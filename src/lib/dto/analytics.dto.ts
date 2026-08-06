/**
 * ConcursoAI — Analytics DTOs
 *
 * Data Transfer Objects do domínio Analytics.
 * Segue: DD-006 (DTO obrigatório), DD-007 (Zod obrigatório),
 *        docs/16-ANALYTICS.md (dashboard e métricas)
 */
import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";
import type {
  DashboardSummary,
  SubjectPerformance,
  EvolutionPoint,
  StudyTimePoint,
  DistributionPoint,
  ScheduleProgress,
} from "@/lib/analytics/services";
import type { eventLogs, dailySummaries } from "@/db/schema/analytics";

// ============================================================
// Summary (KPIs)
// ============================================================

export const SummaryDtoSchema = z.object({
  total_questoes: z.number().int().nonnegative(),
  acertos: z.number().int().nonnegative(),
  taxa_acerto: z.number().min(0).max(100),
  streak_dias: z.number().int().nonnegative(),
  streak_precisa_hoje: z.boolean(),
  meta_hoje_min: z.number().int().nonnegative(),
  estudado_hoje_min: z.number().int().nonnegative(),
  revisoes_pendentes: z.number().int().nonnegative(),
  tarefas_hoje: z.number().int().nonnegative(),
  tarefas_concluidas_hoje: z.number().int().nonnegative(),
  ai_messages_hoje: z.number().int().nonnegative(),
});
export type SummaryDto = OutputOf<typeof SummaryDtoSchema>;

// ============================================================
// Subject performance
// ============================================================

export const SubjectPerformanceDtoSchema = z.object({
  subject_id: z.string().uuid(),
  subject_name: z.string(),
  total: z.number().int().nonnegative(),
  acertos: z.number().int().nonnegative(),
  taxa: z.number().min(0).max(100),
});
export type SubjectPerformanceDto = OutputOf<typeof SubjectPerformanceDtoSchema>;

export const SubjectPerformanceListDtoSchema = z.object({
  data: z.array(SubjectPerformanceDtoSchema),
});
export type SubjectPerformanceListDto = OutputOf<typeof SubjectPerformanceListDtoSchema>;

// ============================================================
// Evolution / Study time
// ============================================================

export const EvolutionPointDtoSchema = z.object({
  dia: z.string(),
  total: z.number().int().nonnegative(),
  acertos: z.number().int().nonnegative(),
  taxa: z.number().min(0).max(100),
});
export type EvolutionPointDto = OutputOf<typeof EvolutionPointDtoSchema>;

export const EvolutionListDtoSchema = z.object({
  data: z.array(EvolutionPointDtoSchema),
});
export type EvolutionListDto = OutputOf<typeof EvolutionListDtoSchema>;

export const StudyTimePointDtoSchema = z.object({
  dia: z.string(),
  minutos: z.number().int().nonnegative(),
});
export type StudyTimePointDto = OutputOf<typeof StudyTimePointDtoSchema>;

export const StudyTimeListDtoSchema = z.object({
  data: z.array(StudyTimePointDtoSchema),
});
export type StudyTimeListDto = OutputOf<typeof StudyTimeListDtoSchema>;

// ============================================================
// Distribution / Schedule
// ============================================================

export const DistributionPointDtoSchema = z.object({
  subject_id: z.string().uuid(),
  subject_name: z.string(),
  total: z.number().int().nonnegative(),
  percentual: z.number().min(0).max(100),
});
export type DistributionPointDto = OutputOf<typeof DistributionPointDtoSchema>;

export const DistributionListDtoSchema = z.object({
  data: z.array(DistributionPointDtoSchema),
});
export type DistributionListDto = OutputOf<typeof DistributionListDtoSchema>;

export const ScheduleProgressDtoSchema = z.object({
  planejadas: z.number().int().nonnegative(),
  concluidas: z.number().int().nonnegative(),
  aderencia: z.number().min(0).max(100),
});
export type ScheduleProgressDto = OutputOf<typeof ScheduleProgressDtoSchema>;

// ============================================================
// DailySummary / EventLog (leitura)
// ============================================================

export const DailySummaryDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  summary_date: z.string(),
  total_questions: z.number().int().nonnegative(),
  correct_answers: z.number().int().nonnegative(),
  study_minutes: z.number().int().nonnegative(),
  reviews_done: z.number().int().nonnegative(),
  ai_messages: z.number().int().nonnegative(),
});
export type DailySummaryDto = OutputOf<typeof DailySummaryDtoSchema>;

export const EventLogDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().nullable(),
  entity_type: z.string(),
  entity_id: z.string().uuid().nullable(),
  event_name: z.string(),
  payload: z.unknown().nullable(),
  occurred_at: z.string(),
});
export type EventLogDto = OutputOf<typeof EventLogDtoSchema>;

// ============================================================
// Mappers
// ============================================================

export function mapSummaryToDto(s: DashboardSummary): SummaryDto {
  return {
    total_questoes: s.totalQuestions,
    acertos: s.correctAnswers,
    taxa_acerto: s.accuracyPct,
    streak_dias: s.streakDays,
    streak_precisa_hoje: s.streakNeedsToday,
    meta_hoje_min: s.metaTodayMin,
    estudado_hoje_min: s.studiedTodayMin,
    revisoes_pendentes: s.pendingReviews,
    tarefas_hoje: s.tasksToday,
    tarefas_concluidas_hoje: s.tasksCompletedToday,
    ai_messages_hoje: s.aiMessagesToday,
  };
}

export function mapSubjectPerfToDto(s: SubjectPerformance): SubjectPerformanceDto {
  return {
    subject_id: s.subjectId,
    subject_name: s.subjectName,
    total: s.total,
    acertos: s.correct,
    taxa: s.accuracyPct,
  };
}

export function mapEvolutionToDto(e: EvolutionPoint): EvolutionPointDto {
  return {
    dia: e.date,
    total: e.total,
    acertos: e.correct,
    taxa: e.accuracyPct,
  };
}

export function mapStudyTimeToDto(p: StudyTimePoint): StudyTimePointDto {
  return { dia: p.date, minutos: p.minutes };
}

export function mapDistributionToDto(d: DistributionPoint): DistributionPointDto {
  return {
    subject_id: d.subjectId,
    subject_name: d.subjectName,
    total: d.total,
    percentual: d.percent,
  };
}

export function mapScheduleToDto(p: ScheduleProgress): ScheduleProgressDto {
  return {
    planejadas: p.scheduled,
    concluidas: p.completed,
    aderencia: p.adherencePct,
  };
}

type DailySummaryRow = typeof dailySummaries.$inferSelect;
type EventLogRow = typeof eventLogs.$inferSelect;

export function mapDailySummaryToDto(r: DailySummaryRow): DailySummaryDto {
  return {
    id: r.id,
    user_id: r.userId,
    summary_date: r.summaryDate.toISOString(),
    total_questions: r.totalQuestions,
    correct_answers: r.correctAnswers,
    study_minutes: r.studyMinutes,
    reviews_done: r.reviewsDone,
    ai_messages: r.aiMessages,
  };
}

export function mapEventLogToDto(r: EventLogRow): EventLogDto {
  return {
    id: r.id,
    user_id: r.userId,
    entity_type: r.entityType,
    entity_id: r.entityId,
    event_name: r.eventName,
    payload: r.payload,
    occurred_at: r.occurredAt.toISOString(),
  };
}

/** Valida um DTO arbitrário (null se inválido). */
export function toAnalyticsDto<T extends z.ZodTypeAny>(
  schema: T,
  input: unknown
): z.infer<T> | null {
  return parseDto(schema, input);
}
