import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

/** DTO de alternativa de questão. */
export const QuestionOptionDtoSchema = z.object({
  id: z.string().uuid(),
  question_id: z.string().uuid(),
  letter: z.string().regex(/^[A-E]$/),
  text: z.string(),
  is_correct: z.boolean(),
});
export type QuestionOptionDto = OutputOf<typeof QuestionOptionDtoSchema>;

/** DTO de questão (banco de questões). */
export const QuestionDtoSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  banca: z.string().nullable(),
  cargo: z.string().nullable(),
  ano: z.number().int().nullable(),
  nivel: z.enum(["facil", "medio", "dificil"]),
  enunciado: z.string(),
  gabarito: z.string().regex(/^[A-E]$/),
  explicacao: z.string().nullable(),
  tipo: z.string(),
  fonte: z.string().nullable(),
  is_public: z.boolean(),
  subject: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      color: z.string().nullable(),
    })
    .nullable()
    .optional(),
  options: z.array(QuestionOptionDtoSchema).optional(),
});
export type QuestionDto = OutputOf<typeof QuestionDtoSchema>;

export function toQuestionDto(input: unknown): QuestionDto | null {
  return parseDto(QuestionDtoSchema, input);
}

export function toQuestionDtoList(input: unknown[]): QuestionDto[] {
  return input
    .map((row) => toQuestionDto(row))
    .filter((dto): dto is QuestionDto => dto !== null);
}

/** DTO de resultado de resposta (POST /api/questoes/:id/responder). */
export const AnswerResultDtoSchema = z.object({
  correct: z.boolean(),
  gabarito: z.string().nullable(),
  explicacao: z.string().nullable(),
  acertos_acumulados: z.number().int().min(0),
});
export type AnswerResultDto = OutputOf<typeof AnswerResultDtoSchema>;

export function toAnswerResultDto(input: unknown): AnswerResultDto | null {
  return parseDto(AnswerResultDtoSchema, input);
}
