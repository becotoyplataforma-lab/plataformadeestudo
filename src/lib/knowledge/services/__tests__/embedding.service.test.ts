/**
 * Testes do EmbeddingService — orquestração com cache e batch.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/document.repository", () => ({
  DocumentRepository: {
    updateStatus: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    getPendingChunks: vi.fn(),
  },
}));

vi.mock("../../repositories/embedding.repository", () => ({
  EmbeddingRepository: {
    findByChunkIds: vi.fn(),
    createBatch: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../../repositories/embedding-cache.repository", () => ({
  EmbeddingCacheRepository: {
    get: vi.fn(),
    set: vi.fn().mockResolvedValue([]),
  },
}));

const mockEmbed = vi.fn();
vi.mock("../../embedding/client", () => ({
  embeddingClient: {
    model: "BAAI/bge-m3",
    dimension: 1024,
    isConfigured: () => true,
    embed: (...args: unknown[]) => mockEmbed(...args),
  },
  EmbeddingClientError: class EmbeddingClientError extends Error {},
}));

import { EmbeddingService } from "../embedding.service";
import { DocumentChunkRepository } from "../../repositories/chunk.repository";
import { EmbeddingRepository } from "../../repositories/embedding.repository";
import { EmbeddingCacheRepository } from "../../repositories/embedding-cache.repository";

function makeChunk(id: string, hash: string | null) {
  return {
    id,
    documentId: "doc-1",
    seq: 1,
    content: "Conteúdo de teste para embedding do chunk.",
    contentHash: hash,
    metadata: {},
  };
}

describe("EmbeddingService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gera embeddings para chunks sem cache", async () => {
    (DocumentChunkRepository.getPendingChunks as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeChunk("chunk-1", "hash-1"),
      makeChunk("chunk-2", "hash-2"),
    ]);
    (EmbeddingRepository.findByChunkIds as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmbeddingCacheRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockEmbed.mockResolvedValue([
      Array(1024).fill(0.5),
      Array(1024).fill(0.7),
    ]);

    const result = await EmbeddingService.embedDocument({ documentId: "doc-1" });

    expect(result.generatedCount).toBe(2);
    expect(result.cachedCount).toBe(0);
    expect(mockEmbed).toHaveBeenCalledTimes(1); // batch único
    expect(EmbeddingRepository.createBatch).toHaveBeenCalledTimes(1);
  });

  it("reutiliza embeddings do cache", async () => {
    (DocumentChunkRepository.getPendingChunks as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeChunk("chunk-1", "hash-1"),
    ]);
    (EmbeddingRepository.findByChunkIds as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmbeddingCacheRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      contentHash: "hash-1",
      model: "BAAI/bge-m3",
      embedding: Array(1024).fill(0.1),
    });

    const result = await EmbeddingService.embedDocument({ documentId: "doc-1" });

    expect(result.cachedCount).toBe(1);
    expect(result.generatedCount).toBe(0);
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it("registra falha quando o serviço de embeddings retorna erro", async () => {
    (DocumentChunkRepository.getPendingChunks as ReturnType<typeof vi.fn>).mockResolvedValue([
      makeChunk("chunk-1", "hash-1"),
    ]);
    (EmbeddingRepository.findByChunkIds as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (EmbeddingCacheRepository.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    mockEmbed.mockRejectedValue(new Error("Falha de rede"));

    const result = await EmbeddingService.embedDocument({ documentId: "doc-1" });

    expect(result.failedCount).toBe(1);
    expect(result.generatedCount).toBe(0);
    expect(result.results[0].status).toBe("failed");
  });
});
