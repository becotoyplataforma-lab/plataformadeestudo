/**
 * Quota maxDocuments — POST /api/knowledge/upload (FASE 3C-5C).
 * 429 QUOTA_EXCEEDED resource=documents; quota de bytes continua 413.
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
    details?: Record<string, unknown>;
    constructor(code: string, message: string, details?: Record<string, unknown>) {
      super(message);
      this.code = code;
      this.details = details;
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
  EntitlementService: {
    getCurrent: () => Promise.resolve({ planCode: "free" }),
  },
}));

import { POST } from "@/app/api/knowledge/upload/route";
import { IngestionError } from "@/lib/knowledge/services/ingestion.service";

function formReq(): NextRequest {
  const fd = new FormData();
  fd.append(
    "file",
    new File([Buffer.from("conteudo de teste")], "apostila.txt", {
      type: "text/plain",
    })
  );
  return new NextRequest("http://localhost/api/knowledge/upload", {
    method: "POST",
    body: fd,
  });
}

describe("POST /api/knowledge/upload — quota maxDocuments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: "admin-1", email: "a@t.com" } });
    mockIsProfessorOrAdmin.mockResolvedValue(true);
  });

  it("K) quota excedida => 429 com resource/limit/current/resetAt null", async () => {
    mockIngest.mockRejectedValue(
      new IngestionError(
        "QUOTA_EXCEEDED",
        "Voce atingiu o limite de documentos do seu plano (3). Exclua um documento ou faca upgrade.",
        { resource: "documents", limit: 3, current: 3, resetAt: null }
      )
    );
    const res = await POST(formReq());
    expect(res.status).toBe(429);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("QUOTA_EXCEEDED");
    expect(body.resource).toBe("documents");
    expect(body.limit).toBe(3);
    expect(body.current).toBe(3);
    expect(body.resetAt).toBeNull();
  });

  it("L) quota de bytes existente continua 413 (nao vira 429)", async () => {
    mockIngest.mockRejectedValue(
      new IngestionError("QUOTA_EXCEEDED", "limite de armazenamento", {
        usedBytes: 90,
        limitBytes: 100,
      })
    );
    const res = await POST(formReq());
    expect(res.status).toBe(413);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("QUOTA_EXCEEDED");
    expect(body).not.toHaveProperty("resource");
  });

  it("H) duplicado ativo => 409 DUPLICATE_FILE (nao 429)", async () => {
    mockIngest.mockRejectedValue(
      new IngestionError("DUPLICATE_FILE", "Este arquivo ja foi enviado", {
        existingDocumentId: "doc-1",
      })
    );
    const res = await POST(formReq());
    expect(res.status).toBe(409);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("DUPLICATE_FILE");
  });
});
