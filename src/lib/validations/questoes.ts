import { z } from "zod";

export const answerQuestionSchema = z.object({
  selected_letter: z.string().regex(/^[A-E]$/, "Alternativa inválida"),
  time_spent_sec: z.coerce.number().int().min(0).max(3600).default(0),
  mode: z.enum(["estudo", "simulado", "revisao"]).default("estudo"),
});

export const questionFiltersSchema = z.object({
  subject_id: z.string().uuid().optional(),
  banca: z.string().optional(),
  nivel: z.enum(["facil", "medio", "dificil"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type QuestionFilters = z.infer<typeof questionFiltersSchema>;
