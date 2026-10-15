#!/usr/bin/env node
/**
 * Diagnóstico da tabela __drizzle_migrations e comparação de hashes.
 * ==================================================================
 * 1. Lista todas as entradas da tabela __drizzle_migrations
 * 2. Calcula o hash SHA-256 de cada arquivo .sql local (no VPS)
 * 3. Compara e mostra quais batem e quais divergem
 *
 * Uso:
 *   node scripts/diagnose-migrations.mjs --confirm-production=<ref>
 *
 * Este script é leitura pura, mas liga-se ao banco de produção. Sem a confirmação do
 * project ref nenhuma conexão é aberta (exit code 4) e a sessão é travada em read-only
 * com confirmação do servidor antes do primeiro SELECT.
 */
import crypto from "node:crypto";
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
const envContent = fs.readFileSync(envFile, "utf8");
const match = envContent.match(/^DATABASE_URL=(.+)$/m);
const DATABASE_URL = match ? match[1].trim() : "";

// ---- Guarda de produção: nenhuma conexão antes de o operador nomear o projeto ----
// O .env.production é a fonte das duas peças da decisão: a URL e o ref de produção.
const decisionEnv = mergeDatabaseEnv(fs, process.env, PROJECT_DIR, [".env.production"]);
const verdict = guardProductionTargetOrExit("diagnose-migrations", DATABASE_URL, { env: decisionEnv });
if (!verdict.allowed) {
  process.exit(PRODUCTION_CONFIRM_EXIT_CODE);
}

// ---- Lê o journal ----
const journalPath = path.join(PROJECT_DIR, "drizzle", "meta", "_journal.json");
const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));

// ---- Calcula hashes dos arquivos .sql locais (no VPS) ----
const localHashes = {};
for (const entry of journal.entries) {
  const sqlPath = path.join(PROJECT_DIR, "drizzle", `${entry.tag}.sql`);
  const query = fs.readFileSync(sqlPath, "utf8");
  localHashes[entry.tag] = {
    hash: crypto.createHash("sha256").update(query).digest("hex"),
    when: entry.when,
  };
}

// ---- Conecta ----
const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 15 });

try {
  // Leitura pura: a sessão é travada em read-only e o servidor confirma o valor.
  await assertReadOnlySession(sql);
  console.log("🔌 Conectado ao banco de produção.\n");

  // 1. Entradas existentes na tabela
  const rows = await sql.unsafe(`
    SELECT id, hash, created_at
    FROM "drizzle"."__drizzle_migrations"
    ORDER BY id
  `);
  console.log(`📊 ${rows.length} entradas na tabela __drizzle_migrations:\n`);
  for (const r of rows) {
    console.log(`  id=${r.id}  created_at=${r.created_at}`);
    console.log(`       hash=${r.hash}`);
  }

  // 2. Comparação com hashes locais
  console.log("\n🔍 Comparação com hashes dos arquivos .sql (no VPS):\n");
  for (const [tag, local] of Object.entries(localHashes)) {
    const matches = rows.filter((r) => r.hash === local.hash);
    const status = matches.length > 0 ? "✅ BATE" : "❌ NÃO BATE";
    console.log(`  ${tag}:`);
    console.log(`    local hash : ${local.hash}`);
    console.log(`    local when : ${local.when}`);
    console.log(`    status     : ${status} (${matches.length} entrada(s) na tabela)`);
  }

  // 3. Entradas órfãs (na tabela mas sem correspondência local)
  console.log("\n🗂️ Entradas na tabela SEM correspondência local:\n");
  const localHashSet = new Set(Object.values(localHashes).map((l) => l.hash));
  const orphans = rows.filter((r) => !localHashSet.has(r.hash));
  if (orphans.length === 0) {
    console.log("  (nenhuma)");
  } else {
    for (const o of orphans) {
      console.log(`  id=${o.id}  created_at=${o.created_at}  hash=${o.hash}`);
    }
  }

  await sql.end();
  console.log("\n✅ Diagnóstico concluído.");
} catch (err) {
  console.error("\n❌ Erro:");
  console.error(err.message);
  process.exit(1);
}
