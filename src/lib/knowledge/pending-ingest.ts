/**
 * ConcursoAI — fila de ingestao pendente (.storage/pending-ingest.json)
 *
 * A ingestao de uma apostila tem duas metades com destinos diferentes: os bytes
 * vao para o storage (hoje tambem para o disco, com o adaptador `local`), e o
 * registro (`documents` + chunks + embeddings) so pode acontecer com o banco de
 * teste isolado — Rule 26 proibe escrever no shadow ou no prod, e o TCP 5432 do
 * Neon continua bloqueado neste posto.
 *
 * Esta fila guarda a primeira metade enquanto a segunda e impossivel. Ela e
 * escrita pelo CLI de ingestao e lida pelo `--sync`, que reproduz o registro no
 * banco. Idempotencia por `sha256`: o mesmo arquivo ingestado duas vezes nao
 * cria duas entradas e nao duplica bytes no storage.
 *
 * A entrada tem dois formatos, porque existe um intervalo real entre eles:
 * - `staged`: os bytes estao preservados em `.storage/staging/{sha256}{ext}` e
 *   nao ha nada no banco. `storagePath` e `documentId` sao `null` porque o
 *   `documentId` nasce junto do INSERT em `IngestionService.ingest` — inventar
 *   um uuid aqui seria uma chave falsa para o proximo `--sync`.
 * - `recorded`: a linha de `documents` e o objeto na chave canonica ja existem
 *   (falta extracao e embeddings); `stagingPath` e `null`.
 *
 * O arquivo e JSON com `schema_version` e escrita atomica (`{file}.{uuid}.tmp`
 * + rename), porque fila corrompida a meio de uma sincronizacao equivaleria a
 * perder o resultado de uma ingestao de varios minutos.
 */
import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import { extensionOf } from "./format-contract";

export const PENDING_INGEST_SCHEMA_VERSION = 1 as const;

export type PendingIngestStatus = "recorded" | "staged" | "synced" | "error";

/**
 * Identidade da entrada: o hash do conteudo, nao o nome. Duas pastas diferentes
 * com o mesmo PDF sao a mesma apostila; o mesmo PDF movido de lugar nao e uma
 * nova entrada.
 */
export type PendingIngestEntry = {
  id: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** Backend do objeto canonico; `null` enquanto os bytes estao so no staging. */
  storageBackend: string | null;
  /** Chave `{userId}/{documentId}/{fileName}`; `null` ate o objeto existir. */
  storagePath: string | null;
  /** Linha de `documents` ja criada; `null` enquanto o registro e planejado. */
  documentId: string | null;
  /** Arquivo em `.storage/staging`; `null` quando os bytes ja viraram objeto. */
  stagingPath: string | null;
  status: PendingIngestStatus;
  recordedAt: string;
  updatedAt: string;
  attempts: number;
  lastError?: string;
};

export type PendingIngestFile = {
  schema_version: number;
  updatedAt: string;
  entries: PendingIngestEntry[];
};

export class PendingIngestError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PendingIngestError";
    this.code = code;
  }
}

/**
 * Caminho do arquivo da fila. Default: `.storage/pending-ingest.json` ao pe da
 * raiz de storage local, para que `rm -rf .storage` descarte o cache inteiro de
 * uma vez. `PENDING_INGEST_FILE` permite apontar para outro lado (teste manual,
 * partilha de fila entre dois worktrees).
 */
export function pendingIngestQueuePath(
  env: Record<string, string | undefined> = process.env,
  cwd: string = process.cwd()
): string {
  const raw = env.PENDING_INGEST_FILE?.trim() ?? "";
  if (raw === "") return join(cwd, ".storage", "pending-ingest.json");
  return join(cwd, raw);
}

function emptyFile(): PendingIngestFile {
  return {
    schema_version: PENDING_INGEST_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    entries: [],
  };
}

/**
 * Le a fila. Ausencia de arquivo e fila vazia (primeira ingestao de um posto
 * novo); JSON invalido e erro explicito — reescrever por cima perderia as
 * entradas que ainda nao foram sincronizadas.
 */
export async function readPendingQueue(
  queueFile: string = pendingIngestQueuePath()
): Promise<PendingIngestFile> {
  let raw: string;
  try {
    raw = await readFile(queueFile, "utf8");
  } catch (error) {
    if (typeof error === "object" && error !== null && (error as { code?: string }).code === "ENOENT") {
      return emptyFile();
    }
    throw new PendingIngestError(
      "PENDING_QUEUE_READ_FAILED",
      `Falha ao ler a fila de ingestao em ${queueFile}.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PendingIngestError(
      "PENDING_QUEUE_CORRUPT",
      `Fila de ingestao corrompida em ${queueFile}: JSON invalido. Nenhum registro foi descartado.`
    );
  }

  const file = parsed as Partial<PendingIngestFile>;
  if (file.schema_version !== PENDING_INGEST_SCHEMA_VERSION || !Array.isArray(file.entries)) {
    throw new PendingIngestError(
      "PENDING_QUEUE_SCHEMA",
      `Fila de ingestao em ${queueFile} tem schema_version ${String(file.schema_version)}; esperado ${PENDING_INGEST_SCHEMA_VERSION}.`
    );
  }
  return {
    schema_version: PENDING_INGEST_SCHEMA_VERSION,
    updatedAt: file.updatedAt ?? new Date().toISOString(),
    entries: file.entries as PendingIngestEntry[],
  };
}

/** Escrita atomica: tmp + rename. Fila truncada a meio e perda de ingestao. */
async function writePendingQueue(file: PendingIngestFile, queueFile: string): Promise<void> {
  const next: PendingIngestFile = { ...file, updatedAt: new Date().toISOString() };
  const tmp = `${queueFile}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(queueFile), { recursive: true });
    await writeFile(tmp, `${JSON.stringify(next, null, 2)}\n`, "utf8");
    await rename(tmp, queueFile);
  } catch (error) {
    throw new PendingIngestError(
      "PENDING_QUEUE_WRITE_FAILED",
      `Falha ao gravar a fila de ingestao em ${queueFile}: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`
    );
  }
}

export type RecordedPendingInput = {
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** Backend onde os bytes viraram objeto canonico. */
  storageBackend: string;
  /** Chave canonica ja escrita no backend. */
  storagePath: string;
  /** Linha de `documents` que existe — sem ela o `--sync` nao sabe o que processar. */
  documentId: string;
  queueFile?: string;
};

export type StagedPendingInput = {
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  /** Arquivo preservado em staging, enderecado pelo proprio conteudo. */
  stagingPath: string;
  queueFile?: string;
};

export type RecordPendingResult = {
  entry: PendingIngestEntry;
  /** false quando ja existia entrada com o mesmo sha256 — nenhum trabalho novo. */
  created: boolean;
};

type PendingEntryFields = Omit<
  PendingIngestEntry,
  "id" | "status" | "recordedAt" | "updatedAt" | "attempts" | "lastError"
>;

/**
 * Estado existente nunca e rebaixado por um registro novo:
 * - `synced` sobrevive a re-ingestao: mudar para `recorded` faria o proximo
 *   `--sync` tentar inserir no banco um documento que ja la esta.
 * - `recorded` sobrevive a um `--stage` do mesmo conteudo: os bytes ja sao
 *   objeto no backend, e staging redundante sugeriria trabalho que nao existe.
 */
function nextStatus(current: PendingIngestStatus, incoming: PendingIngestStatus): PendingIngestStatus {
  if (current === "synced") return "synced";
  if (current === "recorded" && incoming === "staged") return "recorded";
  return incoming;
}

async function upsertPendingEntry(
  fields: PendingEntryFields,
  status: PendingIngestStatus,
  queueFile: string
): Promise<RecordPendingResult> {
  const file = await readPendingQueue(queueFile);
  const now = new Date().toISOString();
  const existing = file.entries.find((entry) => entry.sha256 === fields.sha256);

  if (existing) {
    // Campo ja preenchido nao e apagado por um registro que nao o conhece: uma
    // entrada `recorded` que alguem voltou a por em staging continua com a chave
    // canonica, senao o `--sync` perderia o rastro do objeto que existe.
    const entry: PendingIngestEntry = {
      ...existing,
      ...fields,
      storageBackend: fields.storageBackend ?? existing.storageBackend,
      storagePath: fields.storagePath ?? existing.storagePath,
      documentId: fields.documentId ?? existing.documentId,
      stagingPath: fields.stagingPath ?? existing.stagingPath,
      status: nextStatus(existing.status, status),
      attempts: existing.attempts + 1,
      updatedAt: now,
    };
    file.entries = file.entries.map((e) => (e.sha256 === fields.sha256 ? entry : e));
    await writePendingQueue(file, queueFile);
    return { entry, created: false };
  }

  const entry: PendingIngestEntry = {
    id: randomUUID(),
    ...fields,
    status,
    recordedAt: now,
    updatedAt: now,
    attempts: 1,
  };
  file.entries = [...file.entries, entry];
  await writePendingQueue(file, queueFile);
  return { entry, created: true };
}

/** Registro do que ja virou objeto canonico (falhou so a extracao/embeddings). */
export async function recordPendingIngest(
  input: RecordedPendingInput
): Promise<RecordPendingResult> {
  return upsertPendingEntry(
    {
      fileName: input.fileName,
      filePath: input.filePath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      storageBackend: input.storageBackend,
      storagePath: input.storagePath,
      documentId: input.documentId,
      stagingPath: null,
    },
    "recorded",
    input.queueFile ?? pendingIngestQueuePath()
  );
}

/** Registro dos bytes preservados sem banco: metade de storage, nenhuma de banco. */
export async function recordStagedIngest(
  input: StagedPendingInput
): Promise<RecordPendingResult> {
  return upsertPendingEntry(
    {
      fileName: input.fileName,
      filePath: input.filePath,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      sha256: input.sha256,
      storageBackend: null,
      storagePath: null,
      documentId: null,
      stagingPath: input.stagingPath,
    },
    "staged",
    input.queueFile ?? pendingIngestQueuePath()
  );
}

/**
 * Move uma entrada para outro estado. `lastError` so acompanha `error`;
 * gravar mensagem de erro noutro estado faria o relatorio mostrar falha de um
 * passo que correu bem.
 */
export async function updatePendingStatus(args: {
  id: string;
  status: PendingIngestStatus;
  lastError?: string;
  queueFile?: string;
}): Promise<PendingIngestEntry> {
  const queueFile = args.queueFile ?? pendingIngestQueuePath();
  const file = await readPendingQueue(queueFile);
  const current = file.entries.find((entry) => entry.id === args.id);
  if (!current) {
    throw new PendingIngestError(
      "PENDING_ENTRY_NOT_FOUND",
      `Entrada ${args.id} nao existe na fila de ingestao.`
    );
  }
  const next: PendingIngestEntry = {
    ...current,
    status: args.status,
    updatedAt: new Date().toISOString(),
  };
  if (args.status === "error" && args.lastError) {
    next.lastError = args.lastError.slice(0, 300);
  } else {
    delete next.lastError;
  }
  file.entries = file.entries.map((e) => (e.id === args.id ? next : e));
  await writePendingQueue(file, queueFile);
  return next;
}

/** Contagem por estado, para o resumo que o CLI imprime no fim. */
export function summarizePendingQueue(file: PendingIngestFile): Record<PendingIngestStatus, number> {
  const totals: Record<PendingIngestStatus, number> = {
    recorded: 0,
    staged: 0,
    synced: 0,
    error: 0,
  };
  for (const entry of file.entries) {
    totals[entry.status] = (totals[entry.status] ?? 0) + 1;
  }
  return totals;
}

/** O que o `--sync` tem a fazer: tudo o que ainda nao virou documento processado. */
export function pendingEntriesToSync(file: PendingIngestFile): PendingIngestEntry[] {
  return file.entries.filter((entry) => entry.status !== "synced");
}

/**
 * Directoria de staging: irma do arquivo da fila (`.storage/staging` por
 * default), para que `rm -rf .storage` descarte bytes e fila de uma vez — o
 * mesmo criterio da raiz de storage local.
 */
export function stagingDirFor(queueFile: string = pendingIngestQueuePath()): string {
  return join(dirname(queueFile), "staging");
}

/**
 * Nome em staging: o conteudo e a identidade, a extensao so preserva o MIME
 * para o proximo `head()`. Qualquer coisa fora de letras e numeros vira `.bin`.
 */
export function stagedFileName(sha256: string, fileName: string): string {
  const ext = extensionOf(fileName).replace(/^\./, "").toLowerCase();
  return /^[a-z0-9]{1,8}$/.test(ext) ? `${sha256}.${ext}` : `${sha256}.bin`;
}

/**
 * Preserva os bytes longe do banco. O hash e conferido ANTES do rename: staging
 * com conteudo diferente do sha256 declarado seria sincronizado mais tarde como
 * se fosse a apostila certa, e o catalogo passaria a conter bytes que ninguem
 * pediu. Um arquivo ja presente com o mesmo conteudo nao e reescrito.
 */
export async function writeStagedBytes(args: {
  sha256: string;
  fileName: string;
  buffer: Buffer;
  queueFile?: string;
}): Promise<string> {
  if (!/^[0-9a-f]{64}$/.test(args.sha256)) {
    throw new PendingIngestError(
      "PENDING_STAGED_SHA_INVALID",
      `sha256 invalido para staging: ${args.sha256.slice(0, 16)}…`
    );
  }
  if (createHash("sha256").update(args.buffer).digest("hex") !== args.sha256) {
    throw new PendingIngestError(
      "PENDING_STAGED_HASH_MISMATCH",
      `O conteudo de ${args.fileName} nao bate com o sha256 declarado; nada foi gravado em staging.`
    );
  }

  const dir = resolve(stagingDirFor(args.queueFile ?? pendingIngestQueuePath()));
  const target = resolve(dir, stagedFileName(args.sha256, args.fileName));
  const tmp = `${target}.${randomUUID()}.tmp`;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(tmp, args.buffer);
    await rename(tmp, target);
  } catch (error) {
    throw new PendingIngestError(
      "PENDING_STAGED_WRITE_FAILED",
      `Falha ao gravar staging em ${target}: ${error instanceof Error ? error.message : "erro desconhecido"}`
    );
  }
  return target;
}

/** Le o staging e confirma o hash: o que se sincroniza e o que foi gravado. */
export async function readStagedBytes(args: {
  stagingPath: string;
  sha256: string;
}): Promise<Buffer<ArrayBuffer>> {
  let buffer: Buffer<ArrayBuffer>;
  try {
    buffer = await readFile(args.stagingPath);
  } catch {
    throw new PendingIngestError(
      "PENDING_STAGED_MISSING",
      `Bytes em staging nao encontrados em ${args.stagingPath}; a apostila precisa ser lida da origem outra vez.`
    );
  }
  if (createHash("sha256").update(buffer).digest("hex") !== args.sha256) {
    throw new PendingIngestError(
      "PENDING_STAGED_HASH_MISMATCH",
      `O arquivo de staging ${args.stagingPath} nao bate com o sha256 da fila; sincronizar criaria um documento com conteudo trocado.`
    );
  }
  return buffer;
}
