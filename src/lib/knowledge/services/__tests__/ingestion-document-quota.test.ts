/**
 * Quota maxDocuments — IngestionService (FASE 3C-5C).
 * COUNT(*) FROM documents WHERE user_id AND deleted_at IS NULL.
 * Limites oficiais via resolveUserLimits: Free 3 / Pro 20 / Intensivo 100.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByHash = vi.fn();
const mockCreate = vi.fn();
const mockCountActiveByUser = vi.fn();
const mockGetStorageUsage = vi.fn();

vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findByHash: (...args: unknown[]) => mockFindByHash(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    countActiveByUser: (...args: unknown[]) => mockCountActiveByUser(...args),
    getStorageUsage: (...args: unknown[]) => mockGetStorageUsage(...args),
  },
}));

const mockResolveUserLimits = vi.fn();
vi.mock("@/lib/billing/services/limits.resolver", () => ({
  resolveUserLimits: (...args: unknown[]) => mockResolveUserLimits(...args),
}));

import {
  IngestionService,
  IngestionError,
} from "@/lib/knowledge/services/ingestion.service";

function txtFile(name = "apostila.txt", content = "conteudo de teste") {
  return new File([content], name, { type: "text/plain" });
}

function createdDoc(id = "new-doc") {
  return {
    id, userId: "user-1", type: "txt", title: "apostila",
    storagePath: `user-1/${id}/apostila.txt`, status: "pending",
    fileSize: 100, mimeType: "text/plain", sourceType: "upload",
    fileHash: "abc123", createdAt: new Date(), updatedAt: new Date(),
  };
}

describe("maxDocuments — IngestionService.ingest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByHash.mockResolvedValue(null);
    mockCreate.mockResolvedValue(createdDoc());
    mockGetStorageUsage.mockResolvedValue(0);
  });

  it("A) Free abaixo do limite (2/3) permite e cria", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 3 });
    mockCountActiveByUser.mockResolvedValue(2);
    const out = await IngestionService.ingest({ userId: "user-1", file: txtFile() });
    expect(out.documentId).toBe("new-doc");
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCountActiveByUser).toHaveBeenCalledWith("user-1");
  });

  it("B) Free no limite (3/3) bloqueia sem criar", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 3 });
    mockCountActiveByUser.mockResolvedValue(3);
    await expect(
      IngestionService.ingest({ userId: "user-1", file: txtFile() })
    ).rejects.toMatchObject({
      code: "QUOTA_EXCEEDED",
      details: { resource: "documents", limit: 3, current: 3, resetAt: null },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("C) Pro: 19/20 permite, 20/20 bloqueia", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 20 });
    mockCountActiveByUser.mockResolvedValue(19);
    await IngestionService.ingest({ userId: "u-pro", file: txtFile() });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    mockFindByHash.mockResolvedValue(null);
    mockCreate.mockResolvedValue(createdDoc());
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 20 });
    mockCountActiveByUser.mockResolvedValue(20);
    await expect(
      IngestionService.ingest({ userId: "u-pro", file: txtFile() })
    ).rejects.toMatchObject({
      details: { resource: "documents", limit: 20, current: 20 },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("D) Intensivo: 99/100 permite, 100/100 bloqueia", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 100 });
    mockCountActiveByUser.mockResolvedValue(99);
    await IngestionService.ingest({ userId: "u-int", file: txtFile() });
    expect(mockCreate).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    mockFindByHash.mockResolvedValue(null);
    mockCreate.mockResolvedValue(createdDoc());
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 100 });
    mockCountActiveByUser.mockResolvedValue(100);
    await expect(
      IngestionService.ingest({ userId: "u-int", file: txtFile() })
    ).rejects.toMatchObject({
      details: { resource: "documents", limit: 100, current: 100 },
    });
  });
});

describe("maxDocuments — regras de contagem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByHash.mockResolvedValue(null);
    mockCreate.mockResolvedValue(createdDoc());
    mockGetStorageUsage.mockResolvedValue(0);
  });

  it("F) usuarios isolados (A=3 bloqueia, B=0 permite)", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 3 });
    mockCountActiveByUser.mockImplementation(async (uid: string) =>
      uid === "user-A" ? 3 : 0
    );
    await expect(
      IngestionService.ingest({ userId: "user-A", file: txtFile() })
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    const out = await IngestionService.ingest({ userId: "user-B", file: txtFile() });
    expect(out.documentId).toBe("new-doc");
    expect(mockCountActiveByUser).toHaveBeenCalledWith("user-A");
    expect(mockCountActiveByUser).toHaveBeenCalledWith("user-B");
  });

  it("G) failed com deletedAt NULL ocupa vaga (sem filtro de status)", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 3 });
    mockCountActiveByUser.mockResolvedValue(3);
    await expect(
      IngestionService.ingest({ userId: "user-1", file: txtFile() })
    ).rejects.toMatchObject({ code: "QUOTA_EXCEEDED" });
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(process.cwd(), "src/lib/knowledge/repositories/document.repository.ts"),
      "utf-8"
    );
    const block = repo.slice(repo.indexOf("countActiveByUser"));
    expect(block).not.toContain("status");
  });

  it("H) duplicado ativo no limite => 409, sem contar quota e sem criar", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 3 });
    mockCountActiveByUser.mockResolvedValue(3);
    mockFindByHash.mockResolvedValue({ id: "existing-doc" });
    await expect(
      IngestionService.ingest({ userId: "user-1", file: txtFile() })
    ).rejects.toMatchObject({ code: "DUPLICATE_FILE" });
    expect(mockCountActiveByUser).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("I) mesmo hash apos soft delete libera slot (findByHash null + count 2/3)", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 3 });
    mockFindByHash.mockResolvedValue(null);
    mockCountActiveByUser.mockResolvedValue(2);
    const out = await IngestionService.ingest({ userId: "user-1", file: txtFile() });
    expect(out.documentId).toBe("new-doc");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("E) countActiveByUser = userId + deletedAt IS NULL, sem status", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const repo = readFileSync(
      join(process.cwd(), "src/lib/knowledge/repositories/document.repository.ts"),
      "utf-8"
    );
    const idx = repo.indexOf("countActiveByUser");
    expect(idx).toBeGreaterThan(-1);
    const block = repo.slice(idx, idx + 600);
    expect(block).toContain("documents.userId");
    expect(block).toContain("isNull(documents.deletedAt)");
    expect(block).toContain("count(*)");
  });

  it("J) transformado.html nao cria linha em documents", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const svc = readFileSync(
      join(process.cwd(), "src/lib/knowledge/services/apostila-transform.service.ts"),
      "utf-8"
    );
    expect(svc).not.toContain("DocumentRepository.create");
    expect(svc).toContain("updateMetadata");
  });

  it("M) erro antes do create nao cria documento", async () => {
    mockResolveUserLimits.mockResolvedValue({ maxDocuments: 3 });
    mockCountActiveByUser.mockResolvedValue(3);
    await expect(
      IngestionService.ingest({ userId: "user-1", file: txtFile() })
    ).rejects.toThrow(IngestionError);
    expect(mockCreate).not.toHaveBeenCalled();
    mockCountActiveByUser.mockResolvedValue(0);
    const bad = new File(["x"], "a.exe", { type: "application/x-msdownload" });
    await expect(
      IngestionService.ingest({ userId: "user-1", file: bad })
    ).rejects.toMatchObject({ code: "INVALID_TYPE" });
  });

  it("N) /api/questions/generate nao depende desta quota", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/app/api/questions/generate/route.ts"),
      "utf-8"
    );
    expect(src).not.toContain("countActiveByUser");
    expect(src).not.toContain("maxDocuments");
  });
});
