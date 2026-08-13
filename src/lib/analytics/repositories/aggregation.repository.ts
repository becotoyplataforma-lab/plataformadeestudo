/**
 * ConcursoAI — AggregationRepository (Analytics)
 *
 * Camada de LEITURA do domínio Analytics sobre as tabelas de origem
 * (Study, AI, Identity). O Analytics consome dados dos demais domínios
 * sem depender das entidades internas (docs/05 — dependências).
 *
 * Não escreve nas tabelas de origem — apenas agrega para o dashboard.
 */
import { and, desc, eq, gte, isNull, lt, lte } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  questionAttempts,
  studyTasks,
  reviewSchedules,
  questions,
} from "@/db/schema/study";
import { aiUsage } from "@/db/schema/ai";
import { knowledgeSubjects } from "@/db/schema/knowledge";
import { profiles } from "@/db/schema/identity";

// ============================================================
// Tipos de retorno (formas agregadas do domínio)
// ============================================================

export interface AttemptRow {
  isCorrect: boolean;
  createdAt: Date;
}

export interface SubjectPerfRow {
  subjectId: string;
  subjectName: string;
  total: number;
  correct: number;
}

export interface TaskRow {
  scheduledDate: Date;
  status: "pendente" | "concluida" | "adiada";
  durationMin: number;
  completedAt: Date | null;
}

export interface UsageRow {
  usageDate: Date;
  messagesCount: number;
}

// ============================================================
// Repository
// ============================================================

export const AggregationRepository = {
  /** Tentativas do usuário (opcionalmente desde uma data). */
  async listAttempts(userId: string, since?: Date, limit = 10_000): Promise<AttemptRow[]> {
    const rows = await db
      .select({
        isCorrect: questionAttempts.isCorrect,
        createdAt: questionAttempts.createdAt,
      })
      .from(questionAttempts)
      .where(
        and(
          eq(questionAttempts.userId, userId),
          ...(since ? [gte(questionAttempts.createdAt, since)] : [])
        )
      )
      .orderBy(desc(questionAttempts.createdAt))
      .limit(limit);
    return rows;
  },

  /** Desempenho por matéria (JOIN questions → knowledge_subjects). */
  async listAttemptsBySubject(userId: string, limit = 5000): Promise<SubjectPerfRow[]> {
    const rows = await db
      .select({
        isCorrect: questionAttempts.isCorrect,
        subjectId: questions.knowledgeSubjectId,
        subjectName: knowledgeSubjects.name,
      })
      .from(questionAttempts)
      .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
      .innerJoin(
        knowledgeSubjects,
        eq(questions.knowledgeSubjectId, knowledgeSubjects.id)
      )
      .where(eq(questionAttempts.userId, userId))
      .limit(limit);

    const map = new Map<string, { name: string; total: number; correct: number }>();
    for (const r of rows) {
      const entry = map.get(r.subjectId) ?? {
        name: r.subjectName,
        total: 0,
        correct: 0,
      };
      entry.total++;
      if (r.isCorrect) entry.correct++;
      map.set(r.subjectId, entry);
    }

    return [...map.entries()].map(([subjectId, e]) => ({
      subjectId,
      subjectName: e.name,
      total: e.total,
      correct: e.correct,
    }));
  },

  /** Tarefas do usuário (opcionalmente em intervalo). */
  async listTasks(userId: string, from?: Date, to?: Date): Promise<TaskRow[]> {
    const rows = await db
      .select({
        scheduledDate: studyTasks.scheduledDate,
        status: studyTasks.status,
        durationMin: studyTasks.durationMin,
        completedAt: studyTasks.completedAt,
      })
      .from(studyTasks)
      .where(
        and(
          eq(studyTasks.userId, userId),
          isNull(studyTasks.deletedAt),
          ...(from ? [gte(studyTasks.scheduledDate, from)] : []),
          ...(to ? [lt(studyTasks.scheduledDate, to)] : [])
        )
      )
      .limit(5000);
    return rows;
  },

  /** Revisões com due_date <= data (pendentes). */
  async countReviewsDue(userId: string, date: Date): Promise<number> {
    const rows = await db
      .select({ id: reviewSchedules.id })
      .from(reviewSchedules)
      .where(
        and(
          eq(reviewSchedules.userId, userId),
          lte(reviewSchedules.dueDate, date),
          isNull(reviewSchedules.deletedAt)
        )
      )
      .limit(5000);
    return rows.length;
  },

  /** Uso de IA por dia (ai_usage). */
  async listUsage(userId: string, since?: Date): Promise<UsageRow[]> {
    const rows = await db
      .select({
        usageDate: aiUsage.usageDate,
        messagesCount: aiUsage.messagesCount,
      })
      .from(aiUsage)
      .where(
        and(
          eq(aiUsage.userId, userId),
          ...(since ? [gte(aiUsage.usageDate, since)] : [])
        )
      )
      .orderBy(desc(aiUsage.usageDate))
      .limit(1000);
    return rows;
  },

  /** Datas de atividade para streak: tentativas + tarefas concluídas. */
  async listActivityTimestamps(userId: string, limit = 10_000): Promise<Date[]> {
    const attempts = await db
      .select({ at: questionAttempts.createdAt })
      .from(questionAttempts)
      .where(eq(questionAttempts.userId, userId))
      .limit(limit);

    const tasks = await db
      .select({ at: studyTasks.completedAt })
      .from(studyTasks)
      .where(
        and(
          eq(studyTasks.userId, userId),
          eq(studyTasks.status, "concluida"),
          isNull(studyTasks.deletedAt)
        )
      )
      .limit(limit);

    const dates: Date[] = [];
    for (const a of attempts) dates.push(a.at);
    for (const t of tasks) if (t.at) dates.push(t.at);
    return dates;
  },

  /** Tentativas de um usuário para uma matéria específica em janela temporal. */
  async listAttemptsBySubjectWindow(
    userId: string,
    knowledgeSubjectId: string,
    since: Date,
    before?: Date,
    limit = 5000
  ): Promise<{ total: number; correct: number }> {
    const conditions = [
      eq(questionAttempts.userId, userId),
      eq(questions.knowledgeSubjectId, knowledgeSubjectId),
      gte(questionAttempts.createdAt, since),
    ];
    if (before) conditions.push(lt(questionAttempts.createdAt, before));

    const rows = await db
      .select({ isCorrect: questionAttempts.isCorrect })
      .from(questionAttempts)
      .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
      .where(and(...conditions))
      .limit(limit);

    const total = rows.length;
    const correct = rows.filter((r) => r.isCorrect).length;
    return { total, correct };
  },

  /** Meta diária do usuário (profiles.meta_diaria_min). */
  async getProfileMeta(userId: string) {
    const [row] = await db
      .select({ metaDiariaMin: profiles.metaDiariaMin })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return row ?? null;
  },
};
