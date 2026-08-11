import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  DashboardSummary,
  EvolutionPoint,
  SubjectPerformance,
} from "@/types";
import { computeStreak, distinctActivityDates, todayISO } from "@/lib/analytics/streak";

type DB = SupabaseClient;

/**
 * Repository de analíticas — agregações de desempenho do usuário.
 * Implementa as queries de referência do doc 16-ANALYTICS.md.
 */
export async function getDashboardSummary(
  db: DB,
  userId: string
): Promise<DashboardSummary> {
  const today = todayISO();

  // Questões totais
  const [attempts, tasksToday, tasksDoneToday, dueCountRes] = await Promise.all([
    db
      .from("question_attempts")
      .select("is_correct, created_at")
      .eq("user_id", userId),
    db
      .from("study_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("scheduled_date", today),
    db
      .from("study_tasks")
      .select("id")
      .eq("user_id", userId)
      .eq("scheduled_date", today)
      .eq("status", "concluida"),
    db
      .from("review_schedules")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .lte("due_date", today),
  ]);

  const dueCount = dueCountRes.count ?? 0;

  const allAttempts = (attempts.data ?? []) as Array<{ is_correct: boolean; created_at: string }>;
  const total = allAttempts.length;
  const acertos = allAttempts.filter((a) => a.is_correct).length;

  // Tempo estudado hoje = duração das tarefas concluídas hoje + estimativa
  // (No MVP: soma da duração das tarefas concluídas hoje)
  const tasksDone = (tasksDoneToday.data ?? []) as Array<{ id: string }>;

  // Atividade para streak: tentativas + tarefas concluídas
  const activityTimestamps = [
    ...allAttempts.map((a) => a.created_at),
  ];
  const streakDates = distinctActivityDates(activityTimestamps);
  const streak = computeStreak({ activityDates: streakDates, today });

  // Meta diária (carrega do perfil)
  const { data: profile } = await db
    .from("profiles")
    .select("meta_diaria_min, plano")
    .eq("id", userId)
    .single();

  return {
    total_questoes: total,
    acertos,
    taxa_acerto: total > 0 ? acertos / total : 0,
    streak_dias: streak.current,
    meta_hoje_min: (profile?.meta_diaria_min as number) ?? 120,
    estudado_hoje_min: tasksDone.length > 0 ? await sumMinutesFromTasks(db, userId, today) : 0,
    revisoes_pendentes: dueCount ?? 0,
    tarefas_hoje: (tasksToday.data ?? []).length,
    tarefas_concluidas_hoje: tasksDone.length,
  };
}

async function sumMinutesFromTasks(db: DB, userId: string, date: string): Promise<number> {
  const { data } = await db
    .from("study_tasks")
    .select("duration_min")
    .eq("user_id", userId)
    .eq("scheduled_date", date)
    .eq("status", "concluida");
  return (data ?? []).reduce((acc: number, t: { duration_min: number }) => acc + (t.duration_min ?? 0), 0);
}

/** Taxa de acerto por matéria (piores primeiro) */
export async function getPerformanceBySubject(
  db: DB,
  userId: string
): Promise<SubjectPerformance[]> {
  const { data, error } = await db
    .from("question_attempts")
    .select("is_correct, question:questions(subject:knowledge_subjects(id, name, color))")
    .eq("user_id", userId)
    .limit(5000);

  if (error) throw new Error(error.message);

  // Shape real do runtime: question_attempts.question → questions → knowledge_subjects (FK 1:1).
  // O tipo gerado do Supabase tipa o nested select como array; aqui refletimos o runtime.
  type SubjectRef = { id: string; name: string; color: string | null };
  type AttemptRow = {
    is_correct: boolean;
    question: { subject: SubjectRef } | null;
  };

  const map = new Map<
    string,
    { name: string; color: string | null; total: number; acertos: number }
  >();

  for (const row of (data as unknown as AttemptRow[] | null) ?? []) {
    const subject = row.question?.subject;
    if (!subject) continue;
    const entry = map.get(subject.id) ?? {
      name: subject.name,
      color: subject.color ?? null,
      total: 0,
      acertos: 0,
    };
    entry.total++;
    if (row.is_correct) entry.acertos++;
    map.set(subject.id, entry);
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

/** Série temporal de acertos (últimos N dias) */
export async function getEvolution(
  db: DB,
  userId: string,
  days = 30
): Promise<EvolutionPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const { data, error } = await db
    .from("question_attempts")
    .select("is_correct, created_at")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString());

  if (error) throw new Error(error.message);

  // Agrupa por dia
  const map = new Map<string, { total: number; acertos: number }>();
  for (const row of data ?? []) {
    const day = (row.created_at as string).slice(0, 10);
    const entry = map.get(day) ?? { total: 0, acertos: 0 };
    entry.total++;
    if (row.is_correct) entry.acertos++;
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
