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
vi.mock("@/lib/knowledge/services/ingestion.service", () => ({
  IngestionService: {
    ingest: () =>
      Promise.resolve({
        documentId: "doc-123",
        storagePath: "user/doc-123/file.txt",
        mimeType: "text/plain",
        fileSize: 10,
        createdAt: new Date().toISOString(),
      }),
  },
  IngestionError: class IngestionError extends Error {},
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
});
