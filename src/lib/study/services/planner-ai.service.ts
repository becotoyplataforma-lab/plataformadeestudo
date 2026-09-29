/**
 * ConcursoAI — PlannerAiService
 *
 * Serviço de personalização do cronograma de estudos com IA (DeepSeek).
 *
 * Arquitetura (FASE 5 + FASE 6D):
 * 1. Motor determinístico calcula prioridades P1–P5 e fatores de desempenho.
 * 2. PlannerAiService constrói contexto estruturado seguro enriquecido com tópicos do edital,
 *    frequência histórica e desempenho por tópico (sem credenciais/secrets).
 * 3. Valida quota e limites de IA via Billing (resolveUserLimits / UsageService).
 * 4. Chama DeepSeek (modelo flash / deepseek-chat) com timeout seguro.
 * 5. Valida a resposta JSON estritamente via schema Zod e regras de domínio:
 *    - Todas as disciplinas devem pertencer ao usuário.
 *    - Se fornecido, topic_id DEVE pertencer à disciplina correspondente no contexto.
 *    - Todas as datas devem pertencer aos dias ativos informados.
 *    - Duração das tarefas entre 5 e 600 minutos (constraint do banco).
 *    - Título obrigatoriamente padronizado com prefixo "Estudar ".
 *    - Soma diária de minutos dentro do limite do aluno.
 * 6. Em caso de qualquer falha (sem API key, quota excedida, timeout, erro HTTP,
 *    resposta inválida, topic_id inexistente), aciona fallback para o gerador determinístico seguro.
 * 7. Registra consumo de tokens em ai_usage e emite telemetria padronizada:
 *    PLANNER_AI_CALL: OK ou PLANNER_AI_CALL: FALLBACK (sem segredos).
 */
import "server-only";
import { z } from "zod";
import { chatCompletion } from "@/lib/ai/deepseek";
import { resolveUserLimits } from "@/lib/billing/services/limits.resolver";
import { UsageService } from "@/lib/ai/services/usage.service";
import { logger } from "@/lib/observability";
import type { SubjectPriority } from "./adaptive-planner.service";
import type { EnrichedSubjectContext } from "./edital-context.service";

// ============================================================
// Schemas e Tipos
// ============================================================

export const PlannerAiTaskSchema = z.object({
  subject_id: z.string().uuid({ message: "subject_id deve ser um UUID válido" }),
  topic_id: z.string().uuid({ message: "topic_id deve ser um UUID válido" }).optional().nullable(),
  scheduled_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: "scheduled_date deve ser YYYY-MM-DD" }),
  duration_min: z.number().int().min(5).max(600),
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional().nullable(),
});

export const PlannerAiResponseSchema = z.object({
  plan_summary: z.string().max(1000).optional(),
  tasks: z.array(PlannerAiTaskSchema).min(1).max(100),
});

export type PlannerAiTask = z.infer<typeof PlannerAiTaskSchema>;
export type PlannerAiResponse = z.infer<typeof PlannerAiResponseSchema>;

export interface PlannerAiInput {
  userId: string;
  startDate: string; // ISO date (YYYY-MM-DD)
  activeDays: number[]; // e.g. [1, 2, 3, 4, 5]
  dailyMetaMin: number; // e.g. 120
  priorities: SubjectPriority[];
  bancaTarget?: string | null;
  editalContestId?: string | null;
  enrichedSubjects?: EnrichedSubjectContext[];
}

export interface PlannerAiResult {
  tasks: Array<{
    title: string;
    description?: string | null;
    scheduledDate: string;
    durationMin: number;
    studySubjectId: string;
    topicId?: string | null;
  }>;
  summary?: string;
  aiGenerated: boolean;
  tokensIn?: number;
  tokensOut?: number;
}

// ============================================================
// Helpers de Data
// ============================================================

function addDays(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y!, (m ?? 1) - 1, d ?? 1);
}

/** Extrai bloco JSON caso o modelo envolva em markdown ```json ... ``` */
export function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch && fenceMatch[1]) {
    return fenceMatch[1].trim();
  }
  return trimmed;
}

// ============================================================
// Validador e Normalizador de Domínio
// ============================================================

export function validateAndNormalizeAiResponse(
  rawJson: string,
  validSubjectMap: Map<string, string>,
  validDates: Set<string>,
  dailyMetaMin: number,
  validTopicBySubjectMap?: Map<string, Set<string>>
): {
  summary?: string;
  tasks: Array<{
    title: string;
    scheduledDate: string;
    durationMin: number;
    studySubjectId: string;
    description?: string | null;
    topicId?: string | null;
  }>;
} {
  // 1. Extração e Parse do JSON
  const clean = extractJson(rawJson);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(clean);
  } catch (err) {
    throw new Error(
      `JSON_PARSE_ERROR: ${err instanceof Error ? err.message : "JSON inválido"}`
    );
  }

  // 2. Validação estrutural via Zod
  const parsed = PlannerAiResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`SCHEMA_VALIDATION_ERROR: ${details}`);
  }

  const { tasks, plan_summary } = parsed.data;

  // 3. Validação de Domínio e Normalização
  const dailyTotals = new Map<string, number>();
  const normalizedTasks: Array<{
    title: string;
    scheduledDate: string;
    durationMin: number;
    studySubjectId: string;
    description?: string | null;
    topicId?: string | null;
  }> = [];

  for (const t of tasks) {
    // Disciplina deve pertencer ao usuário
    const subjectName = validSubjectMap.get(t.subject_id);
    if (!subjectName) {
      throw new Error(
        `UNKNOWN_SUBJECT_ID: Disciplina ${t.subject_id} não pertence ao usuário`
      );
    }

    // Validação de tópico (FASE 6D): se topic_id for informado, deve pertencer à disciplina
    if (t.topic_id && validTopicBySubjectMap) {
      const allowedTopics = validTopicBySubjectMap.get(t.subject_id);
      if (!allowedTopics || !allowedTopics.has(t.topic_id)) {
        throw new Error(
          `UNKNOWN_TOPIC_ID: Tópico ${t.topic_id} não pertence à disciplina ${t.subject_id}`
        );
      }
    }

    // Data deve ser um dos dias ativos
    if (!validDates.has(t.scheduled_date)) {
      throw new Error(
        `INVALID_SCHEDULED_DATE: Data ${t.scheduled_date} não pertence aos dias ativos informados`
      );
    }

    // Duração (5-600 min)
    if (t.duration_min < 5 || t.duration_min > 600) {
      throw new Error(
        `INVALID_DURATION: Duração de ${t.duration_min} min fora da faixa permitida (5-600)`
      );
    }

    // Título normalizado para iniciar com "Estudar "
    let title = t.title.trim();
    if (!title.startsWith("Estudar ")) {
      title = `Estudar ${subjectName}: ${title}`;
    }

    // Acumula minutos do dia
    const currentTotal = (dailyTotals.get(t.scheduled_date) ?? 0) + t.duration_min;
    dailyTotals.set(t.scheduled_date, currentTotal);

    normalizedTasks.push({
      title,
      scheduledDate: t.scheduled_date,
      durationMin: t.duration_min,
      studySubjectId: t.subject_id,
      description: t.description ?? null,
      topicId: t.topic_id ?? null,
    });
  }

  // Teto diário de segurança (não permite alocação surreal que viole a meta do aluno)
  const maxAllowedDaily = Math.max(dailyMetaMin * 3, 480);
  for (const [date, total] of dailyTotals.entries()) {
    if (total > maxAllowedDaily) {
      throw new Error(
        `DAILY_LIMIT_EXCEEDED: Data ${date} soma ${total} min (máximo permitido: ${maxAllowedDaily} min)`
      );
    }
  }

  return {
    summary: plan_summary,
    tasks: normalizedTasks,
  };
}

// ============================================================
// System Prompt
// ============================================================

const PLANNER_SYSTEM_PROMPT = `Você é o Assistente Especialista de Planejamento de Estudos do ConcursoAI.
Sua missão é gerar um plano semanal de estudos personalizado em JSON, distribuindo sessões de estudo entre as disciplinas do aluno com base no desempenho real e nas prioridades P1 a P5 calculadas deterministicamente pelo sistema.

REGRAS RÍGIDAS DE SAÍDA:
1. Responda ESTRITAMENTE com um único objeto JSON válido, sem texto antes ou depois.
2. O formato esperado é:
{
  "plan_summary": "Breve justificativa pedagógica do plano gerado (máx. 200 caracteres)",
  "tasks": [
    {
      "subject_id": "<UUID exato da matéria fornecida>",
      "topic_id": "<UUID do tópico contido na lista de tópicos da matéria, ou null/omitido se geral>",
      "scheduled_date": "<Data YYYY-MM-DD contida em active_dates>",
      "duration_min": <minutos inteiros entre 15 e 180>,
      "title": "Estudar <Nome da Matéria>: <Tópico ou Atividade Específica>",
      "description": "<Instrução pedagógica ou foco da sessão>"
    }
  ]
}

REGRAS DE INTEGRIDADE:
- O campo "subject_id" DEVE ser obrigatoriamente um dos UUIDs presentes na lista de matérias fornecida. NUNCA invente disciplinas ou IDs.
- O campo "topic_id" (opcional) DEVE OBRIGATORIAMENTE corresponder a um dos "topic_id" fornecidos dentro da lista de tópicos da respectiva disciplina. NUNCA invente tópicos ou IDs. Se a disciplina não tiver tópicos ou a sessão for de revisão geral, defina "topic_id" como null ou omita.
- O campo "scheduled_date" DEVE ser obrigatoriamente uma das datas presentes em "active_dates".
- O campo "title" DEVE OBRIGATORIAMENTE começar com o prefixo "Estudar " seguido do nome da matéria (ex.: "Estudar Português: Interpretação de Texto").
- "duration_min" deve respeitar a disponibilidade diária do aluno (daily_meta_min).
- DISTRIBUIÇÃO PEDAGÓGICA:
  * Disciplinas são a unidade principal do plano. Prioridades 5 e 4 (pontos fracos, baixa taxa de acerto): sessões mais longas ou frequentes, foco em teoria essencial e muitas questões comentadas. Dê preferência aos tópicos de menor accuracy_pct e maior historical_frequency_percent.
  * Prioridades 1 e 2 (matérias dominadas ou alto acerto): sessões de manutenção rápida, revisão espaçada e flashcards.
  * Prioridade 3: equilíbrio entre conteúdo e prática.
- Para cada dia ativo, programe sessões para as disciplinas ativas, gerando exatamente 1 tarefa por disciplina para cada dia ativo informado (total de [disciplinas × dias ativos] tarefas).`;

// ============================================================
// Telemetria Segura (sem secrets)
// ============================================================

function logSuccess(model: string, tokensIn: number, tokensOut: number, taskCount: number) {
  logger.info("planner-ai", "PLANNER_AI_CALL: OK", {
    model,
    tokensIn,
    tokensOut,
    taskCount,
  });
  console.log(
    `[PLANNER_AI] PLANNER_AI_CALL: OK (model: ${model}, tokens_in: ${tokensIn}, tokens_out: ${tokensOut}, tasks: ${taskCount})`
  );
}

function logFallback(reason: string) {
  logger.warn("planner-ai", "PLANNER_AI_CALL: FALLBACK", { reason });
  console.log(`[PLANNER_AI] PLANNER_AI_CALL: FALLBACK (${reason})`);
}

// ============================================================
// Service Principal
// ============================================================

export const PlannerAiService = {
  /**
   * Gera um plano de estudos personalizado via DeepSeek com fallback seguro.
   * Retorna null caso ocorra qualquer erro ou limite excedido, permitindo
   * que o caller utilize o plano determinístico sem interromper o usuário.
   */
  async generatePersonalizedPlan(
    input: PlannerAiInput
  ): Promise<PlannerAiResult | null> {
    const {
      userId,
      startDate,
      activeDays,
      dailyMetaMin,
      priorities,
      bancaTarget,
      editalContestId,
      enrichedSubjects,
    } = input;

    // 0. Validações preliminares
    if (!priorities || priorities.length === 0 || !activeDays || activeDays.length === 0) {
      logFallback("no_subjects_or_active_days");
      return null;
    }

    // 1. Verificação de chave de API
    const apiKey = process.env.DEEPSEEK_API_KEY?.trim();
    if (!apiKey) {
      logFallback("missing_api_key");
      return null;
    }

    // 2. Verificação de quota e limites de IA (OPEN-004)
    try {
      const limits = await resolveUserLimits(userId);
      const usageCheck = await UsageService.checkLimit(userId, {
        maxMessages: limits.maxMessages,
        maxTokens: limits.maxTokens,
      });

      if (!usageCheck.canSend) {
        logFallback("quota_exceeded");
        return null;
      }
    } catch (err) {
      logFallback(
        `limits_resolution_failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }

    // 3. Montagem das datas ativas e mapas de validação
    const start = parseISODate(startDate);
    const activeDates = activeDays.map((offset) => toISODate(addDays(start, offset)));
    const validDates = new Set(activeDates);
    const validSubjectMap = new Map<string, string>(
      priorities.map((p) => [p.subjectId, p.subjectName])
    );

    // Mapeamento de tópicos enriquecidos por disciplina (FASE 6D)
    const enrichedSubjectMap = new Map<string, EnrichedSubjectContext>();
    const enrichedByNameMap = new Map<string, EnrichedSubjectContext>();
    if (enrichedSubjects) {
      for (const es of enrichedSubjects) {
        enrichedSubjectMap.set(es.subjectId, es);
        enrichedByNameMap.set(es.subjectName.toLowerCase().trim(), es);
      }
    }

    const validTopicBySubjectMap = new Map<string, Set<string>>();
    for (const p of priorities) {
      const enriched =
        enrichedSubjectMap.get(p.subjectId) ??
        (p.knowledgeSubjectName
          ? enrichedByNameMap.get(p.knowledgeSubjectName.toLowerCase().trim())
          : undefined) ??
        enrichedByNameMap.get(p.subjectName.toLowerCase().trim());

      const topicSet = new Set<string>();
      if (enriched?.topics) {
        for (const t of enriched.topics) {
          if (t.topicId) topicSet.add(t.topicId);
          if (t.noticeTopicId) topicSet.add(t.noticeTopicId);
          if (t.knowledgeTopicId) topicSet.add(t.knowledgeTopicId);
        }
      }
      validTopicBySubjectMap.set(p.subjectId, topicSet);
    }

    // 4. Montagem do payload seguro para o DeepSeek (sem secrets, sem senhas, sem DB URL)
    const structuredContext = {
      student_profile: {
        daily_meta_min: dailyMetaMin,
        active_days_count: activeDays.length,
        active_dates: activeDates,
        banca_target: bancaTarget ?? null,
        edital_contest_id: editalContestId ?? null,
      },
      subjects: priorities.map((p) => {
        const enriched =
          enrichedSubjectMap.get(p.subjectId) ??
          (p.knowledgeSubjectName
            ? enrichedByNameMap.get(p.knowledgeSubjectName.toLowerCase().trim())
            : undefined) ??
          enrichedByNameMap.get(p.subjectName.toLowerCase().trim());

        const topics = (enriched?.topics ?? []).map((t) => ({
          topic_id: t.topicId,
          topic_name: t.topicName,
          edital_topic_weight: t.editalTopicWeight,
          historical_frequency_percent: t.historicalFrequencyPercent,
          frequency_source: t.frequencySource,
          total_questions: t.totalQuestions,
          attempted_questions: t.attemptedQuestions,
          accuracy_pct: t.accuracyPct,
          trend: t.trend,
        }));

        return {
          subject_id: p.subjectId,
          subject_name: p.subjectName,
          priority: p.priority,
          accuracy_pct: p.factors.accuracyPct,
          total_questions: p.factors.totalQuestions,
          trend: p.factors.trend,
          days_since_last_task: p.factors.daysSinceLastTask,
          edital_weight: p.factors.editalWeight,
          topics,
        };
      }),
    };

    const userMessage = JSON.stringify(structuredContext, null, 2);

    // 5. Chamada ao DeepSeek com timeout seguro (25 segundos)
    let rawContent = "";
    let tokensIn = 0;
    let tokensOut = 0;
    const model = "flash";

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25_000);

    try {
      const result = await chatCompletion(
        {
          model,
          messages: [
            { role: "system", content: PLANNER_SYSTEM_PROMPT },
            { role: "user", content: userMessage },
          ],
          temperature: 0.3,
          maxTokens: 3500,
        },
        controller.signal
      );
      clearTimeout(timeoutId);

      rawContent = result.content;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isAbort =
        (err instanceof Error && err.name === "AbortError") || controller.signal.aborted;
      if (isAbort) {
        logFallback("timeout");
      } else {
        logFallback(
          `provider_error: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      return null;
    }

    // 6. Validação e normalização da resposta do modelo
    let normalized: ReturnType<typeof validateAndNormalizeAiResponse>;
    try {
      normalized = validateAndNormalizeAiResponse(
        rawContent,
        validSubjectMap,
        validDates,
        dailyMetaMin,
        validTopicBySubjectMap
      );
    } catch (err) {
      logFallback(
        `validation_failed: ${err instanceof Error ? err.message : String(err)}`
      );
      return null;
    }

    // 7. Registro de consumo de IA no domínio Billing/AI (OPEN-004)
    try {
      await UsageService.record(userId, tokensIn, tokensOut);
    } catch (err) {
      logger.warn("planner-ai", "Falha ao registrar uso diário de tokens", {
        userId,
        error: err instanceof Error ? err.message : String(err),
      });
    }

    // 8. Sucesso — log seguro e retorno do plano validado
    logSuccess(model, tokensIn, tokensOut, normalized.tasks.length);

    return {
      tasks: normalized.tasks,
      summary: normalized.summary,
      aiGenerated: true,
      tokensIn,
      tokensOut,
    };
  },
};
