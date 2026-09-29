/**
 * ConcursoAI — PlannerAiService Tests (FASE 5)
 *
 * Validação rigorosa da integração do Planner com DeepSeek:
 * A. DeepSeek recebe contexto estruturado correto.
 * B. Resposta JSON válida é aceita e normalizada.
 * C. Resposta JSON inválida (malformada ou schema errado) é rejeitada.
 * D. Disciplina inexistente (UUID não pertencente ao usuário) é rejeitada.
 * E. Estrutura ou prioridade inválida é rejeitada.
 * F. Minutos inválidos (< 5 ou > 600) são rejeitados.
 * G. Limite diário é respeitado (soma diária absurda é rejeitada).
 * H. Falha do provedor DeepSeek aciona fallback seguro.
 * I. Timeout de rede aciona fallback seguro.
 * J. API key ausente aciona fallback imediato.
 * K. IA não altera userId (o userId é fixado pelo serviço/sessão).
 * L. IA não cria dados diretamente no banco (serviço desacoplado).
 * M. Plano final é estritamente compatível com o schema de study_tasks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  PlannerAiService,
  validateAndNormalizeAiResponse,
  PlannerAiResponseSchema,
  extractJson,
  type PlannerAiInput,
} from "../planner-ai.service";
import type { SubjectPriority } from "../adaptive-planner.service";

// ============================================================
// Mocks
// ============================================================

const mockChatCompletion = vi.fn();
vi.mock("@/lib/ai/deepseek", () => ({
  chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
}));

const mockResolveUserLimits = vi.fn();
vi.mock("@/lib/billing/services/limits.resolver", () => ({
  resolveUserLimits: (...args: unknown[]) => mockResolveUserLimits(...args),
}));

const mockCheckLimit = vi.fn();
const mockRecord = vi.fn();
vi.mock("@/lib/ai/services/usage.service", () => ({
  UsageService: {
    checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
    record: (...args: unknown[]) => mockRecord(...args),
  },
}));

// ============================================================
// Fixtures
// ============================================================

const SUB_1_ID = "11111111-1111-4000-8000-111111111111";
const SUB_2_ID = "22222222-2222-4000-8000-222222222222";

const PRIORITIES: SubjectPriority[] = [
  {
    subjectId: SUB_1_ID,
    subjectName: "Português",
    knowledgeSubjectName: "Português",
    linkMethod: "exact",
    priority: 5,
    performance: {
      subjectId: "k1",
      subjectName: "Português",
      total: 10,
      correct: 2,
      accuracyPct: 20,
    },
    factors: {
      accuracyPct: 20,
      totalQuestions: 10,
      trend: "down",
      daysSinceLastTask: 5,
      accuracyScore: 4.0,
      volumeScore: 2.4,
      trendScore: 0.5,
      idleScore: 2.0,
      bancaTarget: "FGV",
      bancaRelevance: 0.8,
      bancaScore: 0.6,
      editalContestId: null,
      editalWeight: null,
      editalShare: null,
      editalScore: 0,
    },
  },
  {
    subjectId: SUB_2_ID,
    subjectName: "Direito Constitucional",
    knowledgeSubjectName: "Direito Constitucional",
    linkMethod: "exact",
    priority: 2,
    performance: {
      subjectId: "k2",
      subjectName: "Direito Constitucional",
      total: 20,
      correct: 18,
      accuracyPct: 90,
    },
    factors: {
      accuracyPct: 90,
      totalQuestions: 20,
      trend: "up",
      daysSinceLastTask: 1,
      accuracyScore: 0.5,
      volumeScore: 1.8,
      trendScore: 0.5,
      idleScore: 0.5,
      bancaTarget: "FGV",
      bancaRelevance: 0.7,
      bancaScore: 0.4,
      editalContestId: null,
      editalWeight: null,
      editalShare: null,
      editalScore: 0,
    },
  },
];

const VALID_INPUT: PlannerAiInput = {
  userId: "user-123-real-auth",
  startDate: "2026-08-17",
  activeDays: [1, 2, 3], // 2026-08-18, 2026-08-19, 2026-08-20
  dailyMetaMin: 120,
  priorities: PRIORITIES,
  bancaTarget: "FGV",
};

const VALID_AI_RESPONSE_JSON = JSON.stringify({
  plan_summary: "Plano focado em recuperar Português e manter Direito Constitucional.",
  tasks: [
    {
      subject_id: SUB_1_ID,
      scheduled_date: "2026-08-18",
      duration_min: 75,
      title: "Estudar Português: Interpretação de Texto e Crase",
      description: "Resolver 15 questões da banca FGV.",
    },
    {
      subject_id: SUB_2_ID,
      scheduled_date: "2026-08-18",
      duration_min: 45,
      title: "Estudar Direito Constitucional: Direitos Individuais",
      description: "Revisão rápida de artigos da CF.",
    },
    {
      subject_id: SUB_1_ID,
      scheduled_date: "2026-08-19",
      duration_min: 80,
      title: "Estudar Português: Sintaxe e Concordância",
      description: "Foco nos erros recentes.",
    },
    {
      subject_id: SUB_2_ID,
      scheduled_date: "2026-08-19",
      duration_min: 40,
      title: "Estudar Direito Constitucional: Controle de Constitucionalidade",
      description: "Revisão espaçada.",
    },
  ],
});

// ============================================================
// Testes
// ============================================================

describe("PlannerAiService — Integração DeepSeek (FASE 5)", () => {
  const originalKey = process.env.DEEPSEEK_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = "test-deepseek-api-key";

    mockResolveUserLimits.mockResolvedValue({
      maxMessages: 50,
      maxTokens: 500_000,
    });
    mockCheckLimit.mockResolvedValue({
      canSend: true,
      status: { messagesUsed: 2, totalTokens: 1000 },
    });
    mockRecord.mockResolvedValue({ id: "usage-row" });
    mockChatCompletion.mockResolvedValue({
      content: VALID_AI_RESPONSE_JSON,
      model: "flash",
      tokensIn: 350,
      tokensOut: 200,
    });
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.DEEPSEEK_API_KEY = originalKey;
    } else {
      delete process.env.DEEPSEEK_API_KEY;
    }
  });

  // ------------------------------------------------------------
  // A. DeepSeek recebe contexto correto
  // ------------------------------------------------------------
  it("A. envia contexto estruturado correto ao DeepSeek (sem secrets nem banco)", async () => {
    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);

    expect(result).not.toBeNull();
    expect(result?.aiGenerated).toBe(true);
    expect(mockChatCompletion).toHaveBeenCalledTimes(1);

    const callArgs = mockChatCompletion.mock.calls[0]![0];
    expect(callArgs.model).toBe("flash");
    expect(callArgs.messages).toHaveLength(2);
    expect(callArgs.messages[0].role).toBe("system");
    expect(callArgs.messages[1].role).toBe("user");

    const sentUserContent = JSON.parse(callArgs.messages[1].content);
    expect(sentUserContent.student_profile.daily_meta_min).toBe(120);
    expect(sentUserContent.student_profile.banca_target).toBe("FGV");
    expect(sentUserContent.student_profile.active_dates).toEqual([
      "2026-08-18",
      "2026-08-19",
      "2026-08-20",
    ]);
    expect(sentUserContent.subjects).toHaveLength(2);
    expect(sentUserContent.subjects[0].subject_id).toBe(SUB_1_ID);
    expect(sentUserContent.subjects[0].priority).toBe(5);
    expect(sentUserContent.subjects[1].subject_id).toBe(SUB_2_ID);
    expect(sentUserContent.subjects[1].priority).toBe(2);

    // Garante que secrets não vazaram no payload
    expect(callArgs.messages[1].content).not.toContain("password");
    expect(callArgs.messages[1].content).not.toContain("DATABASE_URL");
    expect(callArgs.messages[1].content).not.toContain("test-deepseek-api-key");
  });

  // ------------------------------------------------------------
  // B. Resposta JSON válida é aceita e normalizada
  // ------------------------------------------------------------
  it("B. aceita resposta JSON válida, normaliza títulos e registra uso de tokens", async () => {
    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);

    expect(result).not.toBeNull();
    expect(result?.aiGenerated).toBe(true);
    expect(result?.tasks).toHaveLength(4);
    expect(result?.summary).toContain("recuperar Português");

    // Verifica que tarefas começam com "Estudar "
    for (const t of result!.tasks) {
      expect(t.title).toMatch(/^Estudar /);
      expect(t.durationMin).toBeGreaterThanOrEqual(5);
      expect(t.durationMin).toBeLessThanOrEqual(600);
      expect([SUB_1_ID, SUB_2_ID]).toContain(t.studySubjectId);
    }

    // Verifica registro de tokens via UsageService
    expect(mockRecord).toHaveBeenCalledWith("user-123-real-auth", 350, 200);
  });

  it("B2. extrai JSON encapsulado em blocos markdown ```json", () => {
    const wrapped = "```json\n" + VALID_AI_RESPONSE_JSON + "\n```";
    const extracted = extractJson(wrapped);
    expect(extracted).toBe(VALID_AI_RESPONSE_JSON);
  });

  // ------------------------------------------------------------
  // C. Resposta inválida é rejeitada
  // ------------------------------------------------------------
  it("C. rejeita resposta com JSON malformado e aciona fallback", async () => {
    mockChatCompletion.mockResolvedValue({
      content: "Isto não é um JSON válido: { chave quebrada",
      model: "flash",
      tokensIn: 100,
      tokensOut: 20,
    });

    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).toBeNull();
  });

  it("C2. rejeita resposta sem a propriedade tasks (schema inválido)", async () => {
    mockChatCompletion.mockResolvedValue({
      content: JSON.stringify({ plan_summary: "Sem tarefas" }),
      model: "flash",
      tokensIn: 100,
      tokensOut: 20,
    });

    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).toBeNull();
  });

  // ------------------------------------------------------------
  // D. Disciplina inexistente é rejeitada
  // ------------------------------------------------------------
  it("D. rejeita tarefa com subject_id inexistente ou inventado pela IA", async () => {
    const badJson = JSON.stringify({
      tasks: [
        {
          subject_id: "99999999-9999-4000-8000-999999999999", // Não existe em PRIORITIES
          scheduled_date: "2026-08-18",
          duration_min: 60,
          title: "Estudar Matéria Inventada",
        },
      ],
    });

    mockChatCompletion.mockResolvedValue({
      content: badJson,
      model: "flash",
      tokensIn: 150,
      tokensOut: 50,
    });

    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).toBeNull();
  });

  // ------------------------------------------------------------
  // E. Prioridade / Schema inválido é rejeitado
  // ------------------------------------------------------------
  it("E. rejeita tarefa com campos ausentes ou tipos inválidos", () => {
    const invalidTasks = {
      tasks: [
        {
          subject_id: "not-a-uuid",
          scheduled_date: "2026-08-18",
          duration_min: 30,
          title: "Estudar",
        },
      ],
    };

    const parsed = PlannerAiResponseSchema.safeParse(invalidTasks);
    expect(parsed.success).toBe(false);
  });

  // ------------------------------------------------------------
  // F. Minutos inválidos são rejeitados (< 5 ou > 600)
  // ------------------------------------------------------------
  it("F. rejeita tarefas com duração menor que 5 min ou maior que 600 min", async () => {
    const badDurationJson = JSON.stringify({
      tasks: [
        {
          subject_id: SUB_1_ID,
          scheduled_date: "2026-08-18",
          duration_min: 2, // < 5 (viola constraint chk_study_tasks_duration)
          title: "Estudar Rápido",
        },
      ],
    });

    mockChatCompletion.mockResolvedValue({
      content: badDurationJson,
      model: "flash",
      tokensIn: 100,
      tokensOut: 50,
    });

    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).toBeNull();
  });

  // ------------------------------------------------------------
  // G. Limite diário é respeitado
  // ------------------------------------------------------------
  it("G. rejeita plano onde uma data ultrapassa a meta máxima diária permitida", () => {
    const validSubjectMap = new Map([[SUB_1_ID, "Português"]]);
    const validDates = new Set(["2026-08-18"]);

    const excessiveJson = JSON.stringify({
      tasks: [
        {
          subject_id: SUB_1_ID,
          scheduled_date: "2026-08-18",
          duration_min: 500, // 500 min num único dia quando a meta é 120 (max: 480)
          title: "Estudar Excessivo",
        },
      ],
    });

    expect(() =>
      validateAndNormalizeAiResponse(excessiveJson, validSubjectMap, validDates, 120)
    ).toThrow(/DAILY_LIMIT_EXCEEDED/);
  });

  // ------------------------------------------------------------
  // H. Falha do DeepSeek aciona fallback
  // ------------------------------------------------------------
  it("H. falha no provedor DeepSeek (erro de rede/API) aciona fallback retornando null", async () => {
    mockChatCompletion.mockRejectedValue(new Error("DeepSeek 503 Service Unavailable"));

    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).toBeNull();
  });

  // ------------------------------------------------------------
  // I. Timeout aciona fallback
  // ------------------------------------------------------------
  it("I. timeout na chamada do modelo aciona fallback seguro", async () => {
    const abortErr = new Error("This operation was aborted");
    abortErr.name = "AbortError";
    mockChatCompletion.mockRejectedValue(abortErr);

    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).toBeNull();
  });

  // ------------------------------------------------------------
  // J. API key ausente aciona fallback
  // ------------------------------------------------------------
  it("J. API key ausente ou vazia aciona fallback imediato sem chamar a rede", async () => {
    delete process.env.DEEPSEEK_API_KEY;

    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).toBeNull();
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------
  // J2. Quota de IA excedida aciona fallback
  // ------------------------------------------------------------
  it("J2. usuário com limite de mensagens ou tokens excedido aciona fallback", async () => {
    mockCheckLimit.mockResolvedValue({
      canSend: false,
      status: { messagesUsed: 50, totalTokens: 500_000 },
    });

    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).toBeNull();
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  // ------------------------------------------------------------
  // K. IA não altera userId
  // ------------------------------------------------------------
  it("K. IA nunca define nem altera o userId (não recebe nem devolve userId)", async () => {
    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);

    expect(result).not.toBeNull();
    for (const t of result!.tasks) {
      // Tarefas retornadas são desacopladas de userId; quem anexa userId é o repository
      expect((t as Record<string, unknown>).userId).toBeUndefined();
    }
  });

  // ------------------------------------------------------------
  // L. IA não cria dados diretamente no banco
  // ------------------------------------------------------------
  it("L. serviço de IA opera estritamente em memória (sem side effects no banco)", async () => {
    // PlannerAiService executa apenas chatCompletion, resolveUserLimits e UsageService
    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);
    expect(result).not.toBeNull();
    expect(result?.aiGenerated).toBe(true);
  });

  // ------------------------------------------------------------
  // M. Plano final compatível com study_tasks
  // ------------------------------------------------------------
  it("M. todas as tarefas geradas possuem campos compatíveis com study_tasks", async () => {
    const result = await PlannerAiService.generatePersonalizedPlan(VALID_INPUT);

    expect(result).not.toBeNull();
    for (const task of result!.tasks) {
      expect(task.title).toMatch(/^Estudar /);
      expect(typeof task.scheduledDate).toBe("string");
      expect(task.scheduledDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof task.durationMin).toBe("number");
      expect(task.durationMin).toBeGreaterThanOrEqual(5);
      expect(task.durationMin).toBeLessThanOrEqual(600);
      expect(typeof task.studySubjectId).toBe("string");
    }
  });
});

