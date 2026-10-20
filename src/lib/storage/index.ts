import "server-only";

/**
 * ConcursoAI — Fábrica de StorageAdapter
 *
 * Escolhe o driver pela variável de ambiente STORAGE_DRIVER ("local" | "r2").
 * Não há fallback silencioso: se STORAGE_DRIVER=r2 faltar credencial, falha logo
 * com StorageError("CONFIG_MISSING") — nunca serve ficheiros de disco por engano
 * em produção.
 *
 * Segue: specs/knowledge-apostilas.md (DD-STORAGE-03)
 */
import path from "node:path";
import { env } from "@/lib/env";
import { LocalStorageAdapter } from "./local.adapter";
import { R2StorageAdapter, type R2Config } from "./r2.adapter";
import { StorageError, type StorageAdapter, type StorageDriver } from "./types";

export type {
  StorageAdapter,
  StorageDriver,
  StorageRange,
  StorageStream,
  UploadResult,
} from "./types";
export { StorageError, assertSafeKey } from "./types";

const DEFAULT_LOCAL_DIR = ".storage/apostilas";

/** Raiz absoluta do driver local (mesma lógica usada pelo app). */
export function resolveLocalStorageRoot(): string {
  // turbopackIgnore: o diretório é configurável (STORAGE_LOCAL_DIR) e só deve
  // existir em runtime; sem o opt-out o build rastrearia o projeto inteiro.
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), clean(env.STORAGE_LOCAL_DIR) || DEFAULT_LOCAL_DIR);
}

function clean(value: string | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Cria um adaptador novo (use getStorage() para o singleton partilhado). */
export function createStorageAdapter(driver?: StorageDriver): StorageAdapter {
  const resolved: StorageDriver = driver ?? env.STORAGE_DRIVER;

  if (resolved === "r2") {
    const accountId = clean(env.R2_ACCOUNT_ID);
    const accessKeyId = clean(env.R2_ACCESS_KEY_ID);
    const secretAccessKey = clean(env.R2_SECRET_ACCESS_KEY);

    if (!accountId || !accessKeyId || !secretAccessKey) {
      throw new StorageError(
        "CONFIG_MISSING",
        "STORAGE_DRIVER=r2 exige R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY."
      );
    }

    const config: R2Config = {
      accountId,
      accessKeyId,
      secretAccessKey,
      bucket: clean(env.R2_BUCKET_NAME) || "concursoai-documents",
      publicUrl: clean(env.R2_PUBLIC_URL) || undefined,
    };
    return new R2StorageAdapter(config);
  }

  return new LocalStorageAdapter(resolveLocalStorageRoot());
}

let cached: StorageAdapter | null = null;

/** Singleton do driver configurado (evita novos clients S3 por request). */
export function getStorage(): StorageAdapter {
  if (!cached) cached = createStorageAdapter();
  return cached;
}

/** Permite a testes injetarem um adaptador sem tocar no ambiente. */
export function setStorageForTests(adapter: StorageAdapter | null): void {
  cached = adapter;
}
