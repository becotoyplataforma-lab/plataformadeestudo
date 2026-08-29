#!/usr/bin/env node
/**
 * Executa o carimbo das migrations 0000-0004 no banco de produção.
 * ==================================================================
 * Lê a DATABASE_URL do .env.production, executa o SQL de
 * scripts/stamp-migrations.sql (cria schema drizzle, tabela
 * __drizzle_migrations e insere as 5 migrations), e depois
 * verifica as entradas inseridas.
 *
 * Uso:
 *   node scripts/apply-stamp-migrations.mjs
 */
import postgres from "postgres";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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

// ---- Lê o SQL de carimbo ----
const stampFile = path.join(PROJECT_DIR, "scripts", "stamp-migrations.sql");
if (!fs.existsSync(stampFile)) {
  console.error(`❌ ${stampFile} não encontrado.`);
  process.exit(1);
}
const stampSql = fs.readFileSync(stampFile, "utf8");

// ---- Conecta ----
const sql = postgres(DATABASE_URL, { max: 1, connect_timeout: 15 });

try {
  console.log("🔌 Conectado ao banco de produção.");

  // 1. Verifica se a tabela já existe antes
  const before = await sql.unsafe(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'drizzle' AND table_name = '__drizzle_migrations'
    ) AS exists
  `);
  console.log(`\n📋 Tabela drizzle.__drizzle_migrations existe antes? ${before[0].exists}`);

  // 2. Executa o carimbo
  console.log("\n⚙️ Executando carimbo das migrations...");
  await sql.unsafe(stampSql);
  console.log("✅ Carimbo executado com sucesso.");

  // 3. Verifica as entradas inseridas
  const rows = await sql.unsafe(`
    SELECT id, hash, created_at
    FROM "drizzle"."__drizzle_migrations"
    ORDER BY id
  `);
  console.log(`\n📊 ${rows.length} entradas na tabela __drizzle_migrations:`);
  for (const r of rows) {
    console.log(`  id=${r.id}  created_at=${r.created_at}  hash=${r.hash.slice(0, 16)}...`);
  }

  // 4. Verifica se o schema public está intacto (contagem de tabelas)
  const tables = await sql.unsafe(`
    SELECT count(*)::int AS n
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);
  console.log(`\n🗂️ Tabelas no schema public: ${tables[0].n}`);

  console.log("\n✅ Carimbo concluído com sucesso.");
} catch (err) {
  console.error("\n❌ Erro durante o carimbo:");
  console.error(err.message);
  process.exit(1);
} finally {
  await sql.end();
}
