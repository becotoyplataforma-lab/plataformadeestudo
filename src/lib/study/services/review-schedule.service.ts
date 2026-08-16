/**
 * ConcursoAI — ReviewScheduleService
 *
 * Algoritmo de revisão espaçada (SRS — SM-2 simplificado) para flashcards.
 * Atualiza o ReviewSchedule de um flashcard conforme autoavaliação.
 */
import { ReviewScheduleRepository } from "../repositories/review-schedule.repository";
import { FlashcardRepository } from "../repositories/flashcard.repository";
import { fsrsNextState, type FsrsRating } from "./fsrs";

export class ReviewScheduleError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ReviewScheduleError";
    this.code = code;
  }
}

export type ReviewRating = "facil" | "medio" | "dificil";

/** Mapeia a autoavaliação de 3 botões da UI para as notas FSRS. */
export function toFsrsRating(rating: ReviewRating): FsrsRating {
  switch (rating) {
    case "dificil":
      return "again";
    case "facil":
      return "easy";
    default:
      return "good";
  }
}

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
   * Registrar revisão de um flashcard (FSRS).
   * Atualiza intervalo, estabilidade, dificuldade e data de revisão.
   */
  async review(userId: string, flashcardId: string, rating: ReviewRating): Promise<ReviewResult> {
    const flashcard = await FlashcardRepository.findById(flashcardId, userId);
    if (!flashcard) {
      throw new ReviewScheduleError("FLASHCARD_NOT_FOUND", "Flashcard não encontrado.");
    }

    let schedule = await ReviewScheduleRepository.findByFlashcard(flashcardId, userId);
    if (!schedule) {
      schedule = await ReviewScheduleRepository.create({
        userId,
        flashcardId,
        intervalDays: 0,
        easeFactor: "2.50",
        repetitions: 0,
        stability: "0",
        difficulty: "5",
        dueDate: new Date(),
      });
    }

    const fsrsRating = toFsrsRating(rating);
    const now = new Date();
    const next = fsrsNextState(
      {
        difficulty: Number(schedule.difficulty ?? 5),
        stability: Number(schedule.stability ?? 0),
        lastReviewAt: schedule.lastReviewedAt,
      },
      fsrsRating,
      now
    );

    const updated = await ReviewScheduleRepository.update(schedule.id, userId, {
      intervalDays: next.intervalDays,
      easeFactor: "2.50",
      repetitions: schedule.repetitions + 1,
      stability: next.stability.toFixed(4),
      difficulty: next.difficulty.toFixed(4),
      lastRating: fsrsRating,
      dueDate: next.dueDate,
      lastReviewedAt: now,
    });

    return {
      scheduleId: updated?.id ?? schedule.id,
      intervalDays: next.intervalDays,
      easeFactor: Number(schedule.easeFactor),
      repetitions: schedule.repetitions + 1,
      dueDate: next.dueDate,
    };
  },
};
