/**
 * ConcursoAI — ReviewScheduleService
 *
 * Algoritmo de revisão espaçada (SRS — SM-2 simplificado) para flashcards.
 * Atualiza o ReviewSchedule de um flashcard conforme autoavaliação.
 */
import { ReviewScheduleRepository } from "../repositories/review-schedule.repository";
import { FlashcardRepository } from "../repositories/flashcard.repository";

export class ReviewScheduleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ReviewScheduleError";
    this.code = code;
  }
}

export type ReviewRating = "facil" | "medio" | "dificil";

export interface ReviewResult {
  scheduleId: string;
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
  dueDate: Date;
}

const MIN_EASE = 1.3;
const MAX_EASE = 2.5;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * SM-2 simplificado.
 * - dificil: zera repetições, intervalo curto, ease reduz.
 * - medio: rep++, ease mantido.
 * - facil: rep++, ease aumenta.
 */
export function srsNextState(current: {
  intervalDays: number;
  easeFactor: number;
  repetitions: number;
}, rating: ReviewRating, now = new Date()): ReviewResult {
  const ease = Number(current.easeFactor);
  let repetitions = current.repetitions;
  let intervalDays: number;
  let newEase = ease;

  if (rating === "dificil") {
    repetitions = 0;
    intervalDays = 1;
    newEase = Math.max(MIN_EASE, ease - 0.2);
  } else {
    repetitions += 1;
    if (repetitions === 1) {
      intervalDays = 1;
    } else if (repetitions === 2) {
      intervalDays = 6;
    } else {
      intervalDays = Math.round(current.intervalDays * ease);
    }
    if (rating === "facil") {
      newEase = Math.min(MAX_EASE, ease + 0.15);
    }
  }

  const dueDate = new Date(now.getTime() + intervalDays * DAY_MS);
  return {
    scheduleId: "",
    intervalDays,
    easeFactor: Math.round(newEase * 100) / 100,
    repetitions,
    dueDate,
  };
}

export const ReviewScheduleService = {
  /**
   * Registrar revisão de um flashcard.
   */
  async review(userId: string, flashcardId: string, rating: ReviewRating): Promise<ReviewResult> {
    const flashcard = await FlashcardRepository.findById(flashcardId, userId);
    if (!flashcard) {
      throw new ReviewScheduleError("FLASHCARD_NOT_FOUND", "Flashcard não encontrado.");
    }

    let schedule = await ReviewScheduleRepository.findByFlashcard(flashcardId, userId);
    if (!schedule) {
      // Recupera de schedule "deleted" ou cria novo
      schedule = await ReviewScheduleRepository.create({
        userId,
        flashcardId,
        intervalDays: 0,
        easeFactor: "2.50",
        repetitions: 0,
        dueDate: new Date(),
      });
    }

    const next = srsNextState(
      {
        intervalDays: schedule.intervalDays,
        easeFactor: Number(schedule.easeFactor),
        repetitions: schedule.repetitions,
      },
      rating
    );

    const updated = await ReviewScheduleRepository.update(schedule.id, userId, {
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor.toFixed(2),
      repetitions: next.repetitions,
      dueDate: next.dueDate,
      lastReviewedAt: new Date(),
    });

    return {
      scheduleId: updated?.id ?? schedule.id,
      intervalDays: next.intervalDays,
      easeFactor: next.easeFactor,
      repetitions: next.repetitions,
      dueDate: next.dueDate,
    };
  },
};
