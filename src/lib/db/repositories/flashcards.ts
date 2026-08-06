import type { SupabaseClient } from "@supabase/supabase-js";
import type { Flashcard, ReviewSchedule } from "@/types";
import type { CreateFlashcardInput, ReviewInput } from "@/lib/validations/flashcards";

type DB = SupabaseClient;

/**
 * Repository de flashcards + agendamento SRS (SM-2 simplificado).
 */
export async function listFlashcards(
  db: DB,
  userId: string,
  options?: { subject_id?: string; onlyDue?: boolean }
): Promise<(Flashcard & { schedule?: ReviewSchedule | null })[]> {
  let query = db
    .from("flashcards")
    .select("*, subject:subjects(*), schedule:review_schedules(*)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (options?.subject_id) query = query.eq("subject_id", options.subject_id);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  let cards = (data ?? []) as (Flashcard & { schedule?: ReviewSchedule | null })[];
  if (options?.onlyDue) {
    const today = new Date().toISOString().slice(0, 10);
    cards = cards.filter((c) => !c.schedule || (c.schedule.due_date ?? "") <= today);
  }
  return cards;
}

export async function createFlashcard(
  db: DB,
  userId: string,
  input: CreateFlashcardInput
): Promise<Flashcard> {
  const { data, error } = await db
    .from("flashcards")
    .insert({
      user_id: userId,
      front: input.front,
      back: input.back,
      subject_id: input.subject_id ?? null,
      tags: input.tags ?? [],
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  // Cria schedule inicial
  await db.from("review_schedules").insert({
    user_id: userId,
    flashcard_id: data.id,
    interval_days: 0,
    ease_factor: 2.5,
    repetitions: 0,
    due_date: new Date().toISOString().slice(0, 10),
  });

  return data as Flashcard;
}

export async function deleteFlashcard(
  db: DB,
  userId: string,
  flashcardId: string
): Promise<void> {
  const { error } = await db
    .from("flashcards")
    .delete()
    .eq("id", flashcardId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/**
 * Aplica SM-2 simplificado:
 * - facil:  intervalo *= ease_factor (2.5)
 * - medio:  intervalo *= 1.5
 * - dificil: intervalo = 1 (reset parcial)
 */
export function computeNextSchedule(
  current: { interval_days: number; ease_factor: number; repetitions: number } | null,
  rating: ReviewInput["rating"]
): { interval_days: number; ease_factor: number; repetitions: number; due_date: string } {
  const interval = current?.interval_days ?? 0;
  const ease = current?.ease_factor ?? 2.5;
  const reps = current?.repetitions ?? 0;

  let nextInterval: number;
  let nextEase = ease;
  let nextReps = reps;

  if (rating === "facil") {
    nextReps = reps + 1;
    nextInterval = nextReps === 1 ? 1 : Math.round(interval * ease);
    nextEase = Math.min(ease + 0.15, 3.0);
  } else if (rating === "medio") {
    nextReps = reps + 1;
    nextInterval = nextReps === 1 ? 1 : Math.max(1, Math.round(interval * 1.5));
  } else {
    // dificil → volta ao início
    nextReps = 0;
    nextInterval = 1;
    nextEase = Math.max(ease - 0.2, 1.3);
  }

  const due = new Date();
  due.setDate(due.getDate() + nextInterval);
  return {
    interval_days: nextInterval,
    ease_factor: nextEase,
    repetitions: nextReps,
    due_date: due.toISOString().slice(0, 10),
  };
}

export async function recordReview(
  db: DB,
  userId: string,
  input: ReviewInput
): Promise<{ next_review: string; interval_days: number }> {
  // Lê schedule atual
  const { data: current, error: readError } = await db
    .from("review_schedules")
    .select("*")
    .eq("user_id", userId)
    .eq("flashcard_id", input.flashcard_id)
    .maybeSingle();

  if (readError) throw new Error(readError.message);

  const next = computeNextSchedule(
    current as { interval_days: number; ease_factor: number; repetitions: number } | null,
    input.rating
  );

  const { error } = await db.from("review_schedules").upsert({
    user_id: userId,
    flashcard_id: input.flashcard_id,
    interval_days: next.interval_days,
    ease_factor: next.ease_factor,
    repetitions: next.repetitions,
    due_date: next.due_date,
    last_reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);

  return { next_review: next.due_date, interval_days: next.interval_days };
}

export async function countDue(
  db: DB,
  userId: string
): Promise<number> {
  const today = new Date().toISOString().slice(0, 10);
  const { count, error } = await db
    .from("review_schedules")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .lte("due_date", today);
  if (error) throw new Error(error.message);
  return count ?? 0;
}
