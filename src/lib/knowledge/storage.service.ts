/**
 * ConcursoAI — DocumentStorageService
 *
 * Armazenamento físico de documentos. Backend configurável:
 * - Cloudflare R2 (se R2_ACCESS_KEY_ID configurado) — preferencial.
 * - Supabase Storage (fallback) — bucket privado `documents`.
 *
 * SEMPRE server-side via service role. Nunca use no client.
 * Caminho: {userId}/{documentId}/{fileName}
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { R2StorageService, isR2Configured } from "./storage/r2-storage.service";

const BUCKET = "documents";

export class StorageError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

async function supabaseEnsureBucket(): Promise<void> {
  const sb = createAdminClient();
  const { data } = await sb.storage.getBucket(BUCKET);
  if (!data) {
    const { error } = await sb.storage.createBucket(BUCKET, {
      public: false,
      fileSizeLimit: 25 * 1024 * 1024,
    });
    if (error && !error.message.toLowerCase().includes("already exists")) {
      throw new StorageError("BUCKET_FAILED", error.message);
    }
  }
}

async function supabaseUpload(input: {
  userId: string;
  documentId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
}): Promise<string> {
  await supabaseEnsureBucket();
  const path = `${input.userId}/${input.documentId}/${input.fileName}`;
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .upload(path, input.buffer, {
      contentType: input.mimeType,
      upsert: true,
    });
  if (error) throw new StorageError("UPLOAD_FAILED", error.message);
  return path;
}

async function supabaseDownload(storagePath: string): Promise<Buffer> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new StorageError("DOWNLOAD_FAILED", error?.message ?? "Arquivo não encontrado");
  }
  return Buffer.from(await data.arrayBuffer());
}

async function supabaseRemove(storagePath: string): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .remove([storagePath]);
  if (error) throw new StorageError("REMOVE_FAILED", error.message);
}

/** Backend de storage ativo (R2 quando configurado, Supabase como fallback). */
export function storageBackend(): "r2" | "supabase" {
  return isR2Configured() ? "r2" : "supabase";
}

export const DocumentStorageService = {
  async ensureBucket(): Promise<void> {
    return isR2Configured()
      ? R2StorageService.ensureBucket()
      : supabaseEnsureBucket();
  },

  async upload(input: {
    userId: string;
    documentId: string;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<string> {
    return isR2Configured()
      ? R2StorageService.upload(input)
      : supabaseUpload(input);
  },

  async download(storagePath: string): Promise<Buffer> {
    return isR2Configured()
      ? R2StorageService.download(storagePath)
      : supabaseDownload(storagePath);
  },

  async remove(storagePath: string): Promise<void> {
    return isR2Configured()
      ? R2StorageService.remove(storagePath)
      : supabaseRemove(storagePath);
  },
};
