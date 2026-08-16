/**
 * Testes do FSRS simplificado — cálculo de estabilidade/dificuldade/intervalo.
 */
import { describe, it, expect } from "vitest";
import {
  fsrsNextState,
  fsrsRetrievability,
  FSRS_INITIAL_DIFFICULTY,
  type FsrsState,
} from "../fsrs";

const now = new Date("2026-08-04T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(now.getTime() - n * 24 * 60 * 60 * 1000);
}

describe("fsrsNextState", () => {
  it("cartão novo com 'good' → estabilidade 2.5, dificuldade 5, intervalo 3", () => {
    const next = fsrsNextState(
      { difficulty: FSRS_INITIAL_DIFFICULTY, stability: 0, lastReviewAt: null },
      "good",
      now
    );
    expect(next.stability).toBe(2.5);
    expect(next.difficulty).toBe(5);
    expect(next.intervalDays).toBe(3);
    expect(next.dueDate.getTime()).toBe(now.getTime() + 3 * 24 * 3600 * 1000);
  });

  it("cartão novo com 'again' → estabilidade 0.5, dificuldade 6, intervalo 1", () => {
    const next = fsrsNextState(
      { difficulty: 5, stability: 0, lastReviewAt: null },
      "again",
      now
    );
    expect(next.stability).toBe(0.5);
    expect(next.difficulty).toBe(6);
    expect(next.intervalDays).toBe(1);
  });

  it("'good' em cartão estável aumenta a estabilidade", () => {
    const state: FsrsState = { difficulty: 5, stability: 2.5, lastReviewAt: daysAgo(10) };
    const next = fsrsNextState(state, "good", now);
    // R = (1 + 10/(9*2.5))^-1 ≈ 0.6923 → S = 2.5 * (1 + 1.5*0.3077) ≈ 3.65
    expect(next.stability).toBeCloseTo(3.65, 2);
    expect(next.stability).toBeGreaterThan(2.5);
    expect(next.intervalDays).toBe(Math.max(1, Math.ceil(next.stability)));
  });

  it("'again' em cartão estável reduz a estabilidade pela metade", () => {
    const state: FsrsState = { difficulty: 5, stability: 10, lastReviewAt: daysAgo(5) };
    const next = fsrsNextState(state, "again", now);
    expect(next.stability).toBeCloseTo(5, 4);
    expect(next.difficulty).toBe(6);
    expect(next.intervalDays).toBe(1);
  });

  it("'easy' aumenta a dificuldade? Não — reduz a dificuldade e cresce estabilidade", () => {
    const next = fsrsNextState(
      { difficulty: 5, stability: 0, lastReviewAt: null },
      "easy",
      now
    );
    expect(next.stability).toBe(5);
    expect(next.difficulty).toBeCloseTo(4.85, 2);
  });

  it("dificuldade fica limitada entre 1 e 10", () => {
    const hard = fsrsNextState({ difficulty: 10, stability: 0, lastReviewAt: null }, "again", now);
    expect(hard.difficulty).toBe(10);
    const easy = fsrsNextState({ difficulty: 1, stability: 0, lastReviewAt: null }, "easy", now);
    expect(easy.difficulty).toBeCloseTo(1, 2);
  });
});

describe("fsrsRetrievability", () => {
  it("decai com o tempo e satura em 1 para tempo zero", () => {
    expect(fsrsRetrievability(2.5, 0)).toBe(1);
    expect(fsrsRetrievability(2.5, 10)).toBeCloseTo(0.6923, 3);
    expect(fsrsRetrievability(0, 10)).toBe(0);
  });
});
