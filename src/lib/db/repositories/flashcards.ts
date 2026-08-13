import type { Flashcard, Subject } from "@/types";
import type { CreateFlashcardInput, ReviewInput } from "@/lib/validations/flashcards";
import { FlashcardService } from "@/lib/study/services/flashcard.service";
import { ReviewScheduleService } from "@/lib/study/services/review-schedule.service";
import { ReviewScheduleRepository } from "@/lib/study/repositories/review-schedule.repository";

type LegacySchedule = { due_date: string; interval_days: number } | null;
type LegacyCard = Flashcard & { schedule?: LegacySchedule };

type FlashcardRow = {
  id: string;
  userId: string;
  studySubjectId: string | null;
  front: string;
  back: string;
  tags: unknown;
  createdAt: Date;
  subjectName?: string | null;
  subjectColor?: string | null;
  dueDate?: Date | null;
  intervalDays?: number | null;
};

/**
 * Converte a linha Drizzle do FlashcardRepository para o contrato legado
 * (snake_case, `subject` aninhado e `schedule` reduzido) consumido pela UI.
 */
function toLegacyFlashcard(row: FlashcardRow): LegacyCard {
  return {
    id: row.id,
    user_id: row.userId,
    subject_id: row.studySubjectId,
    front: row.front,
    back: row.back,
    tags: (row.tags as string[]) ?? [],
    created_at: row.createdAt.toISOString(),
    subject: row.studySubjectId
      ? ({
          id: row.studySubjectId,
          name: row.subjectName ?? "",
          color: row.subjectColor ?? null,
        } as unknown as Subject)
      : null,
    schedule: row.dueDate
      ? {
          due_date: row.dueDate.toISOString().slice(0, 10),
          interval_days: row.intervalDays ?? 0,
        }
      : null,
  };
}

/** Lista flashcards do usuário (persistência via FlashcardService/Drizzle). */
export async function listFlashcards(
  userId: string,
  options?: { subject_id?: string; onlyDue?: boolean }
): Promise<LegacyCard[]> {
  const rows = await FlashcardService.list(userId, {
    studySubjectId: options?.subject_id,
    onlyDue: options?.onlyDue,
  });
  return rows.map(toLegacyFlashcard);
}

/** Cria flashcard + schedule inicial (persistência via FlashcardService/Drizzle). */
export async function createFlashcard(
  userId: string,
  input: CreateFlashcardInput
): Promise<LegacyCard> {
  const row = await FlashcardService.create(userId, {
    studySubjectId: input.subject_id ?? undefined,
    front: input.front,
    back: input.back,
    tags: input.tags ?? [],
  });
  return toLegacyFlashcard({
    id: row.id,
    userId: row.userId,
    studySubjectId: row.studySubjectId ?? null,
    front: row.front,
    back: row.back,
    tags: row.tags,
    createdAt: row.createdAt,
    subjectName: null,
    subjectColor: null,
    dueDate: null,
  });
}

/** Remove flashcard do usuário (soft delete via FlashcardService/Drizzle). */
export async function deleteFlashcard(
  userId: string,
  flashcardId: string
): Promise<void> {
  await FlashcardService.delete(userId, flashcardId);
}

/** Registra revisão SRS (via ReviewScheduleService/Drizzle). */
export async function recordReview(
  userId: string,
  input: ReviewInput
): Promise<{ next_review: string; interval_days: number }> {
  const result = await ReviewScheduleService.review(
    userId,
    input.flashcard_id,
    input.rating
  );
  return {
    next_review: result.dueDate.toISOString().slice(0, 10),
    interval_days: result.intervalDays,
  };
}

/** Conta revisões vencidas do usuário (via ReviewScheduleRepository/Drizzle). */
export async function countDue(userId: string): Promise<number> {
  return ReviewScheduleRepository.countDue(userId);
}
