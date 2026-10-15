/**
 * Guarda de seguranca de banco de dados (fail-closed).
 *
 * Este projeto possui um unico projeto Supabase: o .env de desenvolvimento e o
 * .env.production apontam para a MESMA string de conexao, e nao existe banco de
 * teste isolado. Sem esta guarda, qualquer teste de integracao, cleanup de E2E
 * ou CLI de ingestao que rode com o ambiente local carregado escreve diretamente
 * em producao -- inclusive apagando linhas de auth.users.
 *
 * A decisao e sempre conservadora: so permite escrita quando for possivel PROVAR
 * que o destino e um banco de teste. Na duvida, bloqueia.
 *
 * Nada aqui registra credenciais: senha, token, service-role e a string de
 * conexao completa jamais passam para erros, logs ou saidas.
 */

export const NON_PRODUCTION_DATABASE_REQUIRED = "NON_PRODUCTION_DATABASE_REQUIRED" as const;

/** Hosts de maquina local, sempre tratados como banco de teste. */
const SAFE_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "host.docker.internal",
]);

/**
 * Formato oficial de um project ref do Supabase: 20 caracteres [a-z0-9].
 * Fonte unica para extracao do hostname, extracao do usuario, allowlist e
 * comparacao com a producao: as tres pontas precisam medir a mesma coisa.
 */
const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;

/**
 * Sufixos da infraestrutura Supabase que hospedam banco de dados. A
 * comparacao e feita por sufixo de dominio, nunca por substring: tratar
 * "supabase.example.com" como infraestrutura mudaria a decisao de um host
 * externo legitimo, enquanto "db.<ref>.supabase.co" e o pooler
 * "aws-0-ca-central-1.pooler.supabase.com" sao a propria infraestrutura.
 */
const SUPABASE_DATABASE_HOST_SUFFIXES = [".supabase.co", ".supabase.com"];

/** Rotulos de servico que jamais podem ser lidos como project ref. */
const NON_REF_HOST_LABELS = new Set([
  "supabase",
  "pooler",
  "db",
  "api",
  "www",
  "postgres",
]);

/**
 * Tokens que identificam explicitamente um banco de teste/staging. A
 * comparacao e por rotulo inteiro: soltos como substring eles casariam com
 * nomes comuns, inclusive o banco padrao "postgres", que contem "stg".
 */
const TEST_DATABASE_TOKENS = ["test", "staging", "stg", "ci", "sandbox", "dev"];

/** Tokens que nunca podem ser confundidos com teste. */
const PRODUCTION_DATABASE_TOKENS = ["production", "prod", "live"];

export type DatabaseSafetyVerdict = {
  safe: boolean;
  reason: string;
  hostname?: string;
  database?: string;
  projectRef?: string;
  productionProjectRef?: string;
};

type DatabaseIdentity = {
  hostname?: string;
  database?: string;
  projectRef?: string;
  supabaseHost: boolean;
};

let cachedEnvOrigin: boolean | null = null;
let cachedProductionRef: string | null | undefined;

function readEnv(name: string): string | undefined {
  const value = process.env[name];
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}
/**
 * Carrega o .env do projeto quando o processo nao o recebeu (CLI disparado sem
 * next dev / next start nao injeta variaveis). Nunca lanca: ambiente ausente
 * deve terminar em bloqueio, nao em excecao opaca.
 */
function ensureProjectEnv(): void {
  if (cachedEnvOrigin !== null) return;
  if (readEnv("DATABASE_URL")) {
    cachedEnvOrigin = false;
    return;
  }
  cachedEnvOrigin = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { loadEnvConfig } = require("@next/env") as {
      loadEnvConfig: (dir: string, dev?: boolean) => void;
    };
    loadEnvConfig(process.cwd(), readEnv("NODE_ENV") !== "production");
  } catch {
    // @next/env indisponivel: seguimos apenas com o que o processo ja possui.
  }
}

/**
 * O hostname pertence a infraestrutura de banco do Supabase? Sufixo, nao
 * substring: "supabase.example.com" e apenas um host externo de terceiros.
 */
function isSupabaseDatabaseHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return SUPABASE_DATABASE_HOST_SUFFIXES.some(
    (suffix) => normalized.endsWith(suffix) && normalized.length > suffix.length,
  );
}

/**
 * Extrai o project ref de um hostname Supabase varrendo da direita para a
 * esquerda, porque o ref e o rotulo mais proximo do dominio base:
 *   db.abcdefghijklmnopqrst.supabase.co   ->  abcdefghijklmnopqrst
 *   abcdefghijklmnopqrst.supabase.co      ->  abcdefghijklmnopqrst
 *   aws-0-ca.pooler.supabase.com          ->  undefined: ali so o usuario traz o ref
 *   db.abcdefghijklmnopqrstuv.supabase.co ->  undefined: 22 caracteres, fora do formato
 * Sem ref confiavel o resultado e undefined e nenhum nome e inventado. Um host
 * Supabase sem ref cai na regra de bloqueio, jamais na heuristica de nome de
 * banco: era assim que a conexao direta de producao, cujo banco se chama
 * "postgres", parecia um staging e acabava liberada.
 */
function projectRefFromHostname(hostname: string): string | undefined {
  const normalized = hostname.toLowerCase();
  if (!isSupabaseDatabaseHost(normalized)) return undefined;
  const labels = normalized
    .split(".")
    .filter((label) => label.length > 0)
    .reverse();
  for (const label of labels) {
    if (PROJECT_REF_PATTERN.test(label) && !NON_REF_HOST_LABELS.has(label)) {
      return label;
    }
  }
  return undefined;
}

/**
 * Interpreta uma string de conexao sem nunca expor credenciais.
 * Retorna null quando a URL esta ausente ou e invalida.
 */
/**
 * Em poolers do Supabase o ref pode nao estar no hostname: vem entao sufixado
 * no usuario, como em "postgres.abcdefghijklmnopqrst".
 */
function projectRefFromUsername(rawUsername: string): string | undefined {
  let username = rawUsername;
  try {
    username = decodeURIComponent(rawUsername);
  } catch {
    // Usuario sem escape valido: segue com o texto bruto.
  }
  const label = username.split(".").pop() ?? "";
  if (!PROJECT_REF_PATTERN.test(label) || NON_REF_HOST_LABELS.has(label)) {
    return undefined;
  }
  return label;
}
function identify(rawUrl: string | undefined): DatabaseIdentity | null {
  if (!rawUrl) return null;
  let url: URL;
  try {
    url = new URL(rawUrl.replace(/^["']|["']$/g, ""));
  } catch {
    return null;
  }
  let pathname = url.pathname;
  if (pathname.startsWith("/")) pathname = pathname.slice(1);
  const options = url.searchParams.get("options") ?? "";
  const dbnameMatch = /(?:^|&)dbname=([^&]*)/.exec(options);
  if (dbnameMatch?.[1]) {
    try {
      pathname = decodeURIComponent(dbnameMatch[1]);
    } catch {
      // mantem o pathname ja obtido da URI
    }
  }
  const hostname = url.hostname.toLowerCase();
  return {
    hostname,
    database: pathname || undefined,
    supabaseHost: isSupabaseDatabaseHost(hostname),
    projectRef: projectRefFromHostname(hostname) ?? projectRefFromUsername(url.username),
  };
}
/**
 * Project ref de producao, na ordem de prioridade:
 *   1. PROD_SUPABASE_PROJECT_REF (explicito, recomendado em CI);
 *   2. DIRECT_URL;
 *   3. NEXT_PUBLIC_SUPABASE_URL;
 *   4. o proprio DATABASE_URL, quando NODE_ENV=production.
 * Retorna null quando nao e possivel determinar; nesse caso nenhum projeto
 * Supabase e considerado seguro.
 */
export function getProductionProjectRef(): string | null {
  if (cachedProductionRef !== undefined) return cachedProductionRef;
  ensureProjectEnv();
  const explicit = readEnv("PROD_SUPABASE_PROJECT_REF");
  if (explicit) {
    cachedProductionRef = explicit.toLowerCase();
    return cachedProductionRef;
  }
  const fromDirectUrl = identify(readEnv("DIRECT_URL"))?.projectRef;
  if (fromDirectUrl) {
    cachedProductionRef = fromDirectUrl;
    return cachedProductionRef;
  }
  const publicUrl = readEnv("NEXT_PUBLIC_SUPABASE_URL");
  if (publicUrl) {
    try {
      const ref = projectRefFromHostname(new URL(publicUrl).hostname.toLowerCase());
      if (ref) {
        cachedProductionRef = ref;
        return cachedProductionRef;
      }
    } catch {
      // URL publica invalida: segue para o proximo fallback.
    }
  }
  if (readEnv("NODE_ENV") === "production") {
    cachedProductionRef = identify(readEnv("DATABASE_URL"))?.projectRef ?? null;
    return cachedProductionRef;
  }
  cachedProductionRef = null;
  return null;
}

/** Origem do processo, para decidir se NODE_ENV=production pode ser ignorado. */
export function detectExecutionOrigin():
  | "vitest"
  | "playwright"
  | "nextjs"
  | "cli"
  | "unknown" {
  if (readEnv("VITEST")) return "vitest";
  if (readEnv("PLAYWRIGHT_TEST_BASE_URL")) return "playwright";
  if (readEnv("NEXT_RUNTIME")) return "nextjs";
  if (readEnv("TSX_CLI_VERSION") || readEnv("npm_lifecycle_event")) return "cli";
  return "unknown";
}

/** Project refs aprovados explicitamente para escrita em teste. */
export function safeTestProjectRefs(): string[] {
  const raw = readEnv("SAFE_TEST_DATABASE_REFS");
  if (!raw) return [];
  return raw
    .split(/[\s,]+/)
    .map((item) => item.trim().toLowerCase())
    .filter((item) => PROJECT_REF_PATTERN.test(item));

}

/**
 * Overrides de ambiente usados apenas por suites de teste, para exercitar ramos
 * que o ambiente real nao permite alcancar.
 */
export type DatabaseGuardOverrides = {
  nodeEnv?: string;
  origin?: "vitest" | "playwright" | "nextjs" | "cli" | "unknown";
  productionRef?: string | null;
  safeRefs?: string[];
};

/**
 * Compara o nome do banco por rotulo inteiro, com borda de palavra. Divide em
 * tudo que nao e [a-z0-9]: "concursoai_test" e teste, mas "postgres" nao contem
 * "stg", "ciencias" nao contem "ci", "devocional" nao contem "dev" e "contest"
 * nao contem "test". Substring jamais libera um destino.
 */
function hasDatabaseNameToken(
  databaseName: string,
  tokens: readonly string[],
): boolean {
  const segments = databaseName
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((segment) => segment.length > 0);
  return tokens.some((token) => segments.includes(token));
}

/**
 * Decide se o destino de escrita e comprovadamente um banco de teste.
 *
 * Regras, na ordem, todas conservadoras:
 *   - NODE_ENV=production bloqueia fora do harness de teste, porque nesse
 *     contexto o valor so imita o build e nao descreve o alvo real.
 *   - DATABASE_URL ausente ou invalida bloqueia.
 *   - Host de maquina local libera: ali o banco roda no proprio computador,
 *     entao o nome dele, mesmo "postgres", nao converte o destino em producao.
 *   - Host da infraestrutura Supabase, ou qualquer URL de onde sair um project
 *     ref, so libera por comparacao de ref: ref nao identificavel bloqueia, ref
 *     igual ao de producao bloqueia, ref fora da allowlist bloqueia. O nome do
 *     banco nunca e consultado neste ramo.
 *   - Fora do Supabase, sem ref, exige nome de banco claramente de teste,
 *     comparado por rotulo inteiro e sem nenhuma marca de producao.
 */
export function evaluateDatabaseSafety(
  target: string,
  rawUrl?: string,
  overrides: DatabaseGuardOverrides = {},
): DatabaseSafetyVerdict {
  ensureProjectEnv();
  const nodeEnv = overrides.nodeEnv ?? readEnv("NODE_ENV");
  const origin = overrides.origin ?? detectExecutionOrigin();
  const url = rawUrl ?? readEnv("DATABASE_URL");

  if (nodeEnv === "production" && origin !== "vitest") {
    return {
      safe: false,
      reason: "processo com NODE_ENV=production fora do harness de teste",
    };
  }

  if (!url) {
    return { safe: false, reason: "DATABASE_URL ausente" };
  }

  const identity = identify(url);
  if (!identity?.hostname) {
    return { safe: false, reason: "DATABASE_URL invalida ou nao interpretavel" };
  }

  const productionRef = overrides.productionRef ?? getProductionProjectRef();
  const safeRefs = overrides.safeRefs ?? safeTestProjectRefs();
  const base = {
    hostname: identity.hostname,
    database: identity.database,
    projectRef: identity.projectRef,
    productionProjectRef: productionRef ?? undefined,
  };

  if (SAFE_HOSTS.has(identity.hostname)) {
    return { ...base, safe: true, reason: "host de maquina local" };
  }

  const databaseName = (identity.database ?? "").toLowerCase();

  // Host da infraestrutura Supabase, ou qualquer URL de onde sair um project
  // ref: a unica prova aceita aqui e a comparacao de ref. O nome do banco nao
  // entra nesse ramo, nem para liberar nem para bloquear.
  if (identity.supabaseHost || identity.projectRef) {
    if (!identity.projectRef) {
      return {
        ...base,
        safe: false,
        reason: "host Supabase sem project ref identificavel: isolamento nao comprovavel",
      };
    }
    if (!productionRef) {
      return {
        ...base,
        safe: false,
        reason: "project ref de producao desconhecido: isolamento nao comprovavel",
      };
    }
    if (identity.projectRef === productionRef) {
      return { ...base, safe: false, reason: "mesmo projeto Supabase da producao" };
    }
    if (!safeRefs.includes(identity.projectRef)) {
      return {
        ...base,
        safe: false,
        reason: "ref distinto do de producao, mas fora de SAFE_TEST_DATABASE_REFS",
      };
    }
    return { ...base, safe: true, reason: "ref aprovado em SAFE_TEST_DATABASE_REFS" };
  }

  const looksProduction = hasDatabaseNameToken(databaseName, PRODUCTION_DATABASE_TOKENS);
  const looksTest = hasDatabaseNameToken(databaseName, TEST_DATABASE_TOKENS);

  if (!looksProduction && looksTest) {
    return {
      ...base,
      safe: true,
      reason: "host externo com banco claramente marcado como teste ou staging",
    };
  }

  return {
    ...base,
    safe: false,
    reason: "destino externo sem marca clara de teste: isolamento nao comprovavel",
  };
}
/**
 * Erro de dominio do guard. A mensagem traz alvo e motivo, nunca credencial.
 */
export class NonProductionDatabaseRequiredError extends Error {
  readonly code = NON_PRODUCTION_DATABASE_REQUIRED;

  constructor(
    readonly target: string,
    readonly reason: string,
  ) {
    super(
      [
        "Escrita em banco de dados bloqueada para \"" + target + "\": " + reason + ".",
        "Desenvolvimento e producao compartilham o mesmo projeto Supabase neste ambiente.",
        "Provisione um banco isolado em DATABASE_URL ou aprove o project ref em SAFE_TEST_DATABASE_REFS.",
      ].join(" ")
    );
    this.name = "NonProductionDatabaseRequiredError";
  }
}
/**
 * Atalho booleano para gates de teste, como o hasDb da suite de integracao.
 * Os overrides existem para suites unitarias que precisam exercitar ramos que o
 * ambiente real nao permite alcancar; sem overrides a decisao usa o ambiente.
 */
export function isNonProductionDatabaseUrl(
  rawUrl?: string,
  overrides: DatabaseGuardOverrides = {},
): boolean {
  return evaluateDatabaseSafety("database-url-check", rawUrl, overrides).safe;
}

/**
 * Decisao de gate de suite de teste, ja com a justificativa em formato de log
 * seguro. `enabled` so e true quando o destino e comprovadamente banco de teste.
 */
export type DatabaseTestGateDecision = {
  enabled: boolean;
  /** Motivo do veredito, pronto para a mensagem de skip. */
  reason: string;
  /** Resumo log-safe: alvo, host, database, ref, prodRef, safe e motivo. */
  summary: string;
};

/**
 * Gate de suite de teste: decide ANTES de qualquer conexao e devolve a
 * justificativa explicita do skip. Fail-closed - URL ausente, invalida, ref de
 * producao ou destino sem marca clara de teste resultam em enabled=false, e
 * nenhum acesso ao banco e tentado. Use junto de `describe.skipIf(!gate.enabled)`.
 */
export function resolveDatabaseTestGate(
  target: string,
  rawUrl?: string,
  overrides: DatabaseGuardOverrides = {},
): DatabaseTestGateDecision {
  const verdict = evaluateDatabaseSafety(target, rawUrl, overrides);
  return {
    enabled: verdict.safe,
    reason: verdict.reason,
    summary: describeDatabaseSafety(target, rawUrl, overrides),
  };
}

/**
 * Lanca NonProductionDatabaseRequiredError quando o destino nao e
 * comprovadamente um banco de teste. Chame antes de QUALQUER escrita.
 */
export function assertNonProductionDatabaseUrl(
  target: string,
  rawUrl?: string,
  overrides: DatabaseGuardOverrides = {},
): void {
  const verdict = evaluateDatabaseSafety(target, rawUrl, overrides);
  if (!verdict.safe) {
    throw new NonProductionDatabaseRequiredError(target, verdict.reason);
  }
}

/**
 * Resumo legivel para logs e mensagens de skip.
 * Nao contem usuario, senha, token, service-role nem a string de conexao.
 */
export function describeDatabaseSafety(
  target: string,
  rawUrl?: string,
  overrides: DatabaseGuardOverrides = {},
): string {
  const verdict = evaluateDatabaseSafety(target, rawUrl, overrides);
  return [
    "db-safety",
    "target=" + target,
    "nodeEnv=" + (readEnv("NODE_ENV") ?? "-"),
    "origin=" + detectExecutionOrigin(),
    "host=" + (verdict.hostname ?? "-"),
    "database=" + (verdict.database ?? "-"),
    "ref=" + (verdict.projectRef ?? "-"),
    "prodRef=" + (verdict.productionProjectRef ?? "-"),
    "safe=" + verdict.safe,
    "reason=" + verdict.reason,
  ].join(" ");
}

/** Limpa os caches do modulo. Existe para os testes; a producao nao chama. */
export function resetEnvGuardCache(): void {
  cachedEnvOrigin = null;
  cachedProductionRef = undefined;
}