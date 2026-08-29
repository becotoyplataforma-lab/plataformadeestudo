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

    it("sanitiza filename com path traversal no storagePath", async () => {
      mockFindByHash.mockResolvedValue(null);
      mockCreate.mockImplementation((input: { storagePath: string }) => ({
        id: "new-doc",
        userId: "user-1",
        type: "txt",
        title: "arquivo",
        storagePath: input.storagePath,
        status: "pending",
        fileSize: 100,
        mimeType: "text/plain",
        sourceType: "upload",
        fileHash: "abc123",
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      const file = new File(["conteudo"], "../../../etc/passwd.txt", {
        type: "text/plain",
      });

      const result = await IngestionService.ingest({ userId: "user-1", file });

      // O storagePath não deve conter ".." nem separadores de diretório extras.
      expect(result.storagePath).not.toContain("..");
      expect(result.storagePath.split("/")).toHaveLength(3); // userId/docId/nome
      expect(result.storagePath.endsWith("passwd.txt")).toBe(true);
    });

    it("rejeita PDF com magic bytes inválidos (conteúdo não é PDF)", async () => {
      mockFindByHash.mockResolvedValue(null);
      const fakePdf = new File(["isto não é um pdf"], "falso.pdf", {
        type: "application/pdf",
      });

      await expect(
        IngestionService.ingest({ userId: "user-1", file: fakePdf })
      ).rejects.toMatchObject({ code: "INVALID_CONTENT" });
    });

    it("aceita PDF com magic bytes válidos (%PDF-)", async () => {
      mockFindByHash.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "new-doc",
        userId: "user-1",
        type: "pdf",
        title: "apostila",
        storagePath: "user-1/new-doc/apostila.pdf",
        status: "pending",
        fileSize: 100,
        mimeType: "application/pdf",
        sourceType: "upload",
        fileHash: "abc123",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // %PDF-1.4
      const file = new File([pdfBytes], "apostila.pdf", {
        type: "application/pdf",
      });

      const result = await IngestionService.ingest({ userId: "user-1", file });
      expect(result.documentId).toBe("new-doc");
    });

    it("rejeita binário disfarçado de texto (bytes nulos)", async () => {
      mockFindByHash.mockResolvedValue(null);
      const binary = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
      const file = new File([binary], "falso.txt", { type: "text/plain" });

      await expect(
        IngestionService.ingest({ userId: "user-1", file })
      ).rejects.toMatchObject({ code: "INVALID_CONTENT" });
    });

    it("rejeita binário disfarçado de HTML (bytes nulos)", async () => {
      mockFindByHash.mockResolvedValue(null);
      const binary = new Uint8Array([0x3c, 0x68, 0x74, 0x6d, 0x6c, 0x00, 0x01]); // "<html" + nulos
      const file = new File([binary], "falso.html", { type: "text/html" });

      await expect(
        IngestionService.ingest({ userId: "user-1", file })
      ).rejects.toMatchObject({ code: "INVALID_CONTENT" });
    });

    it("rejeita HTML com menos de 95% de caracteres imprimíveis", async () => {
      mockFindByHash.mockResolvedValue(null);
      // 50% de bytes não imprimíveis (0x80-0xFF) → deve ser rejeitado.
      const bytes = new Uint8Array(200);
      for (let i = 0; i < 200; i++) {
        bytes[i] = i % 2 === 0 ? 0x41 : 0x80; // alterna 'A' e byte não imprimível
      }
      const file = new File([bytes], "binario.html", { type: "text/html" });

      await expect(
        IngestionService.ingest({ userId: "user-1", file })
      ).rejects.toMatchObject({ code: "INVALID_CONTENT" });
    });

    it("aceita HTML com ≥95% de caracteres imprimíveis", async () => {
      mockFindByHash.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "new-doc",
        userId: "user-1",
        type: "html",
        title: "pagina",
        storagePath: "user-1/new-doc/pagina.html",
        status: "pending",
        fileSize: 100,
        mimeType: "text/html",
        sourceType: "upload",
        fileHash: "abc123",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const html = "<html><body><h1>Conteúdo</h1></body></html>";
      const file = new File([html], "pagina.html", { type: "text/html" });

      const result = await IngestionService.ingest({ userId: "user-1", file });
      expect(result.documentId).toBe("new-doc");
    });

    it("rejeita binário disfarçado de Markdown (bytes nulos)", async () => {
      mockFindByHash.mockResolvedValue(null);
      const binary = new Uint8Array([0x23, 0x20, 0x54, 0x69, 0x74, 0x00]); // "# Tit" + nulo
      const file = new File([binary], "falso.md", { type: "text/markdown" });

      await expect(
        IngestionService.ingest({ userId: "user-1", file })
      ).rejects.toMatchObject({ code: "INVALID_CONTENT" });
    });

    it("aceita Markdown com conteúdo imprimível", async () => {
      mockFindByHash.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "new-doc",
        userId: "user-1",
        type: "markdown",
        title: "notas",
        storagePath: "user-1/new-doc/notas.md",
        status: "pending",
        fileSize: 100,
        mimeType: "text/markdown",
        sourceType: "upload",
        fileHash: "abc123",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const md = "# Notas\n\nConteúdo de estudo em markdown.";
      const file = new File([md], "notas.md", { type: "text/markdown" });

      const result = await IngestionService.ingest({ userId: "user-1", file });
      expect(result.documentId).toBe("new-doc");
    });

    it("rejeita texto com menos de 95% de caracteres imprimíveis", async () => {
      mockFindByHash.mockResolvedValue(null);
      // 50% de bytes não imprimíveis (0x80-0xFF) → deve ser rejeitado.
      const bytes = new Uint8Array(200);
      for (let i = 0; i < 200; i++) {
        bytes[i] = i % 2 === 0 ? 0x41 : 0x80; // alterna 'A' e byte não imprimível
      }
      const file = new File([bytes], "binario.txt", { type: "text/plain" });

      await expect(
        IngestionService.ingest({ userId: "user-1", file })
      ).rejects.toMatchObject({ code: "INVALID_CONTENT" });
    });

    it("aceita texto com ≥95% de caracteres imprimíveis", async () => {
      mockFindByHash.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "new-doc",
        userId: "user-1",
        type: "txt",
        title: "texto",
        storagePath: "user-1/new-doc/texto.txt",
        status: "pending",
        fileSize: 100,
        mimeType: "text/plain",
        sourceType: "upload",
        fileHash: "abc123",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // 99% imprimível, 1% não imprimível → deve passar.
      const bytes = new Uint8Array(200);
      for (let i = 0; i < 200; i++) {
        bytes[i] = i === 199 ? 0x80 : 0x41; // um único byte não imprimível
      }
      const file = new File([bytes], "texto.txt", { type: "text/plain" });

      const result = await IngestionService.ingest({ userId: "user-1", file });
      expect(result.documentId).toBe("new-doc");
    });

    it("rejeita DOCX com ZIP que não contém estrutura word/", async () => {
      mockFindByHash.mockResolvedValue(null);
      // ZIP header válido (PK\x03\x04) mas conteúdo sem "word/" → não é DOCX.
      const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      const fakeContent = new Uint8Array([0x41, 0x42, 0x43, 0x44]); // "ABCD"
      const combined = new Uint8Array(zipHeader.length + fakeContent.length);
      combined.set(zipHeader, 0);
      combined.set(fakeContent, zipHeader.length);
      const file = new File([combined], "falso.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      await expect(
        IngestionService.ingest({ userId: "user-1", file })
      ).rejects.toMatchObject({ code: "INVALID_CONTENT" });
    });

    it("aceita DOCX com ZIP contendo estrutura word/", async () => {
      mockFindByHash.mockResolvedValue(null);
      mockCreate.mockResolvedValue({
        id: "new-doc",
        userId: "user-1",
        type: "docx",
        title: "apostila",
        storagePath: "user-1/new-doc/apostila.docx",
        status: "pending",
        fileSize: 100,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        sourceType: "upload",
        fileHash: "abc123",
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // ZIP header + conteúdo contendo "word/" (simula diretório central do ZIP).
      const zipHeader = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00]);
      const wordContent = Buffer.from("word/document.xml");
      const combined = Buffer.concat([Buffer.from(zipHeader), wordContent]);
      const file = new File([combined], "apostila.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      });

      const result = await IngestionService.ingest({ userId: "user-1", file });
      expect(result.documentId).toBe("new-doc");
    });
  });
});
