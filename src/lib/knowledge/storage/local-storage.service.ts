/**
 * ConcursoAI — LocalStorageService (adaptador de filesystem)
 *
 * Persiste os bytes do documento em disco, sob `STORAGE_LOCAL_DIR` (default
 * `.storage/documents`). Existe para dois casos que nem o Supabase nem o R2
 * resolvem: desenvolver sem credenciais e ingerir apostila antes de existir
 * banco de teste isolado — enquanto nao ha banco, o arquivo fisico e o
 * resultado da ingestao e preciso nao perde-lo.
 *
 * Mesma chave dos backends remotos (`{userId}/{documentId}/{fileName}`), de
 * forma que migrar local -> R2 seja copia de chave para chave e o
 * `documents.storage_path` continue valido.
 *
 * Integridade: o objeto so aparece no destino depois de escrito num
 * `.tmp` e relido com o sha256 conferido. Escrita interrompida nao deixa
 * objeto truncado visivel. Ao lado do objeto fica um sidecar `.meta.json` com
 * contentType, sha256 e tamanho — o filesystem nao guarda MIME, e sem sidecar
 * o `head()` teria de adivinhar pela extensao.
 *
 * Corre no server e no CLI de ingestao (`tsx --conditions=react-server`, mesmo
 * padrao de `scripts/ingest-apostilas.ts`); em testes o `server-only` e o stub
 * aliasado em `vitest.config.mts`. O guard de producao (`STORAGE_BACKEND=local`
 * proibido em producao) vive em `storage/backend.ts`, unico caminho das rotas.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, parse, relative, resolve } from "node:path";
import { redactSecrets } from "@/lib/observability";
import { extensionOf, mimeForExtension } from "../format-contract";
import type { StorageBackend } from "./backend";
import {
  sha256Hex,
  storageObjectKey,
  type DocumentStorageAdapter,
  type StorageObjectHead,
  type StorageUploadInput,
} from "./contract";

const META_SUFFIX = ".meta.json";

export class LocalStorageError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LocalStorageError";
    this.code = code;
  }
}

/**
 * Raiz do storage local (`STORAGE_LOCAL_DIR`, default `.storage/documents`).
 *
 * Valor relativo e resolvido contra o `cwd`; absoluto e usado como esta.
 * Recusamos a raiz do filesystem e o proprio `cwd`: apontar o storage para "/"
 * ou para o repo inteiro da ao CLI acesso de escrita fora da area de objetos,
 * e isso nao e um erro de configuracao benigno. A funcao nao toca o disco --
 * criar diretorios e papel de `ensureBucket()`.
 */
export function resolveLocalStorageRoot(
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd()
): string {
  const raw = env.STORAGE_LOCAL_DIR?.trim() ?? "";
  const resolved = raw === "" ? resolve(cwd, ".storage", "documents") : resolve(cwd, raw);
  // Sem separador final, exceto quando o caminho E a raiz ("/" ou "C:\").
  const stripped = resolved.replace(/[\\/]+$/, "");
  const normalized = stripped === "" ? resolved : stripped;

  // `parse(p).root === p` e a forma portavel de reconhecer a raiz: "/" em
  // POSIX, "C:\" em Windows. Comparar com sep ou regex de drive falha num dos
  // sistemas (e em Windows "C:\" normalizado para "C:" deixa de ser raiz).
  if (parse(resolved).root === resolved) {
    throw new LocalStorageError(
      "STORAGE_LOCAL_DIR_UNSAFE",
      "STORAGE_LOCAL_DIR nao pode apontar para a raiz do sistema de ficheiros."
    );
  }
  if (normalized === resolve(cwd)) {
    throw new LocalStorageError(
      "STORAGE_LOCAL_DIR_UNSAFE",
      "STORAGE_LOCAL_DIR nao pode apontar para a raiz do repositorio; use uma subpasta (default: .storage/documents)."
    );
  }
  return normalized;
}

/** Objeto de metadados gravado ao lado do arquivo. */
type LocalObjectMeta = {
  contentType: string;
  sha256: string;
  sizeBytes: number;
  uploadedAt: string;
};

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

/**
 * Resolve a chave dentro da raiz, recusando traversal e caminho absoluto.
 * Exportada para teste: a superficie de escrita do CLI e exatamente esta funcao.
 */
export function resolveLocalObjectPath(
  storagePath: string,
  root: string = resolveLocalStorageRoot()
): string {
  const cleaned = storagePath.replace(/\\/g, "/").trim();
  const segments = cleaned.split("/");
  if (
    cleaned === "" ||
    cleaned.startsWith("/") ||
    segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new LocalStorageError(
      "KEY_UNSAFE",
      "Chave de storage local invalida (absoluta, vazia, segmento vazio, ponto ou ..)."
    );
  }
  const target = resolve(root, ...segments);
  const rel = relative(root, target);
  if (rel === "" || rel.startsWith("..") || isAbsolute(rel)) {
    throw new LocalStorageError("KEY_UNSAFE", "Chave de storage fora da raiz local.");
  }
  return target;
}

function metaPathOf(target: string): string {
  return target + META_SUFFIX;
}

async function readMeta(target: string): Promise<LocalObjectMeta | null> {
  try {
    const raw = await readFile(metaPathOf(target), "utf8");
    return JSON.parse(raw) as LocalObjectMeta;
  } catch (error) {
    if (isNotFound(error)) return null;
    throw new LocalStorageError(
      "HEAD_FAILED",
      redactSecrets(error instanceof Error ? error.message : "Falha ao ler metadados locais.")
    );
  }
}

export const LocalStorageService: DocumentStorageAdapter = {
  id: "local" as StorageBackend,

  async ensureBucket(): Promise<void> {
    const root = resolveLocalStorageRoot();
    try {
      await mkdir(root, { recursive: true });
    } catch (error) {
      throw new LocalStorageError(
        "ROOT_UNWRITABLE",
        `Nao foi possivel criar a raiz de storage local em ${root}: ${redactSecrets(
          error instanceof Error ? error.message : "erro desconhecido"
        )}`
      );
    }
  },

  async upload(input: StorageUploadInput): Promise<string> {
    const key = storageObjectKey(input);
    const target = resolveLocalObjectPath(key);
    const sourceSha = sha256Hex(input.buffer);
    const tmp = join(dirname(target), `.${input.documentId}.${randomUUID()}.tmp`);

    try {
      await LocalStorageService.ensureBucket();
      await mkdir(dirname(target), { recursive: true });
      await writeFile(tmp, input.buffer, { mode: 0o600 });

      const written = await readFile(tmp);
      if (sha256Hex(written) !== sourceSha || written.byteLength !== input.buffer.byteLength) {
        await rm(tmp, { force: true });
        throw new LocalStorageError(
          "INTEGRITY_MISMATCH",
          `Bytes gravados nao conferem com o sha256 de origem em ${key}.`
        );
      }
      await rename(tmp, target);
      const meta: LocalObjectMeta = {
        contentType: input.mimeType,
        sha256: sourceSha,
        sizeBytes: input.buffer.byteLength,
        uploadedAt: new Date().toISOString(),
      };
      await writeFile(metaPathOf(target), JSON.stringify(meta, null, 2), { mode: 0o600 });
      return key;
    } catch (error) {
      if (error instanceof LocalStorageError) throw error;
      await rm(tmp, { force: true }).catch(() => undefined);
      throw new LocalStorageError(
        "UPLOAD_FAILED",
        redactSecrets(error instanceof Error ? error.message : "Falha ao gravar arquivo local.")
      );
    }
  },

  async download(storagePath: string): Promise<Buffer> {
    const target = resolveLocalObjectPath(storagePath);
    try {
      return await readFile(target);
    } catch (error) {
      if (isNotFound(error)) {
        throw new LocalStorageError("NOT_FOUND", "Arquivo não encontrado no storage local.");
      }
      throw new LocalStorageError(
        "DOWNLOAD_FAILED",
        redactSecrets(error instanceof Error ? error.message : "Falha ao ler arquivo local.")
      );
    }
  },

  async exists(storagePath: string): Promise<boolean> {
    const target = resolveLocalObjectPath(storagePath);
    try {
      await stat(target);
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw new LocalStorageError(
        "HEAD_FAILED",
        redactSecrets(error instanceof Error ? error.message : "Falha ao consultar objeto local.")
      );
    }
  },

  async head(storagePath: string): Promise<StorageObjectHead> {
    const target = resolveLocalObjectPath(storagePath);
    try {
      const info = await stat(target);
      const meta = await readMeta(target);
      const fileName = storagePath.split("/").pop() ?? "";
      return {
        contentLength: info.size,
        contentType:
          meta?.contentType ??
          mimeForExtension(extensionOf(fileName)) ??
          "application/octet-stream",
        ...(meta?.sha256 ? { sha256: meta.sha256 } : {}),
      };
    } catch (error) {
      if (isNotFound(error)) {
        throw new LocalStorageError("NOT_FOUND", "Arquivo não encontrado no storage local.");
      }
      throw new LocalStorageError(
        "HEAD_FAILED",
        redactSecrets(error instanceof Error ? error.message : "Falha ao consultar objeto local.")
      );
    }
  },

  /** Idempotente: objeto ausente nao e erro; remove o sidecar junto. */
  async remove(storagePath: string): Promise<void> {
    const target = resolveLocalObjectPath(storagePath);
    try {
      await rm(target, { force: true });
      await rm(metaPathOf(target), { force: true });
    } catch (error) {
      throw new LocalStorageError(
        "REMOVE_FAILED",
        redactSecrets(error instanceof Error ? error.message : "Falha ao remover arquivo local.")
      );
    }
  },
};

