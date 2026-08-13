/**
 * ConcursoAI — AdaptivePlannerService
 *
 * Planejador adaptativo: calcula prioridade das disciplinas com base em
 * desempenho real e gera o cronograma semanal automaticamente.
 *
 * Algoritmo 100% determinístico — sem chamadas de IA.
 * Zero-migration: não altera schema.
 *
 * Fluxo:
 *   question_attempts → AggregationService → LinkResolver →
 *   calculatePriority() → StudySubjectRepository.update() →
 *   generateWeekPlan() → StudyTaskRepository.replacePendingPlan()
 *   (remove pendentes antigas e insere as novas em transação — sem duplicar)
 */
import "server-only";
import { AggregationService, type SubjectPerformance } from "@/lib/analytics/services/aggregation.service";
import { AggregationRepository } from "@/lib/analytics/repositories/aggregation.repository";
import { StudySubjectRepository } from "../repositories/study-subject.repository";
import { StudyTaskRepository } from "../repositories/study-task.repository";
import { LinkResolverService, type LinkResult } from "./link-resolver.service";

// ============================================================
// Tipos
// ============================================================

export interface SubjectPriority {
  subjectId: string;
  subjectName: string;
  knowledgeSubjectName: string | null;
  linkMethod: "exact" | "slug" | "none";
  /** Prioridade calculada (1-5) */
  priority: number;
  /** Dados de desempenho (null se sem vínculo) */
  performance: SubjectPerformance | null;
  /** Fatores que influenciaram a prioridade */
  factors: PriorityFactors;
}

export interface PriorityFactors {
  accuracyPct: number | null;
  totalQuestions: number;
  trend: "up" | "down" | "stable";
  daysSinceLastTask: number;
  accuracyScore: number;
  volumeScore: number;
  trendScore: number;
  idleScore: number;
  /** Contexto de banca (Grupo C) — null/0 quando não há banca alvo (equivale ao Grupo B). */
  bancaTarget: string | null;
  bancaRelevance: number | null;
  bancaScore: number;
  /** Contexto de edital (Grupo D) — null/0 quando não há edital vigente (equivale ao Grupo C). */
  editalContestId: string | null;
  /** Peso bruto da matéria no edital vigente (null = matéria sem notice_subject). */
  editalWeight: number | null;
  /** Share normalizado no escopo (weight/soma) — null quando neutro. */
  editalShare: number | null;
  /** Fator aditivo -1..+1 (0 = neutro). */
  editalScore: number;
}

/** Contexto de banca para o cálculo de prioridade (Grupo C). */
export interface BancaContext {
  target: string | null;
  relevance: number | null;
}

/** Contexto de edital para o cálculo de prioridade (Grupo D). */
export interface EditalContext {
  contestId: string;
  positionId: string | null;
  /** Peso bruto por knowledge_subject_id do escopo vigente. */
  weights: Map<string, number>;
  /** Soma dos pesos do escopo (normalização do share). */
  totalWeight: number;
}

/** Fator de edital resolvido por matéria (neutro quando score = 0). */
export interface EditalFactor {
  contestId: string | null;
  weight: number | null;
  share: number | null;
  score: number;
}

export interface WeekPlanResult {
  tasksCreated: number;
  tasks: Array<{
    title: string;
    scheduledDate: string;
    durationMin: number;
    studySubjectId: string;
  }>;
  priorities: SubjectPriority[];
}

export interface GenerateInput {
  userId: string;
  startDate: string; // ISO date (YYYY-MM-DD)
  /** Opcional: dias da semana para planejar (0=Dom, 6=Sáb). Default: 1-5 (seg-sex) */
  activeDays?: number[];
}

// ============================================================
// Helpers
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

// ============================================================
// Algoritmo de prioridade (determinístico)
// ============================================================

const DEFAULT_PERFORMANCE: SubjectPerformance = {
  subjectId: "",
  subjectName: "",
  total: 0,
  correct: 0,
  accuracyPct: 0,
};

function calculatePriority(
  perf: SubjectPerformance | null,
  daysSinceLastTask: number,
  banca: BancaContext = { target: null, relevance: null },
  edital: EditalFactor | null = null
): { priority: number; factors: PriorityFactors } {
  const p = perf ?? { ...DEFAULT_PERFORMANCE };

  // 1. Taxa de acerto: quanto menor, maior a prioridade (peso 50%)
  const accuracyPct = p.total > 0 ? p.accuracyPct : null;
  const accuracyScore = accuracyPct !== null
    ? (1 - accuracyPct / 100) * 5  // 0% → 5, 100% → 0
    : 3; // sem dados → neutro

  // 2. Volume de questões: poucas respondidas = prioridade (peso 30%)
  const volumeScore = Math.max(0, (1 - Math.min(p.total, 50) / 50)) * 3;

  // 3. Tempo sem estudar (peso 15%)
  const idleScore = Math.min(daysSinceLastTask / 2, 2);

  // 4. Tendência: calculada como estável por padrão (peso 5%)
  //    (trend real será calculada no recalculatePriorities com dados de evolução)
  const trendScore = 0.5; // neutro — será sobrescrito no recalculatePriorities

  // Peso composto — MESMOS pesos do Grupo B (não rebalanceados)
  const raw = accuracyScore * 0.50 + volumeScore * 0.30 + idleScore * 0.15 + trendScore * 0.05;

  // 5. Fator banca (Grupo C) — ADITIVO, não altera os pesos acima.
  //    Sem banca alvo (ou sem dados) → 0 → resultado idêntico ao Grupo B.
  const bancaScore =
    banca.target && banca.relevance !== null
      ? (banca.relevance - 0.5) * 2 // relevância 0..1 → ajuste -1..+1
      : 0;

  // 6. Fator edital (Grupo D) — ADITIVO. Neutro (0) quando não há edital
  //    vigente, matéria sem notice_subject ou weight = 0 → Grupo C idêntico.
  const editalScore = edital?.score ?? 0;

  // Arredonda para 1-5
  const priority = Math.max(
    1,
    Math.min(5, Math.round(raw + bancaScore + editalScore))
  );

  return {
    priority,
    factors: {
      accuracyPct,
      totalQuestions: p.total,
      trend: "stable",
      daysSinceLastTask,
      accuracyScore: Math.round(accuracyScore * 10) / 10,
      volumeScore: Math.round(volumeScore * 10) / 10,
      trendScore: Math.round(trendScore * 10) / 10,
      idleScore: Math.round(idleScore * 10) / 10,
      bancaTarget: banca.target ?? null,
      bancaRelevance:
        banca.relevance !== null ? Math.round(banca.relevance * 100) / 100 : null,
      bancaScore: Math.round(bancaScore * 100) / 100,
      editalContestId: edital?.contestId ?? null,
      editalWeight: edital?.weight ?? null,
      editalShare: edital?.share ?? null,
      editalScore: Math.round(editalScore * 100) / 100,
    },
  };
}

/**
 * Relevância da matéria para a banca alvo (0..1):
 * share no catálogo (provas anteriores, 60%) + share nas tentativas do usuário (40%).
 * Retorna null quando não há banca alvo ou quando não há dados (neutro).
 */
function computeBancaRelevance(
  target: string | null,
  perf: SubjectPerformance | null,
  catalog: { total: number; byBanca: Record<string, number> } | null
): number | null {
  if (!target) return null;

  let attemptShare: number | null = null;
  if (perf && perf.total > 0) {
    attemptShare = (perf.byBanca?.[target]?.total ?? 0) / perf.total;
  }

  let catalogShare: number | null = null;
  if (catalog && catalog.total > 0) {
    catalogShare = (catalog.byBanca[target] ?? 0) / catalog.total;
  }

  if (attemptShare === null && catalogShare === null) return null;
  if (attemptShare === null) return catalogShare;
  if (catalogShare === null) return attemptShare;
  return 0.6 * catalogShare + 0.4 * attemptShare;
}

/**
 * Resolve o fator de edital por matéria (Grupo D).
 * Regras:
 *  - sem edital vigente/contest → neutro (score 0);
 *  - matéria sem notice_subject no escopo → neutro;
 *  - weight = 0 → neutro (NÃO penaliza — NUNCA (0-0.5)*2);
 *  - weight > 0 → share = weight/soma(escopo); score = clamp((share-0.5)*2, -1, 1).
 */
function computeEditalFactor(
  context: EditalContext | null,
  knowledgeSubjectId: string | null
): EditalFactor {
  const base: EditalFactor = {
    contestId: context?.contestId ?? null,
    weight: null,
    share: null,
    score: 0,
  };
  if (!context || !knowledgeSubjectId) return base;

  const weight = context.weights.get(knowledgeSubjectId);
  if (weight === undefined || weight === 0) {
    return {
      ...base,
      weight: weight ?? null,
      share: weight === 0 ? 0 : null,
      score: 0,
    };
  }

  const share = weight / context.totalWeight;
  const score = Math.max(-1, Math.min(1, (share - 0.5) * 2));
  return {
    ...base,
    weight,
    share: Math.round(share * 100) / 100,
    score: Math.round(score * 100) / 100,
  };
}

/** Calcula tendência comparando accuracy dos últimos 7 dias vs 7-14 dias atrás. */
async function calculateTrend(
  userId: string,
  link: LinkResult
): Promise<"up" | "down" | "stable"> {
  if (!link.knowledgeSubject) return "stable";

  const now = new Date();
  const recentStart = addDays(now, -7);
  const olderStart = addDays(now, -14);
  const olderEnd = addDays(now, -7);

  try {
    const [recent, older] = await Promise.all([
      AggregationRepository.listAttemptsBySubjectWindow(
        userId,
        link.knowledgeSubject.id,
        recentStart
      ),
      AggregationRepository.listAttemptsBySubjectWindow(
        userId,
        link.knowledgeSubject.id,
        olderStart,
        olderEnd
      ),
    ]);

    const recentAcc = recent.total > 0 ? (recent.correct / recent.total) * 100 : null;
    const olderAcc = older.total > 0 ? (older.correct / older.total) * 100 : null;

    if (recentAcc === null || olderAcc === null) return "stable";
    if (recentAcc < olderAcc - 5) return "down";
    if (recentAcc > olderAcc + 5) return "up";
    return "stable";
  } catch {
    return "stable";
  }
}

/** Dias desde a última tarefa concluída da disciplina. */
async function daysSinceLastStudyTask(userId: string, subjectId: string): Promise<number> {
  try {
    const tasks = await AggregationRepository.listTasks(userId);
    const subjectTasks = tasks
      .filter((t) => t.status === "concluida" && t.completedAt)
      .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

    // Simplificado: conta dias desde a última tarefa concluída geral
    if (subjectTasks.length === 0) return 999;
    const lastTask = subjectTasks[0]!.completedAt!;
    const diffMs = Date.now() - lastTask.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  } catch {
    return 999;
  }
}

// ============================================================
// Service
// ============================================================

export const AdaptivePlannerService = {
  /**
   * Recalcula prioridades de todas as disciplinas do usuário.
   * Atualiza study_subjects.priority no banco.
   */
  async recalculatePriorities(userId: string): Promise<SubjectPriority[]> {
    // 1. Listar disciplinas do aluno
    const subjects = await StudySubjectRepository.listByUser(userId);
    if (subjects.length === 0) return [];

    // 2. Resolver vínculo com knowledge_subjects em lote
    const names = subjects.map((s) => s.name);
    const links = await LinkResolverService.resolveBatch(names);

    // 3. Buscar desempenho por matéria
    const performance = await AggregationService.getPerformanceBySubject(userId);
    const perfByKnowledgeId = new Map(
      performance.map((p) => [p.subjectId, p])
    );

    // 4. Contexto de banca (Grupo C): banca alvo + volume do catálogo por matéria/banca
    const profile = await AggregationRepository.getProfileMeta(userId);
    const bancaTarget = profile?.bancaPreferida ?? null;
    const catalogRows = await AggregationRepository.countCatalogBySubjectBanca();
    const catalogBySubject = new Map<
      string,
      { total: number; byBanca: Record<string, number> }
    >();
    for (const c of catalogRows) {
      const entry = catalogBySubject.get(c.subjectId) ?? { total: 0, byBanca: {} };
      entry.total += c.total;
      if (c.banca) entry.byBanca[c.banca] = (entry.byBanca[c.banca] ?? 0) + c.total;
      catalogBySubject.set(c.subjectId, entry);
    }

    // 4b. Contexto de edital (Grupo D): edital vigente + pesos por matéria.
    const editalCtx = await AggregationRepository.getEditalContext(userId);
    const editalContext: EditalContext | null = editalCtx
      ? {
          contestId: editalCtx.contestId,
          positionId: editalCtx.positionId,
          weights: new Map(
            editalCtx.rows.map((r) => [r.knowledgeSubjectId, r.weight])
          ),
          totalWeight: editalCtx.rows.reduce((acc, r) => acc + r.weight, 0),
        }
      : null;

    // 5. Calcular prioridade para cada disciplina
    const results: SubjectPriority[] = [];

    for (const subject of subjects) {
      const link = links.get(subject.name) ?? {
        knowledgeSubject: null,
        method: "none" as const,
      };

      // Encontrar performance vinculada
      const perf = link.knowledgeSubject
        ? (perfByKnowledgeId.get(link.knowledgeSubject.id) ?? null)
        : null;

      const idle = await daysSinceLastStudyTask(userId, subject.id);
      const bancaRelevance = link.knowledgeSubject
        ? computeBancaRelevance(
            bancaTarget,
            perf,
            catalogBySubject.get(link.knowledgeSubject.id) ?? null
          )
        : null;
      const banca = { target: bancaTarget, relevance: bancaRelevance };
      const editalFactor = computeEditalFactor(
        editalContext,
        link.knowledgeSubject?.id ?? null
      );
      const { priority, factors } = calculatePriority(perf, idle, banca, editalFactor);

      // Tendência real
      const trend = await calculateTrend(userId, link);
      factors.trend = trend;

      // Recalcular com tendência real
      const { priority: finalPriority } = calculatePriority(
        perf,
        idle,
        banca,
        editalFactor
      );
      // Ajusta para incorporar tendência
      let adjustedPriority = finalPriority;
      if (trend === "down") adjustedPriority = Math.min(5, adjustedPriority + 1);
      if (trend === "up" && adjustedPriority > 1) adjustedPriority = Math.max(1, adjustedPriority - 1);

      // 6. Atualizar prioridade no banco
      await StudySubjectRepository.update(subject.id, userId, {
        priority: adjustedPriority,
      });

      results.push({
        subjectId: subject.id,
        subjectName: subject.name,
        knowledgeSubjectName: link.knowledgeSubject?.name ?? null,
        linkMethod: link.method,
        priority: adjustedPriority,
        performance: perf,
        factors,
      });
    }

    return results;
  },

  /**
   * Gera o plano semanal: distribui tarefas nos dias ativos com base nas
   * prioridades recalculadas e na meta diária do usuário.
   */
  async generateWeekPlan(input: GenerateInput): Promise<WeekPlanResult> {
    const { userId, startDate, activeDays = [1, 2, 3, 4, 5] } = input;

    // 1. Recalcular prioridades
    const priorities = await this.recalculatePriorities(userId);

    // 2. Buscar meta diária
    const profile = await AggregationRepository.getProfileMeta(userId);
    const dailyMetaMin = profile?.metaDiariaMin ?? 120;

    // 3. Ordenar por prioridade (maior primeiro)
    const sorted = [...priorities].sort((a, b) => b.priority - a.priority);

    // 4. Distribuir carga horária
    // Prioridade 5 = 40% do tempo, 4 = 25%, 3 = 15%, 2 = 10%, 1 = 5%
    const totalWeight = sorted.reduce((acc, s) => acc + s.priority, 0);
    const allocation = new Map<string, number>();
    for (const s of sorted) {
      const pct = totalWeight > 0 ? s.priority / totalWeight : 0;
      // Minutos por dia * dias ativos * percentual
      const weekMinutes = Math.round(dailyMetaMin * activeDays.length * pct);
      allocation.set(s.subjectId, weekMinutes);
    }

    // 5. Gerar tarefas para cada dia ativo
    const start = parseISODate(startDate);
    const tasks: Array<{
      title: string;
      scheduledDate: string;
      durationMin: number;
      studySubjectId: string;
    }> = [];

    for (const s of sorted) {
      const weekMin = allocation.get(s.subjectId) ?? 0;
      if (weekMin < 15) continue; // mínimo 15min/semana

      // Distribuir igualmente entre os dias ativos
      const perDay = Math.round(weekMin / activeDays.length);

      for (const dayOffset of activeDays) {
        const taskDate = addDays(start, dayOffset);
        tasks.push({
          title: `Estudar ${s.subjectName}`,
          scheduledDate: toISODate(taskDate),
          durationMin: perDay,
          studySubjectId: s.subjectId,
        });
      }
    }

    // 6. Persistir tarefas — SUBSTITUI o plano atual (remove pendentes antigas,
    //    preserva concluídas) em uma transação atômica. Replanejar NÃO acumula
    //    tarefas: 25 → 25, nunca 50.
    if (tasks.length > 0) {
      const rows = tasks.map((t) => ({
        userId,
        studySubjectId: t.studySubjectId,
        title: t.title,
        scheduledDate: new Date(t.scheduledDate + "T12:00:00Z"),
        durationMin: t.durationMin,
        status: "pendente" as const,
      }));
      await StudyTaskRepository.replacePendingPlan(userId, rows);
    }

    return { tasksCreated: tasks.length, tasks, priorities };
  },
};
