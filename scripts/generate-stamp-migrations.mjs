#!/usr/bin/env node
/**
 * Gera o SQL para "carimbar" as migrations 0000-0004 como aplicadas.
 * ==================================================================
 * O banco de produção já tem todo o schema (criado por SQL manual), mas a
 * tabela `drizzle.__drizzle_migrations` não existe. Este script gera o SQL
 * que:
 *   1. Cria o schema `drizzle` (se não existir)
 *   2. Cria a tabela `drizzle.__drizzle_migrations` (estrutura do drizzle-kit)
 *   3. Insere as 5 migrations com hash (SHA-256 do .sql) e created_at (when do journal)
 *
 * NÃO executa nada — apenas GERA o SQL para revisão.
 *
 * Uso:
 *   node scripts/generate-stamp-migrations.mjs [--out <arquivo.sql>]
 */
import crypto from "node:crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.resolve(__dirname, "..");
const DRIZZLE_DIR = path.join(PROJECT_DIR, "drizzle");

// ---- Lê o journal ----
const journalPath = path.join(DRIZZLE_DIR, "meta", "_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));

// ---- Calcula hash e monta inserts ----
const inserts = [];
for (const entry of journal.entries) {
  const sqlPath = path.join(DRIZZLE_DIR, `${entry.tag}.sql`);
  const query = fs.readFileSync(sqlPath, "utf8");
  const hash = crypto.createHash("sha256").update(query).digest("hex");
  inserts.push({
    tag: entry.tag,
    hash,
    when: entry.when,
  });
}

// ---- Monta o SQL ----
const lines = [];
lines.push("-- ============================================================");
lines.push("-- Carimbo das migrations 0000-0004 como aplicadas");
lines.push("-- Gerado em " + new Date().toISOString());
lines.push("-- O schema já existe no banco (criado por SQL manual).");
lines.push("-- Este script apenas sincroniza o registro contábil do drizzle.");
lines.push("-- ============================================================");
lines.push("");
lines.push('CREATE SCHEMA IF NOT EXISTS "drizzle";');
lines.push("");
lines.push('CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (');
lines.push('\t"id" SERIAL PRIMARY KEY,');
lines.push('\t"hash" text NOT NULL,');
lines.push('\t"created_at" bigint');
lines.push(");");
lines.push("");

for (const ins of inserts) {
  lines.push(`-- Migration ${ins.tag}`);
  lines.push(
    `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ('${ins.hash}', ${ins.when});`
  );
  lines.push("");
}

const sql = lines.join("\n");

// ---- Saída ----
const outArgIdx = process.argv.indexOf("--out");
if (outArgIdx !== -1 && process.argv[outArgIdx + 1]) {
  const outFile = process.argv[outArgIdx + 1];
  fs.writeFileSync(outFile, sql);
  console.log(`✅ SQL gerado em ${outFile}`);
  console.log("");
  console.log(sql);
} else {
  console.log(sql);
}
