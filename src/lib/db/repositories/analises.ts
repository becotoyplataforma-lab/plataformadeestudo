import { and, eq, gte, lt, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  questionAttempts,
  questions,
  reviewSchedules,
  studyTasks,
} from "@/db/schema/study";
import { knowledgeSubjects } from "@/db/schema/knowledge";
import { getProfile } from "./perfil";
import { computeStreak, distinctActivityDates, todayISO } from "@/lib/analytics/streak";
import type {
  DashboardSummary,
  EvolutionPoint,
  SubjectPerformance,
} from "@/types";

/**
 * Repository de analíticas — agregações de desempenho do usuário.
 * Implementa as queries de referência do doc 16-ANALYTICS.md (via Drizzle).
 */
export async function getDashboardSummary(userId: string): Promise<DashboardSummary> {
  const today = todayISO();
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  const now = new Date();

  const [attempts, tasksToday, tasksDoneToday, dueCount, profile] = await Promise.all([
    db
      .select({ isCorrect: questionAttempts.isCorrect, createdAt: questionAttempts.createdAt })
      .from(questionAttempts)
      .where(eq(questionAttempts.userId, userId)),
    db
      .select({ id: studyTasks.id, durationMin: studyTasks.durationMin })
      .from(studyTasks)
      .where(
        and(
          eq(studyTasks.userId, userId),
          gte(studyTasks.scheduledDate, start),
          lt(studyTasks.scheduledDate, end)
        )
      ),
    db
      .select({ id: studyTasks.id, durationMin: studyTasks.durationMin })
      .from(studyTasks)
      .where(
        and(
          eq(studyTasks.userId, userId),
          gte(studyTasks.scheduledDate, start),
          lt(studyTasks.scheduledDate, end),
          eq(studyTasks.status, "concluida")
        )
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(reviewSchedules)
      .where(
        and(eq(reviewSchedules.userId, userId), lte(reviewSchedules.dueDate, now))
      ),
    getProfile(userId),
  ]);

  const dueCountN = dueCount[0]?.count ?? 0;
  const total = attempts.length;
  const acertos = attempts.filter((a) => a.isCorrect).length;
  const tasksDone = tasksDoneToday;

  // Atividade para streak: tentativas
  const streakDates = distinctActivityDates(
    attempts.map((a) => a.createdAt.toISOString())
  );
  const streak = computeStreak({ activityDates: streakDates, today });

  return {
    total_questoes: total,
    acertos,
    taxa_acerto: total > 0 ? acertos / total : 0,
    streak_dias: streak.current,
    meta_hoje_min: profile?.meta_diaria_min ?? 120,
    estudado_hoje_min: tasksDone.reduce((acc, t) => acc + t.durationMin, 0),
    revisoes_pendentes: dueCountN,
    tarefas_hoje: tasksToday.length,
    tarefas_concluidas_hoje: tasksDone.length,
  };
}

/** Taxa de acerto por matéria (piores primeiro). */
export async function getPerformanceBySubject(
  userId: string
): Promise<SubjectPerformance[]> {
  const rows = await db
    .select({
      isCorrect: questionAttempts.isCorrect,
      subjectId: questions.knowledgeSubjectId,
      name: knowledgeSubjects.name,
      color: knowledgeSubjects.color,
    })
    .from(questionAttempts)
    .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
    .innerJoin(
      knowledgeSubjects,
      eq(questions.knowledgeSubjectId, knowledgeSubjects.id)
    )
    .where(eq(questionAttempts.userId, userId));

  const map = new Map<
    string,
    { name: string; color: string | null; total: number; acertos: number }
  >();

  for (const row of rows) {
    const entry = map.get(row.subjectId) ?? {
      name: row.name,
      color: row.color ?? null,
      total: 0,
      acertos: 0,
    };
    entry.total++;
    if (row.isCorrect) entry.acertos++;
    map.set(row.subjectId, entry);
  }

  return [...map.values()]
    .map((e) => ({
      materia: e.name,
      total: e.total,
      acertos: e.acertos,
      taxa: e.total > 0 ? e.acertos / e.total : 0,
      color: e.color,
    }))
    .sort((a, b) => a.taxa - b.taxa);
}

/** Série temporal de acertos (últimos N dias). */
export async function getEvolution(
  userId: string,
  days = 30
): Promise<EvolutionPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const rows = await db
    .select({ isCorrect: questionAttempts.isCorrect, createdAt: questionAttempts.createdAt })
    .from(questionAttempts)
    .where(
      and(eq(questionAttempts.userId, userId), gte(questionAttempts.createdAt, since))
    );

  // Agrupa por dia
  const map = new Map<string, { total: number; acertos: number }>();
  for (const row of rows) {
    const day = row.createdAt.toISOString().slice(0, 10);
    const entry = map.get(day) ?? { total: 0, acertos: 0 };
    entry.total++;
    if (row.isCorrect) entry.acertos++;
    map.set(day, entry);
  }

  // Preenche todos os dias
  const points: EvolutionPoint[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    const entry = map.get(key) ?? { total: 0, acertos: 0 };
    points.push({
      dia: key,
      total: entry.total,
      acertos: entry.acertos,
      taxa: entry.total > 0 ? entry.acertos / entry.total : 0,
    });
  }
  return points;
}
