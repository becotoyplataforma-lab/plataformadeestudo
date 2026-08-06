import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

/** DTO de flashcard. */
export const FlashcardDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  front: z.string(),
  back: z.string(),
  tags: z.array(z.string()),
  created_at: z.string(),
  subject: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string().nullable(),
    })
    .nullable()
    .optional(),
  schedule: z
    .object({
      due_date: z.string().nullable(),
      interval_days: z.number().int().min(0),
    })
    .nullable()
    .optional(),
});
export type FlashcardDto = OutputOf<typeof FlashcardDtoSchema>;

export function toFlashcardDto(input: unknown): FlashcardDto | null {
  return parseDto(FlashcardDtoSchema, input);
}

export function toFlashcardDtoList(input: unknown[]): FlashcardDto[] {
  return input
    .map((row) => toFlashcardDto(row))
    .filter((dto): dto is FlashcardDto => dto !== null);
}

/** DTO de resultado de revisão SRS. */
export const ReviewResultDtoSchema = z.object({
  next_review: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  interval_days: z.number().int().min(0),
  due_today_left: z.number().int().min(0),
});
export type ReviewResultDto = OutputOf<typeof ReviewResultDtoSchema>;

export function toReviewResultDto(input: unknown): ReviewResultDto | null {
  return parseDto(ReviewResultDtoSchema, input);
}
