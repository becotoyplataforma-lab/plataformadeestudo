/**
 * ConcursoAI — FSRS (Free Spaced Repetition Scheduler) — implementação
 * simplificada, escrita do zero a partir da especificação pública do FSRS.
 *
 * Mantém os conceitos centrais do FSRS:
 *   - Dificuldade (D) ∈ [1,10], inicia em 5.
 *   - Estabilidade (S), em dias (0 = cartão novo).
 *   - Recuperabilidade R(t) = (1 + t / (9·S))^-1  (fórmula FSRS-4.5).
 *   - Quatro notas: again / hard / good / easy.
 *
 * É um modelo reduzido (sem o conjunto completo de pesos w0..w17 do FSRS
 * completo), mas captura a dinâmica de dificuldade + estabilidade e é
 * determinístico para testes. Sem dependência externa (licença: código próprio).
 */
export type FsrsRating = "again" | "hard" | "good" | "easy";

export interface FsrsState {
  difficulty: number;
  stability: number;
  lastReviewAt: Date | null;
}

export interface FsrsNextState {
  difficulty: number;
  stability: number;
  intervalDays: number;
  dueDate: Date;
}

export const FSRS_INITIAL_DIFFICULTY = 5;
const MIN_STABILITY = 0.5;
const MAX_STABILITY = 36_500; // 100 anos (teto de segurança)
const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Recuperabilidade (FSRS-4.5) dado o tempo decorrido desde a última revisão. */
export function fsrsRetrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  return Math.pow(1 + elapsedDays / (9 * stability), -1);
}

/**
 * Calcula o próximo estado de revisão de um cartão.
 * `state.lastReviewAt = null` e `stability = 0` indicam cartão novo.
 */
export function fsrsNextState(
  state: FsrsState,
  rating: FsrsRating,
  now = new Date()
): FsrsNextState {
  const difficulty = clamp(
    Number.isFinite(state.difficulty) && state.difficulty > 0
      ? state.difficulty
      : FSRS_INITIAL_DIFFICULTY,
    1,
    10
  );
  const stability = Math.max(0, state.stability ?? 0);

  const elapsedDays =
    state.lastReviewAt && stability > 0
      ? Math.max(0, (now.getTime() - state.lastReviewAt.getTime()) / DAY_MS)
      : 0;
  const retrievability = fsrsRetrievability(stability, elapsedDays);

  let nextDifficulty = difficulty;
  let nextStability = stability;

  switch (rating) {
    case "again":
      nextDifficulty = Math.min(10, difficulty + 1);
      nextStability = stability === 0 ? 0.5 : Math.max(MIN_STABILITY, stability * 0.5);
      break;
    case "hard":
      nextDifficulty = Math.min(10, difficulty + 0.15);
      nextStability = stability === 0 ? 1 : stability * 1.2;
      break;
    case "good":
      nextDifficulty = difficulty;
      // Ganho de estabilidade maior quando o cartão estava "atrasado" (R baixo).
      nextStability = stability === 0 ? 2.5 : stability * (1 + 1.5 * (1 - retrievability));
      break;
    case "easy":
      nextDifficulty = Math.max(1, difficulty - 0.15);
      nextStability = stability === 0 ? 5 : stability * 2.5;
      break;
  }

  nextStability = clamp(nextStability, MIN_STABILITY, MAX_STABILITY);
  const intervalDays = rating === "again" ? 1 : Math.max(1, Math.ceil(nextStability));
  const dueDate = new Date(now.getTime() + intervalDays * DAY_MS);

  return {
    difficulty: round(nextDifficulty, 4),
    stability: round(nextStability, 4),
    intervalDays,
    dueDate,
  };
}
