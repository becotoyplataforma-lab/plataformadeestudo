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

const mockIsAdminEmail = vi.fn();
vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/admin-guard.service")
  >();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      isAdminEmail: (...a: unknown[]) => mockIsAdminEmail(...a),
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
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: () => Promise.resolve(null),
    updateAssociations: () => Promise.resolve(),
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
    mockIsAdminEmail.mockResolvedValue(false);
    const res = await POST(formReq());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("FORBIDDEN");
  });

  it("admin autenticado → 201 (fluxo normal)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", email: "admin@test.com" },
    });
    mockIsAdminEmail.mockResolvedValue(true);
    const res = await POST(formReq());
    expect(res.status).toBe(201);
  });

  it("admin → upload rejeitado quando binário não bate a extensão (INVALID_CONTENT → 400)", async () => {
    mockAuth.mockResolvedValue({
      user: { id: "admin-1", email: "admin@test.com" },
    });
    mockIsAdminEmail.mockResolvedValue(true);
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
    mockIsAdminEmail.mockResolvedValue(true);
    mockIngest.mockRejectedValue(
      new IngestionError("INVALID_TYPE", "Tipo de arquivo não permitido.")
    );

    const res = await POST(formReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("INVALID_TYPE");
  });
});
