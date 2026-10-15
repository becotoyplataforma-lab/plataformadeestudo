/**
 * FASE A - Paridade entre o guard TypeScript e o espelho usado pelos scripts .mjs.
 *
 * src/lib/db/env-guard.ts e a fonte autoritativa da decisao. Os scripts de linha de
 * comando (test-db.mjs, scripts/apply-migration.mjs, scripts/catalog-snapshot.mjs) nao
 * conseguem importa-lo porque rodam em Node puro, entao usam scripts/lib/db-safety.mjs.
 * Este teste e o que impede os dois caminhos de divergirem.
 *
 * Nada aqui conecta a banco: as URLs sao sinteticas e o espelho apenas devolve veredito.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { evaluateDatabaseSafety, type DatabaseGuardOverrides } from "../env-guard";
import {
  NON_PRODUCTION_DATABASE_REQUIRED,
  ScriptDatabaseBlockedError,
  SCRIPT_DB_BLOCKED_EXIT_CODE,
  assertScriptDatabaseTarget,
  describeScriptDatabaseTarget,
  evaluateScriptDatabaseSafety,
  readDatabaseEnvKeys,
} from "../../../../scripts/lib/db-safety.mjs";

const PROD_REF = "a".repeat(20);
const TEST_REF = "b".repeat(20);
const OTHER_REF = "c".repeat(20);
const SECRET = "senha-secreta-de-teste";
const EMPTY = "";

const overrides: DatabaseGuardOverrides = {
  nodeEnv: "test",
  origin: "vitest",
  productionRef: PROD_REF,
  safeRefs: [TEST_REF],
};

/** Mesmo ambiente, so para o espelho nao ler o processo real. */
const mirrorEnv: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  VITEST: "true",
  PROD_SUPABASE_PROJECT_REF: PROD_REF,
  SAFE_TEST_DATABASE_REFS: TEST_REF,
};

const mirrorOverrides = {
  nodeEnv: "test",
  origin: "vitest" as const,
  productionRef: PROD_REF,
  safeRefs: [TEST_REF],
};

type Case = { name: string; url: string | undefined };

const CASES: Case[] = [
  { name: "host local", url: "postgresql://postgres:" + SECRET + "@localhost:5432/concursoai" },
  { name: "127.0.0.1", url: "postgresql://postgres:" + SECRET + "@127.0.0.1:5432/postgres" },
  { name: "docker host", url: "postgresql://postgres:" + SECRET + "@host.docker.internal:5432/app" },
  { name: "ref aprovado", url: "postgresql://postgres:" + SECRET + "@" + TEST_REF + ".supabase.co:5432/concursoai" },
  { name: "producao direta", url: "postgresql://postgres:" + SECRET + "@db." + PROD_REF + ".supabase.co:5432/postgres" },
  { name: "producao pooler", url: "postgresql://postgres." + PROD_REF + ":" + SECRET + "@aws-0-ca-central-1.pooler.supabase.com:6543/postgres" },
  { name: "ref nao aprovado", url: "postgresql://postgres:" + SECRET + "@" + OTHER_REF + ".supabase.co:5432/concursoai" },
  { name: "supabase sem ref", url: "postgresql://postgres:" + SECRET + "@db.supabase.co:5432/postgres" },
  { name: "externo com nome de teste", url: "postgresql://app:" + SECRET + "@pg.example.com:5432/concursoai_test" },
  { name: "externo com nome de producao", url: "postgresql://app:" + SECRET + "@pg.example.com:5432/concursoai_production" },
  { name: "externo sem marca", url: "postgresql://app:" + SECRET + "@pg.example.com:5432/appdb" },
  { name: "dbname nos options", url: "postgresql://app:" + SECRET + "@pg.example.com:5432/postgres?options=dbname%3Dconcursoai_stg" },
  { name: "url invalida", url: "isso-nao-e-uma-url" },
  { name: "url em branco", url: EMPTY },
];

describe("espelho .mjs decide igual ao guard TypeScript", () => {
  it.each(CASES)("$name", ({ url }) => {
    const authoritative = evaluateDatabaseSafety("parity", url, overrides);
    const mirror = evaluateScriptDatabaseSafety(url, mirrorEnv, mirrorOverrides);
    expect(mirror.safe).toBe(authoritative.safe);
    expect(mirror.reason).toBe(authoritative.reason);
    expect(mirror.hostname).toBe(authoritative.hostname);
    expect(mirror.database).toBe(authoritative.database);
    expect(mirror.projectRef).toBe(authoritative.projectRef);
    expect(mirror.productionProjectRef).toBe(authoritative.productionProjectRef);
  });
});

describe("espelho .mjs cai no ambiente quando nenhuma URL e informada", () => {
  it("usa DATABASE_URL do ambiente e bloqueia o projeto de producao", () => {
    const env: NodeJS.ProcessEnv = {
      NODE_ENV: "test",
      VITEST: "true",
      PROD_SUPABASE_PROJECT_REF: PROD_REF,
      SAFE_TEST_DATABASE_REFS: TEST_REF,
      DATABASE_URL: "postgresql://postgres:" + SECRET + "@db." + PROD_REF + ".supabase.co:5432/postgres",
    };
    expect(evaluateScriptDatabaseSafety(undefined, env, mirrorOverrides).safe).toBe(false);
  });

  it("URL vazia no ambiente continua sendo URL ausente", () => {
    const env: NodeJS.ProcessEnv = { DATABASE_URL: "", NODE_ENV: "test", VITEST: "true" };
    const verdict = evaluateScriptDatabaseSafety(undefined, env, mirrorOverrides);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toBe("DATABASE_URL ausente");
  });
});
describe("espelho .mjs nao vaza credencial", () => {
  it("resumo nao contem senha nem string de conexao", () => {
    for (const item of CASES) {
      const summary = describeScriptDatabaseTarget("apply-migration", item.url, mirrorEnv, mirrorOverrides);
      expect(summary).not.toContain(SECRET);
      expect(summary).not.toContain("://");
      expect(summary.startsWith("db-safety target=apply-migration")).toBe(true);
    }
  });

  it("erro de bloqueio traz alvo e motivo, nunca credencial", () => {
    let caught: unknown;
    try {
      assertScriptDatabaseTarget("apply-migration", CASES[4].url, mirrorEnv, mirrorOverrides);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ScriptDatabaseBlockedError);
    const typed = caught as ScriptDatabaseBlockedError;
    expect(typed.code).toBe(NON_PRODUCTION_DATABASE_REQUIRED);
    expect(typed.target).toBe("apply-migration");
    expect(typed.message).not.toContain(SECRET);
  });

  it("destino de teste passa sem lanca erro", () => {
    expect(() =>
      assertScriptDatabaseTarget("catalog-snapshot", CASES[0].url, mirrorEnv, mirrorOverrides)
    ).not.toThrow();
  });
});

describe("leitura seletiva de .env pelos scripts", () => {
  const fakeFs = {
    readFileSync: () =>
      [
        "# comentario",
        "DATABASE_URL=postgresql://postgres:SECRET@db." + PROD_REF + ".supabase.co:5432/postgres",
        "SUPABASE_SERVICE_ROLE_KEY=nao-interessa",
        "PROD_SUPABASE_PROJECT_REF=" + PROD_REF,
        "SAFE_TEST_DATABASE_REFS=" + TEST_REF,
        "NODE_ENV=test",
      ].join("\n"),
  };

  it("so devolve as chaves que interessam a decisao", () => {
    const values = readDatabaseEnvKeys(fakeFs, ".env");
    expect(Object.keys(values).sort()).toStrictEqual([
      "DATABASE_URL",
      "NODE_ENV",
      "PROD_SUPABASE_PROJECT_REF",
      "SAFE_TEST_DATABASE_REFS",
    ].sort());
    expect(values.SAFE_TEST_DATABASE_REFS).toBe(TEST_REF);
  });
});

describe("scripts abrem conexao somente depois da guarda", () => {
  const sources: Record<string, string> = {
    "test-db.mjs": readFileSync(join(process.cwd(), "test-db.mjs"), "utf8"),
    "scripts/apply-migration.mjs": readFileSync(
      join(process.cwd(), "scripts", "apply-migration.mjs"),
      "utf8"
    ),
    "scripts/catalog-snapshot.mjs": readFileSync(
      join(process.cwd(), "scripts", "catalog-snapshot.mjs"),
      "utf8"
    ),
  };

  it("cada script importa o espelho", () => {
    for (const [name, source] of Object.entries(sources)) {
      expect(source, name).toContain("db-safety.mjs");
      expect(source, name).toContain("guardScriptDatabaseTargetOrExit(");
    }
  });

  it("nenhum script chama postgres() ou sql() antes da guarda", () => {
    for (const [name, source] of Object.entries(sources)) {
      const guard = source.indexOf("guardScriptDatabaseTargetOrExit(");
      const connect = Math.max(source.indexOf("= postgres("), source.indexOf("= sql("));
      expect(guard, name).toBeGreaterThan(-1);
      expect(connect, name).toBeGreaterThan(-1);
      expect(guard < connect, name).toBe(true);
    }
  });

  it("o codigo de bloqueio continua 3", () => {
    expect(SCRIPT_DB_BLOCKED_EXIT_CODE).toBe(3);
  });
});
