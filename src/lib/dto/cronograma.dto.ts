import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

/** DTO de disciplina (cronograma). */
export const SubjectDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
  priority: z.number().int().min(1).max(5),
  carga_horaria_total: z.number().int().min(0),
});
export type SubjectDto = OutputOf<typeof SubjectDtoSchema>;

export function toSubjectDto(input: unknown): SubjectDto | null {
  return parseDto(SubjectDtoSchema, input);
}

/** DTO de tarefa de estudo (inclui disciplina aninhada, opcional). */
export const StudyTaskDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  subject_id: z.string().uuid().nullable(),
  title: z.string(),
  description: z.string().nullable(),
  scheduled_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  duration_min: z.number().int().min(0),
  status: z.enum(["pendente", "concluida", "adiada"]),
  completed_at: z.string().nullable(),
  subject: SubjectDtoSchema.nullable().optional(),
});
export type StudyTaskDto = OutputOf<typeof StudyTaskDtoSchema>;

export function toStudyTaskDto(input: unknown): StudyTaskDto | null {
  return parseDto(StudyTaskDtoSchema, input);
}

export function toStudyTaskDtoList(input: unknown[]): StudyTaskDto[] {
  return input
    .map((row) => toStudyTaskDto(row))
    .filter((dto): dto is StudyTaskDto => dto !== null);
}
