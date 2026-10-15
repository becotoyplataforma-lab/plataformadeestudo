/**
 * FASE 1 - Gate de banco das suites de teste (resolveDatabaseTestGate).
 *
 * Cobre a decisao que liga ou desliga uma suite dependente de banco, exatamente
 * como agora faz src/lib/billing/repositories/__tests__/plans.contract.test.ts:
 * URL ausente, URL invalida, banco local permitido e URL de producao bloqueada.
 *
 * Nada aqui conecta a banco: sao strings sinteticas + overrides de ambiente, no
 * mesmo padrao de src/lib/db/__tests__/env-guard.test.ts. O mock de
 * @/lib/db/drizzle funciona como tripwire - se alguem ligar o gate a uma query
 * real, o acesso ao cliente Drizzle lanca e esta suite falha.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db/drizzle", () => ({
  db: new Proxy({} as Record<string, unknown>, {
    get(_target, prop): never {
      throw new Error(
        'gate de teste nao pode tocar o cliente Drizzle: acesso a "' + String(prop) + '"'
      );
    },
  }),
}));

import {
  NON_PRODUCTION_DATABASE_REQUIRED,
  type DatabaseGuardOverrides,
  NonProductionDatabaseRequiredError,
  assertNonProductionDatabaseUrl,
  isNonProductionDatabaseUrl,
  resolveDatabaseTestGate,
  resetEnvGuardCache,
} from "../env-guard";

/** Refs e URLs sinteticas. Nenhuma delas aponta para um banco existente. */
const PROD_REF = "a".repeat(20);
const TEST_REF = "b".repeat(20);
const OTHER_REF = "c".repeat(20);
const SECRET_PASSWORD = "senha-secreta-de-teste";

const prodPoolerUrl =
  "postgresql://postgres." + PROD_REF + ":" + SECRET_PASSWORD + "@aws-0-ca-central-1.pooler.supabase.com:6543/postgres";
const prodDirectUrl =
  "postgresql://postgres:" + SECRET_PASSWORD + "@db." + PROD_REF + ".supabase.co:5432/postgres";
const approvedTestUrl =
  "postgresql://postgres:" + SECRET_PASSWORD + "@" + TEST_REF + ".supabase.co:5432/concursoai";
const unapprovedRefUrl =
  "postgresql://postgres:" + SECRET_PASSWORD + "@" + OTHER_REF + ".supabase.co:5432/postgres";
const localUrl = "postgresql://postgres:postgres@localhost:5432/concursoai";
const invalidUrl = "nao-e-uma-url";

/** Ambiente pinado por overrides: o veredito nao depende do .env da maquina. */
const gateEnv: DatabaseGuardOverrides = {
  nodeEnv: "test",
  origin: "vitest",
  productionRef: PROD_REF,
  safeRefs: [TEST_REF],
};

const ENV_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "PROD_SUPABASE_PROJECT_REF",
  "SAFE_TEST_DATABASE_REFS",
  "NODE_ENV",
] as const;

const snapshot: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const key of ENV_KEYS) {
    snapshot[key] = process.env[key];
    delete process.env[key];
  }
  resetEnvGuardCache();
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = snapshot[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      vi.stubEnv(key, value);
    }
  }
  resetEnvGuardCache();
});

describe("resolveDatabaseTestGate: URL ausente", () => {
  it("desliga a suite com justificativa explicita", () => {
    const gate = resolveDatabaseTestGate("plans-contract", "", gateEnv);
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("ausente");
    expect(gate.summary).toContain("target=plans-contract");
    expect(gate.summary).toContain("safe=false");
  });

  it("nao liga a suite quando o ambiente traz so espacos em branco", () => {
    process.env.DATABASE_URL = "   ";
    const gate = resolveDatabaseTestGate("plans-contract", undefined, gateEnv);
    expect(gate.enabled).toBe(false);
    expect(gate.reason.length).toBeGreaterThan(0);
  });
});

describe("resolveDatabaseTestGate: URL invalida", () => {
  it("desliga em vez de tentar interpretar connectando", () => {
    const gate = resolveDatabaseTestGate("plans-contract", invalidUrl, gateEnv);
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("invalida");
  });
});

describe("resolveDatabaseTestGate: banco de teste permitido", () => {
  it("liga a suite para host de maquina local", () => {
    const gate = resolveDatabaseTestGate("plans-contract", localUrl, gateEnv);
    expect(gate.enabled).toBe(true);
    expect(gate.reason).toBe("host de maquina local");
    expect(gate.summary).toContain("host=localhost");
    expect(gate.summary).toContain("safe=true");
  });

  it("liga a suite para ref aprovado em SAFE_TEST_DATABASE_REFS", () => {
    const gate = resolveDatabaseTestGate("plans-contract", approvedTestUrl, gateEnv);
    expect(gate.enabled).toBe(true);
    expect(gate.reason).toContain("SAFE_TEST_DATABASE_REFS");
  });
});

describe("resolveDatabaseTestGate: producao bloqueada", () => {
  it("bloqueia a conexao direta do projeto de producao", () => {
    const gate = resolveDatabaseTestGate("plans-contract", prodDirectUrl, gateEnv);
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toBe("mesmo projeto Supabase da producao");
    expect(gate.summary).toContain("ref=" + PROD_REF);
    expect(gate.summary).toContain("safe=false");
  });

  it("bloqueia o pooler do projeto de producao", () => {
    const gate = resolveDatabaseTestGate("plans-contract", prodPoolerUrl, gateEnv);
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("producao");
  });

  it("bloqueia ref distinto que nao esta na allowlist", () => {
    const gate = resolveDatabaseTestGate("plans-contract", unapprovedRefUrl, gateEnv);
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("SAFE_TEST_DATABASE_REFS");
  });

  it("bloqueia ate localhost sob NODE_ENV=production fora do harness", () => {
    const gate = resolveDatabaseTestGate("plans-contract", localUrl, {
      ...gateEnv,
      nodeEnv: "production",
      origin: "cli",
    });
    expect(gate.enabled).toBe(false);
    expect(gate.reason).toContain("production");
  });
});

describe("resolveDatabaseTestGate: resumo nao vaza credencial", () => {
  it("omite senha e string de conexao nos quatro vereditos", () => {
    const summaries = [prodDirectUrl, prodPoolerUrl, localUrl, invalidUrl].map((url) =>
      resolveDatabaseTestGate("plans-contract", url, gateEnv).summary
    );
    for (const summary of summaries) {
      expect(summary).not.toContain(SECRET_PASSWORD);
      expect(summary).not.toContain("postgresql://");
      expect(summary).not.toContain("://");
    }
  });
});

describe("regressao do gate antigo da suite de contrato", () => {
  it("Boolean(DATABASE_URL) liberava a producao; o gate nao libera", () => {
    expect(Boolean(prodDirectUrl)).toBe(true);
    expect(isNonProductionDatabaseUrl(prodDirectUrl, gateEnv)).toBe(false);
    expect(resolveDatabaseTestGate("plans-contract", prodDirectUrl, gateEnv).enabled).toBe(false);
  });

  it("o gate booleano e o gate de suite concordam", () => {
    for (const url of [localUrl, approvedTestUrl, prodDirectUrl, prodPoolerUrl, invalidUrl, ""]) {
      expect(resolveDatabaseTestGate("t", url, gateEnv).enabled).toBe(
        isNonProductionDatabaseUrl(url, gateEnv)
      );
    }
  });
});

describe("o gate decide antes de qualquer conexao", () => {
  it("nenhum veredito toca o cliente Drizzle", () => {
    expect(() => resolveDatabaseTestGate("plans-contract", prodDirectUrl, gateEnv)).not.toThrow();
    expect(() => resolveDatabaseTestGate("plans-contract", localUrl, gateEnv)).not.toThrow();
    expect(() => resolveDatabaseTestGate("plans-contract", "", gateEnv)).not.toThrow();
  });

  it("o tripwire do mock esta ativo", async () => {
    const drizzle = (await import("@/lib/db/drizzle")) as unknown as {
      db: Record<string, unknown>;
    };
    expect(() => drizzle.db.select).toThrow(/cliente Drizzle/);
  });

  it("assert revalidado pela suite lanca erro de dominio sem credencial", () => {
    let caught: unknown;
    try {
      assertNonProductionDatabaseUrl("plans-contract", prodDirectUrl, gateEnv);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(NonProductionDatabaseRequiredError);
    const typed = caught as NonProductionDatabaseRequiredError;
    expect(typed.code).toBe(NON_PRODUCTION_DATABASE_REQUIRED);
    expect(typed.message).toContain("plans-contract");
    expect(typed.message).not.toContain(SECRET_PASSWORD);
    expect(typed.message).not.toContain("postgresql://");
  });
});