/**
 * Testes do FSRS-6 completo — cálculo de estabilidade/dificuldade/intervalo.
 *
 * Os valores esperados foram derivados da especificação pública do FSRS-6
 * (pesos w0..w20 padrão) e conferidos contra o ts-fsrs.
 */
import { describe, it, expect } from "vitest";
import {
  fsrsNextState,
  fsrsRetrievability,
  FSRS_INITIAL_DIFFICULTY,
  FSRS_WEIGHTS,
  FSRS_DECAY,
  FSRS_REQUEST_RETENTION,
  type FsrsState,
} from "../fsrs";

const now = new Date("2026-08-04T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
}

describe("fsrsNextState — cartão novo", () => {
  it("'good' → S0 = w2 = 2.3065, D0 = 2.1181, intervalo 2", () => {
    const next = fsrsNextState(
      { difficulty: FSRS_INITIAL_DIFFICULTY, stability: 0, lastReviewAt: null },
      "good",
      now
    );
    expect(next.stability).toBeCloseTo(2.3065, 4);
    expect(next.difficulty).toBeCloseTo(2.1181, 4);
    expect(next.intervalDays).toBe(2);
    expect(next.dueDate.getTime()).toBe(now.getTime() + 2 * 24 * 3600 * 1000);
  });

  it("'again' → S0 = w0 = 0.212, D0 = 6.4133, intervalo 1", () => {
    const next = fsrsNextState(
      { difficulty: 5, stability: 0, lastReviewAt: null },
      "again",
      now
    );
    expect(next.stability).toBeCloseTo(0.212, 4);
    expect(next.difficulty).toBeCloseTo(6.4133, 4);
    expect(next.intervalDays).toBe(1);
  });

  it("'hard' → S0 = w1 = 1.2931, D0 = 5.1122, intervalo 1", () => {
    const next = fsrsNextState(
      { difficulty: 5, stability: 0, lastReviewAt: null },
      "hard",
      now
    );
    expect(next.stability).toBeCloseTo(1.2931, 4);
    expect(next.difficulty).toBeCloseTo(5.1122, 4);
    expect(next.intervalDays).toBe(1);
  });

  it("'easy' → S0 = w3 = 8.2956, D0 = 1, intervalo 8", () => {
    const next = fsrsNextState(
      { difficulty: 5, stability: 0, lastReviewAt: null },
      "easy",
      now
    );
    expect(next.stability).toBeCloseTo(8.2956, 4);
    expect(next.difficulty).toBeCloseTo(1, 4);
    expect(next.intervalDays).toBe(8);
  });
});

describe("fsrsNextState — cartão estável", () => {
  it("'good' em cartão estável (S=2.5, D=5, 10d) cresce a estabilidade", () => {
    const state: FsrsState = { difficulty: 5, stability: 2.5, lastReviewAt: daysAgo(10) };
    const next = fsrsNextState(state, "good", now);
    // R(2.5,10) ≈ 0.7821 → S'r ≈ 18.3558
    expect(next.stability).toBeCloseTo(18.3558, 4);
    expect(next.stability).toBeGreaterThan(2.5);
    expect(next.difficulty).toBeCloseTo(4.9902, 4);
    expect(next.intervalDays).toBe(18);
  });

  it("'again' em cartão estável (S=2.5, D=5, 10d) reduz a estabilidade", () => {
    const state: FsrsState = { difficulty: 5, stability: 2.5, lastReviewAt: daysAgo(10) };
    const next = fsrsNextState(state, "again", now);
    expect(next.stability).toBeCloseTo(0.7507, 4);
    expect(next.difficulty).toBeCloseTo(8.3418, 4);
    expect(next.intervalDays).toBe(1);
  });

  it("'again' em cartão estável (S=10, D=5, 5d)", () => {
    const state: FsrsState = { difficulty: 5, stability: 10, lastReviewAt: daysAgo(5) };
    const next = fsrsNextState(state, "again", now);
    expect(next.stability).toBeCloseTo(1.3024, 4);
    expect(next.difficulty).toBeCloseTo(8.3418, 4);
    expect(next.intervalDays).toBe(1);
  });
});

describe("fsrsNextState — limites", () => {
  it("dificuldade fica limitada entre 1 e 10", () => {
    const hard = fsrsNextState({ difficulty: 10, stability: 0, lastReviewAt: null }, "again", now);
    expect(hard.difficulty).toBeGreaterThanOrEqual(1);
    expect(hard.difficulty).toBeLessThanOrEqual(10);
    const easy = fsrsNextState({ difficulty: 1, stability: 0, lastReviewAt: null }, "easy", now);
    expect(easy.difficulty).toBeGreaterThanOrEqual(1);
    expect(easy.difficulty).toBeLessThanOrEqual(10);
  });

  it("estabilidade fica limitada entre S_MIN e S_MAX", () => {
    const next = fsrsNextState(
      { difficulty: 5, stability: 36_500, lastReviewAt: daysAgo(1) },
      "easy",
      now
    );
    expect(next.stability).toBeLessThanOrEqual(36_500);
    expect(next.intervalDays).toBeLessThanOrEqual(36_500);
  });
});

describe("fsrsRetrievability", () => {
  it("decai com o tempo e satura em 1 para tempo zero", () => {
    expect(fsrsRetrievability(2.5, 0)).toBe(1);
    expect(fsrsRetrievability(2.5, 10)).toBeCloseTo(0.7821, 3);
    expect(fsrsRetrievability(0, 10)).toBe(0);
  });

  it("R(t,S) = (1 + FACTOR*t/S)^DECAY com DECAY=-w20", () => {
    const decay = -FSRS_DECAY;
    const factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1;
    const expected = Math.pow(1 + (factor * 10) / 2.5, decay);
    expect(fsrsRetrievability(2.5, 10)).toBeCloseTo(expected, 6);
  });
});

describe("FSRS_WEIGHTS", () => {
  it("tem 21 pesos (w0..w20) e decay = w20", () => {
    expect(FSRS_WEIGHTS).toHaveLength(21);
    expect(FSRS_DECAY).toBeCloseTo(0.1542, 4);
    expect(FSRS_REQUEST_RETENTION).toBe(0.9);
  });
});
