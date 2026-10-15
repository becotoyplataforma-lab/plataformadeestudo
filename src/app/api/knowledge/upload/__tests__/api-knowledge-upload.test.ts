/**
 * Testes de autorização do POST /api/knowledge/upload.
 *
 * REGRA DE NEGÓCIO: upload de apostilas é EXCLUSIVO de admin.
 * Alunos NUNCA enviam apostilas → recebem 403.
 *
 * Cobre:
 *   1. usuário não autenticado → 401;
 *   2. usuário autenticado mas não-admin → 403 (FORBIDDEN);
 *   3. usuário admin → fluxo normal (201).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

const mockIsProfessorOrAdmin = vi.fn();
vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/admin-guard.service")
  >();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      isProfessorOrAdmin: (...a: unknown[]) => mockIsProfessorOrAdmin(...a),
    },
  };
});

// Mocks dos serviços usados pelo route (não são o foco deste teste).
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: () => Promise.resolve(null),
}));
vi.mock("@/lib/db/repositories/perfil", () => ({
  getProfile: () => Promise.resolve(null),
}));
vi.mock("@/lib/db/repositories/edital", () => ({
  getCurrentEditalByContest: () => Promise.resolve(null),
}));
const mockIngest = vi.fn();
vi.mock("@/lib/knowledge/services/ingestion.service", () => ({
  IngestionService: {
    ingest: (...args: unknown[]) => mockIngest(...args),
  },
  IngestionError: class IngestionError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));
vi.mock("@/lib/knowledge/storage.service", () => ({
  DocumentStorageService: { upload: () => Promise.resolve() },
}));
vi.mock("@/lib/knowledge/services/document-pipeline.service", () => ({
  DocumentPipelineService: { processDocument: () => Promise.resolve() },
}));
const mockUpdateMetadata = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: () => Promise.resolve(null),
    updateAssociations: () => Promise.resolve(),
    updateMetadata: (...args: unknown[]) => mockUpdateMetadata(...args),
  },
}));
vi.mock("@/lib/knowledge/repositories/junction.repository", () => ({
  DocumentSubjectRepository: { upsert: () => Promise.resolve() },
}));
vi.mock("@/lib/dto/knowledge.dto", () => ({
  mapDocumentToDto: (d: unknown) => d,
}));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: () => ({ allowed: true, remaining: 10, resetAt: 0, limit: 10 }),
}));
vi.mock("@/lib/billing/services/entitlement.service", () => ({
  EntitlementService: { getCurrent: () => Promise.resolve(null) },
}));

import { POST } from "@/app/api/knowledge/upload/route";
import { IngestionError } from "@/lib/knowledge/services/ingestion.service";
import { DEFAULT_MCP_PROVIDER_ID } from "@/lib/knowledge/mcp/contracts";

function formReq(): NextRequest {
  const fd = new FormData();
  fd.append(
    "file",
    new File([Buffer.from("conteúdo de teste")], "apostila.txt", {
      type: "text/plain",
    })
  );
  return new NextRequest("http://localhost/api/knowledge/upload", {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/knowledge/upload — regra de negócio (admin apenas)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIngest.mockResolvedValue({
      documentId: "doc-123",
      storagePath: "user/doc-123/file.txt",
      mimeType: "text/plain",
      fileSize: 10,
      createdAt: new Date().toISOString(),
    });
  });

  it("sem sessão → 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(formReq());
    expect(res.status).toBe(401);
  });

  it("aluno autenticado (não-admin) → 403 FORBIDDEN", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "aluno-1", email: "aluno@test.com" },
    });
    mockIsProfessorOrAdmin.mockResolvedValue(false);
    const res = await POST(formReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  it("admin autenticado → 201 (fluxo normal)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", email: "admin@test.com" },
    });
    mockIsProfessorOrAdmin.mockResolvedValue(true);
    const res = await POST(formReq());
    expect(res.status).toBe(201);
  });

  it("admin → upload rejeitado quando binário não bate a extensão (INVALID_CONTENT → 400)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", email: "admin@test.com" },
    });
    mockIsProfessorOrAdmin.mockResolvedValue(true);
    // Simula o IngestionService rejeitando um arquivo cujo conteúdo não
    // corresponde ao MIME declarado (ex.: executável renomeado para .pdf).
    mockIngest.mockRejectedValue(
      new IngestionError("INVALID_CONTENT", "O conteúdo do arquivo não corresponde ao tipo declarado.")
    );

    const res = await POST(formReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_CONTENT");
  });

  it("admin → upload rejeitado quando tipo não permitido (INVALID_TYPE → 400)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", email: "admin@test.com" },
    });
    mockIsProfessorOrAdmin.mockResolvedValue(true);
    mockIngest.mockRejectedValue(
      new IngestionError("INVALID_TYPE", "Tipo de arquivo não permitido.")
    );

    const res = await POST(formReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_TYPE");
  });
});

/**
 * O plano do MCP acontece ANTES de qualquer escrita: documento fora do escopo e
 * id malformado viram 422 sem tocar IngestionService nem storage.
 */
describe("POST /api/knowledge/upload - plano do MCP", () => {
  function reqWith(fileName: string, type: string, mcpField?: string): NextRequest {
    const fd = new FormData();
    fd.append("file", new File([Buffer.from("conteudo de teste")], fileName, { type }));
    if (mcpField !== undefined) fd.append("mcp_provider_id", mcpField);
    return new NextRequest("http://localhost/api/knowledge/upload", {
      method: "POST",
      body: fd,
    });
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "admin-1", email: "admin@test.com" } });
    mockIsProfessorOrAdmin.mockResolvedValue(true);
    mockIngest.mockResolvedValue({
      documentId: "doc-123",
      storagePath: "user/doc-123/file.txt",
      mimeType: "application/pdf",
      fileSize: 10,
      createdAt: new Date().toISOString(),
    });
  });

  it("mcp_provider_id malformado vira 422 sem expor mensagem do zod", async () => {
    const res = await POST(reqWith("apostila.txt", "text/plain", "nome com espaco!"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("INVALID_MCP_PROVIDER");
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("documento fora do escopo do MCP vira 422 MCP_REJECTED antes de gravar", async () => {
    const res = await POST(reqWith("capa.jpg", "image/jpeg"));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toBe("MCP_REJECTED");
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("fluxo normal grava o carimbo do MCP em documents.metadata", async () => {
    const res = await POST(reqWith("aula-01.pdf", "application/pdf"));
    expect(res.status).toBe(201);
    const stamp = (mockUpdateMetadata.mock.calls[0] ?? [])[1] as Record<string, unknown>;
    expect(stamp.mcp_provider_id).toBe(DEFAULT_MCP_PROVIDER_ID);
    expect(typeof stamp.mcp_version).toBe("string");
    expect(typeof stamp.processing_version).toBe("string");
    expect(stamp.processing_version).not.toBe(stamp.mcp_version);
    const mcp = stamp.mcp as Record<string, unknown>;
    expect(mcp.providerId).toBe(DEFAULT_MCP_PROVIDER_ID);
    expect(mcp.processingVersion).toBe(stamp.processing_version);
  });
});
