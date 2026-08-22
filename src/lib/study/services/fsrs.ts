/**
 * ConcursoAI — FSRS-6 (Free Spaced Repetition Scheduler)
 *
 * Implementação completa do FSRS-6 com o conjunto de pesos w0..w20,
 * escrita do zero a partir da especificação pública do FSRS
 * (https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm)
 * e alinhada ao ts-fsrs (https://github.com/open-spaced-repetition/ts-fsrs).
 *
 * Mantém a MESMA API pública da implementação simplificada anterior
 * (FsrsRating, FsrsState, FsrsNextState, fsrsRetrievability, fsrsNextState,
 * FSRS_INITIAL_DIFFICULTY) para compatibilidade com o ReviewScheduleService
 * e com os dados já persistidos em `review_schedules` (stability, difficulty,
 * last_rating).
 *
 * Sem dependência externa (licença: código próprio).
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

/** Dificuldade inicial (Good) — mantida para compatibilidade. */
export const FSRS_INITIAL_DIFFICULTY = 5;

// ============================================================
// Parâmetros FSRS-6 (pesos w0..w20)
// ============================================================

/** Pesos padrão do FSRS-6 (default_w do ts-fsrs). */
export const FSRS_WEIGHTS: readonly number[] = Object.freeze([
  0.212, // w0  initial stability (Again)
  1.2931, // w1  initial stability (Hard)
  2.3065, // w2  initial stability (Good)
  8.2956, // w3  initial stability (Easy)
  6.4133, // w4  initial difficulty (Good)
  0.8334, // w5  initial difficulty (multiplier)
  3.0194, // w6  difficulty (multiplier)
  0.001, // w7  difficulty (multiplier)
  1.8722, // w8  stability (exponent)
  0.1666, // w9  stability (negative power)
  0.796, // w10 stability (exponent)
  1.4835, // w11 fail stability (multiplier)
  0.0614, // w12 fail stability (negative power)
  0.2629, // w13 fail stability (power)
  1.6483, // w14 fail stability (exponent)
  0.6014, // w15 stability (multiplier for Hard)
  1.8729, // w16 stability (multiplier for Easy)
  0.5425, // w17 short-term stability (exponent)
  0.0912, // w18 short-term stability (exponent)
  0.0658, // w19 short-term last-stability (exponent)
  0.1542, // w20 decay
]);

/** Decay do FSRS-6 (w20). */
export const FSRS_DECAY = FSRS_WEIGHTS[20];

/** Retenção desejada (request retention) — 90%. */
export const FSRS_REQUEST_RETENTION = 0.9;

/** Intervalo máximo (dias) — 100 anos. */
export const FSRS_MAX_INTERVAL = 36_500;

/** Estabilidade mínima. */
const S_MIN = 0.001;

/** Estabilidade máxima. */
const S_MAX = 36_500;

const DAY_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/**
 * Fator de decaimento do FSRS-6.
 *   DECAY  = -w20
 *   FACTOR = e^(ln(0.9)/DECAY) - 1
 */
function computeDecayFactor(): { decay: number; factor: number } {
  const decay = -FSRS_DECAY;
  const factor = Math.exp(Math.pow(decay, -1) * Math.log(0.9)) - 1.0;
  return { decay, factor: round(factor, 8) };
}

/**
 * Recuperabilidade (curva de esquecimento FSRS-6):
 *   R(t,S) = (1 + FACTOR * t/S)^DECAY
 */
export function fsrsRetrievability(stability: number, elapsedDays: number): number {
  if (stability <= 0) return 0;
  const { decay, factor } = computeDecayFactor();
  return round(Math.pow(1 + (factor * elapsedDays) / stability, decay), 8);
}

/** Estabilidade inicial: S0(G) = max(w[G-1], 0.1). */
function initStability(g: number): number {
  return Math.max(FSRS_WEIGHTS[g - 1], 0.1);
}

/** Dificuldade inicial: D0(G) = w4 - e^((G-1)*w5) + 1. */
function initDifficulty(g: number): number {
  return round(FSRS_WEIGHTS[4] - Math.exp((g - 1) * FSRS_WEIGHTS[5]) + 1, 8);
}

/** Damping linear: delta_d * (10 - D) / 9. */
function linearDamping(deltaD: number, oldD: number): number {
  return round((deltaD * (10 - oldD)) / 9, 8);
}

/** Mean reversion: w7 * init + (1 - w7) * current. */
function meanReversion(init: number, current: number): number {
  return round(FSRS_WEIGHTS[7] * init + (1 - FSRS_WEIGHTS[7]) * current, 8);
}

/** Próxima dificuldade: D' = clamp(w7*D0(4) + (1-w7)*next_d, 1, 10). */
function nextDifficulty(d: number, g: number): number {
  const deltaD = -FSRS_WEIGHTS[6] * (g - 3);
  const nextD = d + linearDamping(deltaD, d);
  return clamp(meanReversion(initDifficulty(4), nextD), 1, 10);
}

/** Estabilidade após recall (g=2,3,4). */
function nextRecallStability(d: number, s: number, r: number, g: number): number {
  const hardPenalty = g === 2 ? FSRS_WEIGHTS[15] : 1;
  const easyBound = g === 4 ? FSRS_WEIGHTS[16] : 1;
  return round(
    clamp(
      s *
        (1 +
          Math.exp(FSRS_WEIGHTS[8]) *
            (11 - d) *
            Math.pow(s, -FSRS_WEIGHTS[9]) *
            (Math.exp((1 - r) * FSRS_WEIGHTS[10]) - 1) *
            hardPenalty *
            easyBound),
      S_MIN,
      S_MAX
    ),
    8
  );
}

/** Estabilidade após esquecimento (g=1). */
function nextForgetStability(d: number, s: number, r: number): number {
  return round(
    clamp(
      FSRS_WEIGHTS[11] *
        Math.pow(d, -FSRS_WEIGHTS[12]) *
        (Math.pow(s + 1, FSRS_WEIGHTS[13]) - 1) *
        Math.exp((1 - r) * FSRS_WEIGHTS[14]),
      S_MIN,
      S_MAX
    ),
    8
  );
}

/** Modificador de intervalo: I(r,s) = (r^(1/DECAY) - 1)/FACTOR. */
function intervalModifier(): number {
  const { decay, factor } = computeDecayFactor();
  return (Math.pow(FSRS_REQUEST_RETENTION, 1 / decay) - 1) / factor;
}

/** Próximo intervalo: I = min(max(1, round(S * modifier)), max_interval). */
function nextInterval(s: number): number {
  return Math.min(
    Math.max(1, Math.round(s * intervalModifier())),
    FSRS_MAX_INTERVAL
  );
}

/**
 * Calcula o próximo estado de revisão de um cartão (FSRS-6 completo).
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

  // Grade FSRS: 1=again, 2=hard, 3=good, 4=easy
  const g = rating === "again" ? 1 : rating === "hard" ? 2 : rating === "good" ? 3 : 4;

  let nextDifficultyValue: number;
  let nextStabilityValue: number;

  if (stability === 0) {
    // Cartão novo: estabilidade e dificuldade iniciais.
    nextStabilityValue = initStability(g);
    nextDifficultyValue = clamp(initDifficulty(g), 1, 10);
  } else {
    nextDifficultyValue = nextDifficulty(difficulty, g);
    if (g === 1) {
      nextStabilityValue = nextForgetStability(difficulty, stability, retrievability);
    } else {
      nextStabilityValue = nextRecallStability(
        difficulty,
        stability,
        retrievability,
        g
      );
    }
  }

  nextStabilityValue = clamp(nextStabilityValue, S_MIN, S_MAX);
  const intervalDays = nextInterval(nextStabilityValue);
  const dueDate = new Date(now.getTime() + intervalDays * DAY_MS);

  return {
    difficulty: round(nextDifficultyValue, 4),
    stability: round(nextStabilityValue, 4),
    intervalDays,
    dueDate,
  };
}
