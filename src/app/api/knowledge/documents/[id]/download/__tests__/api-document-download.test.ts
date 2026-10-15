/**
 * Testes de GET /api/knowledge/documents/[id]/download.
 *
 * O que precisa continuar verdadeiro: o backend pedido ao storage e o que esta gravado no
 * documento (documents.storage_backend). Sem isso um documento ja migrado seria lido do
 * bucket errado em silencio durante a janela de migracao Supabase -> R2, e o acesso e
 * sempre restrito a dono ou admin.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

const mockGetAdminSession = vi.fn();
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: (...args: unknown[]) => mockGetAdminSession(...args),
}));

const mockResolveScope = vi.fn();
vi.mock("@/lib/knowledge/security/document-access", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/knowledge/security/document-access")
  >();
  // Sem escopo explicito no teste, o mock devolve apenas o proprio usuario:
  // os casos antigos (dono ok, outro usuario 403) continuam valendo. Os casos
  // de compartilhamento definem escopo explicito.
  return {
    ...actual,
    resolveAccessScope: (...a: unknown[]) =>
      mockResolveScope(...a) ??
      Promise.resolve({ userId: a[0] as string, isStaff: false }),
  };
});

const mockFindById = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: (...args: unknown[]) => mockFindById(...args),
  },
}));

const mockDownload = vi.fn();
// Mantemos a classe real de erro para que o instanceof da rota continue valido;
// apenas o servico de storage e substituido.
vi.mock("@/lib/knowledge/storage.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/knowledge/storage.service")>();
  return {
    ...actual,
    DocumentStorageService: {
      download: (...args: unknown[]) => mockDownload(...args),
    },
  };
});

import { StorageError } from "@/lib/knowledge/storage.service";
import { StorageBackendError } from "@/lib/knowledge/storage/backend";
import { GET } from "@/app/api/knowledge/documents/[id]/download/route";

const DOC_ID = "00000000-0000-0000-0000-0000000000a1";
const OWNER = "00000000-0000-0000-0000-0000000000b1";
const OTHER = "00000000-0000-0000-0000-0000000000ff";

function docRow(overrides: Record<string, unknown> = {}) {
  return {
    id: DOC_ID,
    userId: OWNER,
    title: "Apostila de Portugues",
    mimeType: "application/pdf",
    storagePath: "documents/" + DOC_ID + "/apostila.pdf",
    storageBackend: "supabase",
    status: "processado",
    ...overrides,
  };
}

const ctx = { params: Promise.resolve({ id: DOC_ID }) };

function requestFor() {
  return new NextRequest("http://localhost:3000/api/knowledge/documents/download");
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ user: { id: OWNER } });
  mockGetAdminSession.mockResolvedValue(null);
  mockFindById.mockResolvedValue(docRow());
  mockDownload.mockResolvedValue(Buffer.from("%PDF-1.4 corpo"));
});

describe("GET /api/knowledge/documents/[id]/download", () => {
  it("exige sessao", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(401);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("recusa quem nao e dono nem admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER } });
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(403);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("baixa como dono pedindo o backend gravado no documento", async () => {
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(200);
    expect(mockDownload).toHaveBeenCalledWith(
      "documents/" + DOC_ID + "/apostila.pdf",
      "supabase"
    );
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toContain("attachment");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("Cache-Control")).toContain("no-store");
    const body = Buffer.from(await res.arrayBuffer());
    expect(body.toString()).toContain("%PDF-1.4");
  });

  it("admin baixa documento de outro usuario", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER } });
    mockGetAdminSession.mockResolvedValue({ id: "adm-1" });
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(200);
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it("pede o bucket r2 quando o documento ja migrou", async () => {
    mockFindById.mockResolvedValue(docRow({ storageBackend: "r2" }));
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(200);
    expect(mockDownload).toHaveBeenCalledWith(
      "documents/" + DOC_ID + "/apostila.pdf",
      "r2"
    );
  });

  it("devolve 404 quando o documento nao existe", async () => {
    mockFindById.mockResolvedValue(null);
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: "NOT_FOUND" });
  });

  it("devolve 404 quando nao ha storage_path registrado", async () => {
    mockFindById.mockResolvedValue(docRow({ storagePath: null }));
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({
      error: "STORAGE_PATH_MISSING",
    });
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("mapeia backend ausente para 503 sem tentar outro storage", async () => {
    mockDownload.mockRejectedValue(
      new StorageError("R2_NOT_CONFIGURED", "Configure as credenciais do R2")
    );
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ error: "R2_NOT_CONFIGURED" });
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it("mapeia objeto ausente no storage para 404", async () => {
    mockDownload.mockRejectedValue(new StorageError("DOWNLOAD_FAILED", "404"));
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toMatchObject({ error: "DOWNLOAD_FAILED" });
  });

  it("mapeia STORAGE_BACKEND ausente para 503 sem tentar outro storage", async () => {
    mockDownload.mockRejectedValue(
      new StorageBackendError(
        "STORAGE_BACKEND_REQUIRED",
        "STORAGE_BACKEND nao definido"
      )
    );
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      error: "STORAGE_BACKEND_REQUIRED",
    });
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it("devolve mensagem segura em vez do erro cru do storage", async () => {
    mockDownload.mockRejectedValue(
      new StorageError(
        "DOWNLOAD_FAILED",
        "404 bucket=documents-private path=admin-1/x.pdf"
      )
    );
    const res = await GET(requestFor(), ctx);
    expect(res.status).toBe(404);
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("documents-private");
    expect(text).not.toContain("admin-1/");
  });

  it("sanitiza o nome do arquivo no Content-Disposition", async () => {
    mockFindById.mockResolvedValue(docRow({ storagePath: "documents/x/../../a b.pdf" }));
    const res = await GET(requestFor(), ctx);
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    const filename = (disposition.split("filename=")[1] ?? "").replace(/\"/g, "");
    expect(filename).not.toContain("..");
    expect(filename).not.toContain(" ");
    expect(filename).toBe("a_b.pdf");
  });
});

describe("download de documento compartilhado (piloto B1/B2)", () => {
  it("aluno do mesmo cargo baixa o material compartilhado", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER, email: "aluno@exemplo.com" } });
    mockFindById.mockResolvedValue(docRow({ positionId: "pos-A" }));
    mockResolveScope.mockResolvedValue({ userId: OTHER, positionId: "pos-A" });

    const res = await GET(requestFor(), ctx);

    expect(res.status).toBe(200);
    expect(mockDownload).toHaveBeenCalledTimes(1);
  });

  it("aluno de outro cargo nao baixa o material", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER, email: "aluno@exemplo.com" } });
    mockFindById.mockResolvedValue(docRow({ positionId: "pos-A" }));
    mockResolveScope.mockResolvedValue({ userId: OTHER, positionId: "pos-B" });

    const res = await GET(requestFor(), ctx);

    expect(res.status).toBe(403);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("material sem escopo continua privado, mesmo para aluno com cargo", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER, email: "aluno@exemplo.com" } });
    mockFindById.mockResolvedValue(docRow());
    mockResolveScope.mockResolvedValue({ userId: OTHER, positionId: "pos-A" });

    const res = await GET(requestFor(), ctx);

    expect(res.status).toBe(403);
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("edital vigente libera o material do edital", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER, email: "aluno@exemplo.com" } });
    mockFindById.mockResolvedValue(docRow({ editalId: "edital-A" }));
    mockResolveScope.mockResolvedValue({ userId: OTHER, editalId: "edital-A" });

    const res = await GET(requestFor(), ctx);

    expect(res.status).toBe(200);
  });
});