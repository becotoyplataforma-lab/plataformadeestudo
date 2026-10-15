/**
 * ConcursoAI - Guarda fail-closed de banco para scripts Node puros (.mjs).
 *
 * A politica autoritativa vive em src/lib/db/env-guard.ts (TypeScript). Os scripts .mjs
 * rodam em Node puro, sem tsx, e ate agora resolviam DATABASE_URL (do ambiente ou de um
 * arquivo .env) e abriam conexao sem verificar o destino: se o .env apontasse para o
 * projeto de producao, um comando de leitura ou de migration atingia producao.
 *
 * Este modulo ESPELHA a decisao do guard para esses caminhos. Nao abre conexao, nao imprime
 * segredo algum e recusa todo destino que nao seja comprovadamente banco de teste. A URL e
 * resolvida pelo chamador e nunca e ecoada aqui.
 *
 * PARIDADE VIGIADA: src/lib/db/__tests__/script-db-safety-parity.test.ts compara cada
 * veredito daqui com evaluateDatabaseSafety() sobre a mesma matriz de URLs e ambiente.
 * Mudou a regra no guard TypeScript, traga para ca: a suite denuncia o desvio.
 */

export const NON_PRODUCTION_DATABASE_REQUIRED = "NON_PRODUCTION_DATABASE_REQUIRED";

/** Codigo de saida quando o guard bloqueia (o mesmo de scripts/db-guard.ts). */
export const SCRIPT_DB_BLOCKED_EXIT_CODE = 3;

/** Hosts de maquina local: ali o banco roda no proprio computador, entao e teste. */
const SAFE_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "host.docker.internal"]);

/** Project ref do Supabase: 20 caracteres [a-z0-9]. Mesma medida do guard TypeScript. */
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

/** Sufixos da infraestrutura Supabase de banco. Comparacao por sufixo, nunca substring. */
const SUPABASE_DATABASE_HOST_SUFFIXES = [".supabase.co", ".supabase.com"];

/** Rotulos que jamais podem ser lidos como project ref. */
const NON_REF_HOST_LABELS = new Set(["supabase", "pooler", "db", "api", "www", "postgres"]);

/** Tokens que identificam banco de teste, comparados por rotulo inteiro. */
const TEST_DATABASE_TOKENS = ["test", "staging", "stg", "ci", "sandbox", "dev"];

/** Tokens que nunca podem ser confundidos com teste. */
const PRODUCTION_DATABASE_TOKENS = ["production", "prod", "live"];

/** Chave do ambiente que interessam a decisao. */
export const DATABASE_ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "PROD_SUPABASE_PROJECT_REF",
  "SAFE_TEST_DATABASE_REFS",
  "NODE_ENV",
];

function trimmed(value) {
  return typeof value === "string" ? value.trim() : "";
}

function pick(env, name) {
  const value = trimmed(env[name]);
  return value.length > 0 ? value : undefined;
}

/** Aspas de envolucro aparecem em .env; a URL real nao pode carrega-las. */
function stripQuotes(value) {
  const quote = String.fromCharCode(39);
  let out = value;
  if (out.charAt(0) === "\"" || out.charAt(0) === quote) out = out.slice(1);
  const last = out.charAt(out.length - 1);
  if (last === "\"" || last === quote) out = out.slice(0, -1);
  return out;
}

function isSupabaseDatabaseHost(hostname) {
  const normalized = hostname.toLowerCase();
  return SUPABASE_DATABASE_HOST_SUFFIXES.some(
    (suffix) => normalized.endsWith(suffix) && normalized.length > suffix.length,
  );
}

function projectRefFromHostname(hostname) {
  const normalized = hostname.toLowerCase();
  if (!isSupabaseDatabaseHost(normalized)) return undefined;
  const labels = normalized.split(".").filter((label) => label.length > 0).reverse();
  for (const label of labels) {
    if (PROJECT_REF_PATTERN.test(label) && !NON_REF_HOST_LABELS.has(label)) {
      return label;
    }
  }
  return undefined;
}

/** Em poolers o ref pode vir no usuario (postgres.<ref>), nao no hostname. */
function projectRefFromUsername(rawUsername) {
  let username = rawUsername;
  try {
    username = decodeURIComponent(rawUsername);
  } catch {
    username = rawUsername;
  }
  const parts = username.split(".");
  const label = parts.length > 0 ? parts[parts.length - 1] : "";
  if (!PROJECT_REF_PATTERN.test(label) || NON_REF_HOST_LABELS.has(label)) {
    return undefined;
  }
  return label;
}

function hasDatabaseNameToken(databaseName, tokens) {
  const segments = databaseName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((segment) => segment.length > 0);
  return tokens.some((token) => segments.includes(token));
}

/**
 * Le a string de conexao sem nunca expor credencial. Null quando ausente ou invalida.
 */
function identify(rawUrl) {
  const value = trimmed(rawUrl);
  if (!value) return null;
  let url;
  try {
    url = new URL(stripQuotes(value));
  } catch {
    return null;
  }
  let pathname = url.pathname;
  if (pathname.startsWith("/")) pathname = pathname.slice(1);
  const options = url.searchParams.get("options") || "";
  const dbnameMatch = /(?:^|&)dbname=([^&]*)/.exec(options);
  if (dbnameMatch && dbnameMatch[1]) {
    try {
      pathname = decodeURIComponent(dbnameMatch[1]);
    } catch {
      /* mantem o pathname ja lido da URI */
    }
  }
  const hostname = url.hostname.toLowerCase();
  return {
    hostname,
    database: pathname || undefined,
    supabaseHost: isSupabaseDatabaseHost(hostname),
    projectRef: projectRefFromHostname(hostname) || projectRefFromUsername(url.username),
  };
}

/**
 * Project ref de producao na mesma ordem do guard TypeScript:
 *   1. PROD_SUPABASE_PROJECT_REF; 2. DIRECT_URL; 3. NEXT_PUBLIC_SUPABASE_URL;
 *   4. o proprio DATABASE_URL quando NODE_ENV=production. Null = nada comprovavel.
 */
export function productionProjectRefFromEnv(env = process.env) {
  const explicit = pick(env, "PROD_SUPABASE_PROJECT_REF");
  if (explicit) return explicit.toLowerCase();
  const fromDirectUrl = identify(pick(env, "DIRECT_URL"));
  if (fromDirectUrl && fromDirectUrl.projectRef) return fromDirectUrl.projectRef;
  const publicUrl = pick(env, "NEXT_PUBLIC_SUPABASE_URL");
  if (publicUrl) {
    try {
      const ref = projectRefFromHostname(new URL(publicUrl).hostname.toLowerCase());
      if (ref) return ref;
    } catch {
      /* URL publica invalida: segue para o proximo fallback */
    }
  }
  if (pick(env, "NODE_ENV") === "production") {
    const self = identify(pick(env, "DATABASE_URL"));
    return self && self.projectRef ? self.projectRef : null;
  }
  return null;
}

/** Allowlist de refs de teste lida do ambiente, no mesmo formato do guard. */
export function safeTestProjectRefsFromEnv(env = process.env) {
  const raw = pick(env, "SAFE_TEST_DATABASE_REFS");
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => PROJECT_REF_PATTERN.test(item));
}

/** Origem do processo: decide se NODE_ENV=production pode ser ignorado. */
export function detectScriptOrigin(env = process.env) {
  if (pick(env, "VITEST")) return "vitest";
  if (pick(env, "PLAYWRIGHT_TEST_BASE_URL")) return "playwright";
  if (pick(env, "NEXT_RUNTIME")) return "nextjs";
  if (pick(env, "TSX_CLI_VERSION") || pick(env, "npm_lifecycle_event")) return "cli";
  return "unknown";
}

/**
 * Veredito fail-closed, regra por regra identico a evaluateDatabaseSafety():
 * producao fora do harness bloqueia; URL ausente ou invalida bloqueia; host local
 * libera; host Supabase (ou qualquer URL com ref) so libera por comparacao de ref;
 * fora do Supabase exige nome de banco claramente de teste e sem marca de producao.
 */
export function evaluateScriptDatabaseSafety(rawUrl, env = process.env, overrides = {}) {
  const nodeEnv = overrides.nodeEnv !== undefined ? overrides.nodeEnv : pick(env, "NODE_ENV");
  const origin = overrides.origin !== undefined ? overrides.origin : detectScriptOrigin(env);
  const url = rawUrl !== undefined ? rawUrl : pick(env, "DATABASE_URL");

  if (nodeEnv === "production" && origin !== "vitest") {
    return { safe: false, reason: "processo com NODE_ENV=production fora do harness de teste" };
  }

  if (!url) {
    return { safe: false, reason: "DATABASE_URL ausente" };
  }

  const identity = identify(url);
  if (!identity || !identity.hostname) {
    return { safe: false, reason: "DATABASE_URL invalida ou nao interpretavel" };
  }

  const productionRef =
    overrides.productionRef !== undefined ? overrides.productionRef : productionProjectRefFromEnv(env);
  const safeRefs =
    overrides.safeRefs !== undefined ? overrides.safeRefs : safeTestProjectRefsFromEnv(env);
  const base = {
    hostname: identity.hostname,
    database: identity.database,
    projectRef: identity.projectRef,
    productionProjectRef: productionRef || undefined,
  };

  if (SAFE_HOSTS.has(identity.hostname)) {
    return Object.assign({}, base, { safe: true, reason: "host de maquina local" });
  }

  const databaseName = (identity.database || "").toLowerCase();

  if (identity.supabaseHost || identity.projectRef) {
    if (!identity.projectRef) {
      return Object.assign({}, base, {
        safe: false,
        reason: "host Supabase sem project ref identificavel: isolamento nao comprovavel",
      });
    }
    if (!productionRef) {
      return Object.assign({}, base, {
        safe: false,
        reason: "project ref de producao desconhecido: isolamento nao comprovavel",
      });
    }
    if (identity.projectRef === productionRef) {
      return Object.assign({}, base, { safe: false, reason: "mesmo projeto Supabase da producao" });
    }
    if (!safeRefs.includes(identity.projectRef)) {
      return Object.assign({}, base, {
        safe: false,
        reason: "ref distinto do de producao, mas fora de SAFE_TEST_DATABASE_REFS",
      });
    }
    return Object.assign({}, base, { safe: true, reason: "ref aprovado em SAFE_TEST_DATABASE_REFS" });
  }

  const looksProduction = hasDatabaseNameToken(databaseName, PRODUCTION_DATABASE_TOKENS);
  const looksTest = hasDatabaseNameToken(databaseName, TEST_DATABASE_TOKENS);

  if (!looksProduction && looksTest) {
    return Object.assign({}, base, {
      safe: true,
      reason: "host externo com banco claramente marcado como teste ou staging",
    });
  }

  return Object.assign({}, base, {
    safe: false,
    reason: "destino externo sem marca clara de teste: isolamento nao comprovavel",
  });
}

/** Erro de dominio do espelho: traz alvo e motivo, nunca credencial. */
export class ScriptDatabaseBlockedError extends Error {
  constructor(target, reason) {
    super(["Escrita em banco de dados bloqueada para \"" + target + "\": " + reason + ".", "Desenvolvimento e producao compartilham o mesmo projeto Supabase neste ambiente.", "Provisione um banco isolado em DATABASE_URL ou aprove o project ref em SAFE_TEST_DATABASE_REFS."].join(" "));
    this.name = "NonProductionDatabaseRequiredError";
    this.code = NON_PRODUCTION_DATABASE_REQUIRED;
    this.target = target;
    this.reason = reason;
  }
}

/** Linha de log segura: host, database, ref e motivo. Nunca usuario, senha ou URL. */
export function describeScriptDatabaseTarget(target, rawUrl, env = process.env, overrides = {}) {
  const verdict = evaluateScriptDatabaseSafety(rawUrl, env, overrides);
  return [
    "db-safety",
    "target=" + target,
    "nodeEnv=" + (pick(env, "NODE_ENV") || "-"),
    "origin=" + (overrides.origin || detectScriptOrigin(env)),
    "host=" + (verdict.hostname || "-"),
    "database=" + (verdict.database || "-"),
    "ref=" + (verdict.projectRef || "-"),
    "prodRef=" + (verdict.productionProjectRef || "-"),
    "safe=" + verdict.safe,
    "reason=" + verdict.reason,
  ].join(" ");
}

/** Lanca quando o destino nao e comprovadamente banco de teste. */
export function assertScriptDatabaseTarget(target, rawUrl, env = process.env, overrides = {}) {
  const verdict = evaluateScriptDatabaseSafety(rawUrl, env, overrides);
  if (!verdict.safe) {
    throw new ScriptDatabaseBlockedError(target, verdict.reason);
  }
  return verdict;
}

/**
 * Porta de entrada dos scripts: imprime o veredito log-safe e define codigo de saida 3
 * antes de QUALQUER conexao. Use no topo, imediatamente apos resolver a URL.
 */
export function guardScriptDatabaseTargetOrExit(target, rawUrl, env = process.env) {
  const verdict = evaluateScriptDatabaseSafety(rawUrl, env);
  const summary = describeScriptDatabaseTarget(target, rawUrl, env);
  if (verdict.safe) {
    console.log(summary);
    return verdict;
  }
  console.error(summary);
  console.error("[" + target + "] BLOCKED " + NON_PRODUCTION_DATABASE_REQUIRED + ": " + verdict.reason);
  console.error("Nenhuma conexao sera aberta. Use um banco de teste isolado ou aprove o ref em SAFE_TEST_DATABASE_REFS.");
  process.exitCode = SCRIPT_DB_BLOCKED_EXIT_CODE;
  return verdict;
}

/**
 * Le de um arquivo .env apenas as chaves que interessam a decisao de banco. Nenhum
 * valor e impresso: o conteudo so alimenta o objeto de ambiente usado pelo guard.
 */
export function readDatabaseEnvKeys(fs, filePath) {
  const found = {};
  let raw = "";
  try {
    raw = fs.readFileSync(filePath, "utf8");
  } catch {
    return found;
  }
  for (const line of raw.split(/\r?\n/)) {
    const text = line.trim();
    if (!text || text.startsWith("#")) continue;
    const idx = text.indexOf("=");
    if (idx === -1) continue;
    const key = text.slice(0, idx).trim();
    if (!DATABASE_ENV_KEYS.includes(key)) continue;
    const value = stripQuotes(text.slice(idx + 1).trim());
    if (value.length > 0 && found[key] === undefined) found[key] = value;
  }
  return found;
}

/**
 * Mescla o ambiente do processo com o que os arquivos .env trazem, sem sobrescrever
 * o que ja veio do ambiente: equivalente do loadEnvConfig() usado pelo guard TS.
 */
export function mergeDatabaseEnv(fs, env, root, files) {
  const merged = Object.assign({}, env);
  for (const file of files) {
    const values = readDatabaseEnvKeys(fs, root + "/" + file);
    for (const key of Object.keys(values)) {
      if (pick(merged, key) === undefined) merged[key] = values[key];
    }
  }
  return merged;
}

/* ------------------------------------------------------------------ *
 * RAMO DE PRODUCAO                                                     *
 * ------------------------------------------------------------------ *
 * Alguns scripts existem PARA tocar producao: auditoria de schema, diagnostico do
 * ledger e carimbo manual. O guard acima recusaria esses destinos sempre, entao eles
 * precisam de outra politica, e nao de uma excecao silenciosa. A regra continua
 * fail-closed, mas inverte a prova: o operador precisa NOMEAR o projeto antes de
 * qualquer conexao, e o nome precisa bater com o ref resolvido do URL e com o ref de
 * producao configurado.
 *
 *   node scripts/<x>.mjs --confirm-production=<project-ref>
 *
 * e, se o script escreve, tambem --allow-production-write. A URL nunca e ecoada.
 *
 * IMPORTANTE: este ramo nao altera evaluateScriptDatabaseSafety(). A matriz paridade
 * do guard TypeScript continua vigiada por script-db-safety-parity.test.ts.
 */

export const PRODUCTION_CONFIRM_REQUIRED = "PRODUCTION_CONFIRM_REQUIRED";

/** Codigo de saida distinto do 3 do guard de teste: bloqueio por falta de confirmacao. */
export const PRODUCTION_CONFIRM_EXIT_CODE = 4;

export const PRODUCTION_CONFIRM_FLAG = "--confirm-production=";
export const PRODUCTION_WRITE_FLAG = "--allow-production-write";

/** Fallback para CI, onde o argv pode ficar em logs: o valor vem do ambiente. */
export const PRODUCTION_CONFIRM_ENV_KEY = "PRODUCTION_CONFIRM_REF";

/** Project ref no mesmo formato do guard TypeScript: 20 caracteres [a-z0-9]. */
export function isProjectRef(value) {
  return typeof value === "string" && PROJECT_REF_PATTERN.test(value.trim().toLowerCase());
}

/** Le as flags de confirmacao do argv (e o fallback do ambiente). Nunca le segredos. */
export function readProductionConfirmation(argv = process.argv, env = process.env) {
  const flags = Array.isArray(argv) ? argv : [];
  let confirmRef;
  let allowWrite = false;
  for (const arg of flags) {
    if (typeof arg !== "string") continue;
    if (arg.startsWith(PRODUCTION_CONFIRM_FLAG)) {
      confirmRef = arg.slice(PRODUCTION_CONFIRM_FLAG.length).trim().toLowerCase();
    } else if (arg === PRODUCTION_WRITE_FLAG) {
      allowWrite = true;
    }
  }
  if (confirmRef === undefined) {
    const fromEnv = trimmed(env[PRODUCTION_CONFIRM_ENV_KEY]).toLowerCase();
    if (fromEnv.length > 0) confirmRef = fromEnv;
  }
  return {
    confirmRef: confirmRef !== undefined && confirmRef.length > 0 ? confirmRef : undefined,
    allowWrite,
  };
}

/**
 * Veredito de producao. Nao abre conexao e nao imprime nada: quem decide o que fazer com
 * o resultado e o script, sempre antes de chamar o driver. Resolvido por identidade de
 * URL (incluindo pooler, onde o ref vive no usuario), nunca por substring do texto.
 */
export function evaluateProductionTarget(rawUrl, env = process.env, options = {}) {
  const argv = options.argv !== undefined ? options.argv : process.argv;
  const writes = options.writes === true;
  const url = rawUrl !== undefined ? rawUrl : pick(env, "DATABASE_URL");
  const productionRef =
    options.productionRef !== undefined ? options.productionRef : productionProjectRefFromEnv(env);
  const base = {
    hostname: undefined,
    database: undefined,
    projectRef: undefined,
    productionProjectRef: productionRef || undefined,
    writes,
  };

  if (!url) return Object.assign({}, base, { allowed: false, reason: "DATABASE_URL ausente" });

  const identity = identify(url);
  if (!identity || !identity.hostname) {
    return Object.assign({}, base, { allowed: false, reason: "DATABASE_URL invalida ou nao interpretavel" });
  }

  const info = Object.assign({}, base, {
    hostname: identity.hostname,
    database: identity.database,
    projectRef: identity.projectRef,
  });

  if (!identity.projectRef) {
    return Object.assign({}, info, {
      allowed: false,
      reason: "project ref nao identificavel no destino: recuso sem saber em que projeto entraria",
    });
  }
  if (!productionRef) {
    return Object.assign({}, info, {
      allowed: false,
      reason: "PROD_SUPABASE_PROJECT_REF ausente: nao ha como provar que este destino e a producao configurada",
    });
  }
  if (identity.projectRef !== productionRef) {
    return Object.assign({}, info, {
      allowed: false,
      reason:
        "destino nao e o projeto de producao configurado; para banco de teste use guardScriptDatabaseTargetOrExit",
    });
  }

  const confirmation = readProductionConfirmation(argv, env);
  if (confirmation.confirmRef === undefined) {
    return Object.assign({}, info, {
      allowed: false,
      reason: "falta " + PRODUCTION_CONFIRM_FLAG + "<ref> a nomear o projeto de producao",
    });
  }
  if (!isProjectRef(confirmation.confirmRef)) {
    return Object.assign({}, info, {
      allowed: false,
      reason: "confirmacao nao e um project ref valido (20 caracteres a-z0-9)",
    });
  }
  if (confirmation.confirmRef !== identity.projectRef) {
    return Object.assign({}, info, {
      allowed: false,
      reason: "confirmacao nomeia um ref distinto do destino real",
    });
  }
  if (writes && !confirmation.allowWrite) {
    return Object.assign({}, info, {
      allowed: false,
      reason: "este script escreve; falta " + PRODUCTION_WRITE_FLAG,
    });
  }

  return Object.assign({}, info, {
    allowed: true,
    reason: writes ? "producao confirmada para escrita" : "producao confirmada, apenas leitura",
  });
}

/** Linha de log segura: host, database e refs. Nunca usuario, senha ou URL. */
export function describeProductionTarget(target, verdict) {
  return [
    "prod-guard",
    "target=" + target,
    "host=" + (verdict.hostname || "-"),
    "database=" + (verdict.database || "-"),
    "ref=" + (verdict.projectRef || "-"),
    "prodRef=" + (verdict.productionProjectRef || "-"),
    "writes=" + (verdict.writes === true),
    "allowed=" + verdict.allowed,
    "reason=" + verdict.reason,
  ].join(" ");
}

/** Erro de dominio do ramo de producao: alvo e motivo, nunca credencial. */
export class ProductionConfirmationError extends Error {
  constructor(target, reason) {
    super(
      [
        "Producao nao confirmada para \"" + target + "\": " + reason + ".",
        "Passe " + PRODUCTION_CONFIRM_FLAG + "<ref>" + " e, havendo escrita, " + PRODUCTION_WRITE_FLAG + ".",
        "Nenhuma conexao sera aberta.",
      ].join(" "),
    );
    this.name = "ProductionConfirmationError";
    this.code = PRODUCTION_CONFIRM_REQUIRED;
    this.target = target;
    this.reason = reason;
  }
}

/** Para chamadores que preferem excecao (testes, wrappers). */
export function assertProductionTarget(target, rawUrl, env = process.env, options = {}) {
  const verdict = evaluateProductionTarget(rawUrl, env, options);
  if (!verdict.allowed) {
    throw new ProductionConfirmationError(target, verdict.reason);
  }
  return verdict;
}

/**
 * Porta de entrada dos scripts de producao: imprime o veredito log-safe e devolve
 * allowed=false com codigo de saida 4 antes de QUALQUER conexao. Use no topo, logo
 * apos resolver a DATABASE_URL, e aborte o script quando allowed for false.
 */
export function guardProductionTargetOrExit(target, rawUrl, options = {}) {
  const env = options.env !== undefined ? options.env : process.env;
  const verdict = evaluateProductionTarget(rawUrl, env, options);
  const line = describeProductionTarget(target, verdict);
  if (verdict.allowed) {
    console.log(line);
    return verdict;
  }
  console.error(line);
  console.error("[" + target + "] BLOCKED " + PRODUCTION_CONFIRM_REQUIRED + ": " + verdict.reason);
  console.error("Nenhuma conexao sera aberta.");
  process.exitCode = PRODUCTION_CONFIRM_EXIT_CODE;
  return verdict;
}
