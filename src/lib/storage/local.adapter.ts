import "server-only";

/**
 * ConcursoAI — LocalStorageAdapter (driver "local")
 *
 * Guarda os arquivos dentro de uma pasta do projeto (default `.storage/apostilas`),
 * para desenvolvimento local sem depender de nuvem. Nunca expõe caminhos do disco:
 * `getUrl` falha de propósito — a leitura é sempre feita pela rota autenticada
 * `/api/apostilas/[id]/arquivo`.
 *
 * Segue: specs/knowledge-apostilas.md (DD-STORAGE-01)
 */
import { mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  assertSafeKey,
  StorageError,
  type StorageAdapter,
  type StorageRange,
  type StorageStream,
  type UploadResult,
} from "./types";

const CHUNK_SIZE = 64 * 1024;

export class LocalStorageAdapter implements StorageAdapter {
  readonly driver = "local" as const;
  private readonly root: string;

  constructor(baseDir: string) {
    this.root = path.resolve(baseDir);
  }

  /** Resolve a chave para dentro da raiz, com guarda anti path traversal. */
  private resolvePath(key: string): string {
    const segments = assertSafeKey(key);
    const target = path.resolve(this.root, ...segments);
    const rootPrefix = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
    if (!target.startsWith(rootPrefix)) {
      throw new StorageError("INVALID_KEY", "Chave de arquivo fora da raiz do storage.");
    }
    return target;
  }

  /**
   * Aceita `contentType` por contrato (StorageAdapter), mas o Content-Type lido é
   * derivado da extensão da chave (`guessContentType`).
   */
  async upload(key: string, body: Uint8Array): Promise<UploadResult> {
    const target = this.resolvePath(key);
    try {
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, body);
      return { key, size: body.byteLength };
    } catch {
      throw new StorageError("UPLOAD_FAILED", "Não foi possível gravar o arquivo no storage local.");
    }
  }

  async getStream(key: string, range?: StorageRange): Promise<StorageStream> {
    const target = this.resolvePath(key);

    let size: number;
    let modified: Date;
    try {
      const info = await stat(target);
      size = info.size;
      modified = info.mtime;
    } catch {
      throw new StorageError("NOT_FOUND", "Arquivo não encontrado no storage.");
    }

    const start = range?.start ?? 0;
    if (!Number.isFinite(start) || start < 0 || start >= size) {
      throw new StorageError("READ_FAILED", "Intervalo de bytes inválido para este arquivo.");
    }
    const requestedEnd = range?.end ?? null;
    const end = requestedEnd === null ? size - 1 : Math.min(requestedEnd, size - 1);
    const partial = start > 0 || end < size - 1;

    const handle = await open(target, "r");
    let position = start;
    let buffer = Buffer.alloc(Math.min(CHUNK_SIZE, end - start + 1));

    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        const remaining = end - position + 1;
        if (remaining <= 0) {
          await handle.close();
          controller.close();
          return;
        }
        const wanted = Math.min(CHUNK_SIZE, remaining);
        if (buffer.length < wanted) buffer = Buffer.alloc(wanted);
        const { bytesRead } = await handle.read(buffer, 0, wanted, position);
        if (bytesRead === 0) {
          await handle.close();
          controller.close();
          return;
        }
        position += bytesRead;
        controller.enqueue(new Uint8Array(buffer.subarray(0, bytesRead)));
      },
      async cancel() {
        await handle.close();
      },
    });

    return {
      body,
      contentLength: end - start + 1,
      contentType: guessContentType(target),
      etag: null,
      lastModified: modified,
      partial,
      rangeStart: start,
      rangeEnd: end,
    };
  }

  async getUrl(): Promise<string> {
    throw new StorageError(
      "NOT_SUPPORTED",
      "O storage local não gera URL pública; use a rota autenticada /arquivo."
    );
  }

  async delete(key: string): Promise<void> {
    const target = this.resolvePath(key);
    await rm(target, { force: true });
  }

  async exists(key: string): Promise<boolean> {
    const target = this.resolvePath(key);
    try {
      const info = await stat(target);
      return info.isFile();
    } catch {
      return false;
    }
  }
}

/** Tipo de conteúdo pelo sufixo (usado na resposta HTTP do leitor). */
function guessContentType(filePath: string): string | null {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".txt":
      return "text/plain; charset=utf-8";
    case ".md":
      return "text/markdown; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return null;
  }
}
