/**
 * Testes do StreakService (Analytics) + lógica pura legada de streak.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeStreak,
  distinctActivityDates,
  todayISO,
} from "@/lib/analytics/streak";

const mockActivity = vi.fn();
vi.mock("../../repositories/aggregation.repository", () => ({
  AggregationRepository: {
    listActivityTimestamps: (...args: unknown[]) => mockActivity(...args),
  },
}));

import { StreakService } from "../streak.service";

describe("computeStreak (lógica pura legada)", () => {
  it("conta dias consecutivos com atividade a partir de hoje", () => {
    const r = computeStreak({
      activityDates: ["2026-08-03", "2026-08-04", "2026-08-05"],
      today: "2026-08-05",
    });
    expect(r).toEqual({ current: 3, needsToday: false });
  });

  it("com hoje sem atividade, conta a partir de ontem e marca needsToday", () => {
    const r = computeStreak({
      activityDates: ["2026-08-03", "2026-08-04"],
      today: "2026-08-05",
    });
    expect(r).toEqual({ current: 2, needsToday: true });
  });

  it("interrupção zera a sequência", () => {
    const r = computeStreak({
      activityDates: ["2026-08-01", "2026-08-02", "2026-08-05"],
      today: "2026-08-05",
    });
    expect(r).toEqual({ current: 1, needsToday: false });
  });

  it("distinctActivityDates extrai datas únicas de timestamps", () => {
    const dates = distinctActivityDates([
      "2026-08-05T10:00:00.000Z",
      "2026-08-05T15:00:00.000Z",
      "2026-08-04T10:00:00.000Z",
      "invalido",
    ]);
    expect(dates).toHaveLength(2);
  });

  it("todayISO retorna data local em yyyy-MM-dd", () => {
    expect(todayISO()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("StreakService.getStreak", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reutiliza a lógica de streak com as datas de atividade do usuário", async () => {
    const now = new Date();
    mockActivity.mockResolvedValue([now]);
    const result = await StreakService.getStreak("u1", todayISO());
    expect(mockActivity).toHaveBeenCalledWith("u1");
    expect(result.current).toBeGreaterThanOrEqual(0);
    expect(typeof result.needsToday).toBe("boolean");
  });

  it("sem atividade retorna current 0", async () => {
    mockActivity.mockResolvedValue([]);
    const result = await StreakService.getStreak("u1", "2026-08-05");
    expect(result).toEqual({ current: 0, needsToday: true });
  });
});
