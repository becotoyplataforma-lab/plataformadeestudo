#!/usr/bin/env node
/**
 * ConcursoAI — Migração de storage: Supabase Storage → Cloudflare R2
 *
 * FASE 2A (DRY-RUN): somente leitura. NUNCA escreve.
 *   - NÃO executa PutObjectCommand / S3.
 *   - NÃO executa UPDATE no banco.
 *   - NÃO executa DELETE no Supabase.
 *   - NÃO modifica documentos.
 * O padrão é SEMPRE dry-run: `node scripts/migrate-storage-r2.mjs`
 * Flags de escrita (--live/--execute/--no-dry-run) são RECUSADAS com exit 1.
 *
 * Comportamento (somente leitura):
 *   1. Lista documentos ATIVOS com storage_backend='supabase' (paginado).
 *   2. Para cada documento:
 *      a. Valida id/user_id/storage_path (senão INVALID_METADATA).
 *      b. Baixa do Supabase Storage (REST com service role, fetch nativo).
 *      c. Calcula sha256 e compara com documents.file_hash (se presente).
 *      d. Compara tamanho com documents.file_size (se presente).
 *      e. Determina chave R2 = MESMO storage_path (sem novo padrão).
 *      f. Classifica: WOULD_MIGRATE | HASH_MISMATCH | SIZE_MISMATCH |
 *         SOURCE_NOT_FOUND | INVALID_METADATA | ALREADY_R2 | ERROR.
 *   3. Exibe resumo. NUNCA apaga o original (rollback garantido).
 *
 * Padrões confirmados no código (não inventar novo path):
 *   - storage_path = `{userId}/{docId}/{safeFileName}` (ingestion.service.ts:202)
 *   - file_hash = sha256 hex do buffer (ingestion.service.ts:62-63)
 *   - file_size = file.size em bytes
 *   - bucket Supabase = "documents" (storage.service.ts:25)
 *   - R2 key = MESMO storage_path | R2_BUCKET default "documents"
 *
 * Uso (FASE 2A):
 *   node scripts/migrate-storage-r2.mjs [--dry-run] [--limit=N] [--batch-size=N]
 *   env vars: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *             R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET,
 *             R2_ENDPOINT (opcional, não usado no dry-run sem rede R2)
 *
 * Guarda de destino (scripts/lib/db-safety.mjs), sempre ANTES de abrir conexão ou de
 * fazer qualquer pedido HTTP ao storage:
 *   - Banco de teste isolado (host local ou ref em SAFE_TEST_DATABASE_REFS): livre.
 *   - Banco de produção: exige --confirm-production=<project-ref>, que tem de bater com
 *     o ref da DATABASE_URL e com PROD_SUPABASE_PROJECT_REF. Este script é só leitura,
 *     por isso não pede --allow-production-write.
 *   - DATABASE_URL e SUPABASE_URL têm de apontar para o MESMO projecto: sem esta prova,
 *     um dry-run podia listar metadados de um banco e ir baixar ficheiros de outro.
 * Códigos de saída: 3 destino não aprovado, 4 produção não confirmada,
 * 5 origens divergem (banco vs storage).
 */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { SCRIPT_DB_BLOCKED_EXIT_CODE, guardDataTargetEitherWayOrExit } from "./lib/db-safety.mjs";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------
// Args (FASE 2A: SEMPRE dry-run; escrita é recusada)
// ---------------------------------------------------------------
function parseArgs(argv) {
  let limit = null;
  let batchSize = 100;
  let help = false;
  let liveRequested = false;
  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--dry-run") { /* default, sem efeito */ }
    else if (arg === "--live" || arg === "--execute" || arg === "--no-dry-run") liveRequested = true;
    else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice(8));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (arg.startsWith("--batch-size=")) {
      const n = Number(arg.slice(13));
      if (Number.isFinite(n) && n > 0) batchSize = Math.floor(n);
    }
  }
  return { limit, batchSize, help, liveRequested };
}

const args = parseArgs(process.argv.slice(2));

if (args.help) {
  console.log(`Uso: node scripts/migrate-storage-r2.mjs [--dry-run] [--limit=N] [--batch-size=N]`);
  console.log(`FASE 2A: somente leitura (dry-run). Nenhum arquivo é copiado, nenhum registro é alterado.`);
  process.exit(0);
}

if (args.liveRequested) {
  console.error(`[migrate-storage] ERRO: FASE 2A permite SOMENTE dry-run. Flags de escrita (--live/--execute/--no-dry-run) são recusadas.`);
  process.exit(1);
}

// ---------------------------------------------------------------
// Config (valida presença — NUNCA imprime valores)
// ---------------------------------------------------------------
const SUPABASE_BUCKET = "documents"; // storage.service.ts:25 (bucket Supabase)
const R2_BUCKET = process.env.R2_BUCKET ?? "documents"; // r2-storage.service.ts:33

function fail(msg) {
  console.error(`[migrate-storage] ERRO: ${msg}`);
  process.exit(1);
}

// Checagem de configuração — sem exibir segredos.
for (const k of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[k]) fail(`Faltando ${k}. Defina no .env antes de executar.`);
}
for (const k of ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]) {
  if (!process.env[k]) fail(`Faltando ${k}. Defina no .env antes de executar.`);
}

// ---- Guarda de destino: nenhuma rede antes de provar banco e origem de storage ----
const guarda = guardDataTargetEitherWayOrExit("migrate-storage-r2", process.env.DATABASE_URL, {
  storageUrl: process.env.SUPABASE_URL,
  writes: false, // FASE 2A é somente leitura
});
if (guarda.modo === "bloqueado") {
  process.exit(typeof process.exitCode === "number" ? process.exitCode : SCRIPT_DB_BLOCKED_EXIT_CODE);
}
console.log(`[migrate-storage] Destino aprovado em modo ${guarda.modo}.`);

function sha256Hex(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

// ===============================================================
// DRY-RUN (somente leitura — FASE 2A)
// ===============================================================

/** Classifica um documento sem escrever nada. */
function classifyDoc(doc, download) {
  if (doc.storage_backend === "r2") return { code: "ALREADY_R2" };
  if (!doc.id || !doc.user_id || !doc.storage_path) {
    return { code: "INVALID_METADATA" };
  }
  if (String(doc.storage_path).trim() === "") {
    return { code: "INVALID_METADATA" };
  }
  if (!download.found) {
    if (download.error) return { code: "ERROR" };
    return { code: "SOURCE_NOT_FOUND" };
  }
  if (!download.buffer) return { code: "ERROR" };
  const actualHash = sha256Hex(download.buffer);
  const actualSize = download.buffer.length;
  const expectedHash = (doc.file_hash ?? "").trim().toLowerCase();
  if (expectedHash !== "" && actualHash.toLowerCase() !== expectedHash) {
    return { code: "HASH_MISMATCH", actualHash, actualSize };
  }
  const fs = doc.file_size;
  if (typeof fs === "number" && Number.isFinite(fs) && actualSize !== fs) {
    return { code: "SIZE_MISMATCH", actualHash, actualSize };
  }
  return { code: "WOULD_MIGRATE", r2Key: doc.storage_path };
}

function createDbClient() {
  let postgres;
  try {
    postgres = require("postgres");
  } catch {
    fail(`Dependencia "postgres" nao encontrada no runtime.`);
  }
  return postgres(process.env.DATABASE_URL, { max: 2 });
}

async function listBatch(sql, limit, offset) {
  return sql`
    SELECT id, user_id, storage_path, storage_backend,
           file_hash, file_size, mime_type
    FROM documents
    WHERE storage_backend = 'supabase'
      AND deleted_at IS NULL
      AND storage_path IS NOT NULL
      AND storage_path <> ''
    ORDER BY created_at ASC
    LIMIT ${limit} OFFSET ${offset}
  `;
}

async function countAlreadyR2(sql) {
  const rows = await sql`
    SELECT COUNT(*)::int AS total FROM documents
    WHERE storage_backend = 'r2' AND deleted_at IS NULL
  `;
  return rows[0]?.total ?? 0;
}

async function downloadFromSupabase(storagePath) {
  const base = String(process.env.SUPABASE_URL).replace(/\/$/, "");
  const url = `${base}/storage/v1/object/${SUPABASE_BUCKET}/${storagePath}`;
  let res;
  try {
    res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { found: false, error: msg };
  }
  if (res.status === 404) return { found: false };
  if (!res.ok) return { found: false, error: `HTTP ${res.status}` };
  try {
    const ab = await res.arrayBuffer();
    return { found: true, buffer: Buffer.from(ab) };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { found: false, error: msg };
  }
}

async function run() {
  console.log(`[migrate-storage] DRY-RUN somente leitura.`);
  console.log(`[migrate-storage] Origem=${SUPABASE_BUCKET} destino=${R2_BUCKET}. Nada sera copiado ou alterado.`);
  const sql = createDbClient();
  const summary = {
    totalFound: 0, eligible: 0, would_migrate: 0,
    hash_mismatch: 0, size_mismatch: 0, source_not_found: 0,
    invalid_metadata: 0, errors: 0, already_r2: 0,
  };
  try {
    summary.already_r2 = await countAlreadyR2(sql);
    const batchSize = args.batchSize;
    let offset = 0;
    let processed = 0;
    for (;;) {
      let take = batchSize;
      if (args.limit != null) {
        take = Math.min(batchSize, args.limit - processed);
        if (take <= 0) break;
      }
      const rows = await listBatch(sql, take, offset);
      if (rows.length === 0) break;
      summary.totalFound += rows.length;
      for (const doc of rows) {
        if (args.limit != null && processed >= args.limit) break;
        processed += 1;
        summary.eligible += 1;
        let result;
        try {
          if (!doc.id || !doc.user_id || !doc.storage_path) {
            summary.invalid_metadata += 1;
            console.log(`[migrate-storage] INVALID_METADATA id=${doc.id ?? "?"}`);
            continue;
          }
          const dl = await downloadFromSupabase(doc.storage_path);
          result = classifyDoc(doc, dl);
        } catch (err) {
          summary.errors += 1;
          const m = err instanceof Error ? err.message : String(err);
          console.log(`[migrate-storage] ERROR id=${doc.id} err=${m}`);
          continue;
        }
        if (result.code === "WOULD_MIGRATE") {
          summary.would_migrate += 1;
          console.log(`[migrate-storage] WOULD_MIGRATE id=${doc.id} r2Key=${result.r2Key}`);
        } else if (result.code === "HASH_MISMATCH") {
          summary.hash_mismatch += 1;
          console.log(`[migrate-storage] HASH_MISMATCH id=${doc.id}`);
        } else if (result.code === "SIZE_MISMATCH") {
          summary.size_mismatch += 1;
          console.log(`[migrate-storage] SIZE_MISMATCH id=${doc.id}`);
        } else if (result.code === "SOURCE_NOT_FOUND") {
          summary.source_not_found += 1;
          console.log(`[migrate-storage] SOURCE_NOT_FOUND id=${doc.id}`);
        } else if (result.code === "INVALID_METADATA") {
          summary.invalid_metadata += 1;
          console.log(`[migrate-storage] INVALID_METADATA id=${doc.id ?? "?"}`);
        } else if (result.code === "ALREADY_R2") {
          summary.already_r2 += 1;
        } else {
          summary.errors += 1;
          console.log(`[migrate-storage] ERROR id=${doc.id}`);
        }
      }
      offset += rows.length;
      if (rows.length < take) break;
      if (args.limit != null && processed >= args.limit) break;
    }
  } finally {
    try { await sql.end(); } catch { /* ignore */ }
  }
  console.log(`[migrate-storage] RESUMO DRY-RUN: ` + JSON.stringify(summary));
  console.log(`[migrate-storage] DRY-RUN concluido. Nada copiado, alterado ou apagado.`);
}

if (import.meta.url.endsWith('migrate-storage-r2.mjs')) {
  await run();
}
