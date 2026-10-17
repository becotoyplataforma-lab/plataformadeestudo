/**
 * Testes unitários — fila de ingestão pendente (.storage/pending-ingest.json).
 *
 * A fila existe porque a metade de storage da ingestão corre hoje e a metade de
 * banco só pode correr com DATABASE_URL isolado (Rule 26). Estes testes fecham
 * as três garantias que o arquivo precisa dar: idempotência por sha256,
 * ausência de arquivo não é erro, e escrita que não perde entradas.
 */
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  PENDING_INGEST_SCHEMA_VERSION,
  pendingIngestQueuePath,
  readPendingQueue,
  recordPendingIngest,
  summarizePendingQueue,
  updatePendingStatus,
  PendingIngestError,
} from "@/lib/knowledge/pending-ingest";

let dir = "";
let queueFile = "";

function inputFor(overrides: Partial<Parameters<typeof recordPendingIngest>[0]> = {}) {
  return {
    fileName: "13-TRT15-2024.pdf",
    filePath: "/apostilas/13-TRT15-2024.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1024,
    sha256: "a".repeat(64),
    storageBackend: "local",
    storagePath: "owner-1/doc-1/13-TRT15-2024.pdf",
    queueFile,
    ...overrides,
  };
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "ca-pending-"));
  queueFile = join(dir, "pending-ingest.json");
});

afterAll(async () => {
  await rm(dir, { recursive: true, force: true });
});

beforeEach(async () => {
  await rm(queueFile, { force: true });
});

describe("pendingIngestQueuePath", () => {
  it("usa .storage/pending-ingest.json quando não há override", () => {
    expect(pendingIngestQueuePath({}, "/repo")).toBe(
      join("/repo", ".storage", "pending-ingest.json")
    );
  });

  it("respeita PENDING_INGEST_FILE relativo ao cwd", () => {
    expect(pendingIngestQueuePath({ PENDING_INGEST_FILE: "tmp/fila.json" }, "/repo")).toBe(
      join("/repo", "tmp", "fila.json")
    );
  });
});

describe("readPendingQueue", () => {
  it("arquivo ausente é fila vazia, não erro", async () => {
    const file = await readPendingQueue(join(dir, "nao-existe.json"));
    expect(file.entries).toEqual([]);
    expect(file.schema_version).toBe(PENDING_INGEST_SCHEMA_VERSION);
  });

  it("JSON corrompido é erro explícito (a fila não é reescrita por cima)", async () => {
    await writeFile(join(dir, "corrupt.json"), "{ this is not json", "utf8");
    await expect(readPendingQueue(join(dir, "corrupt.json"))).rejects.toBeInstanceOf(
      PendingIngestError
    );
  });

  it("schema_version divergente é erro explícito", async () => {
    await writeFile(
      join(dir, "v999.json"),
      JSON.stringify({ schema_version: 999, updatedAt: new Date().toISOString(), entries: [] }),
      "utf8"
    );
    try {
      await readPendingQueue(join(dir, "v999.json"));
      expect.unreachable("schema divergente deveria lançar");
    } catch (error) {
      expect((error as PendingIngestError).code).toBe("PENDING_QUEUE_SCHEMA");
    }
  });
});

describe("recordPendingIngest", () => {
  it("grava a entrada e o arquivo com schema_version", async () => {
    const { entry, created } = await recordPendingIngest(inputFor());
    expect(created).toBe(true);
    expect(entry.status).toBe("recorded");

    const raw = JSON.parse(await readFile(queueFile, "utf8"));
    expect(raw.schema_version).toBe(PENDING_INGEST_SCHEMA_VERSION);
    expect(raw.entries).toHaveLength(1);
    expect(raw.entries[0].sha256).toBe("a".repeat(64));
  });

  it("reprocessar o mesmo sha256 não duplica entrada (idempotência)", async () => {
    await recordPendingIngest(inputFor());
    const second = await recordPendingIngest(
      inputFor({ fileName: "copia-identica.pdf", filePath: "/outra/copia-identica.pdf" })
    );

    expect(second.created).toBe(false);
    const file = await readPendingQueue(queueFile);
    expect(file.entries).toHaveLength(1);
    expect(file.entries[0].attempts).toBe(2);
  });

  it("não rebaixa entrada já sincronizada — reprocessar não marca re-sync", async () => {
    const first = await recordPendingIngest(inputFor());
    await updatePendingStatus({ id: first.entry.id, status: "synced", queueFile });
    await recordPendingIngest(inputFor());

    const file = await readPendingQueue(queueFile);
    expect(file.entries[0].status).toBe("synced");
  });

  it("sha256 diferente entra como registro novo", async () => {
    await recordPendingIngest(inputFor());
    await recordPendingIngest(inputFor({ sha256: "b".repeat(64) }));
    const file = await readPendingQueue(queueFile);
    expect(file.entries).toHaveLength(2);
  });
});

describe("updatePendingStatus", () => {
  it("grava lastError apenas no estado error", async () => {
    const { entry } = await recordPendingIngest(inputFor());
    const failed = await updatePendingStatus({
      id: entry.id,
      status: "error",
      lastError: "banco indisponível",
      queueFile,
    });
    expect(failed.lastError).toBe("banco indisponível");

    const staged = await updatePendingStatus({ id: entry.id, status: "staged", queueFile });
    expect(staged.status).toBe("staged");
    expect(staged.lastError).toBeUndefined();
  });

  it("id inexistente é erro explícito", async () => {
    await recordPendingIngest(inputFor());
    try {
      await updatePendingStatus({ id: "nao-existe", status: "staged", queueFile });
      expect.unreachable("id inexistente deveria lançar");
    } catch (error) {
      expect((error as PendingIngestError).code).toBe("PENDING_ENTRY_NOT_FOUND");
    }
  });

  it("não perde as outras entradas ao atualizar", async () => {
    const a = await recordPendingIngest(inputFor({ sha256: "c".repeat(64) }));
    await recordPendingIngest(inputFor({ sha256: "d".repeat(64) }));
    await updatePendingStatus({ id: a.entry.id, status: "staged", queueFile });

    const file = await readPendingQueue(queueFile);
    expect(file.entries).toHaveLength(2);
    expect(summarizePendingQueue(file)).toEqual({
      recorded: 1,
      staged: 1,
      synced: 0,
      error: 0,
    });
  });
});
