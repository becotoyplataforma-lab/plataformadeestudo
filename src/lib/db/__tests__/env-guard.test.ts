import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  NON_PRODUCTION_DATABASE_REQUIRED,
  NonProductionDatabaseRequiredError,
  assertNonProductionDatabaseUrl,
  detectExecutionOrigin,
  type DatabaseGuardOverrides,
  describeDatabaseSafety,
  evaluateDatabaseSafety,
  getProductionProjectRef,
  isNonProductionDatabaseUrl,
  resetEnvGuardCache,
  safeTestProjectRefs,
} from "../env-guard";

/**
 * Estes testes usam apenas refs e URLs sinteticas. Nada aqui le o .env real do
 * projeto nem aponta para qualquer banco existente.
 */
const PROD_REF = "a".repeat(20);
const TEST_REF = "b".repeat(20);
const SECRET_PASSWORD = "senha-secreta-de-teste";

const prodUrl = "postgresql://postgres." + PROD_REF + ":" + SECRET_PASSWORD + "@" + PROD_REF + ".supabase.co:5432/postgres";
const testUrl = "postgresql://postgres:" + SECRET_PASSWORD + "@" + TEST_REF + ".supabase.co:5432/postgres";
const localUrl = "postgresql://postgres:postgres@localhost:5432/concursoai";
const poolerUrl = "postgresql://postgres.aaaaaaaaaaaaaaaaaaaa:pass@aws-1-us-east.pooler.supabase.com:6543/postgres";
const externalTestUrl = "postgresql://app:pass@db.example.com:5432/concursoai_test";
const externalProdUrl = "postgresql://app:pass@db.example.com:5432/concursoai_production";
const externalPlainUrl = "postgresql://app:pass@db.example.com:5432/concursoai";

/** Ambiente de teste: sem overrides, o guard so enxerga o que estas chaves tiverem. */
const testEnv: DatabaseGuardOverrides = { nodeEnv: "test", origin: "vitest", productionRef: PROD_REF };

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
describe("evaluateDatabaseSafety: ausencia e invalidez", () => {
  it("bloqueia quando DATABASE_URL esta ausente", () => {
    const verdict = evaluateDatabaseSafety("unit", "", testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("ausente");
  });

  it("bloqueia quando a URL nao e interpretavel", () => {
    const verdict = evaluateDatabaseSafety("unit", "nao-e-uma-url", testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("invalida");
  });

  it("bloqueia quando o project ref de producao e desconhecido", () => {
    const verdict = evaluateDatabaseSafety("unit", testUrl, { ...testEnv, productionRef: null });
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("desconhecido");
  });
});

describe("evaluateDatabaseSafety: projetos Supabase", () => {
  it("bloqueia o proprio banco de producao", () => {
    const verdict = evaluateDatabaseSafety("unit", prodUrl, testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("producao");
  });

  it("bloqueia ref distinto mas ausente da allowlist", () => {
    const verdict = evaluateDatabaseSafety("unit", testUrl, { ...testEnv, safeRefs: [] });
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("SAFE_TEST_DATABASE_REFS");
  });

  it("libera ref distinto aprovado na allowlist", () => {
    const verdict = evaluateDatabaseSafety("unit", testUrl, { ...testEnv, safeRefs: [TEST_REF] });
    expect(verdict.safe).toBe(true);
    expect(verdict.projectRef).toBe(TEST_REF);
  });

  it("bloqueia o pooler do projeto de producao", () => {
    const verdict = evaluateDatabaseSafety("unit", poolerUrl, testEnv);
    expect(verdict.safe).toBe(false);
  });
});

describe("evaluateDatabaseSafety: hosts externos e locais", () => {
  it("libera localhost", () => {
    expect(evaluateDatabaseSafety("unit", localUrl, testEnv).safe).toBe(true);
  });

  it("libera banco externo claramente marcado como teste", () => {
    const verdict = evaluateDatabaseSafety("unit", externalTestUrl, testEnv);
    expect(verdict.safe).toBe(true);
    expect(verdict.database).toBe("concursoai_test");
  });

  it("bloqueia banco externo marcado como producao", () => {
    expect(evaluateDatabaseSafety("unit", externalProdUrl, testEnv).safe).toBe(false);
  });

  it("bloqueia banco externo sem nenhuma marca de teste", () => {
    const verdict = evaluateDatabaseSafety("unit", externalPlainUrl, testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("nao comprovavel");
  });
});
describe("evaluateDatabaseSafety: NODE_ENV production", () => {
  it("bloqueia ate localhost quando a origem nao e o harness de teste", () => {
    const verdict = evaluateDatabaseSafety("unit", localUrl, {
      ...testEnv,
      nodeEnv: "production",
      origin: "cli",
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toContain("production");
  });

  it("reconhece o harness de teste quando NODE_ENV imita o build", () => {
    const verdict = evaluateDatabaseSafety("unit", localUrl, {
      ...testEnv,
      nodeEnv: "production",
      origin: "vitest",
    });
    expect(verdict.safe).toBe(true);
  });
});

describe("assertNonProductionDatabaseUrl", () => {
  it("nao lanca para banco de teste aprovado", () => {
    expect(() =>
      assertNonProductionDatabaseUrl("cli", testUrl, { ...testEnv, safeRefs: [TEST_REF] }),
    ).not.toThrow();
  });

  it("lanca erro com codigo estavel apontando o alvo", () => {
    let caught: unknown;
    try {
      assertNonProductionDatabaseUrl("cli-ingest", prodUrl, testEnv);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(NonProductionDatabaseRequiredError);
    expect((caught as NonProductionDatabaseRequiredError).code).toBe(
      NON_PRODUCTION_DATABASE_REQUIRED,
    );
    expect((caught as Error).message).toContain("cli-ingest");
  });

  it("nunca expoe credenciais na mensagem de erro", () => {
    let message = "";
    try {
      assertNonProductionDatabaseUrl("e2e-cleanup", prodUrl, testEnv);
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).not.toBe("");
    expect(message).not.toContain(SECRET_PASSWORD);
    expect(message).not.toContain("postgresql://");
  });
});

describe("describeDatabaseSafety", () => {
  it("produz resumo sem senha nem string de conexao", () => {
    process.env.DATABASE_URL = prodUrl;
    vi.stubEnv("NODE_ENV", "test");
    const line = describeDatabaseSafety("e2e-cleanup");
    expect(line).toContain("target=e2e-cleanup");
    expect(line).toContain("safe=false");
    expect(line).not.toContain(SECRET_PASSWORD);
    expect(line).not.toContain("postgresql://");
  });
});

describe("safeTestProjectRefs", () => {
  it("interpreta separadores por virgula e espaco", () => {
    process.env.SAFE_TEST_DATABASE_REFS = TEST_REF + " , " + PROD_REF;
    expect(safeTestProjectRefs()).toEqual([TEST_REF, PROD_REF]);
  });

  it("descarta entradas fora do formato de project ref", () => {
    process.env.SAFE_TEST_DATABASE_REFS = "curto," + TEST_REF + ",MAIUSCULAS";
    expect(safeTestProjectRefs()).toEqual([TEST_REF]);
  });

  it("retorna lista vazia sem configuracao", () => {
    expect(safeTestProjectRefs()).toEqual([]);
  });
});

describe("getProductionProjectRef", () => {
  it("prefere o valor explicito de PROD_SUPABASE_PROJECT_REF", () => {
    process.env.DATABASE_URL = localUrl;
    process.env.PROD_SUPABASE_PROJECT_REF = PROD_REF;
    process.env.DIRECT_URL = testUrl;
    expect(getProductionProjectRef()).toBe(PROD_REF);
  });

  it("deduz de DIRECT_URL na ausencia do valor explicito", () => {
    process.env.DATABASE_URL = localUrl;
    process.env.DIRECT_URL = prodUrl;
    expect(getProductionProjectRef()).toBe(PROD_REF);
  });

  it("deduz de NEXT_PUBLIC_SUPABASE_URL", () => {
    process.env.DATABASE_URL = localUrl;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://" + PROD_REF + ".supabase.co";
    expect(getProductionProjectRef()).toBe(PROD_REF);
  });

  it("retorna null quando nenhuma fonte existe", () => {
    process.env.DATABASE_URL = localUrl;
    expect(getProductionProjectRef()).toBeNull();
  });
});

describe("detectExecutionOrigin", () => {
  it("reconhece o harness do Vitest", () => {
    expect(detectExecutionOrigin()).toBe("vitest");
  });
});
describe("isNonProductionDatabaseUrl", () => {
  it("traduz o veredito em booleano para gates de teste", () => {
    process.env.DATABASE_URL = testUrl;
    vi.stubEnv("NODE_ENV", "test");
    expect(isNonProductionDatabaseUrl(localUrl)).toBe(true);
    expect(isNonProductionDatabaseUrl(testUrl)).toBe(false);
  });
});

/**
 * FASE 6A: regressao dos falsos positivos encontrados no diagnostico do guard.
 * A conexao direta em forma db.REF.supabase.co usa o banco padrao "postgres",
 * que contem a substring "stg": antes do endurecimento esse nome bastava para
 * liberar escrita. Nada aqui abre conexao: sao apenas strings sinteticas.
 */
const UNKNOWN_REF = "c".repeat(20);
const directProdUrl = "postgresql://postgres:" + SECRET_PASSWORD + "@db." + PROD_REF + ".supabase.co:5432/postgres";
const directTestUrl = "postgresql://postgres:" + SECRET_PASSWORD + "@db." + TEST_REF + ".supabase.co:5432/postgres";
const directUnknownUrl = "postgresql://postgres:" + SECRET_PASSWORD + "@db." + UNKNOWN_REF + ".supabase.co:5432/postgres";
const envExampleUrl = "postgresql://postgres:sua-senha@db." + PROD_REF + ".supabase.co:5432/postgres";
const reflessUrl = "postgresql://postgres:" + SECRET_PASSWORD + "@db.pooler.supabase.com:5432/postgres";
const reflessTestNamedUrl = "postgresql://postgres:" + SECRET_PASSWORD + "@db.pooler.supabase.com:5432/concursoai_test";
const malformedRefUrl = "postgresql://postgres:" + SECRET_PASSWORD + "@db.abcdefghijklmnopqrstuv.supabase.co:5432/postgres";
const poolerProdUrl = "postgresql://postgres." + PROD_REF + ":" + SECRET_PASSWORD + "@aws-0-ca-central-1.pooler.supabase.com:6543/postgres";
const localPlainUrl = "postgresql://postgres:senha@localhost:5432/postgres";
const dockerPlainUrl = "postgresql://postgres:senha@host.docker.internal:5432/postgres";
const localProdNamedUrl = "postgresql://postgres:senha@localhost:5432/app_production";
const thirdPartyUrl = "postgresql://app:pass@supabase.example.com:5432/concursoai_test";

/** Host externo comum, fora da infraestrutura Supabase: so o nome decide. */
function externalNamed(database: string) {
  return "postgresql://app:pass@db.example.com:5432/" + database;
}

describe("FASE 6A: R1 - conexao direta do projeto de producao", () => {
  it("bloqueia conexao direta de producao com banco postgres", () => {
    const verdict = evaluateDatabaseSafety("unit", directProdUrl, testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.projectRef).toBe(PROD_REF);
    expect(verdict.reason).toBe("mesmo projeto Supabase da producao");
  });

  it("bloqueia o formato literal do .env.example", () => {
    const verdict = evaluateDatabaseSafety("unit", envExampleUrl, testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toBe("mesmo projeto Supabase da producao");
  });

  it("bloqueia a forma placeholder que o proprio .env.example traz", () => {
    // db.YOUR-PROJECT.supabase.co nao entrega ref de 20 caracteres e o banco he
    // o padrao "postgres": era exatamente esta string a rota de falso positivo.
    const placeholderUrl =
      "postgresql://postgres:sua-senha-aqui@db.YOUR-PROJECT.supabase.co:5432/postgres";
    const verdict = evaluateDatabaseSafety("unit", placeholderUrl, {
      ...testEnv,
      safeRefs: [TEST_REF],
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.projectRef).toBeUndefined();
    expect(verdict.reason).toContain("sem project ref identificavel");
  });

  it("bloqueia pooler de producao com banco postgres", () => {
    const verdict = evaluateDatabaseSafety("unit", poolerProdUrl, testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.projectRef).toBe(PROD_REF);
  });

  it("mantem o bloqueio quando o ref de producao cai na allowlist por engano", () => {
    const verdict = evaluateDatabaseSafety("unit", directProdUrl, {
      ...testEnv,
      safeRefs: [PROD_REF],
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).toBe("mesmo projeto Supabase da producao");
  });

  it("extrai o ref das duas formas de hostname Supabase", () => {
    const simples = "postgresql://u:p@" + TEST_REF + ".supabase.co:5432/postgres";
    expect(evaluateDatabaseSafety("unit", directTestUrl, testEnv).projectRef).toBe(TEST_REF);
    expect(evaluateDatabaseSafety("unit", simples, testEnv).projectRef).toBe(TEST_REF);
  });

  it("libera conexao direta de teste com ref na allowlist", () => {
    const verdict = evaluateDatabaseSafety("unit", directTestUrl, {
      ...testEnv,
      safeRefs: [TEST_REF],
    });
    expect(verdict.safe).toBe(true);
    expect(verdict.hostname).toBe("db." + TEST_REF + ".supabase.co");
    expect(verdict.reason).toBe("ref aprovado em SAFE_TEST_DATABASE_REFS");
  });
});

describe("FASE 6A: host Supabase sem project ref identificavel", () => {
  it("bloqueia host Supabase sem ref", () => {
    const verdict = evaluateDatabaseSafety("unit", reflessUrl, testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.projectRef).toBeUndefined();
    expect(verdict.reason).toContain("sem project ref identificavel");
  });

  it("jamais usa o nome do banco para liberar um host Supabase", () => {
    const verdict = evaluateDatabaseSafety("unit", reflessTestNamedUrl, {
      ...testEnv,
      safeRefs: [TEST_REF],
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.reason).not.toContain("claramente marcado");
  });

  it("bloqueia ref malformado de 22 caracteres", () => {
    const verdict = evaluateDatabaseSafety("unit", malformedRefUrl, testEnv);
    expect(verdict.safe).toBe(false);
    expect(verdict.projectRef).toBeUndefined();
    expect(verdict.reason).toContain("sem project ref identificavel");
  });

  it("bloqueia ref desconhecido que nao esta na allowlist", () => {
    const verdict = evaluateDatabaseSafety("unit", directUnknownUrl, {
      ...testEnv,
      safeRefs: [TEST_REF],
    });
    expect(verdict.safe).toBe(false);
    expect(verdict.projectRef).toBe(UNKNOWN_REF);
    expect(verdict.reason).toContain("SAFE_TEST_DATABASE_REFS");
  });

  it("libera o mesmo ref desconhecido depois de aprovado na allowlist", () => {
    const verdict = evaluateDatabaseSafety("unit", directUnknownUrl, {
      ...testEnv,
      safeRefs: [UNKNOWN_REF],
    });
    expect(verdict.safe).toBe(true);
  });

  it("nao trata supabase.example.com como infraestrutura Supabase", () => {
    const verdict = evaluateDatabaseSafety("unit", thirdPartyUrl, testEnv);
    expect(verdict.safe).toBe(true);
    expect(verdict.reason).toContain("host externo");
  });
});

describe("FASE 6A: R2 - tokens de banco comparados por rotulo inteiro", () => {
  const falsosPositivos = [
    "postgres",
    "ciencias",
    "devocional",
    "contest",
    "testingground",
    "sandboxie",
    "mostg",
    "prodbot",
  ];
  for (const database of falsosPositivos) {
    it("nao classifica " + database + " como banco de teste", () => {
      const verdict = evaluateDatabaseSafety("unit", externalNamed(database), testEnv);
      expect(verdict.safe).toBe(false);
      expect(verdict.reason).toContain("nao comprovavel");
    });
  }

  const nomesDeTeste = [
    "concursoai_test",
    "concursoai-staging",
    "db_stg",
    "my_ci_db",
    "app-sandbox",
    "app.dev",
  ];
  for (const database of nomesDeTeste) {
    it("reconhece " + database + " como banco de teste", () => {
      expect(evaluateDatabaseSafety("unit", externalNamed(database), testEnv).safe).toBe(true);
    });
  }

  const nomesDeProducao = ["concursoai_production", "my-prod-db", "live_db"];
  for (const database of nomesDeProducao) {
    it("reconhece " + database + " como producao", () => {
      expect(evaluateDatabaseSafety("unit", externalNamed(database), testEnv).safe).toBe(false);
    });
  }
});

describe("FASE 6A: hosts locais continuam liberados", () => {
  it("libera localhost com banco postgres", () => {
    const verdict = evaluateDatabaseSafety("unit", localPlainUrl, testEnv);
    expect(verdict.safe).toBe(true);
    expect(verdict.reason).toBe("host de maquina local");
  });

  it("libera host.docker.internal", () => {
    expect(evaluateDatabaseSafety("unit", dockerPlainUrl, testEnv).safe).toBe(true);
  });

  it("nome de producao nao converte localhost em destino bloqueado", () => {
    expect(evaluateDatabaseSafety("unit", localProdNamedUrl, testEnv).safe).toBe(true);
  });
});

describe("FASE 6A: descoberta do production ref pela conexao direta", () => {
  it("resolve DIRECT_URL em forma db.REF.supabase.co", () => {
    process.env.DATABASE_URL = localPlainUrl;
    process.env.DIRECT_URL = directProdUrl;
    expect(getProductionProjectRef()).toBe(PROD_REF);
  });
});

describe("FASE 6A: booleano e assert refletem o veredito", () => {
  it("recusa producao direta e host sem ref pelas variaveis reais do ambiente", () => {
    process.env.DATABASE_URL = directProdUrl;
    process.env.PROD_SUPABASE_PROJECT_REF = PROD_REF;
    vi.stubEnv("NODE_ENV", "test");
    expect(isNonProductionDatabaseUrl(directProdUrl)).toBe(false);
    expect(isNonProductionDatabaseUrl(reflessUrl)).toBe(false);
  });

  it("aceita conexao direta allowlisted pelas variaveis reais do ambiente", () => {
    process.env.DATABASE_URL = directTestUrl;
    process.env.PROD_SUPABASE_PROJECT_REF = PROD_REF;
    process.env.SAFE_TEST_DATABASE_REFS = TEST_REF;
    vi.stubEnv("NODE_ENV", "test");
    expect(isNonProductionDatabaseUrl(directTestUrl)).toBe(true);
  });

  it("assert bloqueia producao direta com erro de dominio sem credencial", () => {
    let message = "";
    let code = "";
    try {
      assertNonProductionDatabaseUrl("db:push", directProdUrl, testEnv);
    } catch (error) {
      const typed = error as NonProductionDatabaseRequiredError;
      message = typed.message;
      code = typed.code;
    }
    expect(code).toBe(NON_PRODUCTION_DATABASE_REQUIRED);
    expect(message).toContain("db:push");
    expect(message).toContain("mesmo projeto Supabase da producao");
    expect(message).not.toContain(SECRET_PASSWORD);
    expect(message).not.toContain("postgresql://");
  });
});
