/**
 * Testes unitários do IngestionService.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByHash = vi.fn();
const mockCreate = vi.fn();
const mockGetStorageUsage = vi.fn();

vi.mock("../../repositories/document.repository", () => ({
  DocumentRepository: {
    findByHash: (...args: unknown[]) => mockFindByHash(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    getStorageUsage: (...args: unknown[]) => mockGetStorageUsage(...args),
  },
}));

import { IngestionService, IngestionError } from "../ingestion.service";

describe("IngestionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateQuota", () => {
    it("rejeita quando used + fileSize > limit", async () => {
      mockGetStorageUsage.mockResolvedValue(90 * 1024 * 1024);
      await expect(
        IngestionService.validateQuota("user-1", 20 * 1024 * 1024, 100 * 1024 * 1024)
      ).rejects.toThrow(IngestionError);
    });

    it("permite quando used + fileSize <= limit", async () => {
      mockGetStorageUsage.mockResolvedValue(80 * 1024 * 1024);
      await expect(
        IngestionService.validateQuota("user-1", 20 * 1024 * 1024, 100 * 1024 * 1024)
      ).resolves.toBeUndefined();
    });
  });

  describe("ingest", () => {
    it("rejeita MIME type inválido", async () => {
      const invalidFile = new File(["conteudo"], "arquivo.exe", {
        type: "application/x-msdownload",
      });

      await expect(
        IngestionService.ingest({ userId: "user-1", file: invalidFile })
      ).rejects.toMatchObject({ code: "INVALID_TYPE" });
    });

    it("rejeita arquivo duplicado", async () => {
      mockFindByHash.mockResolvedValue({ id: "existing-doc" });
      const file = new File(["conteudo de teste"], "arquivo.txt", {
        type: "text/plain",
      });

      await expect(
        IngestionService.ingest({ userId: "user-1", file })
      ).rejects.toMatchObject({ code: "DUPLICATE_FILE" });
    });

    it("rejeita arquivo acima de 25 MB", async () => {
      mockFindByHash.mockResolvedValue(null);
      const bigBuffer = Buffer.alloc(26 * 1024 * 1024);
      const file = new File([bigBuffer], "grande.txt", { type: "text/plain" });

      await expect(
        IngestionService.ingest({ userId: "user-1", file })
      ).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
    });

    it("cria documento com sucesso para upload válido", async () => {
      mockFindByHash.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "new-doc",
        userId: "user-1",
        type: "txt",
        title: "meu arquivo",
        storagePath: "user-1/new-doc/arquivo.txt",
        status: "pending",
        fileSize: 100,
        mimeType: "text/plain",
        sourceType: "upload",
        fileHash: "abc123",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const file = new File(["conteudo"], "meu arquivo.txt", {
        type: "text/plain",
      });

      const result = await IngestionService.ingest({ userId: "user-1", file });

      expect(result.documentId).toBe("new-doc");
      expect(result.status).toBe("pending");
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });
  });
});
