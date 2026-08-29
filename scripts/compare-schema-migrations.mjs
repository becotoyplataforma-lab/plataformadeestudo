#!/usr/bin/env node
/**
 * Comparação do schema de produção com as migrations 0000-0004 (Passo 2)
 * ======================================================================
 * Lê o JSON da auditoria (scripts/schema-prod.json) e os arquivos .sql das
 * migrations (drizzle/*.sql), e reporta para cada migration:
 *   - Tabelas que ela cria → existem no banco?
 *   - Colunas que ela adiciona (ALTER TABLE ADD COLUMN) → existem no banco?
 *   - Enums que ela cria → existem no banco?
 *   - Valores de enum que ela adiciona (ALTER TYPE ADD VALUE) → existem?
 *
 * Uso:
 *   node scripts/compare-schema-migrations.mjs
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");

// ---- Lê auditoria ----
const auditPath = path.join(__dirname, "schema-prod.json");
if (!fs.existsSync(auditPath)) {
  console.error(`❌ ${auditPath} não encontrado. Rode scripts/audit-schema-prod.mjs primeiro.`);
  process.exit(1);
}
const audit = JSON.parse(fs.readFileSync(auditPath, "utf8"));

const dbTables = new Set(audit.tables);
const dbColumns = new Map(); // table -> Set(column)
for (const c of audit.columns) {
  if (!dbColumns.has(c.table)) dbColumns.set(c.table, new Set());
  dbColumns.get(c.table).add(c.column);
}
const dbEnums = new Map(); // enumName -> Set(value)
for (const e of audit.enums) {
  if (!dbEnums.has(e.name)) dbEnums.set(e.name, new Set());
  dbEnums.get(e.name).add(e.value);
}

// ---- Lê migrations ----
const drizzleDir = path.join(PROJECT_DIR, "drizzle");
const migrationFiles = fs
  .readdirSync(drizzleDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const report = [];

for (const file of migrationFiles) {
  const sql = fs.readFileSync(path.join(drizzleDir, file), "utf8");
  const tag = file.replace(".sql", "");

  const entry = {
    migration: tag,
    tablesCreated: [],
    columnsAdded: [],
    enumsCreated: [],
    enumValuesAdded: [],
  };

  // Tabelas criadas: CREATE TABLE [IF NOT EXISTS] "name"
  const tableRe = /CREATE TABLE (?:IF NOT EXISTS )?"([^"]+)"/g;
  let m;
  while ((m = tableRe.exec(sql))) {
    entry.tablesCreated.push(m[1]);
  }

  // Colunas adicionadas: ALTER TABLE "t" ADD COLUMN "c"
  const colRe = /ALTER TABLE "([^"]+)" ADD COLUMN "([^"]+)"/g;
  while ((m = colRe.exec(sql))) {
    entry.columnsAdded.push({ table: m[1], column: m[2] });
  }

  // Enums criados: CREATE TYPE "public"."name" AS ENUM
  const enumRe = /CREATE TYPE "public"\."([^"]+)" AS ENUM/g;
  while ((m = enumRe.exec(sql))) {
    entry.enumsCreated.push(m[1]);
  }

  // Valores de enum adicionados: ALTER TYPE "public"."name" ADD VALUE 'x'
  const enumValRe = /ALTER TYPE "public"\."([^"]+)" ADD VALUE '([^']+)'/g;
  while ((m = enumValRe.exec(sql))) {
    entry.enumValuesAdded.push({ enum: m[1], value: m[2] });
  }

  report.push(entry);
}

// ---- Análise ----
console.log("=".repeat(70));
console.log("COMPARAÇÃO: SCHEMA DE PRODUÇÃO vs MIGRATIONS 0000-0004");
console.log("=".repeat(70));
console.log(`Banco: ${audit.databaseUrlHost}`);
console.log(`Tabelas no banco: ${dbTables.size}`);
console.log(`Colunas no banco: ${audit.columns.length}`);
console.log(`Valores de enum no banco: ${audit.enums.length}`);
console.log("");

let allOk = true;

for (const entry of report) {
  console.log(`\n### Migration ${entry.migration}`);
  console.log("-".repeat(70));

  // Tabelas
  if (entry.tablesCreated.length > 0) {
    console.log(`\n  Tabelas criadas (${entry.tablesCreated.length}):`);
    for (const t of entry.tablesCreated) {
      const exists = dbTables.has(t);
      if (!exists) allOk = false;
      console.log(`    ${exists ? "✅" : "❌ FALTA"} ${t}`);
    }
  }

  // Colunas
  if (entry.columnsAdded.length > 0) {
    console.log(`\n  Colunas adicionadas (${entry.columnsAdded.length}):`);
    for (const { table, column } of entry.columnsAdded) {
      const exists = dbColumns.get(table)?.has(column) ?? false;
      if (!exists) allOk = false;
      console.log(`    ${exists ? "✅" : "❌ FALTA"} ${table}.${column}`);
    }
  }

  // Enums
  if (entry.enumsCreated.length > 0) {
    console.log(`\n  Enums criados (${entry.enumsCreated.length}):`);
    for (const e of entry.enumsCreated) {
      const exists = dbEnums.has(e);
      if (!exists) allOk = false;
      console.log(`    ${exists ? "✅" : "❌ FALTA"} ${e}`);
    }
  }

  // Valores de enum
  if (entry.enumValuesAdded.length > 0) {
    console.log(`\n  Valores de enum adicionados (${entry.enumValuesAdded.length}):`);
    for (const { enum: e, value } of entry.enumValuesAdded) {
      const exists = dbEnums.get(e)?.has(value) ?? false;
      if (!exists) allOk = false;
      console.log(`    ${exists ? "✅" : "❌ FALTA"} ${e}.${value}`);
    }
  }
}

console.log("\n" + "=".repeat(70));
if (allOk) {
  console.log("✅ RESULTADO: TUDO que as migrations 0000-0004 esperam JÁ EXISTE no banco.");
  console.log("   → Pode carimbar as 5 migrations como aplicadas (sem rodar DDL).");
} else {
  console.log("⚠️ RESULTADO: Existem itens FALTANDO no banco. Ver detalhes acima.");
}
console.log("=".repeat(70));
