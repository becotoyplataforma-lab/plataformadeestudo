/**
 * Testes do algoritmo SRS (SM-2 simplificado) — ReviewScheduleService.
 */
import { describe, it, expect } from "vitest";
import { srsNextState } from "../review-schedule.service";

describe("srsNextState (SM-2 simplificado)", () => {
  const base = { intervalDays: 6, easeFactor: 2.5, repetitions: 2 };
  const now = new Date("2026-08-04T12:00:00Z");

  it("rating 'facil' aumenta ease e intervalo", () => {
    const next = srsNextState(base, "facil", now);
    expect(next.easeFactor).toBe(2.5); // já no máximo (MAX_EASE)
    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBe(Math.round(6 * 2.5)); // 15
    expect(next.dueDate.getTime()).toBe(now.getTime() + 15 * 24 * 3600 * 1000);
  });

  it("rating 'medio' mantém ease", () => {
    const next = srsNextState(base, "medio", now);
    expect(next.easeFactor).toBe(2.5);
    expect(next.repetitions).toBe(3);
    expect(next.intervalDays).toBe(Math.round(6 * 2.5));
  });

  it("rating 'dificil' zera repetições e reduz ease", () => {
    const next = srsNextState({ ...base, easeFactor: 2.0 }, "dificil", now);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
    expect(next.easeFactor).toBe(1.8);
  });

  it("ease nunca fica abaixo do mínimo (1.3)", () => {
    const next = srsNextState({ intervalDays: 6, easeFactor: 1.3, repetitions: 2 }, "dificil", now);
    expect(next.easeFactor).toBe(1.3);
  });

  it("primeira repetição (1) usa intervalo 1", () => {
    const next = srsNextState({ intervalDays: 0, easeFactor: 2.5, repetitions: 0 }, "medio", now);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
  });

  it("segunda repetição (2) usa intervalo 6", () => {
    const next = srsNextState({ intervalDays: 1, easeFactor: 2.5, repetitions: 1 }, "medio", now);
    expect(next.repetitions).toBe(2);
    expect(next.intervalDays).toBe(6);
  });
});
