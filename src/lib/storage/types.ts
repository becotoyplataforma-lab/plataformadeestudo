/**
 * ConcursoAI — Contrato de Storage (StorageAdapter)
 *
 * Abstração de armazenamento de arquivos do Knowledge Core (apostilas/PDFs).
 * Drivers: "local" (disco do projeto, dev) e "r2" (Cloudflare R2, produção).
 * A troca é feita apenas por variável de ambiente: STORAGE_DRIVER=local|r2.
 *
 * Regras de segurança:
 * - A `key` é um identificador LÓGICO (ex.: "<userId>/<documentId>/<arquivo>.pdf").
 *   Nunca é um caminho de disco nem uma URL pública exposta ao cliente.
 * - `assertSafeKey` bloqueia traversal (`..`), caminhos absolutos e separators
 *   de SO, para que uma linha adulterada na tabela `documents` não permita ler
 *   ficheiros fora da raiz do storage.
 *
 * Segue: specs/knowledge-apostilas.md, .ai/04-CODING-RULES.md, .ai/08-SECURITY-STANDARDS.md
 */

export type StorageDriver = "local" | "r2";

/** Intervalo de bytes (para suporte a HTTP Range na leitura de PDFs). */
export interface StorageRange {
  start: number;
  /** `null` = até ao fim do objeto. */
  end: number | null;
}

/** Objeto lido do storage, pronto para virar corpo de `Response`. */
export interface StorageStream {
  body: ReadableStream<Uint8Array>;
  contentLength: number | null;
  contentType: string | null;
  etag: string | null;
  lastModified: Date | null;
  /** true quando a resposta é parcial (HTTP 206). */
  partial: boolean;
  rangeStart: number;
  rangeEnd: number | null;
}

export interface UploadResult {
  key: string;
  size: number;
}

/** Contrato único que os adaptadores implementam. */
export interface StorageAdapter {
  readonly driver: StorageDriver;

  /** Grava o conteúdo binário na chave indicada. */
  upload(key: string, body: Uint8Array, contentType?: string): Promise<UploadResult>;

  /** Lê o fluxo de bytes (com `range` opcional). Lança StorageError se não existir. */
  getStream(key: string, range?: StorageRange): Promise<StorageStream>;

  /** URL de acesso direto (pública ou pré-assinada). Pode lançar se o driver não suportar. */
  getUrl(key: string, options?: { expiresInSec?: number }): Promise<string>;

  /** Remove o objeto (ausente não é erro). */
  delete(key: string): Promise<void>;

  /** Verifica existência. */
  exists(key: string): Promise<boolean>;
}

export type StorageErrorCode =
  | "INVALID_KEY"
  | "NOT_FOUND"
  | "NOT_SUPPORTED"
  | "CONFIG_MISSING"
  | "UPLOAD_FAILED"
  | "READ_FAILED";

/** Erro de storage com código estável (mapeado para status HTTP na borda). */
export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message: string) {
    super(message);
    this.name = "StorageError";
    this.code = code;
  }
}

/**
 * Valida uma chave lógica de storage.
 * Aceita apenas segmentos "simples": sem `..`, sem absolute path, sem backslash.
 */
export function assertSafeKey(key: string): string[] {
  if (typeof key !== "string" || key.trim() === "") {
    throw new StorageError("INVALID_KEY", "Chave de arquivo inválida.");
  }
  if (key.includes("\\") || key.includes(":") || /[\u0000-\u001f]/.test(key)) {
    throw new StorageError("INVALID_KEY", "Chave de arquivo inválida.");
  }
  // Caminho absoluto (o `:` acima já bloqueia "C:/").
  if (key.startsWith("/")) {
    throw new StorageError("INVALID_KEY", "Chave de arquivo inválida.");
  }

  const segments = key.split("/").filter((segment) => segment !== "");
  if (segments.length === 0 || segments.length > 8) {
    throw new StorageError("INVALID_KEY", "Chave de arquivo inválida.");
  }
  if (segments.some((segment) => segment === "." || segment === "..")) {
    throw new StorageError("INVALID_KEY", "Chave de arquivo inválida.");
  }

  return segments;
}
