/**
 * ConcursoAI — Migrador storage: classificação dry-run (puro, unit-testável)
 *
 * Regras usadas por scripts/migrate-storage-r2.mjs (standalone, sem TS imports no VPS).
 * Mantido aqui para cobertura via vitest (scripts/*.mjs fora do include do vitest).
 * O script .mjs DUPLICA intencionalmente esta lógica mínima (sha256 + classificação)
 * para continuar executável com `node` puro no VPS — não importar este módulo no script.
 *
 * Padrões confirmados no código:
 * - storage_path = `{userId}/{documentId}/{safeFileName}` (ingestion.service.ts:202)
 * - file_hash = sha256 hex do buffer (ingestion.service.ts:62-63)
 * - file_size = file.size (bytes)
 * - bucket Supabase = "documents" (storage.service.ts:25)
 * - R2 key = MESMO storage_path (sem novo padrão)
 */

import { createHash } from "node:crypto";

export type MigratorResultCode =
  | "WOULD_MIGRATE"
  | "HASH_MISMATCH"
  | "SIZE_MISMATCH"
  | "SOURCE_NOT_FOUND"
  | "INVALID_METADATA"
  | "ALREADY_R2"
  | "ERROR";

export interface MigratorDocInput {
  id: string | null | undefined;
  userId: string | null | undefined;
  storagePath: string | null | undefined;
  storageBackend?: string | null | undefined;
  fileHash?: string | null | undefined;
  fileSize?: number | null | undefined;
}

export interface MigratorDownloadInput {
  /** false = objeto não encontrado no Supabase (404). */
  found: boolean;
  buffer?: Buffer | Uint8Array | null | undefined;
  /** Erro de rede/leitura (quando found=false por falha, não por 404). */
  error?: string | null | undefined;
}

export interface MigratorClassification {
  code: MigratorResultCode;
  /** Chave R2 = MESMO storage_path (só quando WOULD_MIGRATE). */
  r2Key?: string;
  actualHash?: string;
  actualSize?: number;
}

/** SHA-256 hex (mesmo algoritmo do IngestionService.computeHash). */
export async function sha256Hex(
  data: Buffer | Uint8Array
): Promise<string> {
  return createHash("sha256").update(data).digest("hex");
}

/** Versão síncrona (testes / script podem usar qualquer uma). */
export function sha256HexSync(data: Buffer | Uint8Array): string {
  return createHash("sha256").update(data).digest("hex");
}

export function parseMigratorArgs(argv: string[]): {
  limit: number | null;
  batchSize: number;
  help: boolean;
  liveRequested: boolean;
} {
  let limit: number | null = null;
  let batchSize = 100;
  let help = false;
  let liveRequested = false;

  for (const arg of argv) {
    if (arg === "--help" || arg === "-h") help = true;
    else if (arg === "--dry-run") {
      // default, sem efeito
    } else if (arg === "--live" || arg === "--execute" || arg === "--no-dry-run") {
      liveRequested = true;
    } else if (arg.startsWith("--limit=")) {
      const n = Number(arg.slice("--limit=".length));
      if (Number.isFinite(n) && n > 0) limit = Math.floor(n);
    } else if (arg.startsWith("--batch-size=")) {
      const n = Number(arg.slice("--batch-size=".length));
      if (Number.isFinite(n) && n > 0) batchSize = Math.floor(n);
    }
  }

  return { limit, batchSize, help, liveRequested };
}

/**
 * Classifica um documento no dry-run.
 * Ordem: ALREADY_R2 → INVALID_METADATA → SOURCE_NOT_FOUND/ERROR → HASH → SIZE → WOULD_MIGRATE.
 */
export function classifyMigratorDoc(
  doc: MigratorDocInput,
  download: MigratorDownloadInput,
  opts?: { actualHash?: string; actualSize?: number }
): MigratorClassification {
  if (doc.storageBackend === "r2") {
    return { code: "ALREADY_R2" };
  }
  if (!doc.id || !doc.userId || !doc.storagePath || doc.storagePath.trim() === "") {
    return { code: "INVALID_METADATA" };
  }
  if (!download.found) {
    if (download.error) return { code: "ERROR" };
    return { code: "SOURCE_NOT_FOUND" };
  }
  const buffer = download.buffer;
  if (!buffer) return { code: "ERROR" };

  const actualHash = opts?.actualHash ?? sha256HexSync(buffer);
  const actualSize = opts?.actualSize ?? buffer.length;

  const expectedHash = (doc.fileHash ?? "").trim().toLowerCase();
  if (expectedHash !== "" && actualHash.toLowerCase() !== expectedHash) {
    return { code: "HASH_MISMATCH", actualHash, actualSize };
  }
  if (
    typeof doc.fileSize === "number" &&
    Number.isFinite(doc.fileSize) &&
    actualSize !== doc.fileSize
  ) {
    return { code: "SIZE_MISMATCH", actualHash, actualSize };
  }
  return { code: "WOULD_MIGRATE", r2Key: doc.storagePath, actualHash, actualSize };
}
