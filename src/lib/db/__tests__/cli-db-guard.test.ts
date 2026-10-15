/**
 * Testes do guard dos scripts de escrita no banco.
 *
 * So refs e URLs sinteticas: nenhum caso abre conexao, escreve em disco ou le o
.env real do projeto. O cwd aponta para o diretorio temporario do sistema, onde
.
.temp/project-ref nao existe, e a leitura do link e sempre injetada.
 */
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  NonProductionDatabaseRequiredError,
  assertSafeDatabaseCli,
  cliDatabaseTarget,
  describeCliDatabaseTarget,
  evaluateCliDatabaseTarget,
} from "../cli-db-guard";
import { resetEnvGuardCache } from "../env-guard";

const PROD_REF = "a".repeat(20);
const TEST_REF = "b".repeat(20);
const SECRET = "senha-sintetica-de-teste";

const prodUrl = "postgresql://postgres:" + SECRET + "@" + PROD_REF + ".supabase.co:5432/postgres";
const testUrl = "postgresql://postgres:" + SECRET + "@" + TEST_REF + ".supabase.co:5432/postgres";
const localUrl = "postgresql://postgres:postgres@localhost:5432/concursoai_test";
const brokenUrl = "isso-nao-e-uma-url";

const CWD = tmpdir();
const noLink = () => {
  throw new Error("sem link");
};

const envWith = (overrides: Record<string, string> = {}): NodeJS.ProcessEnv => ({
  NODE_ENV: "test",
  DATABASE_URL: brokenUrl,
  PROD_SUPABASE_PROJECT_REF: PROD_REF,
  SAFE_TEST_DATABASE_REFS: "",
  ...overrides,
});

describe("cli-db-guard: destino de escrita de db:push, db:seed e migrate", () => {
  it("bloqueia sem URL e sem link: isolamento nao comprovavel", () => {
    const verdict = evaluateCliDatabaseTarget("db:push", envWith(), CWD, noLink);
    expect(verdict.safe).toBe(false);
  });

  it("libera host local de maquina", () => {
    const verdict = evaluateCliDatabaseTarget("db:push", envWith({ DATABASE_URL: localUrl }), CWD, noLink);
    expect(verdict.safe).toBe(true);
  });

  it("bloqueia o proprio projeto Supabase da producao", () => {
    const verdict = evaluateCliDatabaseTarget("db:push", envWith({ DATABASE_URL: prodUrl }), CWD, noLink);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("producao");
  });

  it("bloqueia ref distinto que nao esta na allowlist", () => {
    const verdict = evaluateCliDatabaseTarget("db:seed", envWith({ DATABASE_URL: testUrl }), CWD, noLink);
    expect(verdict.safe).toBe(false);
  });

  it("libera ref distinto aprovado em SAFE_TEST_DATABASE_REFS", () => {
    const env = envWith({ DATABASE_URL: testUrl, SAFE_TEST_DATABASE_REFS: TEST_REF });
    const verdict = evaluateCliDatabaseTarget("db:seed", env, CWD, noLink);
    expect(verdict.safe).toBe(true);
  });

  it("bloqueia link do CLI apontando para o projeto de producao", () => {
    const env = envWith({ SUPABASE_DB_URL: "" });
    const verdict = evaluateCliDatabaseTarget("db:push", env, CWD, () => PROD_REF);
    expect(verdict.safe).toBe(false);
    expect(verdict.projectRef).toBe(PROD_REF);
  });

  it("libera link do CLI aprovado, porque db push escreve no projeto linkado", () => {
    const env = envWith({ SUPABASE_DB_URL: "", SAFE_TEST_DATABASE_REFS: TEST_REF });
    const verdict = evaluateCliDatabaseTarget("db:push", env, CWD, () => TEST_REF);
    expect(verdict.safe).toBe(true);
  });

  it("assert lanca o erro de dominio sem vazar credencial", () => {
    const env = envWith({ DATABASE_URL: prodUrl });
    try {
      assertSafeDatabaseCli("db:seed", env, CWD, noLink);
      throw new Error("o guard deveria ter bloqueado");
    } catch (error) {
      expect(error).toBeInstanceOf(NonProductionDatabaseRequiredError);
      const message = (error as Error).message;
      expect(message).not.toContain(SECRET);
      expect(message).not.toContain("postgres://");
      expect(message).toContain("db:seed");
    }
  });

  it("cliDatabaseTarget registra a origem, nunca o valor", () => {
    const info = cliDatabaseTarget(envWith({ DATABASE_URL: prodUrl }), CWD, noLink);
    expect(info.origins).toContain("env:DATABASE_URL");
    expect(JSON.stringify(info)).not.toContain(SECRET);
  });

  it("describe imprime apenas identificadores nao sensiveis", () => {
    const previous = process.env.DATABASE_URL;
    process.env.DATABASE_URL = prodUrl;
    process.env.PROD_SUPABASE_PROJECT_REF = PROD_REF;
    const line = describeCliDatabaseTarget("db:push", CWD);
    expect(line).toContain("safe=false");
    expect(line).not.toContain(SECRET);
    expect(line).not.toContain("postgresql://");
    if (previous === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = previous;
    }
    delete process.env.PROD_SUPABASE_PROJECT_REF;
    resetEnvGuardCache();
  });
});

type Pkg = { scripts: Record<string, string> };

const scripts = (): Pkg => {
  const raw = readFileSync(resolve(process.cwd(), "package.json"), "utf8");
  return JSON.parse(raw) as Pkg;
};

const GUARDED = ["db:push", "db:seed", "db:migrate", "drizzle:migrate"];
const OFFLINE = ["db:check", "db:generate", "drizzle:generate"];

describe("package.json: scripts de escrita passam pelo guard", () => {
  for (const name of GUARDED) {
    it(name + " roda o guard antes do comando real", () => {
      expect(scripts().scripts[name]).toContain("scripts/db-guard.ts");
    });
  }

  for (const name of OFFLINE) {
    it(name + " continua direto porque nao escreve no banco", () => {
      expect(scripts().scripts[name]).not.toContain("db-guard");
    });
  }
});
