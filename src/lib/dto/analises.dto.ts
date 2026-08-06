import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

/** DTO de resumo do dashboard/analíticas. */
export const DashboardSummaryDtoSchema = z.object({
  total_questoes: z.number().int().min(0),
  acertos: z.number().int().min(0),
  taxa_acerto: z.number().min(0).max(1),
  streak_dias: z.number().int().min(0),
  meta_hoje_min: z.number().int().min(0),
  estudado_hoje_min: z.number().int().min(0),
  revisoes_pendentes: z.number().int().min(0),
  tarefas_hoje: z.number().int().min(0),
  tarefas_concluidas_hoje: z.number().int().min(0),
});
export type DashboardSummaryDto = OutputOf<typeof DashboardSummaryDtoSchema>;

export function toDashboardSummaryDto(input: unknown): DashboardSummaryDto | null {
  return parseDto(DashboardSummaryDtoSchema, input);
}

/** DTO de desempenho por matéria. */
export const SubjectPerformanceDtoSchema = z.object({
  materia: z.string(),
  total: z.number().int().min(0),
  acertos: z.number().int().min(0),
  taxa: z.number().min(0).max(1),
  color: z.string().nullable(),
});
export type SubjectPerformanceDto = OutputOf<typeof SubjectPerformanceDtoSchema>;

export function toSubjectPerformanceDtoList(input: unknown[]): SubjectPerformanceDto[] {
  return input
    .map((row) => parseDto(SubjectPerformanceDtoSchema, row))
    .filter((dto): dto is SubjectPerformanceDto => dto !== null);
}

/** DTO de ponto de evolução (série temporal). */
export const EvolutionPointDtoSchema = z.object({
  dia: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  total: z.number().int().min(0),
  acertos: z.number().int().min(0),
  taxa: z.number().min(0).max(1),
});
export type EvolutionPointDto = OutputOf<typeof EvolutionPointDtoSchema>;

export function toEvolutionPointDtoList(input: unknown[]): EvolutionPointDto[] {
  return input
    .map((row) => parseDto(EvolutionPointDtoSchema, row))
    .filter((dto): dto is EvolutionPointDto => dto !== null);
}
