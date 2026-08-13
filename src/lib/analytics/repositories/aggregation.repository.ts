/**
 * ConcursoAI — AggregationRepository (Analytics)
 *
 * Camada de LEITURA do domínio Analytics sobre as tabelas de origem
 * (Study, AI, Identity). O Analytics consome dados dos demais domínios
 * sem depender das entidades internas (docs/05 — dependências).
 *
 * Não escreve nas tabelas de origem — apenas agrega para o dashboard.
 */
import { and, count, desc, eq, gte, isNull, lt, lte } from "drizzle-orm";
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
import { editais, noticeSubjects } from "@/db/schema/contest";
import type { SQL } from "drizzle-orm";

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
  /** Total/certo por banca (chave = banca da questão; questões sem banca ficam de fora). */
  byBanca: Record<string, { total: number; correct: number }>;
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

  /** Desempenho por matéria (JOIN questions → knowledge_subjects), com breakdown por banca. */
  async listAttemptsBySubject(userId: string, limit = 5000): Promise<SubjectPerfRow[]> {
    const rows = await db
      .select({
        isCorrect: questionAttempts.isCorrect,
        subjectId: questions.knowledgeSubjectId,
        subjectName: knowledgeSubjects.name,
        banca: questions.banca,
      })
      .from(questionAttempts)
      .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
      .innerJoin(
        knowledgeSubjects,
        eq(questions.knowledgeSubjectId, knowledgeSubjects.id)
      )
      .where(eq(questionAttempts.userId, userId))
      .limit(limit);

    const map = new Map<
      string,
      {
        name: string;
        total: number;
        correct: number;
        byBanca: Record<string, { total: number; correct: number }>;
      }
    >();
    for (const r of rows) {
      const entry = map.get(r.subjectId) ?? {
        name: r.subjectName,
        total: 0,
        correct: 0,
        byBanca: {},
      };
      entry.total++;
      if (r.isCorrect) entry.correct++;
      if (r.banca) {
        const b = entry.byBanca[r.banca] ?? { total: 0, correct: 0 };
        b.total++;
        if (r.isCorrect) b.correct++;
        entry.byBanca[r.banca] = b;
      }
      map.set(r.subjectId, entry);
    }

    return [...map.entries()].map(([subjectId, e]) => ({
      subjectId,
      subjectName: e.name,
      total: e.total,
      correct: e.correct,
      byBanca: e.byBanca,
    }));
  },

  /**
   * Volume do catálogo por matéria × banca (provas anteriores).
   * Questões públicas e publicadas — base para o peso de matérias por banca.
   */
  async countCatalogBySubjectBanca(
    limit = 10_000
  ): Promise<Array<{ subjectId: string; banca: string | null; total: number }>> {
    return db
      .select({
        subjectId: questions.knowledgeSubjectId,
        banca: questions.banca,
        total: count(questions.id),
      })
      .from(questions)
      .where(
        and(
          eq(questions.isPublic, true),
          eq(questions.status, "publicada"),
          isNull(questions.deletedAt)
        )
      )
      .groupBy(questions.knowledgeSubjectId, questions.banca)
      .limit(limit);
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

  /** Meta diária do usuário + contexto de concurso (banca, concurso alvo). */
  async getProfileMeta(userId: string) {
    const [row] = await db
      .select({
        metaDiariaMin: profiles.metaDiariaMin,
        bancaPreferida: profiles.bancaPreferida,
        concursoAlvo: profiles.concursoAlvo,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    return row ?? null;
  },

  /**
   * Contexto de edital do usuário (Grupo D): edital vigente+publicado do
   * concurso vinculado + pesos de matéria do escopo correto.
   * - Sem contest_id no perfil → null (neutro).
   * - Sem edital publicado + is_current → null (neutro).
   * - position_id preenchido → pesos do cargo; sem pesos do cargo → fallback geral.
   * - position_id NULL → pesos gerais (position_id NULL).
   * - Sem notice_subjects no escopo → null (neutro).
   */
  async getEditalContext(
    userId: string
  ): Promise<
    | {
        contestId: string;
        positionId: string | null;
        rows: Array<{ knowledgeSubjectId: string; weight: number }>;
      }
    | null
  > {
    const [profile] = await db
      .select({
        contestId: profiles.contestId,
        positionId: profiles.positionId,
      })
      .from(profiles)
      .where(eq(profiles.id, userId))
      .limit(1);
    if (!profile?.contestId) return null;

    const [edital] = await db
      .select({ id: editais.id })
      .from(editais)
      .where(
        and(
          eq(editais.contestId, profile.contestId),
          eq(editais.isCurrent, true),
          eq(editais.status, "publicado"),
          isNull(editais.deletedAt)
        )
      )
      .limit(1);
    if (!edital) return null;

    const selectNoticeRows = async (conditions: SQL[]) =>
      db
        .select({
          knowledgeSubjectId: noticeSubjects.knowledgeSubjectId,
          weight: noticeSubjects.weight,
        })
        .from(noticeSubjects)
        .where(and(...conditions))
        .limit(5000);

    const baseConditions: SQL[] = [
      eq(noticeSubjects.editalId, edital.id),
      eq(noticeSubjects.status, "active"),
      isNull(noticeSubjects.deletedAt),
    ];

    // Escopo correto (DD-020): cargo específico se houver; senão geral.
    let rows: Array<{ knowledgeSubjectId: string; weight: number }> = [];
    if (profile.positionId) {
      rows = await selectNoticeRows([
        ...baseConditions,
        eq(noticeSubjects.positionId, profile.positionId),
      ]);
      if (rows.length === 0) {
        // Fallback: sem pesos do cargo → pesos gerais (position_id NULL).
        rows = await selectNoticeRows([
          ...baseConditions,
          isNull(noticeSubjects.positionId),
        ]);
      }
    } else {
      rows = await selectNoticeRows([
        ...baseConditions,
        isNull(noticeSubjects.positionId),
      ]);
    }

    if (rows.length === 0) return null;
    return {
      contestId: profile.contestId,
      positionId: profile.positionId ?? null,
      rows,
    };
  },
};
