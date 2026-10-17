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
 * escrita pelo CLI de ingestao local e lida pelo comando de sincronizacao, que
 * reproduz o registro no banco. Idempotencia por `sha256`: o mesmo arquivo
 * ingestado duas vezes nao cria duas entradas e nao duplica bytes no storage.
 *
 * O arquivo e JSON com `schema_version` e escrita atomica (`{file}.{uuid}.tmp`
 * + rename), porque fila corrompida a meio de `markStaged` equivaleria a perder
 * o resultado de uma ingestao de varios minutos.
 */
import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

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
  storageBackend: string;
  storagePath: string;
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

export type RecordPendingInput = {
  fileName: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  storageBackend: string;
  storagePath: string;
  queueFile?: string;
};

export type RecordPendingResult = {
  entry: PendingIngestEntry;
  /** false quando ja existia entrada com o mesmo sha256 — nenhum trabalho novo. */
  created: boolean;
};

/**
 * Grava (ou reencontra) a entrada da apostila na fila.
 *
 * Idempotente por sha256: reprocessar o mesmo arquivo nao duplica entrada nem
 * reescreve bytes. Se a entrada ja estava `synced` e alguem reingestou o mesmo
 * conteudo, ela permanece `synced` — mudar para `recorded` faria o proximo
 * `--sync` tentar inserir no banco um documento que ja la esta.
 */
export async function recordPendingIngest(input: RecordPendingInput): Promise<RecordPendingResult> {
  const queueFile = input.queueFile ?? pendingIngestQueuePath();
  const file = await readPendingQueue(queueFile);
  const now = new Date().toISOString();
  const existing = file.entries.find((entry) => entry.sha256 === input.sha256);

  if (existing) {
    const entry: PendingIngestEntry = {
      ...existing,
      fileName: input.fileName,
      filePath: input.filePath,
      attempts: existing.attempts + 1,
      updatedAt: now,
    };
    file.entries = file.entries.map((e) => (e.sha256 === input.sha256 ? entry : e));
    await writePendingQueue(file, queueFile);
    return { entry, created: false };
  }

  const entry: PendingIngestEntry = {
    id: randomUUID(),
    fileName: input.fileName,
    filePath: input.filePath,
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    sha256: input.sha256,
    storageBackend: input.storageBackend,
    storagePath: input.storagePath,
    status: "recorded",
    recordedAt: now,
    updatedAt: now,
    attempts: 1,
  };
  file.entries = [...file.entries, entry];
  await writePendingQueue(file, queueFile);
  return { entry, created: true };
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
