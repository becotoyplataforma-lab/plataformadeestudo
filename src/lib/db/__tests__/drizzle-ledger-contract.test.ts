/**
 * Contrato do ledger de migrations, extraido do migrador REAL instalado.
 *
 * Nada aqui abre conexao. O ponto e exatamente esse: a R6.5 afirmava ordem e
 * comparacao do ledger por leitura de cabeca, e leitura de cabeca produziu
 * conclusao falsa (NULL como bloqueio, quando NULL causa re-execucao). As
 * assercoes abaixo leem node_modules/drizzle-orm/pg-core/dialect.cjs e o
 * journal do repositorio, entao se o Drizzle mudar de comportamento o teste
 * avisa em vez de confirmar a expectativa antiga.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DIALECT_PATH = join(
  process.cwd(),
  "node_modules",
  "drizzle-orm",
  "pg-core",
  "dialect.cjs"
);
const dialect = readFileSync(DIALECT_PATH, "utf-8");

function migrateBody(): string {
  const start = dialect.indexOf("async migrate(");
  const end = dialect.indexOf("escapeName", start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return dialect.slice(start, end);
}

const MIGRATE = migrateBody();

type JournalEntry = { idx: number; version: string; when: number; tag: string; breakpoints: boolean };

function journal(): { version: string; dialect: string; entries: JournalEntry[] } {
  return JSON.parse(
    readFileSync(join(process.cwd(), "drizzle", "meta", "_journal.json"), "utf-8")
  );
}

/**
 * Emulacao de ORDER BY created_at DESC LIMIT 1 com a regra real do PostgreSQL:
 * em DESC, NULL vem antes (NULLS FIRST e implicito). Sem isso o teste ordenaria
 * de um jeito e o banco de outro.
 */
function lastAppliedDescending(rows: Array<{ created_at: number | null }>) {
  const sorted = [...rows].sort((a, b) => {
    if (a.created_at === null && b.created_at === null) return 0;
    if (a.created_at === null) return -1;
    if (b.created_at === null) return 1;
    return b.created_at - a.created_at;
  });
  return sorted[0] ?? null;
}

/** A regra literal do migrador, copiada linha a linha. */
function pendingUnderDrizzleRule(
  entries: JournalEntry[],
  ledgerRows: Array<{ created_at: number | null }>
): JournalEntry[] {
  const lastDbMigration = lastAppliedDescending(ledgerRows);
  return entries.filter(
    (migration) =>
      !lastDbMigration ||
      Number(lastDbMigration.created_at) < migration.when
  );
}

describe("drizzle 0.45.2 - contrato real do ledger", () => {
  it("cria schema e tabela de ledger de forma idempotente", () => {
    expect(MIGRATE).toContain("CREATE SCHEMA IF NOT EXISTS");
    expect(MIGRATE).toContain("CREATE TABLE IF NOT EXISTS");
  });

  it("created_at do ledger e bigint NULLABLE - nao ha garantia de timestamp", () => {
    expect(MIGRATE).toMatch(/hash text NOT NULL/);
    expect(MIGRATE).toMatch(/created_at bigint(\s*)\)/);
    expect(MIGRATE).not.toMatch(/created_at bigint NOT NULL/);
  });

  it("a leitura do ledger e order by created_at desc limit 1, sem desempate", () => {
    expect(MIGRATE).toContain(
      "order by created_at desc limit 1"
    );
    const query = MIGRATE.match(/select id, hash, created_at from[^`]*/);
    expect(query).not.toBeNull();
    expect(query?.[0].toLowerCase()).not.toContain("id desc");
    expect(query?.[0].toLowerCase()).not.toContain("nulls first");
    expect(query?.[0].toLowerCase()).not.toContain("nulls last");
  });

  it("a comparacao e estrita e NAO ha guarda por hash", () => {
    expect(MIGRATE).toMatch(/Number\(lastDbMigration\.created_at\) < migration\.folderMillis/);
    expect(MIGRATE).not.toMatch(/Number\(lastDbMigration\.created_at\) <=/);
    expect(MIGRATE).not.toMatch(/dbMigrations\.some/);
    expect(MIGRATE).not.toMatch(/hash === migration\.hash/);
  });

  it("tudo roda em uma unica transacao: nao existe ledger parcial", () => {
    const txIndex = MIGRATE.indexOf("session.transaction");
    const loopIndex = MIGRATE.indexOf("for await (const migration of migrations)");
    expect(txIndex).toBeGreaterThan(-1);
    expect(loopIndex).toBeGreaterThan(txIndex);
  });

  it("created_at gravado e o folderMillis do journal (origem sintetica)", () => {
    expect(MIGRATE).toMatch(/\("hash", "created_at"\) values\(\$\{migration\.hash\}, \$\{migration\.folderMillis\}\)/);
  });

  it("nomes padrao de schema e tabela", () => {
    expect(MIGRATE).toContain("__drizzle_migrations");
    expect(MIGRATE).toMatch(/migrationsSchema[\s\S]{0,80}"drizzle"/);
  });
});

describe("reconciliacao journal, arquivos, snapshots e carimbo", () => {
  const j = journal();
  const migrationFiles = readdirSync(join(process.cwd(), "drizzle"))
    .filter((f) => /^\d{4}.*\.sql$/.test(f))
    .map((f) => f.replace(/\.sql$/, ""))
    .sort();
  const snapshotTags = readdirSync(join(process.cwd(), "drizzle", "meta"))
    .filter((f) => /^\d{4}_snapshot\.json$/.test(f))
    .map((f) => f.slice(0, 4))
    .sort();
  const stampSql = readFileSync(
    join(process.cwd(), "scripts", "stamp-migrations.sql"),
    "utf-8"
  );
  const stampedCreatedAt = Array.from(
    stampSql.matchAll(/VALUES \([^)]*,\s*(\d+)\)/g),
    (m) => Number(m[1])
);

  it("o journal esta ordenado por idx e os when crescem", () => {
    const idxs = j.entries.map((e) => e.idx);
    expect(idxs).toEqual([...idxs].sort((a, b) => a - b));
    const whens = j.entries.map((e) => e.when);
    expect(whens).toEqual([...whens].sort((a, b) => a - b));
  });

  it("0006, 0007 e 0008 existem como arquivo mas nao estao no journal", () => {
    const tags = j.entries.map((e) => e.tag);
    const orphans = migrationFiles.filter((f) => !tags.includes(f));
    expect(orphans).toEqual([
      "0006_questions_knowledge_topic_id",
      "0007_notice_topics",
      "0008_reconcile_production_drift",
    ]);
  });

  it("os orfaos tambem nao tem snapshot", () => {
    expect(snapshotTags).toEqual(["0000", "0001", "0002", "0003", "0004", "0005"]);
  });

  it("o carimbo manual cobre so 0000-0004, entao 0005 fica pendente", () => {
    const whens = j.entries.map((e) => e.when);
    for (const created of stampedCreatedAt) {
      expect(whens).toContain(created);
    }
    expect(stampedCreatedAt).toHaveLength(5);
    const rows = stampedCreatedAt.map((created_at) => ({ created_at }));
    const pending = pendingUnderDrizzleRule(j.entries, rows);
    expect(pending.map((e) => e.tag)).toEqual(["0005_thick_supernaut"]);
  });

  it("igualdade nao reexecuta: comparacao estrita nos dados reais", () => {
    const last = j.entries[j.entries.length - 1];
    const pending = pendingUnderDrizzleRule(j.entries, [{ created_at: last.when }]);
    expect(pending).toEqual([]);
  });

  it("created_at NULL no ledger provoca re-execucao de todo o journal", () => {
    const rows = [{ created_at: null }, { created_at: j.entries[5].when }];
    const last = lastAppliedDescending(rows);
    expect(last?.created_at).toBeNull();
    expect(Number(last?.created_at)).toBe(0);
    const pending = pendingUnderDrizzleRule(j.entries, rows);
    expect(pending).toHaveLength(j.entries.length);
  });
});

describe("divergencia de schema detectavel sem tocar no banco", () => {
  const baseline = readFileSync(
    join(process.cwd(), "drizzle", "0000_baseline.sql"),
    "utf-8"
  );
  const third = readFileSync(
    join(process.cwd(), "drizzle", "0003_wide_molten_man.sql"),
    "utf-8"
  );
  const eighth = readFileSync(
    join(process.cwd(), "drizzle", "0008_reconcile_production_drift.sql"),
    "utf-8"
  );

  it("kimi esta na baseline e volta em ADD VALUE: replay limpo colide", () => {
    expect(baseline).toMatch(/CREATE TYPE "public"\."ai_model" AS ENUM\([^)]*kimi[^)]*\)/);
    expect(third).toMatch(/ALTER TYPE "public"\."ai_model" ADD VALUE/);
    expect(third).toContain("kimi");
    expect(third).not.toMatch(/IF NOT EXISTS/);
  });

  /**
   * A checagem roda sobre DDL real, nao sobre prosa: o cabecalho do arquivo
   * declara justamente que nao duplica knowledge_topic_id e notice_topics, e
   * citar isso no comentario nao conta como objeto duplicado.
   */
  function statementsOnly(text: string): string {
    return text
      .split(String.fromCharCode(10))
      .filter((line) => !line.trim().startsWith("--"))
      .join(String.fromCharCode(10));
  }

  const eighthDdl = statementsOnly(eighth);

  it("0008 declara nao duplicar 0006 e 0007, e cumpre no DDL", () => {
    expect(eighth).toContain("Nao duplica nada de 0000-0007");
    expect(eighthDdl).not.toMatch(/knowledge_topic_id/i);
    expect(eighthDdl).not.toMatch(/notice_topics/i);
    expect(eighthDdl).not.toMatch(/questions_knowledge_topic_id/i);
  });

  it("0008 precisa de autocommit porque ADD VALUE nao roda em transacao", () => {
    expect(eighth).toMatch(/ALTER TYPE[\s\S]*ADD VALUE/);
    expect(eighth).toMatch(/sem --single-transaction/i);
  });

  it("0008 e catch-up forward-only: nao semeia dados nem mexe em RLS", () => {
    // ON DELETE SET NULL e Clausula de FK, nao DML: o que se proibe aqui e
    //Statement de dados ou de estrutura destrutiva de alto alcance.
    expect(eighthDdl).not.toMatch(/(^|\n)\s*(INSERT|UPDATE|DELETE|TRUNCATE)\b/i);
    expect(eighthDdl).not.toMatch(/DROP\s+(TABLE|SCHEMA|DATABASE|COLUMN)/i);
    expect(eighthDdl).not.toMatch(/ROW LEVEL SECURITY/i);
    expect(eighthDdl).not.toMatch(/\bGRANT\b/i);
  });
});
