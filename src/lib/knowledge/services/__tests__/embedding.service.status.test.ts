/**
 * Testes de estado do EmbeddingService.
 *
 * O ponto corrigido aqui e uma conclusao falsa: o servico escrevia indexed
 * tambem quando nao existia nenhum vetor. O status agora so afirma indexacao
 * quando existe vetor registrado.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdateStatus = vi.fn();
const mockUpdateMetadata = vi.fn();
vi.mock("../../repositories/document.repository", () => ({
  DocumentRepository: {
    updateStatus: (...a: unknown[]) => mockUpdateStatus(...a),
    updateMetadata: (...a: unknown[]) => mockUpdateMetadata(...a),
  },
}));

const mockGetPendingChunks = vi.fn();
vi.mock("../../repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    getPendingChunks: (...a: unknown[]) => mockGetPendingChunks(...a),
  },
}));

const mockFindByChunkIds = vi.fn();
const mockCreateBatch = vi.fn();
vi.mock("../../repositories/embedding.repository", () => ({
  EmbeddingRepository: {
    findByChunkIds: (...a: unknown[]) => mockFindByChunkIds(...a),
    createBatch: (...a: unknown[]) => mockCreateBatch(...a),
  },
}));

const mockCacheGet = vi.fn();
vi.mock("../../repositories/embedding-cache.repository", () => ({
  EmbeddingCacheRepository: {
    get: (...a: unknown[]) => mockCacheGet(...a),
    set: vi.fn().mockResolvedValue([]),
  },
}));

const mockEmbed = vi.fn();
const configured = { value: true };
vi.mock("../../embedding/client", () => ({
  embeddingClient: {
    model: "BAAI/bge-m3",
    dimension: 1024,
    isConfigured: () => configured.value,
    embed: (...a: unknown[]) => mockEmbed(...a),
  },
  EmbeddingClientError: class EmbeddingClientError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "EmbeddingClientError";
    }
  },
}));

import { EmbeddingService } from "../embedding.service";

function chunk(id: string) {
  return {
    id,
    documentId: "doc-1",
    seq: 0,
    content: "conteudo do chunk " + id,
    contentHash: "hash-" + id,
  };
}

function statusWrites() {
  return mockUpdateStatus.mock.calls.map((c) => c[1]) as string[];
}

describe("EmbeddingService e a verdade do status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    configured.value = true;
    mockUpdateStatus.mockResolvedValue({});
    mockUpdateMetadata.mockResolvedValue({});
    mockCreateBatch.mockResolvedValue([]);
    mockCacheGet.mockResolvedValue(null);
    mockFindByChunkIds.mockResolvedValue([]);
  });

  it("sem servico configurado nao marca indexed", async () => {
    configured.value = false;
    await expect(
      EmbeddingService.embedDocument({ documentId: "doc-1" })
    ).rejects.toThrow(/configurado/);
    expect(statusWrites()).toEqual(["chunked"]);
  });

  it("batch que falha inteiro deixa o documento pendente, nao indexado", async () => {
    mockGetPendingChunks.mockResolvedValue([chunk("c1"), chunk("c2")]);
    mockEmbed.mockRejectedValue(new Error("servico fora do ar"));

    const out = await EmbeddingService.embedDocument({ documentId: "doc-1" });

    expect(out.failedCount).toBe(2);
    expect(statusWrites()[statusWrites().length - 1]).toBe("chunked");
  });

  it("com vetores gerados o status final e indexed", async () => {
    mockGetPendingChunks.mockResolvedValue([chunk("c1")]);
    mockEmbed.mockResolvedValue([Array(1024).fill(0.2)]);

    const out = await EmbeddingService.embedDocument({ documentId: "doc-1" });

    expect(out.generatedCount).toBe(1);
    expect(statusWrites()[statusWrites().length - 1]).toBe("indexed");
  });

  it("documento sem chunk nenhum nao e declarado indexado", async () => {
    mockGetPendingChunks.mockResolvedValue([]);
    await EmbeddingService.embedDocument({ documentId: "doc-1" });
    expect(statusWrites()[statusWrites().length - 1]).toBe("chunked");
  });

  it("chunks ja vetorizados continuam declarados indexados", async () => {
    mockGetPendingChunks.mockResolvedValue([chunk("c1")]);
    mockFindByChunkIds.mockResolvedValue([{ chunkId: "c1", id: "e1" }]);

    const out = await EmbeddingService.embedDocument({ documentId: "doc-1" });

    expect(out.cachedCount).toBe(1);
    expect(mockEmbed).not.toHaveBeenCalled();
    expect(statusWrites()[statusWrites().length - 1]).toBe("indexed");
  });
});
