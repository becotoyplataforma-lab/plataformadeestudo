/**
 * ConcursoAI — AggregationService (Analytics)
 *
 * Agregação SOB DEMANDA dos KPIs do dashboard (docs/16-ANALYTICS.md §3-5),
 * lendo as tabelas de origem (Study, AI, Identity) via AggregationRepository.
 *
 * Não materializa daily_summaries (materialização é OPEN-006, pós-MVP).
 */
import "server-only";
import { todayISO } from "@/lib/analytics/streak";
import { AggregationRepository } from "../repositories/aggregation.repository";
import { StreakService } from "./streak.service";

// ============================================================
// Tipos de saída
// ============================================================

export interface DashboardSummary {
  totalQuestions: number;
  correctAnswers: number;
  accuracyPct: number;
  streakDays: number;
  streakNeedsToday: boolean;
  metaTodayMin: number;
  studiedTodayMin: number;
  pendingReviews: number;
  tasksToday: number;
  tasksCompletedToday: number;
  aiMessagesToday: number;
}

export interface SubjectPerformance {
  subjectId: string;
  subjectName: string;
  total: number;
  correct: number;
  accuracyPct: number;
  /** Total/certo por banca da matéria (para o planner orientado à banca). */
  byBanca?: Record<string, { total: number; correct: number }>;
}

export interface EvolutionPoint {
  date: string;
  total: number;
  correct: number;
  accuracyPct: number;
}

export interface StudyTimePoint {
  date: string;
  minutes: number;
}

export interface DistributionPoint {
  subjectId: string;
  subjectName: string;
  total: number;
  percent: number;
}

export interface ScheduleProgress {
  scheduled: number;
  completed: number;
  adherencePct: number;
}

// ============================================================
// Helpers de data (local, sem fuso)
// ============================================================

function toLocalISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

function accuracy(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 1000) / 10 : 0;
}

// ============================================================
// Service
// ============================================================

export const AggregationService = {
  /** KPIs principais do dashboard (docs/16 §3.1). */
  async getSummary(userId: string, today: string = todayISO()): Promise<DashboardSummary> {
    const todayDate = parseISODate(today);
    const from = todayDate;
    const to = addDays(todayDate, 1);

    const attempts = await AggregationRepository.listAttempts(userId);
    const total = attempts.length;
    const correct = attempts.filter((a) => a.isCorrect).length;

    const tasks = await AggregationRepository.listTasks(userId, from, to);
    const completed = tasks.filter((t) => t.status === "concluida");
    const studiedTodayMin = completed.reduce((acc, t) => acc + t.durationMin, 0);

    const pendingReviews = await AggregationRepository.countReviewsDue(userId, to);
    const usage = await AggregationRepository.listUsage(userId, from);
    const aiMessagesToday = usage.reduce((acc, u) => acc + u.messagesCount, 0);

    const profile = await AggregationRepository.getProfileMeta(userId);
    const streak = await StreakService.getStreak(userId, today);

    return {
      totalQuestions: total,
      correctAnswers: correct,
      accuracyPct: accuracy(correct, total),
      streakDays: streak.current,
      streakNeedsToday: streak.needsToday,
      metaTodayMin: profile?.metaDiariaMin ?? 120,
      studiedTodayMin,
      pendingReviews,
      tasksToday: tasks.length,
      tasksCompletedToday: completed.length,
      aiMessagesToday,
    };
  },

  /** Acerto por matéria (piores primeiro — docs/16 §4.2). */
  async getPerformanceBySubject(userId: string): Promise<SubjectPerformance[]> {
    const rows = await AggregationRepository.listAttemptsBySubject(userId);
    return rows
      .map((r) => ({
        subjectId: r.subjectId,
        subjectName: r.subjectName,
        total: r.total,
        correct: r.correct,
        accuracyPct: accuracy(r.correct, r.total),
        byBanca: r.byBanca,
      }))
      .sort((a, b) => a.accuracyPct - b.accuracyPct);
  },

  /** Evolução diária de acertos (últimos N dias — docs/16 §4.3). */
  async getEvolution(userId: string, days = 30): Promise<EvolutionPoint[]> {
    const from = addDays(new Date(), -(days - 1));
    const attempts = await AggregationRepository.listAttempts(userId, from);

    const map = new Map<string, { total: number; correct: number }>();
    for (const a of attempts) {
      const day = toLocalISO(a.createdAt);
      const entry = map.get(day) ?? { total: 0, correct: 0 };
      entry.total++;
      if (a.isCorrect) entry.correct++;
      map.set(day, entry);
    }

    const points: EvolutionPoint[] = [];
    for (let i = 0; i < days; i++) {
      const day = toLocalISO(addDays(from, i));
      const entry = map.get(day) ?? { total: 0, correct: 0 };
      points.push({
        date: day,
        total: entry.total,
        correct: entry.correct,
        accuracyPct: accuracy(entry.correct, entry.total),
      });
    }
    return points;
  },

  /** Tempo de estudo por dia (últimos N dias — docs/16 §3.2). */
  async getStudyTime(userId: string, days = 7): Promise<StudyTimePoint[]> {
    const from = addDays(new Date(), -(days - 1));
    const to = addDays(new Date(), 1);
    const tasks = await AggregationRepository.listTasks(userId, from, to);

    const map = new Map<string, number>();
    for (const t of tasks) {
      if (t.status !== "concluida") continue;
      const day = toLocalISO(t.scheduledDate);
      map.set(day, (map.get(day) ?? 0) + t.durationMin);
    }

    const points: StudyTimePoint[] = [];
    for (let i = 0; i < days; i++) {
      const day = toLocalISO(addDays(from, i));
      points.push({ date: day, minutes: map.get(day) ?? 0 });
    }
    return points;
  },

  /** Distribuição de estudo por matéria (docs/16 §3.2). */
  async getDistribution(userId: string): Promise<DistributionPoint[]> {
    const rows = await AggregationRepository.listAttemptsBySubject(userId);
    const total = rows.reduce((acc, r) => acc + r.total, 0);
    if (total === 0) return [];

    return rows.map((r) => ({
      subjectId: r.subjectId,
      subjectName: r.subjectName,
      total: r.total,
      percent: Math.round((r.total / total) * 1000) / 10,
    }));
  },

  /** Progresso do cronograma (docs/16 §3.1/§3.2). */
  async getScheduleProgress(userId: string, days = 7): Promise<ScheduleProgress> {
    const from = addDays(new Date(), -(days - 1));
    const to = addDays(new Date(), 1);
    const tasks = await AggregationRepository.listTasks(userId, from, to);
    const completed = tasks.filter((t) => t.status === "concluida").length;

    return {
      scheduled: tasks.length,
      completed,
      adherencePct: tasks.length > 0 ? Math.round((completed / tasks.length) * 1000) / 10 : 0,
    };
  },
};
