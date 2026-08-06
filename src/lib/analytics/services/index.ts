/**
 * ConcursoAI — Analytics Services (barrel export)
 */
export { StreakService, type StreakResult } from "./streak.service";
export {
  AggregationService,
  type DashboardSummary,
  type SubjectPerformance,
  type EvolutionPoint,
  type StudyTimePoint,
  type DistributionPoint,
  type ScheduleProgress,
} from "./aggregation.service";
export { DailySummaryService } from "./daily-summary.service";
export { EventLogService, type RecordEventInput } from "./event-log.service";
