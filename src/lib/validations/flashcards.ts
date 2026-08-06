import { z } from "zod";

export const createFlashcardSchema = z.object({
  front: z.string().min(1, "Informe a pergunta").max(500),
  back: z.string().min(1, "Informe a resposta").max(2000),
  subject_id: z.string().uuid().optional().nullable(),
  tags: z.array(z.string().max(30)).max(10).default([]),
});

export const updateFlashcardSchema = createFlashcardSchema.partial();

export const reviewSchema = z.object({
  flashcard_id: z.string().uuid(),
  rating: z.enum(["facil", "medio", "dificil"]),
});

export type CreateFlashcardInput = z.infer<typeof createFlashcardSchema>;
export type ReviewInput = z.infer<typeof reviewSchema>;
