/**
 * ConcursoAI — Observabilidade
 *
 * Logs estruturados (JSON) + métricas de tempo para o pipeline de IA.
 *
 * - Cada entrada é um JSON de linha única: { ts, level, scope, message, ...campos }.
 * - Nível controlado por LOG_LEVEL (debug|info|warn|error; default: info).
 * - Escopos: professor | rag | hybrid-search | deepseek | usage.
 *
 * Não altera regras de negócio — apenas instrumentação.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  [key: string]: unknown;
}

const LEVELS: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function minLevel(): number {
  const raw = (process.env.LOG_LEVEL ?? "info").toLowerCase() as LogLevel;
  return LEVELS[raw] ?? LEVELS.info;
}

/** Emite um log estruturado (JSON) se o nível estiver habilitado. */
export function structuredLog(
  scope: string,
  level: LogLevel,
  message: string,
  fields: LogFields = {}
): void {
  if (LEVELS[level] < minLevel()) return;
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope,
    message,
    ...fields,
  });
  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.log(entry);
  }
}

/** Logger estruturado por escopo (Professor, RAG, Hybrid Search, DeepSeek, Usage). */
export const logger = {
  debug: (scope: string, message: string, fields?: LogFields) =>
    structuredLog(scope, "debug", message, fields),
  info: (scope: string, message: string, fields?: LogFields) =>
    structuredLog(scope, "info", message, fields),
  warn: (scope: string, message: string, fields?: LogFields) =>
    structuredLog(scope, "warn", message, fields),
  error: (scope: string, message: string, fields?: LogFields) =>
    structuredLog(scope, "error", message, fields),
};

/** Marca o início de uma medição (Date.now). */
export function now(): number {
  return Date.now();
}

/** Tempo decorrido (ms) desde `startedAt`. */
export function elapsed(startedAt: number): number {
  return Date.now() - startedAt;
}
