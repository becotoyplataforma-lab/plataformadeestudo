/**
 * Guarda de seguranca dos scripts de linha de comando que escrevem no banco.
 *
 * O env-guard cobre o caminho do Node (testes de integracao, CLI de ingestao).
 * Supabase CLI e drizzle-kit sao processos filhos e nao passam por ele: sem este
 * modulo, npm run db:push e npm run db:seed atingiriam o projeto de producao com
 * um simples link local. Aqui a decisao acontece antes de disparar o processo.
 *
 * Regras (as mesmas do env-guard, conservadoras): so escreve quem consegue PROVAR
 * que o destino e banco de teste - host local, ref distinto do de producao e
 * aprovado em SAFE_TEST_DATABASE_REFS, ou nome de banco claramente de teste.
 * Credencial alguma sai deste modulo: nem no log, nem no erro.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  NonProductionDatabaseRequiredError,
  evaluateDatabaseSafety,
  getProductionProjectRef,
  safeTestProjectRefs,
  type DatabaseSafetyVerdict,
} from "./env-guard";

export { NonProductionDatabaseRequiredError } from "./env-guard";

const PROJECT_REF_PATTERN = /^[a-z0-9]{20}$/;
const LINKED_REF_FILE = join("supabase", ".temp", "project-ref");

export type CliDatabaseTarget = {
  /** Project ref do link local do Supabase CLI. */
  linkedRef?: string;
  /** De onde cada pedaco de informacao veio (nunca o valor). */
  origins: string[];
};

type ReadFile = (path: string) => string;

const defaultReadFile: ReadFile = (path) => readFileSync(path, "utf8");

function pick(env: NodeJS.ProcessEnv, name: string): string | undefined {
  const raw = (env[name] ?? "").trim();
  return raw.length === 0 ? undefined : raw;
}

/** Le o project ref gravado pelo supabase link; formato invalido e ignorado. */
function readLinkedRef(cwd: string, read: ReadFile): string | undefined {
  try {
    const raw = read(join(cwd, LINKED_REF_FILE)).trim().toLowerCase();
    return PROJECT_REF_PATTERN.test(raw) ? raw : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Monta o destino de escrita visto pelo comando: URL explicita do CLI, a URL do
 * ambiente e o ref do link local. Nenhum valor e retornado, apenas a origem.
 */
export function cliDatabaseTarget(
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  read: ReadFile = defaultReadFile,
): CliDatabaseTarget {
  const direct = pick(env, "SUPABASE_DB_URL");
  const pooled = pick(env, "DATABASE_URL");
  const origins: string[] = [];
  if (direct) origins.push("env:SUPABASE_DB_URL");
  if (!direct && pooled) origins.push("env:DATABASE_URL");
  const linkedRef = readLinkedRef(cwd, read);
  if (linkedRef) origins.push(LINKED_REF_FILE);
  return { linkedRef, origins };
}

/** Allowlist de refs de teste a partir do ambiente do comando. */
function safeRefsFrom(env: NodeJS.ProcessEnv): string[] {
  const raw = (env.SAFE_TEST_DATABASE_REFS ?? "").trim();
  if (raw.length === 0) return safeTestProjectRefs();
  const parts = raw.split(/[\s,]+/);
  return parts.map((item) => item.trim().toLowerCase()).filter((item) => PROJECT_REF_PATTERN.test(item));
}

/** Ref de producao a partir do ambiente do comando, com fallback global. */
function productionRefFrom(env: NodeJS.ProcessEnv): string | null {
  const explicit = (env.PROD_SUPABASE_PROJECT_REF ?? "").trim().toLowerCase();
  if (PROJECT_REF_PATTERN.test(explicit)) return explicit;
  return getProductionProjectRef();
}

/**
 * Veredito para um comando de escrita (db:push, db:seed, migrate).
 * A URL decide primeiro; sem URL segura, o ref do link local decide sozinho.
 */
export function evaluateCliDatabaseTarget(
  target: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  read: ReadFile = defaultReadFile,
): DatabaseSafetyVerdict {
  const info = cliDatabaseTarget(env, cwd, read);
  const url = pick(env, "SUPABASE_DB_URL") ?? pick(env, "DATABASE_URL");
  const productionRef = productionRefFrom(env);
  const safeRefs = safeRefsFrom(env);
  const verdict = evaluateDatabaseSafety(target, url, {
    nodeEnv: env.NODE_ENV,
    productionRef,
    safeRefs,
  });
  if (verdict.safe) return verdict;
  const ref = info.linkedRef;
  if (!ref) {
    return verdict;
  }
  if (productionRef && ref === productionRef) {
    return {
      ...verdict,
      projectRef: ref,
      productionProjectRef: productionRef,
      safe: false,
      reason: "o link do Supabase CLI aponta para o projeto de producao",
    };
  }
  if (safeRefs.includes(ref)) {
    return {
      ...verdict,
      projectRef: ref,
      productionProjectRef: productionRef ?? undefined,
      safe: true,
      reason: "project ref do link aprovado em SAFE_TEST_DATABASE_REFS",
    };
  }
  return {
    ...verdict,
    projectRef: ref,
    productionProjectRef: productionRef ?? undefined,
    safe: false,
    reason: "project ref do link fora de SAFE_TEST_DATABASE_REFS",
  };
}

/** Lanca quando o destino nao e comprovadamente banco de teste. */
export function assertSafeDatabaseCli(
  target: string,
  env: NodeJS.ProcessEnv = process.env,
  cwd: string = process.cwd(),
  read: ReadFile = defaultReadFile,
): void {
  const verdict = evaluateCliDatabaseTarget(target, env, cwd, read);
  if (!verdict.safe) {
    throw new NonProductionDatabaseRequiredError(target, verdict.reason);
  }
}

/** Linha de log segura: origem das informacoes e veredito, nunca credencial. */
export function describeCliDatabaseTarget(target: string, cwd: string = process.cwd()): string {
  const verdict = evaluateCliDatabaseTarget(target, process.env, cwd);
  const info = cliDatabaseTarget(process.env, cwd);
  const parts = [
    "db-cli-safety",
    "target=" + target,
    "origins=" + (info.origins.join(",") || "-"),
    "host=" + (verdict.hostname ?? "-"),
    "database=" + (verdict.database ?? "-"),
    "ref=" + (verdict.projectRef ?? "-"),
    "prodRef=" + (verdict.productionProjectRef ?? "-"),
    "safe=" + verdict.safe,
    "reason=" + verdict.reason,
  ];
  return parts.join(" ");
}
