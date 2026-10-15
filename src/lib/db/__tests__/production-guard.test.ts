/**
 * Guarda dos scripts que por desenho visam a producao.
 *
 * src/lib/db/env-guard.ts (e o espelho .mjs) recusam producao: servem os caminhos que
 * precisam de banco isolado. Os scripts de auditoria, diagnostico e carimbo precisam do
 * caminho inverso, e a politica deles e "o operador nomeia o projeto antes de qualquer
 * conexao". Este ficheiro trava essa politica e prova que ela continua fail-closed.
 *
 * Nada aqui conecta a banco: as URLs sao sinteticas, e o assertReadOnlySession recebe um
 * stub do driver.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PRODUCTION_CONFIRM_EXIT_CODE,
  PRODUCTION_CONFIRM_FLAG,
  PRODUCTION_CONFIRM_REQUIRED,
  PRODUCTION_WRITE_FLAG,
  ProductionConfirmationError,
  SCRIPT_DB_BLOCKED_EXIT_CODE,
  STORAGE_ORIGIN_DIVERGE,
  STORAGE_ORIGIN_EXIT_CODE,
  assertProductionTarget,
  describeProductionTarget,
  evaluateProductionTarget,
  evaluateStorageOrigin,
  guardDataTargetEitherWayOrExit,
  guardProductionTargetOrExit,
  isProjectRef,
  readProductionConfirmation,
} from "../../../../scripts/lib/db-safety.mjs";
import { assertReadOnlySession } from "../../../../scripts/lib/prod-readonly.mjs";

const PROD_REF = "a".repeat(20);
const TEST_REF = "b".repeat(20);
const OTHER_REF = "c".repeat(20);
const SECRET = "senha-secreta-de-teste";

const PROD_URL = "postgresql://postgres:" + SECRET + "@db." + PROD_REF + ".supabase.co:5432/postgres";
const POOLER_URL = "postgresql://postgres." + PROD_REF + ":" + SECRET + "@aws-0-ca-central-1.pooler.supabase.com:6543/postgres";
const TEST_URL = "postgresql://postgres:" + SECRET + "@" + TEST_REF + ".supabase.co:5432/concursoai";
const LOCAL_URL = "postgresql://postgres:" + SECRET + "@localhost:5432/concursoai";

const env: NodeJS.ProcessEnv = { PROD_SUPABASE_PROJECT_REF: PROD_REF, NODE_ENV: "production" };
const VAZIO: NodeJS.ProcessEnv = { NODE_ENV: "production" };
const envConfirmRef: NodeJS.ProcessEnv = { NODE_ENV: "production", PRODUCTION_CONFIRM_REF: TEST_REF };
const envOutroRef: NodeJS.ProcessEnv = { NODE_ENV: "production", PRODUCTION_CONFIRM_REF: OTHER_REF };
const envComUrl: NodeJS.ProcessEnv = { ...env, DATABASE_URL: PROD_URL };
const argv = (...flags: string[]) => ["node", "scripts/x.mjs", ...flags];
const confirm = (ref: string) => PRODUCTION_CONFIRM_FLAG + ref;

/** O veredito e sempre log-safe: nem credencial, nem string de conexao. */
function expectSemCredencial(
  verb: { reason: string; hostname?: string; database?: string; projectRef?: string },
  rotulo: string,
) {
  const texto = [verb.reason, verb.hostname, verb.database, verb.projectRef].join(" ");
  expect(texto, rotulo).not.toContain(SECRET);
  expect(texto, rotulo).not.toContain("://");
}

describe("isProjectRef", () => {
  it("aceita 20 caracteres alnum", () => {
    expect(isProjectRef(PROD_REF)).toBe(true);
    expect(isProjectRef("  " + PROD_REF.toUpperCase() + "  ")).toBe(true);
  });

  it("recusa tamanho, formato e tipos errados", () => {
    expect(isProjectRef("a".repeat(19))).toBe(false);
    expect(isProjectRef("a".repeat(21))).toBe(false);
    expect(isProjectRef("db")).toBe(false);
    expect(isProjectRef("")).toBe(false);
    expect(isProjectRef(undefined)).toBe(false);
    expect(isProjectRef(42)).toBe(false);
  });
});

describe("leitura das flags de confirmacao", () => {
  it("sem flag, confirmRef fica indefinido", () => {
    expect(readProductionConfirmation(argv("--out", "x.json"), VAZIO)).toStrictEqual({
      confirmRef: undefined,
      allowWrite: false,
    });
  });

  it("flag com ref e flag de escrita", () => {
    const lida = readProductionConfirmation(argv(confirm(PROD_REF.toUpperCase()), PRODUCTION_WRITE_FLAG), VAZIO);
    expect(lida.confirmRef).toBe(PROD_REF);
    expect(lida.allowWrite).toBe(true);
  });

  it("fallback do ambiente so quando nao ha flag", () => {
    expect(readProductionConfirmation(argv(), envConfirmRef).confirmRef).toBe(TEST_REF);
    expect(readProductionConfirmation(argv(confirm(PROD_REF)), envOutroRef).confirmRef).toBe(
      PROD_REF,
    );
  });

  it("flag vazia nao conta como confirmacao", () => {
    expect(readProductionConfirmation(argv(PRODUCTION_CONFIRM_FLAG), VAZIO).confirmRef).toBeUndefined();
  });

  it("argv inesperado nao rebenta", () => {
    expect(readProductionConfirmation(undefined, VAZIO).confirmRef).toBeUndefined();
    expect(readProductionConfirmation([1, null] as unknown as string[], VAZIO).confirmRef).toBeUndefined();
  });
});

describe("veredito de producao: bloqueia enquanto o operador nao nomear o projeto", () => {
  it("producao sem confirmacao fica bloqueada e aponta a flag", () => {
    const v = evaluateProductionTarget(PROD_URL, env, { argv: argv() });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain(PRODUCTION_CONFIRM_FLAG);
    expectSemCredencial(v, "sem confirmacao");
  });

  it("confirmacao com ref mal formado fica bloqueada", () => {
    for (const ref of ["db", OTHER_REF.slice(0, 19), "nao-existe-de-todo"]) {
      const v = evaluateProductionTarget(PROD_URL, env, { argv: argv(confirm(ref)) });
      expect(v.allowed, ref).toBe(false);
      expect(v.reason, ref).toContain("project ref valido");
    }
  });

  it("confirmacao com ref de outro projeto fica bloqueada", () => {
    const v = evaluateProductionTarget(PROD_URL, env, { argv: argv(confirm(OTHER_REF)) });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("distinto do destino real");
  });

  it("destino que nao e producao fica bloqueado: recuso o carimbo em banco de teste", () => {
    const v = evaluateProductionTarget(TEST_URL, env, { argv: argv(confirm(TEST_REF)) });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("nao e o projeto de producao configurado");
  });

  it("host local sem project ref fica bloqueado", () => {
    const v = evaluateProductionTarget(LOCAL_URL, env, { argv: argv(confirm(PROD_REF)) });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("project ref nao identificavel");
  });

  it("sem PROD_SUPABASE_PROJECT_REF nao ha como provar o destino", () => {
    const v = evaluateProductionTarget(PROD_URL, VAZIO, { argv: argv(confirm(PROD_REF)) });
    expect(v.allowed).toBe(false);
    expect(v.reason).toContain("PROD_SUPABASE_PROJECT_REF ausente");
  });

  it("URL ausente ou invalida fica bloqueada", () => {
    expect(evaluateProductionTarget(undefined, env, { argv: argv(confirm(PROD_REF)) }).allowed).toBe(false);
    expect(evaluateProductionTarget("", env, { argv: argv(confirm(PROD_REF)) }).reason).toBe("DATABASE_URL ausente");
    const invalida = evaluateProductionTarget("isso-nao-e-uma-url", env, { argv: argv(confirm(PROD_REF)) });
    expect(invalida.allowed).toBe(false);
    expect(invalida.reason).toContain("invalida");
  });

  it("confirmacao certa liberta leitura", () => {
    const v = evaluateProductionTarget(PROD_URL, env, { argv: argv(confirm(PROD_REF)) });
    expect(v.allowed).toBe(true);
    expect(v.writes).toBe(false);
    expect(v.projectRef).toBe(PROD_REF);
    expect(v.hostname).toBe("db." + PROD_REF + ".supabase.co");
    expect(v.reason).toContain("apenas leitura");
  });

  it("escrita exige a flag extra, e as duas juntas libertam", () => {
    const semWrite = evaluateProductionTarget(PROD_URL, env, { argv: argv(confirm(PROD_REF)), writes: true });
    expect(semWrite.allowed).toBe(false);
    expect(semWrite.reason).toContain(PRODUCTION_WRITE_FLAG);
    const comWrite = evaluateProductionTarget(PROD_URL, env, {
      argv: argv(confirm(PROD_REF), PRODUCTION_WRITE_FLAG),
      writes: true,
    });
    expect(comWrite.allowed).toBe(true);
    expect(comWrite.reason).toContain("para escrita");
  });

  it("pooler: o ref vive no usuario da URL e a confirmacao bate por la", () => {
    const v = evaluateProductionTarget(POOLER_URL, env, { argv: argv(confirm(PROD_REF)) });
    expect(v.allowed).toBe(true);
    expect(v.projectRef).toBe(PROD_REF);
    expect(v.hostname).toContain("pooler.supabase.com");
  });

  it("DATABASE_URL vem do ambiente quando nao ha argumento", () => {
    const v = evaluateProductionTarget(undefined, envComUrl, { argv: argv(confirm(PROD_REF)) });
    expect(v.allowed).toBe(true);
  });

  it("nenhum motivo expoe credencial em nenhum caso", () => {
    const urls = [PROD_URL, POOLER_URL, TEST_URL, LOCAL_URL, "isso-nao-e-uma-url", ""];
    for (const url of urls) {
      for (const flags of [[], [confirm(PROD_REF)], [confirm(OTHER_REF)], [confirm(PROD_REF), PRODUCTION_WRITE_FLAG]]) {
        expectSemCredencial(evaluateProductionTarget(url, env, { argv: argv(...flags) }), url + " / " + flags.join(","));
      }
    }
  });

  it("NODE_ENV=production nao desvia a decisao deste ramo", () => {
    const v = evaluateProductionTarget(PROD_URL, env, {
      argv: argv(confirm(PROD_REF)),
    });
    expect(v.allowed).toBe(true);
  });
});

describe("linha de log do ramo de producao", () => {
  it("comeca com prod-guard e target, e nunca traz a URL", () => {
    const casos = [
      evaluateProductionTarget(PROD_URL, env, { argv: argv(confirm(PROD_REF)) }),
      evaluateProductionTarget(PROD_URL, env, { argv: argv() }),
      evaluateProductionTarget(POOLER_URL, env, { argv: argv(confirm(OTHER_REF)), writes: true }),
      evaluateProductionTarget("", env, { argv: argv() }),
    ];
    for (const v of casos) {
      const linha = describeProductionTarget("audit-schema-prod", v);
      expect(linha.startsWith("prod-guard target=audit-schema-prod ")).toBe(true);
      expect(linha).not.toContain(SECRET);
      expect(linha).not.toContain("://");
      expect(linha).toContain("allowed=" + v.allowed);
    }
  });
});

describe("assertProductionTarget langa erro de dominio sem credencial", () => {
  it("lanca ProductionConfirmationError com code e target", () => {
    let apanhado: unknown;
    try {
      assertProductionTarget("apply-stamp-migrations", PROD_URL, env, { argv: argv() });
    } catch (error) {
      apanhado = error;
    }
    expect(apanhado).toBeInstanceOf(ProductionConfirmationError);
    const typed = apanhado as ProductionConfirmationError;
    expect(typed.code).toBe(PRODUCTION_CONFIRM_REQUIRED);
    expect(typed.target).toBe("apply-stamp-migrations");
    expect(typed.message).not.toContain(SECRET);
    expect(typed.message).not.toContain("://");
  });

  it("devolve o veredito quando confirmado", () => {
    const v = assertProductionTarget("audit-schema-prod", PROD_URL, env, { argv: argv(confirm(PROD_REF)) });
    expect(v.allowed).toBe(true);
  });
});

describe("guardProductionTargetOrExit e a ultima porta antes do driver", () => {
  let exitCodeAnterior: typeof process.exitCode;
  const saida = { log: [] as string[], erro: [] as string[] };

  beforeEach(() => {
    exitCodeAnterior = process.exitCode;
    process.exitCode = undefined;
    saida.log = [];
    saida.erro = [];
    vi.spyOn(console, "log").mockImplementation((...args: unknown[]) => {
      saida.log.push(args.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      saida.erro.push(args.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = exitCodeAnterior;
  });

  it("bloqueio marca 4 e explica no stderr sem credencial alguma", () => {
    const v = guardProductionTargetOrExit("apply-stamp-migrations", PROD_URL, { env, argv: argv() });
    expect(PRODUCTION_CONFIRM_EXIT_CODE).toBe(4);
    expect(v.allowed).toBe(false);
    expect(process.exitCode).toBe(PRODUCTION_CONFIRM_EXIT_CODE);
    expect(saida.log).toStrictEqual([]);
    const texto = saida.erro.join("\n");
    expect(texto).toContain("BLOCKED " + PRODUCTION_CONFIRM_REQUIRED);
    expect(texto).toContain("Nenhuma conexao sera aberta");
    expect(texto).not.toContain(SECRET);
    expect(texto).not.toContain("://");
  });

  it("confirmacao certa liberta sem tocar no exit code", () => {
    const v = guardProductionTargetOrExit("audit-schema-prod", PROD_URL, { env, argv: argv(confirm(PROD_REF)) });
    expect(v.allowed).toBe(true);
    expect(process.exitCode).toBeUndefined();
    expect(saida.erro).toStrictEqual([]);
    expect(saida.log[0]?.startsWith("prod-guard target=audit-schema-prod")).toBe(true);
  });
});

describe("assertReadOnlySession exige a confirmacao do servidor", () => {
  /** Stub do driver: regista as queries e devolve o que o "servidor" responder. */
  function stub(resposta: unknown) {
    const queries: string[] = [];
    return {
      queries,
      sql: {
        unsafe: async (query: string) => {
          queries.push(query);
          return resposta;
        },
      },
    };
  }

  it("trava em read-only e so depois aceita o valor on", async () => {
    const fake = stub([{ default_transaction_read_only: "on" }]);
    expect(await assertReadOnlySession(fake.sql)).toBe("on");
    expect(fake.queries).toStrictEqual([
      "SET default_transaction_read_only = on",
      "SHOW default_transaction_read_only",
    ]);
  });

  it("aborta quando o servidor reporta off", async () => {
    const fake = stub([{ default_transaction_read_only: "off" }]);
    await expect(assertReadOnlySession(fake.sql)).rejects.toThrow(/read-only/);
    expect(fake.queries).toHaveLength(2);
  });

  it("aborta quando o servidor nao responde nada", async () => {
    await expect(assertReadOnlySession(stub([]).sql)).rejects.toThrow(/nenhuma query sera executada/);
    await expect(assertReadOnlySession(stub(undefined).sql)).rejects.toThrow(/nenhuma query sera executada/);
  });

  it("aborta antes de qualquer query se o handle nao tem unsafe", async () => {
    const semUnsafe = {} as { unsafe: (q: string) => Promise<unknown> };
    await expect(assertReadOnlySession(semUnsafe)).rejects.toThrow(/unsafe/);
    await expect(assertReadOnlySession(null as unknown as { unsafe: (q: string) => Promise<unknown> })).rejects.toThrow(
      /unsafe/,
    );
  });

  it("o motivo da falha nunca traz credencial", async () => {
    const erro = await assertReadOnlySession(stub([{ default_transaction_read_only: "off" }]).sql).catch((e: unknown) =>
      String(e),
    );
    expect(erro).not.toContain(SECRET);
    expect(erro).not.toContain("://");
  });
});

describe("scripts de producao aplicam a guarda antes de conectar", () => {
  const fontes: Record<string, string> = {
    "scripts/audit-schema-prod.mjs": readFileSync(join(process.cwd(), "scripts", "audit-schema-prod.mjs"), "utf8"),
    "scripts/diagnose-migrations.mjs": readFileSync(join(process.cwd(), "scripts", "diagnose-migrations.mjs"), "utf8"),
    "scripts/apply-stamp-migrations.mjs": readFileSync(
      join(process.cwd(), "scripts", "apply-stamp-migrations.mjs"),
      "utf8",
    ),
  };

  it("todos importam e chamam o guard de producao", () => {
    for (const [nome, fonte] of Object.entries(fontes)) {
      expect(fonte, nome).toContain("./lib/db-safety.mjs");
      expect(fonte, nome).toContain("guardProductionTargetOrExit(");
      expect(fonte, nome).toContain("verdict.allowed");
    }
  });

  it("a decisao le as chaves do mesmo .env.production que fornece a URL", () => {
    for (const [nome, fonte] of Object.entries(fontes)) {
      expect(fonte, nome).toContain('".env.production"');
      const chaves = fonte.indexOf("mergeDatabaseEnv(");
      const guarda = fonte.indexOf("guardProductionTargetOrExit(");
      expect(chaves, nome).toBeGreaterThan(-1);
      expect(chaves, nome).toBeLessThan(guarda);
      expect(fonte, nome).toContain("mergeDatabaseEnv(fs,");
      expect(fonte, nome).toContain("env: decisionEnv");
    }
  });

  it("a guarda vem sempre antes da conexao", () => {
    for (const [nome, fonte] of Object.entries(fontes)) {
      const guarda = fonte.indexOf("guardProductionTargetOrExit(");
      const conexao = fonte.indexOf("postgres(DATABASE_URL");
      expect(guarda, nome).toBeGreaterThan(-1);
      expect(conexao, nome).toBeGreaterThan(guarda);
    }
  });

  it("so o script que escreve pede writes: true", () => {
    expect(fontes["scripts/apply-stamp-migrations.mjs"]).toContain("writes: true");
    expect(fontes["scripts/audit-schema-prod.mjs"]).not.toContain("writes: true");
    expect(fontes["scripts/diagnose-migrations.mjs"]).not.toContain("writes: true");
  });

  it("os dois de leitura travam a sessao em read-only depois de conectar", () => {
    for (const nome of ["scripts/audit-schema-prod.mjs", "scripts/diagnose-migrations.mjs"]) {
      const fonte = fontes[nome];
      const trava = fonte.indexOf("assertReadOnlySession(sql)");
      expect(trava, nome).toBeGreaterThan(-1);
      expect(trava, nome).toBeGreaterThan(fonte.indexOf("postgres(DATABASE_URL"));
    }
  });
});

describe("origem de storage tem de ser o mesmo projecto do banco", () => {
  const STOR_PROD = "https://" + PROD_REF + ".supabase.co";
  const STOR_TESTE = "https://" + TEST_REF + ".supabase.co";
  const STOR_OUTRO = "https://" + OTHER_REF + ".supabase.co";

  it("bate quando os dois refs sao o mesmo projecto", () => {
    expect(evaluateStorageOrigin(PROD_URL, STOR_PROD).ok).toBe(true);
    const pooler = evaluateStorageOrigin(POOLER_URL, STOR_PROD);
    expect(pooler.ok).toBe(true);
    expect(pooler.dbRef).toBe(PROD_REF);
  });

  it("diverge quando storage e banco sao projectos diferentes", () => {
    const v = evaluateStorageOrigin(TEST_URL, STOR_PROD);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("divergem");
    expect(v.storageRef).toBe(PROD_REF);
  });

  it("recusa banco sem ref (local ou externo): nada e comparavel", () => {
    const v = evaluateStorageOrigin(LOCAL_URL, STOR_PROD);
    expect(v.ok).toBe(false);
    expect(v.reason).toContain("sem project ref");
  });

  it("recusa storage ausente ou invalida", () => {
    expect(evaluateStorageOrigin(PROD_URL, undefined).ok).toBe(false);
    expect(evaluateStorageOrigin(PROD_URL, "").reason).toContain("SUPABASE_URL");
    expect(evaluateStorageOrigin(PROD_URL, "nao-e-url").ok).toBe(false);
    expect(evaluateStorageOrigin("isso-nao-e-uma-url", STOR_PROD).ok).toBe(false);
  });

  it("motivos nunca trazem credencial", () => {
    const pares: Array<[string, string | undefined]> = [
      [PROD_URL, STOR_PROD],
      [POOLER_URL, STOR_OUTRO],
      [LOCAL_URL, STOR_TESTE],
      ["", ""],
    ];
    for (const [db, st] of pares) {
      const v = evaluateStorageOrigin(db, st);
      expect(v.reason).not.toContain(SECRET);
      expect(v.reason).not.toContain("://");
    }
  });
});

describe("veredito composto: teste livre ou producao nomeada", () => {
  let exitCodeAnterior: typeof process.exitCode;
  const saida = { log: [] as string[], erro: [] as string[] };
  const envTeste: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    VITEST: "true",
    PROD_SUPABASE_PROJECT_REF: PROD_REF,
    SAFE_TEST_DATABASE_REFS: TEST_REF,
  };
  const envProd: NodeJS.ProcessEnv = { NODE_ENV: "production", PROD_SUPABASE_PROJECT_REF: PROD_REF };
  const stor = (ref: string) => "https://" + ref + ".supabase.co";

  beforeEach(() => {
    exitCodeAnterior = process.exitCode;
    process.exitCode = undefined;
    saida.log = [];
    saida.erro = [];
    vi.spyOn(console, "log").mockImplementation((...a: unknown[]) => {
      saida.log.push(a.map(String).join(" "));
    });
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
      saida.erro.push(a.map(String).join(" "));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.exitCode = exitCodeAnterior;
  });

  it("banco de teste aprovado passa sem ceremonya", () => {
    const r = guardDataTargetEitherWayOrExit("migrate-storage-r2", TEST_URL, {
      env: envTeste,
      storageUrl: stor(TEST_REF),
      argv: argv(),
    });
    expect(r.modo).toBe("teste");
    expect(process.exitCode).toBeUndefined();
    expect(saida.erro).toStrictEqual([]);
    expect(saida.log[0]).toContain("modo=teste");
  });

  it("banco de teste com storage de producao bloqueia por origem", () => {
    const r = guardDataTargetEitherWayOrExit("migrate-storage-r2", TEST_URL, {
      env: envTeste,
      storageUrl: stor(PROD_REF),
      argv: argv(),
    });
    expect(r.modo).toBe("bloqueado");
    expect(process.exitCode).toBe(STORAGE_ORIGIN_EXIT_CODE);
    const texto = saida.erro.join("\n");
    expect(texto).toContain("BLOCKED " + STORAGE_ORIGIN_DIVERGE);
    expect(texto).not.toContain(SECRET);
  });

  it("producao sem nomeacao bloqueia com 4 e explica os dois caminhos", () => {
    const r = guardDataTargetEitherWayOrExit("migrate-storage-r2", PROD_URL, {
      env: envProd,
      storageUrl: stor(PROD_REF),
      argv: argv(),
    });
    expect(r.modo).toBe("bloqueado");
    expect(process.exitCode).toBe(PRODUCTION_CONFIRM_EXIT_CODE);
    const texto = saida.erro.join("\n");
    expect(texto).toContain("BLOCKED NON_PRODUCTION_DATABASE_REQUIRED e PRODUCTION_CONFIRM_REQUIRED");
    expect(texto).toContain(PRODUCTION_CONFIRM_FLAG);
    expect(texto).not.toContain("://");
  });

  it("producao nomeada passa e anuncia o modo", () => {
    const r = guardDataTargetEitherWayOrExit("migrate-storage-r2", PROD_URL, {
      env: envProd,
      storageUrl: stor(PROD_REF),
      argv: argv(confirm(PROD_REF)),
    });
    expect(r.modo).toBe("producao");
    expect(process.exitCode).toBeUndefined();
    expect(saida.log[0]).toContain("modo=producao");
    expect(saida.log.join("\n")).not.toContain(SECRET);
  });

  it("producao nomeada com storage de outro projecto continua bloqueada", () => {
    const r = guardDataTargetEitherWayOrExit("migrate-storage-r2", PROD_URL, {
      env: envProd,
      storageUrl: stor(OTHER_REF),
      argv: argv(confirm(PROD_REF)),
    });
    expect(r.modo).toBe("bloqueado");
    expect(process.exitCode).toBe(STORAGE_ORIGIN_EXIT_CODE);
  });

  it("destino externo sem marca bloqueia com 3, nao com 4", () => {
    const r = guardDataTargetEitherWayOrExit(
      "migrate-storage-r2",
      "postgresql://app:" + SECRET + "@pg.example.com:5432/appdb",
      { env: envProd, argv: argv(confirm(PROD_REF)) },
    );
    expect(r.modo).toBe("bloqueado");
    expect(process.exitCode).toBe(SCRIPT_DB_BLOCKED_EXIT_CODE);
  });

  it("sem storageUrl a origem nao e exigida", () => {
    const r = guardDataTargetEitherWayOrExit("outro-script", TEST_URL, { env: envTeste, argv: argv() });
    expect(r.modo).toBe("teste");
    expect(r.origem.ok).toBe(true);
  });
});

describe("o script de migracao aplica a guarda antes de qualquer rede", () => {
  const fonte = readFileSync(join(process.cwd(), "scripts", "migrate-storage-r2.mjs"), "utf8");

  it("importa e chama o veredito composto com a origem de storage", () => {
    expect(fonte).toContain("./lib/db-safety.mjs");
    expect(fonte).toContain("guardDataTargetEitherWayOrExit(");
    expect(fonte).toContain("storageUrl: process.env.SUPABASE_URL");
    expect(fonte).toContain("guarda.modo");
  });

  it("a guarda vem antes da conexao, do fetch e do createDbClient", () => {
    const guarda = fonte.indexOf("guardDataTargetEitherWayOrExit(");
    expect(guarda).toBeGreaterThan(-1);
    expect(fonte.indexOf("postgres(process.env.DATABASE_URL")).toBeGreaterThan(guarda);
    expect(fonte.indexOf("await fetch(url")).toBeGreaterThan(guarda);
    expect(fonte.indexOf("createDbClient()")).toBeGreaterThan(guarda);
  });

  it("declara-se somente leitura perante a guarda", () => {
    expect(fonte).toContain("writes: false");
    expect(fonte).not.toContain("writes: true");
  });
});
