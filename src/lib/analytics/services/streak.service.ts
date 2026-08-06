/**
 * ConcursoAI — StreakService (Analytics)
 *
 * Reutiliza a lógica pura existente em src/lib/analytics/streak.ts
 * (computeStreak, distinctActivityDates, todayISO) e agrega as datas de
 * atividade do usuário (tentativas + tarefas concluídas).
 */
import "server-only";
import {
  computeStreak,
  distinctActivityDates,
  todayISO,
} from "@/lib/analytics/streak";
import { AggregationRepository } from "../repositories/aggregation.repository";

export interface StreakResult {
  current: number;
  /** true se ainda hoje não houve atividade. */
  needsToday: boolean;
}

export const StreakService = {
  /** Sequência atual de estudo do usuário. */
  async getStreak(userId: string, today: string = todayISO()): Promise<StreakResult> {
    const timestamps = await AggregationRepository.listActivityTimestamps(userId);
    const activityDates = distinctActivityDates(
      timestamps.map((d) => d.toISOString())
    );
    return computeStreak({ activityDates, today });
  },
};
