#!/usr/bin/env node
/**
 * ConcursoAI — Migração de storage: Supabase Storage → Cloudflare R2
 *
 * FASE 1 (LOCAL): este arquivo é o esqueleto da rotina. NÃO EXECUTAR.
 * A execução real pertence à FASE 2 (após revisão do diff + autorização),
 * rodando no VPS com as credenciais de produção.
 *
 * Comportamento (idempotente):
 *   1. Lista documentos ATIVOS com storage_backend='supabase' (paginado).
 *   2. Para cada documento:
 *      a. Se R2.exists(storage_path) → já migrado: marca 'r2' e pula.
 *      b. Baixa do Supabase Storage (REST com service role — Node 20 não tem
 *         WebSocket nativo para supabase-js v2).
 *      c. Compara sha256 do conteúdo com documents.file_hash (se presente).
 *      d. Faz upload para o R2 usando o MESMO storage_path.
 *      e. Valida tamanho via head() (ContentLength == file_size).
 *      f. UPDATE documents SET storage_backend='r2'.
 *   3. NUNCA apaga o original no Supabase (rollback garantido).
 *
 * Uso (FASE 2):
 *   node scripts/migrate-storage-r2.mjs --limit 50
 *   env vars: DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *             R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 */

import { createHash } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------
// Config
// ---------------------------------------------------------------
const BUCKET = process.env.R2_BUCKET ?? "documents";
const PAGE = 100;

function fail(msg) {
  console.error(`[migrate-storage] ERRO: ${msg}`);
  process.exit(1);
}

// Checagem mínima de configuração — FASE 1: apenas valida e sai.
for (const k of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]) {
  if (!process.env[k]) fail(`Faltando ${k}. Defina no .env antes de executar.`);
}
const r2Keys = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"];
for (const k of r2Keys) {
  if (!process.env[k]) fail(`Faltando ${k}. Defina no .env antes de executar.`);
}
console.log(
  `[migrate-storage] Config OK (bucket=${BUCKET}, page=${PAGE}). ` +
    `ESQUELETO — FASE 1: execução intencionalmente bloqueada.`
);
process.exit(0);

// ===============================================================
// (Código abaixo NÃO roda na FASE 1 — implementação de referência.)
// ===============================================================

async function listSupabaseDocuments() {
  // FASE 2: SELECT id, user_id, storage_path, file_hash, file_size
  //         FROM documents WHERE storage_backend='supabase' AND deleted_at IS NULL
  //         ORDER BY created_at ASC LIMIT $page OFFSET $offset;
  // via postgres (require("postgres")) com DATABASE_URL.
  return [];
}

async function downloadFromSupabase(storagePath) {
  // FASE 2: GET ${SUPABASE_URL}/storage/v1/object/${BUCKET}/${storagePath}
  // headers: Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}, apikey: ...
  // (fetch nativo — evita WebSocket do supabase-js no Node 20.)
}

async function uploadToR2(storagePath, buffer, contentType) {
  // FASE 2: PUT via @aws-sdk/client-s3 (PutObjectCommand).
  // Bucket, Key = storagePath, Body = buffer, ContentType = contentType.
}

async function r2Exists(storagePath) {
  // FASE 2: HeadObjectCommand → true se 200, false se 404.
  return false;
}

async function r2Head(storagePath) {
  // FASE 2: HeadObjectCommand → { contentLength, contentType }.
  return { contentLength: 0, contentType: "application/octet-stream" };
}

async function markMigrated(documentId) {
  // FASE 2: UPDATE documents SET storage_backend='r2', updated_at=now()
  //         WHERE id=$documentId AND storage_backend='supabase';
}

async function run() {
  // FASE 2: loop paginado com as etapas a–f descritas no cabeçalho.
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await run();
}
