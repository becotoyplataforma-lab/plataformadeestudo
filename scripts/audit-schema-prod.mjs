#!/usr/bin/env node
/**
 * Auditoria do schema de produção (Passo 1)
 * ==========================================
 * Conecta no banco de produção via DATABASE_URL do .env.production e lista:
 *   1. Todas as tabelas do schema public
 *   2. Todas as colunas de cada tabela (nome, tipo, nullable, default)
 *   3. Todos os enums customizados (pg_type onde typtype='e')
 *
 * Uso:
 *   node scripts/audit-schema-prod.mjs --confirm-production=<ref> [--out <arquivo.json>]
 *
 * Sem --confirm-production a nomear o mesmo project ref do destino, nenhuma conexão é
 * aberta (bloqueio com exit code 4). Além disso a sessão é travada em read-only e o
 * valor é confirmado pelo servidor antes de qualquer SELECT.
 *
 * Se --out for omitido, imprime no stdout.
 */
import postgres from "postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { PRODUCTION_CONFIRM_EXIT_CODE, guardProductionTargetOrExit, mergeDatabaseEnv } from "./lib/db-safety.mjs";
import { assertReadOnlySession } from "./lib/prod-readonly.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");

// ---- Lê DATABASE_URL do .env.production ----
const envFile = path.join(PROJECT_DIR, ".env.production");
if (!fs.existsSync(envFile)) {
  console.error(`❌ ${envFile} não encontrado.`);
  process.exit(1);
}
const envContent = fs.readFileSync(envFile, "utf8");
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
if (!match) {
  console.error("❌ DATABASE_URL não definida em .env.production");
  process.exit(1);
}
const DATABASE_URL = match[1].trim();

// ---- Guarda de produção: nenhuma conexão antes de o operador nomear o projeto ----
// As chaves da decisão vêm do mesmo .env.production de onde saiu a DATABASE_URL: sem
// PROD_SUPABASE_PROJECT_REF no ambiente não há como provar que o destino é produção.
const decisionEnv = mergeDatabaseEnv(fs, process.env, PROJECT_DIR, [".env.production"]);
const verdict = guardProductionTargetOrExit("audit-schema-prod", DATABASE_URL, { env: decisionEnv });
if (!verdict.allowed) {
  process.exit(PRODUCTION_CONFIRM_EXIT_CODE);
}

// ---- Conecta ----
const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 15 });

try {
  // Este script é leitura pura: a sessão é travada em read-only e o servidor confirma o valor.
  await assertReadOnlySession(sql);
  // 1. Tabelas do schema public
  const tables = await sql.unsafe(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  // 2. Colunas de cada tabela
  const columns = await sql.unsafe(`
    SELECT
      c.table_name,
      c.column_name,
      c.data_type,
      c.udt_name,
      c.is_nullable,
      c.column_default,
      c.character_maximum_length
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position
  `);

  // 3. Enums customizados
  const enums = await sql.unsafe(`
    SELECT
      t.typname AS enum_name,
      e.enumlabel AS enum_value
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_namespace n ON t.typnamespace = n.oid
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);

  // ---- Monta resultado ----
  const result = {
    generatedAt: new Date().toISOString(),
    databaseUrlHost: new URL(DATABASE_URL).host,
    tables: tables.map((t) => t.table_name),
    columns: columns.map((c) => ({
      table: c.table_name,
      column: c.column_name,
      type: c.data_type,
      udt: c.udt_name,
      nullable: c.is_nullable === "YES",
      default: c.column_default,
      maxLength: c.character_maximum_length,
    })),
    enums: enums.map((e) => ({
      name: e.enum_name,
      value: e.enum_value,
    })),
  };

  // ---- Saída ----
  const outArgIdx = process.argv.indexOf("--out");
  if (outArgIdx !== -1 && process.argv[outArgIdx + 1]) {
    const outFile = process.argv[outArgIdx + 1];
    fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
    console.log(`✅ Auditoria salva em ${outFile}`);
    console.log(`   Tabelas: ${result.tables.length}`);
    console.log(`   Colunas: ${result.columns.length}`);
    console.log(`   Enums:   ${result.enums.length}`);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
} catch (err) {
  console.error("❌ Erro na auditoria:", err.message);
  process.exit(1);
} finally {
  await sql.end();
}
