/**
 * ConcursoAI — DocumentStorageService
 *
 * Armazenamento físico de documentos. Backend EXPLÍCITO via STORAGE_BACKEND
 * (nunca fallback automático):
 * - STORAGE_BACKEND=r2        → somente Cloudflare R2 (falha se não configurado)
 * - STORAGE_BACKEND=supabase  → somente Supabase Storage
 * - STORAGE_BACKEND=local     → somente filesystem (.storage/documents; nunca em produção)
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
import { redactSecrets } from "@/lib/observability";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  R2StorageService,
  isR2Configured,
} from "./storage/r2-storage.service";
import {
  LocalStorageService,
  LocalStorageError,
} from "./storage/local-storage.service";
import { resolveStorageBackend, type StorageBackend } from "./storage/backend";
import type { StorageObjectHead } from "./storage/contract";

const BUCKET = "documents";

export class StorageError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

/**
 * Traduz LocalStorageError para StorageError, preservando o codigo.
 *
 * As rotas ja tratam StorageError (503/404/500) e nunca ecoam a mensagem crua
 * do driver. Sem esta tradugao o adaptador local seria a unica excecao da
 * familia que escapa do tratamento ja existente.
 */
async function viaLocal<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof StorageError) throw error;
    if (error instanceof LocalStorageError) {
      throw new StorageError(error.code, error.message);
    }
    throw new StorageError(
      "STORAGE_FAILED",
      redactSecrets(error instanceof Error ? error.message : "Falha no storage local.")
    );
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
      throw new StorageError("BUCKET_FAILED", redactSecrets(error.message));
    }
  }
}

/**
 * HEAD no backend Supabase Storage sem baixar bytes. O adapter nao expoe head()
 * fora do contrato, e getPublicUrl nao serve bucket privado — entao assinamos um
 * URL de 60s e fazemos HEAD, a mesma fonte de content-length/content-type usada
 * pelo fallback de download(). Devolve null quando o objeto nao existe:
 * `exists()` depende disso, `head()` traduz para STORAGE_ERROR.
 *
 * Sem `sha256` de proposito: o etag do Supabase/S3 e MD5 (e, em upload
 * multipart, MD5-com-sufixo), nao o sha256 que o contrato registra. Inventar
 * integridade aqui faria a rota de purge comparar contra um valor falso.
 */
async function supabaseHead(storagePath: string): Promise<StorageObjectHead | null> {
  const sb = createAdminClient();
  const { data } = await sb.storage.from(BUCKET).createSignedUrl(storagePath, 60);
  if (!data?.signedUrl) return null;
  try {
    const res = await fetch(data.signedUrl, { method: "HEAD" });
    if (!res.ok) return null;
    return {
      contentLength: Number(res.headers.get("content-length") ?? 0),
      contentType: res.headers.get("content-type") ?? "application/octet-stream",
    };
  } catch {
    return null;
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
  if (error) throw new StorageError("UPLOAD_FAILED", redactSecrets(error.message));
  return path;
}

async function supabaseDownload(storagePath: string): Promise<Buffer> {
  const { data, error } = await createAdminClient()
    .storage.from(BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new StorageError("DOWNLOAD_FAILED", redactSecrets(error?.message ?? "Arquivo não encontrado"));
  }
  return Buffer.from(await data.arrayBuffer());
}

async function supabaseRemove(storagePath: string): Promise<void> {
  const { error } = await createAdminClient()
    .storage.from(BUCKET)
    .remove([storagePath]);
  if (error) throw new StorageError("REMOVE_FAILED", redactSecrets(error.message));
}

/** Backend de storage ativo (EXPLÍCITO — sem fallback automático). */
export function storageBackend(): StorageBackend {
  return resolveStorageBackend();
}

export const DocumentStorageService = {
  async ensureBucket(): Promise<void> {
    const backend = storageBackend();
    if (backend === "local") {
      return viaLocal(() => LocalStorageService.ensureBucket());
    }
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
    if (backend === "local") {
      return viaLocal(() => LocalStorageService.upload(input));
    }
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
    if (target === "local") {
      return viaLocal(() => LocalStorageService.download(storagePath));
    }
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
    if (target === "local") {
      return viaLocal(() => LocalStorageService.remove(storagePath));
    }
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

  /**
   * O objeto ainda existe no backend indicado? Usado pela rota de purge para
   * confirmar, depois do DELETE, que os bytes foram mesmo. Falha de leitura e
   * erro (nao `false`): responder "nao ha bytes" sem certeza seria mentir.
   */
  async exists(storagePath: string, backend?: StorageBackend): Promise<boolean> {
    const target = backend ?? storageBackend();
    if (target === "local") {
      return viaLocal(() => LocalStorageService.exists(storagePath));
    }
    if (target === "r2") {
      if (!isR2Configured()) {
        throw new StorageError(
          "R2_NOT_CONFIGURED",
          "Documento com storage_backend=r2 mas R2 não está configurado."
        );
      }
      return R2StorageService.exists(storagePath);
    }
    await supabaseEnsureBucket();
    const info = await supabaseHead(storagePath);
    return info !== null;
  },

  /** Tamanho/tipo registrados no objeto; base da verificacao de integridade. */
  async head(storagePath: string, backend?: StorageBackend): Promise<StorageObjectHead> {
    const target = backend ?? storageBackend();
    if (target === "local") {
      return viaLocal(() => LocalStorageService.head(storagePath));
    }
    if (target === "r2") {
      if (!isR2Configured()) {
        throw new StorageError(
          "R2_NOT_CONFIGURED",
          "Documento com storage_backend=r2 mas R2 não está configurado."
        );
      }
      return R2StorageService.head(storagePath);
    }
    const info = await supabaseHead(storagePath);
    if (info === null) {
      throw new StorageError("DOWNLOAD_FAILED", "Objeto não encontrado no storage.");
    }
    return info;
  },
};
