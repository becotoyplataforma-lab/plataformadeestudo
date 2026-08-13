/**
 * ConcursoAI — Study DTOs
 *
 * Data Transfer Objects para o domínio Study.
 * Todo dado que cruza a fronteira API → Cliente passa por validação Zod.
 *
 * Segue: DD-006 (DTO obrigatório), DD-007 (Zod obrigatório),
 *        docs/08-DATABASE-PHYSICAL.md
 */
import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

// ============================================================
// StudySubject
// ============================================================

export const StudySubjectCreateDtoSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(20).optional(),
  priority: z.number().int().min(1).max(5).default(3),
  carga_horaria_total: z.number().int().min(0).max(10000).default(0),
});
export type StudySubjectCreateDto = OutputOf<typeof StudySubjectCreateDtoSchema>;

export const StudySubjectUpdateDtoSchema = StudySubjectCreateDtoSchema.partial();
export type StudySubjectUpdateDto = OutputOf<typeof StudySubjectUpdateDtoSchema>;

export const StudySubjectDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  name: z.string(),
  color: z.string().nullable(),
  priority: z.number().int(),
  carga_horaria_total: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type StudySubjectDto = OutputOf<typeof StudySubjectDtoSchema>;

// ============================================================
// StudyTask
// ============================================================

export const StudyTaskCreateDtoSchema = z.object({
  study_subject_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  scheduled_date: z.string().datetime(),
  duration_min: z.number().int().min(5).max(600).default(30),
});
export type StudyTaskCreateDto = OutputOf<typeof StudyTaskCreateDtoSchema>;

export const StudyTaskUpdateDtoSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    scheduled_date: z.string().datetime().optional(),
    duration_min: z.number().int().min(5).max(600).optional(),
    status: z.enum(["pendente", "concluida", "adiada"]).optional(),
  })
  .strict();
export type StudyTaskUpdateDto = OutputOf<typeof StudyTaskUpdateDtoSchema>;

export const StudyTaskDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  study_subject_id: z.string().uuid().nullable(),
  subject_name: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().nullable(),
  scheduled_date: z.string(),
  duration_min: z.number().int(),
  status: z.enum(["pendente", "concluida", "adiada"]),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type StudyTaskDto = OutputOf<typeof StudyTaskDtoSchema>;

// ============================================================
// Question
// ============================================================

export const QuestionListQueryDtoSchema = z.object({
  subject_id: z.string().uuid().optional(),
  banca: z.string().optional(),
  nivel: z.enum(["facil", "medio", "dificil"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  page_size: z.coerce.number().int().min(1).max(50).default(20),
});
export type QuestionListQueryDto = OutputOf<typeof QuestionListQueryDtoSchema>;

export const QuestionDtoSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid(),
  subject_name: z.string().nullable().optional(),
  subject_color: z.string().nullable().optional(),
  banca: z.string().nullable(),
  cargo: z.string().nullable(),
  ano: z.number().int().nullable(),
  nivel: z.enum(["facil", "medio", "dificil"]),
  enunciado: z.string(),
  gabarito: z.string(),
  explicacao: z.string().nullable(),
  tipo: z.string(),
  fonte: z.string().nullable(),
  options: z
    .array(
      z.object({
        id: z.string().uuid(),
        letter: z.string(),
        text: z.string(),
      })
    )
    .optional(),
});
export type QuestionDto = OutputOf<typeof QuestionDtoSchema>;

export const QuestionListDtoSchema = z.object({
  data: z.array(QuestionDtoSchema),
  total: z.number().int().nonnegative(),
});
export type QuestionListDto = OutputOf<typeof QuestionListDtoSchema>;

// ============================================================
// QuestionAnswer
// ============================================================

export const QuestionAnswerRequestDtoSchema = z.object({
  selected_letter: z.string().regex(/^[A-E]$/, "Alternativa deve ser A-E"),
  time_spent_sec: z.number().int().min(0).max(3600).default(0),
  mode: z.enum(["estudo", "simulado", "revisao"]).default("estudo"),
});
export type QuestionAnswerRequestDto = OutputOf<typeof QuestionAnswerRequestDtoSchema>;

export const QuestionAnswerResponseDtoSchema = z.object({
  attempt_id: z.string().uuid(),
  correct: z.boolean(),
  gabarito: z.string(),
  explicacao: z.string().nullable(),
});
export type QuestionAnswerResponseDto = OutputOf<typeof QuestionAnswerResponseDtoSchema>;

// ============================================================
// QuestionAttempt
// ============================================================

export const QuestionAttemptDtoSchema = z.object({
  id: z.string().uuid(),
  question_id: z.string().uuid(),
  selected_letter: z.string(),
  is_correct: z.boolean(),
  time_spent_sec: z.number().int(),
  mode: z.enum(["estudo", "simulado", "revisao"]),
  created_at: z.string(),
  enunciado: z.string().nullable().optional(),
});
export type QuestionAttemptDto = OutputOf<typeof QuestionAttemptDtoSchema>;

// ============================================================
// Flashcard
// ============================================================

export const FlashcardCreateDtoSchema = z.object({
  study_subject_id: z.string().uuid().optional(),
  front: z.string().min(1).max(500),
  back: z.string().min(1).max(2000),
  tags: z.array(z.string().min(1).max(50)).max(20).default([]),
});
export type FlashcardCreateDto = OutputOf<typeof FlashcardCreateDtoSchema>;

export const FlashcardUpdateDtoSchema = z
  .object({
    front: z.string().min(1).max(500).optional(),
    back: z.string().min(1).max(2000).optional(),
    tags: z.array(z.string().min(1).max(50)).max(20).optional(),
    study_subject_id: z.string().uuid().nullable().optional(),
  })
  .strict();
export type FlashcardUpdateDto = OutputOf<typeof FlashcardUpdateDtoSchema>;

export const FlashcardDtoSchema = z.object({
  id: z.string().uuid(),
  study_subject_id: z.string().uuid().nullable(),
  subject_name: z.string().nullable().optional(),
  subject_color: z.string().nullable().optional(),
  front: z.string(),
  back: z.string(),
  tags: z.array(z.string()),
  created_at: z.string(),
  schedule: z
    .object({
      id: z.string().uuid().nullable(),
      interval_days: z.number().int().nullable(),
      ease_factor: z.number().nullable(),
      repetitions: z.number().int().nullable(),
      due_date: z.string().nullable(),
      last_reviewed_at: z.string().nullable(),
    })
    .optional(),
});
export type FlashcardDto = OutputOf<typeof FlashcardDtoSchema>;

// ============================================================
// Review (SRS)
// ============================================================

export const ReviewRequestDtoSchema = z.object({
  rating: z.enum(["facil", "medio", "dificil"]),
});
export type ReviewRequestDto = OutputOf<typeof ReviewRequestDtoSchema>;

export const ReviewResponseDtoSchema = z.object({
  schedule_id: z.string().uuid(),
  interval_days: z.number().int(),
  ease_factor: z.number(),
  repetitions: z.number().int(),
  due_date: z.string(),
});
export type ReviewResponseDto = OutputOf<typeof ReviewResponseDtoSchema>;

// ============================================================
// Mappers
// ============================================================

import type { reviewSchedules } from "@/db/schema/study";

type ScheduleRow = typeof reviewSchedules.$inferSelect;

export function mapStudySubjectToDto(row: {
  id: string;
  userId: string;
  name: string;
  color: string | null;
  priority: number;
  cargaHorariaTotal: number;
  createdAt: Date;
  updatedAt: Date;
}): StudySubjectDto {
  return {
    id: row.id,
    user_id: row.userId,
    name: row.name,
    color: row.color,
    priority: row.priority,
    carga_horaria_total: row.cargaHorariaTotal,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function mapStudyTaskToDto(
  row: {
    id: string;
    userId: string;
    studySubjectId: string | null;
    title: string;
    description: string | null;
    scheduledDate: Date;
    durationMin: number;
    status: "pendente" | "concluida" | "adiada";
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } & { subjectName?: string | null }
): StudyTaskDto {
  return {
    id: row.id,
    user_id: row.userId,
    study_subject_id: row.studySubjectId,
    subject_name: row.subjectName ?? null,
    title: row.title,
    description: row.description,
    scheduled_date: row.scheduledDate.toISOString(),
    duration_min: row.durationMin,
    status: row.status,
    completed_at: row.completedAt ? row.completedAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function mapQuestionToDto(
  row: {
    id: string;
    knowledgeSubjectId: string;
    banca: string | null;
    cargo: string | null;
    ano: number | null;
    nivel: "facil" | "medio" | "dificil";
    enunciado: string;
    gabarito: string;
    explicacao: string | null;
    tipo: string;
    fonte: string | null;
  } & {
    subjectName?: string | null;
    subjectColor?: string | null;
    options?: { id: string; letter: string; text: string }[];
  }
): QuestionDto {
  return {
    id: row.id,
    subject_id: row.knowledgeSubjectId,
    subject_name: row.subjectName ?? null,
    subject_color: row.subjectColor ?? null,
    banca: row.banca,
    cargo: row.cargo,
    ano: row.ano,
    nivel: row.nivel,
    enunciado: row.enunciado,
    gabarito: row.gabarito,
    explicacao: row.explicacao,
    tipo: row.tipo,
    fonte: row.fonte,
    options: row.options,
  };
}

// ============================================================
// Planner (Adaptive)
// ============================================================

export const PlannerGenerateRequestDtoSchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato YYYY-MM-DD"),
  active_days: z.array(z.number().int().min(0).max(6)).min(1).max(7).default([1, 2, 3, 4, 5]),
});
export type PlannerGenerateRequestDto = OutputOf<typeof PlannerGenerateRequestDtoSchema>;

export const PlannerPriorityFactorDtoSchema = z.object({
  accuracy_pct: z.number().nullable(),
  total_questions: z.number().int(),
  trend: z.enum(["up", "down", "stable"]),
  days_since_last_task: z.number().int(),
  accuracy_score: z.number(),
  volume_score: z.number(),
  trend_score: z.number(),
  idle_score: z.number(),
});
export type PlannerPriorityFactorDto = OutputOf<typeof PlannerPriorityFactorDtoSchema>;

export const PlannerSubjectPriorityDtoSchema = z.object({
  subject_id: z.string().uuid(),
  subject_name: z.string(),
  knowledge_subject_name: z.string().nullable(),
  link_method: z.enum(["exact", "slug", "none"]),
  priority: z.number().int().min(1).max(5),
  performance: z
    .object({
      total: z.number().int(),
      correct: z.number().int(),
      accuracy_pct: z.number(),
    })
    .nullable(),
  factors: PlannerPriorityFactorDtoSchema,
});
export type PlannerSubjectPriorityDto = OutputOf<typeof PlannerSubjectPriorityDtoSchema>;

export const PlannerGenerateResponseDtoSchema = z.object({
  tasks_created: z.number().int(),
  priorities: z.array(PlannerSubjectPriorityDtoSchema),
});
export type PlannerGenerateResponseDto = OutputOf<typeof PlannerGenerateResponseDtoSchema>;

export function mapAttemptToDto(
  row: {
    id: string;
    questionId: string;
    selectedLetter: string;
    isCorrect: boolean;
    timeSpentSec: number;
    mode: "estudo" | "simulado" | "revisao";
    createdAt: Date;
  } & { enunciado?: string | null }
): QuestionAttemptDto {
  return {
    id: row.id,
    question_id: row.questionId,
    selected_letter: row.selectedLetter,
    is_correct: row.isCorrect,
    time_spent_sec: row.timeSpentSec,
    mode: row.mode,
    created_at: row.createdAt.toISOString(),
    enunciado: row.enunciado ?? null,
  };
}

export function mapFlashcardToDto(
  row: {
    id: string;
    studySubjectId: string | null;
    front: string;
    back: string;
    tags: unknown;
    createdAt: Date;
  } & {
    subjectName?: string | null;
    subjectColor?: string | null;
    schedule?: {
      id?: string | null;
      intervalDays?: number | null;
      easeFactor?: string | number | null;
      repetitions?: number | null;
      dueDate?: Date | string | null;
      lastReviewedAt?: Date | string | null;
    } | null;
  }
): FlashcardDto {
  return {
    id: row.id,
    study_subject_id: row.studySubjectId,
    subject_name: row.subjectName ?? null,
    subject_color: row.subjectColor ?? null,
    front: row.front,
    back: row.back,
    tags: (row.tags as string[]) ?? [],
    created_at: row.createdAt.toISOString(),
    schedule: row.schedule
      ? {
          id: row.schedule.id ?? null,
          interval_days: row.schedule.intervalDays ?? null,
          ease_factor: row.schedule.easeFactor
            ? Number(row.schedule.easeFactor)
            : null,
          repetitions: row.schedule.repetitions ?? null,
          due_date: row.schedule.dueDate
            ? new Date(row.schedule.dueDate).toISOString()
            : null,
          last_reviewed_at: row.schedule.lastReviewedAt
            ? new Date(row.schedule.lastReviewedAt).toISOString()
            : null,
        }
      : undefined,
  };
}

export function mapScheduleToDto(
  row: ScheduleRow & { flashcardId?: string }
): ReviewResponseDto {
  return {
    schedule_id: row.id,
    interval_days: row.intervalDays,
    ease_factor: Number(row.easeFactor),
    repetitions: row.repetitions,
    due_date: row.dueDate.toISOString(),
  };
}

export function toStudySubjectDto(input: unknown): StudySubjectDto | null {
  return parseDto(StudySubjectDtoSchema, input);
}
