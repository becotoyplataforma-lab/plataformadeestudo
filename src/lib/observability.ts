/**
 * ConcursoAI - Observabilidade
 *
 * - Cada entrada e um JSON de linha unica: { ts, level, scope, message, ...campos }.
 * - Nivel controlado por LOG_LEVEL (debug|info|warn|error; default: info).
 * - Escopos: professor | rag | hybrid-search | deepseek | usage | auth-recovery.
 *
 * Redacao (FASE B2): toda saida passa por redactLogEntry antes de ser serializada,
 * entao credencial nunca chega ao console - string de conexao, Bearer/Basic, api key,
 * service role, anon key, token, cookie, senha e JWT. O diagnostico util permanece:
 * escopo, nivel, codigo de dominio, host sem credencial e medidas de tempo.
 *
 * As expressoes usam somente regex literals: uma regex montada em string exigiria
 * escape de aspa dentro de aspa e o arquivo nasceria quebrado.
 *
 * Nao altera regras de negocio - apenas instrumentacao.
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

/** Marcador unico de valor removido. Nunca contem pedaco do segredo original. */
export const REDACTED_PLACEHOLDER = "[redigido]";

/** Segmentos de nome de chave que nunca podem ter valor registrado. */
const SECRET_SEGMENTS = new Set([
  "authorization",
  "cookie",
  "password",
  "passwd",
  "pwd",
  "secret",
  "token",
  "credential",
  "apikey",
  "anonkey",
  "publishablekey",
  "clientsecret",
  "servicerole",
  "accesskey",
  "apikeyid",
]);

/** Pares de segmento que juntos nomeiam uma credencial (api key, access token...). */
const SECRET_PAIRS = new Set([
  "api key",
  "access key",
  "secret key",
  "access token",
  "refresh token",
  "id token",
  "security token",
  "service role",
  "anon key",
  "set cookie",
  "x api key",
  "client secret",
  "publishable key",
  "db url",
  "database url",
  "connection string",
  "connection url",
  "connectionString",
  "directUrl",
  "databaseUrl",
]);

/** Divide a chave em segmentos por sublinhado, traco e camelCase. */
function keySegments(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((segment) => segment.length > 0);
}

/** Nome de chave que carrega credencial: o valor inteiro e substituido. */
export function isSecretKeyName(key: string): boolean {
  const segments = keySegments(key);
  if (segments.length === 0) return false;
  if (segments.some((segment) => SECRET_SEGMENTS.has(segment))) return true;
  const joined = segments.join(" ");
  return Array.from(SECRET_PAIRS).some((pair) => joined.includes(pair));
}

/** URL com usuario e senha embutidos (postgres://user:senha@host). */
const CONNECTION_STRING_WITH_USER = /\b[a-z][a-z0-9+.\-]*:\/\/[^\s/@:]+:[^\s@/]+@/gi;

/** JWT de sessao, de recuperacao ou de provedor. */
const JWT_LIKE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;

/** Host de projeto Supabase: o project ref identifica a infraestrutura. */
const SUPABASE_REF_HOST = /\b[a-z0-9]{20}\.supabase\.(?:co|in|com)\b/gi;

/** Mencao explicita a ref em texto de erro de guard ou de config. */
const SUPABASE_REF_IN_TEXT = /\b(?:ref|project[_-]?ref)[=:][ \t]*[a-z0-9]{20}\b/gi;

/** Header de autorizacao copiado para dentro de uma mensagem. */
const AUTH_SCHEME_VALUE = /\b(Bearer|Basic)[ \t]+[^\s,;]+/gi;

/** chave: valor / chave = valor / "chave": "valor" em texto livre. */
const SECRET_KEY_ASSIGNMENT =
  /([\"\x27]?[A-Za-z0-9_.\-]*(?:authorization|cookie|password|passwd|pwd|secret|token|api[_-]?key|apikey|access[_-]?key|service[_-]?role|anon[_-]?key|publishable[_-]?key|client[_-]?secret|credential)[A-Za-z0-9_.\-]*[\"\x27]?)[ \t]*[:=][ \t]*(?:\"[^\"]*\"|\x27[^\x27]*\x27|[^ \t]+)/gi;

/**
 * Redige credenciais de um texto livre preservando o restante. Funcao pura: lanca
 * nada e devolve sempre string. Nao corta o conteudo diagnostico legitimo.
 */
export function redactSecrets(value: string): string {
  if (value.length === 0) return value;

  let out = value.replace(CONNECTION_STRING_WITH_USER, (match) => {
    const schemeEnd = match.indexOf("://") + 3;
    return match.slice(0, schemeEnd) + REDACTED_PLACEHOLDER + "@";
  });

  out = out.replace(JWT_LIKE, REDACTED_PLACEHOLDER);
  out = out.replace(SUPABASE_REF_HOST, REDACTED_PLACEHOLDER);
  out = out.replace(SUPABASE_REF_IN_TEXT, REDACTED_PLACEHOLDER);
  out = out.replace(AUTH_SCHEME_VALUE, "$1 " + REDACTED_PLACEHOLDER);
  out = out.replace(SECRET_KEY_ASSIGNMENT, "$1: " + REDACTED_PLACEHOLDER);

  return out;
}

/** Valor dentro de um campo de log: string, Error, array ou objeto raso. */
function redactFieldValue(value: unknown): unknown {
  if (typeof value === "string") return redactSecrets(value);
  if (value instanceof Error) {
    const code = (value as { code?: unknown }).code;
    return {
      name: value.name,
      message: redactSecrets(value.message),
      ...(typeof code === "string" && code.length > 0 ? { code } : {}),
    };
  }
  if (Array.isArray(value)) return value.map(redactFieldValue);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, inner] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSecretKeyName(key) ? REDACTED_PLACEHOLDER : redactFieldValue(inner);
    }
    return out;
  }
  return value;
}

/** Redige mensagem e campos antes da serializacao do registro. */
export function redactLogEntry(
  fields: LogFields,
  message: string,
): { message: string; fields: LogFields } {
  const sanitized: LogFields = {};
  for (const [key, value] of Object.entries(fields)) {
    sanitized[key] = isSecretKeyName(key) ? REDACTED_PLACEHOLDER : redactFieldValue(value);
  }
  return { message: redactSecrets(message), fields: sanitized };
}

/**
 * Resumo seguro de um erro lancado. Use no lugar de repassar error.message para o
 * cliente ou para o log: preserva nome e codigo de dominio, redige credencial.
 */
export function safeErrorLog(error: unknown): {
  name: string;
  code?: string;
  message: string;
} {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return {
      name: error.name,
      ...(typeof code === "string" && code.length > 0 ? { code } : {}),
      message: redactSecrets(error.message),
    };
  }
  return { name: "UnknownError", message: redactSecrets(String(error)) };
}

/** Emite um log estruturado (JSON) se o nivel estiver habilitado. */
export function structuredLog(
  scope: string,
  level: LogLevel,
  message: string,
  fields: LogFields = {}
): void {
  if (LEVELS[level] < minLevel()) return;
  const clean = redactLogEntry(fields, message);
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    scope: redactSecrets(scope),
    message: clean.message,
    ...clean.fields,
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

/** Marca o inicio de uma medicao (Date.now). */
export function now(): number {
  return Date.now();
}

/** Tempo decorrido (ms) desde startedAt. */
export function elapsed(startedAt: number): number {
  return Date.now() - startedAt;
}
