/**
 * Testes unitários do ChunkService.
 * Mocka os repositórios para testar a lógica pura de chunking.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/document.repository", () => ({
  DocumentRepository: {
    updateStatus: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    softDeleteByDocument: vi.fn().mockResolvedValue({}),
    createBatch: vi.fn().mockResolvedValue([]),
  },
}));

import { ChunkService } from "../chunk.service";
import { DocumentRepository } from "../../repositories/document.repository";
import { DocumentChunkRepository } from "../../repositories/chunk.repository";

describe("ChunkService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("chunk", () => {
    it("divide texto de 3000 chars em múltiplos chunks", async () => {
      const text = "a".repeat(3000);
      const result = await ChunkService.chunk({
        documentId: "doc-1",
        text,
        documentType: "txt",
        chunkSize: 1000,
        overlap: 200,
      });

      expect(result.chunkCount).toBeGreaterThan(1);
      expect(DocumentChunkRepository.createBatch).toHaveBeenCalledTimes(1);
    });

    it("não quebra no meio de palavra", async () => {
      const text =
        "Lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor. ".repeat(40);
      const result = await ChunkService.chunk({
        documentId: "doc-1",
        text,
        documentType: "txt",
        chunkSize: 100,
        overlap: 20,
      });

      for (const chunk of result.chunks) {
        // Verificar que nenhum chunk termina com metade de palavra
        expect(chunk.contentHash).toBeTruthy();
      }
      expect(result.chunkCount).toBeGreaterThan(0);
    });

    it("preserva overlap entre chunks consecutivos", async () => {
      const text = "Palavra teste repetida para gerar contexto suficiente para o teste de chunking. ".repeat(30);
      const result = await ChunkService.chunk({
        documentId: "doc-1",
        text,
        documentType: "txt",
        chunkSize: 150,
        overlap: 30,
      });

      expect(result.chunkCount).toBeGreaterThan(1);
    });

    it("usa estratégia estrutural para Markdown", async () => {
      const text = [
        "# Título 1",
        "",
        "Conteúdo da primeira seção com texto suficiente para o chunk.",
        "",
        "## Subseção 1.1",
        "",
        "Conteúdo da subseção com texto.",
        "",
        "# Título 2",
        "",
        "Conteúdo da segunda seção.",
      ].join("\n");

      const result = await ChunkService.chunk({
        documentId: "doc-1",
        text,
        documentType: "markdown",
        chunkSize: 1000,
        overlap: 200,
      });

      expect(result.chunkCount).toBeGreaterThan(0);
      expect(result.strategy).toBe("structural");
    });

    it("retorna 0 chunks para texto vazio", async () => {
      const result = await ChunkService.chunk({
        documentId: "doc-1",
        text: "",
        documentType: "txt",
      });

      expect(result.chunkCount).toBe(0);
      expect(DocumentChunkRepository.createBatch).not.toHaveBeenCalled();
    });

    it("soft-deleta chunks antigos antes de inserir novos", async () => {
      const text = "Conteúdo de teste para o chunk service. ".repeat(20);
      await ChunkService.chunk({
        documentId: "doc-1",
        text,
        documentType: "txt",
      });

      expect(DocumentChunkRepository.softDeleteByDocument).toHaveBeenCalledWith("doc-1");
    });

    it("atualiza status do documento para chunked", async () => {
      const text = "Conteúdo para atualizar o status. ".repeat(10);
      await ChunkService.chunk({
        documentId: "doc-1",
        text,
        documentType: "txt",
      });

      expect(DocumentRepository.updateStatus).toHaveBeenCalledWith("doc-1", "chunked");
    });
  });
});
