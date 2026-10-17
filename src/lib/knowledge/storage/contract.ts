/**
 * ConcursoAI — contrato unico de adaptador de storage (ADR-011)
 *
 * Hoje o `DocumentStorageService` decide o backend por `if/else` sobre
 * "r2" | "supabase". Cada novo adaptador (filesystem local, um bucket propio)
 * teria de reescrever essa decisao em cinco metodos, e a regra de seguranca —
 * NUNCA fazer fallback silencioso entre backends — seria copiada e colada.
 *
 * Este arquivo fixa o contrato que todo adaptador cumpre e as duas funcoes
 * compartilhadas: a chave de objeto canonica e o hash de integridade. Nada aqui
 * toca rede ou disco.
 *
 * Sem `import "server-only"` de proposito: o modulo e puro (crypto + tipos) e e
 * a unica camada do storage que ferramentas pontuais podem importar sem o
 * `--conditions=react-server`. Os marcadores ficam nas camadas que tocam
 * credenciais ou disco (`storage.service.ts`, `storage/backend.ts`,
 * `storage/local-storage.service.ts`, `storage/r2-storage.service.ts`).
 */
import { createHash } from "node:crypto";
import type { StorageBackend } from "./backend";

/** Entrada de upload identica em qualquer backend. */
export type StorageUploadInput = {
  userId: string;
  documentId: string;
  fileName: string;
  buffer: Buffer;
  mimeType: string;
};

/** Metadados lidos do objeto, sem baixar o conteudo inteiro. */
export type StorageObjectHead = {
  contentLength: number;
  contentType: string;
  /** sha256 hex do objeto, quando o backend o registou no upload. */
  sha256?: string;
};

/**
 * Adaptador de storage de documentos.
 *
 * Regras que todo implementador deve manter:
 * - falha explicita quando o backend nao esta configurado (sem fallback);
 * - `remove` e idempotente: objeto ausente nao e erro;
 * - mensagem de erro do cliente nunca e ecoada ao chamador sem redacao
 *   (bucket, caminho interno e credencial ficam no log);
 * - a chave devolvida por `upload` e o que vai para `documents.storage_path`.
 */
export interface DocumentStorageAdapter {
  readonly id: StorageBackend;
  ensureBucket(): Promise<void>;
  upload(input: StorageUploadInput): Promise<string>;
  download(storagePath: string): Promise<Buffer>;
  exists(storagePath: string): Promise<boolean>;
  head(storagePath: string): Promise<StorageObjectHead>;
  remove(storagePath: string): Promise<void>;
}

/**
 * Chave canonica de objeto: `{userId}/{documentId}/{fileName}`.
 *
 * Exportada porque Supabase, R2 e o adaptador local gravam exatamente a mesma
 * chave: a migracao entre backends e uma copia de chave para chave, e o
 * `documents.storage_path` continua valido depois de trocar de storage.
 */
export function storageObjectKey(input: {
  userId: string;
  documentId: string;
  fileName: string;
}): string {
  return `${input.userId}/${input.documentId}/${input.fileName}`;
}

/** sha256 hex (minúsculas) do buffer — fonte da verificacao de integridade. */
export function sha256Hex(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/** Sha256 hex do conteudo de um ficheiro de texto ou buffer ja lido. */
export function sha256Of(value: Buffer | string): string {
  return sha256Hex(typeof value === "string" ? Buffer.from(value, "utf8") : value);
}
