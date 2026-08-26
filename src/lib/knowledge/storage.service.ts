/**
 * ConcursoAI — DocumentStorageService
 *
 * Armazenamento físico de documentos. Backend EXPLÍCITO via STORAGE_BACKEND
 * (nunca fallback automático):
 * - STORAGE_BACKEND=r2        → somente Cloudflare R2 (falha se não configurado)
 * - STORAGE_BACKEND=supabase  → somente Supabase Storage
 * - ausente em produção       → fail-fast (StorageBackendError)
 *
 * O download/remove aceitam o backend do DOCUMENTO (doc.storage_backend),
 * permitindo período híbrido durante a migração: documentos antigos continuam
 * no Supabase enquanto os novos vão para o R2.
 *
 * SEMPRE server-side via service role. Nunca use no client.
 * Caminho: {userId}/{documentId}/{fileName}
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  R2StorageService,
  isR2Configured,
} from "./storage/r2-storage.service";
import { resolveStorageBackend, type StorageBackend } from "./storage/backend";

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

/** Backend de storage ativo (EXPLÍCITO — sem fallback automático). */
export function storageBackend(): StorageBackend {
  return resolveStorageBackend();
}

export const DocumentStorageService = {
  async ensureBucket(): Promise<void> {
    const backend = storageBackend();
    if (backend === "r2") {
      if (!isR2Configured()) {
        throw new StorageError(
          "R2_NOT_CONFIGURED",
          "STORAGE_BACKEND=r2 mas R2 não está configurado (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY ausentes)."
        );
      }
      return R2StorageService.ensureBucket();
    }
    return supabaseEnsureBucket();
  },

  /**
   * Upload para o backend ATIVO (STORAGE_BACKEND).
   * Novos uploads respeitam o backend global — não há escolha por documento.
   */
  async upload(input: {
    userId: string;
    documentId: string;
    fileName: string;
    buffer: Buffer;
    mimeType: string;
  }): Promise<string> {
    const backend = storageBackend();
    if (backend === "r2") {
      if (!isR2Configured()) {
        throw new StorageError(
          "R2_NOT_CONFIGURED",
          "STORAGE_BACKEND=r2 mas R2 não está configurado (R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY ausentes)."
        );
      }
      return R2StorageService.upload(input);
    }
    return supabaseUpload(input);
  },

  /**
   * Download do backend do DOCUMENTO (storage_backend).
   * Durante a transição, documentos antigos (supabase) e novos (r2) coexistem:
   * o backend informado decide onde buscar.
   * Se não informado, usa o backend global ativo.
   */
  async download(storagePath: string, backend?: StorageBackend): Promise<Buffer> {
    const target = backend ?? storageBackend();
    if (target === "r2") {
      if (!isR2Configured()) {
        throw new StorageError(
          "R2_NOT_CONFIGURED",
          "Documento com storage_backend=r2 mas R2 não está configurado."
        );
      }
      return R2StorageService.download(storagePath);
    }
    return supabaseDownload(storagePath);
  },

  /**
   * Remove do backend do DOCUMENTO (storage_backend).
   * Se não informado, usa o backend global ativo.
   */
  async remove(storagePath: string, backend?: StorageBackend): Promise<void> {
    const target = backend ?? storageBackend();
    if (target === "r2") {
      if (!isR2Configured()) {
        throw new StorageError(
          "R2_NOT_CONFIGURED",
          "Documento com storage_backend=r2 mas R2 não está configurado."
        );
      }
      return R2StorageService.remove(storagePath);
    }
    return supabaseRemove(storagePath);
  },
};
