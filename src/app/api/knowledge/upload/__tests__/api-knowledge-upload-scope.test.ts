/**
 * Escopo de compartilhamento no POST /api/knowledge/upload.
 *
 * O upload individual passou a validar cargo/edital antes de gravar qualquer
 * coisa: id inventado devolve 400 e nao deixa documento orphan. Sem ids, o
 * material continua privado (so admin/professor pode definir escopo porque so
 * eles podem enviar apostila).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  queue: [] as unknown[][],
  selectCalls: 0,
}));

vi.mock("@/lib/db/drizzle", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: () => {
            state.selectCalls += 1;
            const rows = state.queue.shift() ?? [];
            return {
              then: (onFulfilled: (v: unknown) => unknown) =>
                Promise.resolve(onFulfilled(rows)),
            };
          },
        }),
      }),
    }),
  },
}));

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...a: unknown[]) => mockAuth(...a),
}));

vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/admin-guard.service")
  >();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      isProfessorOrAdmin: () => Promise.resolve(true),
    },
  };
});

vi.mock("@/lib/administration/session", () => ({
  getAdminSession: () => Promise.resolve({ userId: "adm-1", email: "admin@exemplo.com" }),
}));
vi.mock("@/lib/db/repositories/perfil", () => ({
  getProfile: () => Promise.resolve(null),
}));
vi.mock("@/lib/db/repositories/edital", () => ({
  getCurrentEditalByContest: () => Promise.resolve(null),
}));

const mockIngest = vi.fn();
vi.mock("@/lib/knowledge/services/ingestion.service", () => ({
  IngestionService: { ingest: (...a: unknown[]) => mockIngest(...a) },
  IngestionError: class IngestionError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

const mockStorageUpload = vi.fn();
vi.mock("@/lib/knowledge/storage.service", () => ({
  DocumentStorageService: { upload: (...a: unknown[]) => mockStorageUpload(...a) },
}));
vi.mock("@/lib/knowledge/services/document-pipeline.service", () => ({
  DocumentPipelineService: { processDocument: () => Promise.resolve({ status: "chunked" }) },
}));

const mockUpdateAssociations = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: () => Promise.resolve({ status: "chunked" }),
    updateMetadata: () => Promise.resolve(),
    updateAssociations: (...a: unknown[]) => mockUpdateAssociations(...a),
  },
}));
vi.mock("@/lib/knowledge/repositories/junction.repository", () => ({
  DocumentSubjectRepository: { upsert: () => Promise.resolve() },
}));
vi.mock("@/lib/dto/knowledge.dto", () => ({ mapDocumentToDto: (d: unknown) => d }));
vi.mock("@/lib/security/rate-limit", () => ({
  rateLimit: () => ({ allowed: true, remaining: 9, resetAt: 0, limit: 10 }),
}));
vi.mock("@/lib/billing/services/entitlement.service", () => ({
  EntitlementService: { getCurrent: () => Promise.resolve(null) },
}));

import { POST } from "@/app/api/knowledge/upload/route";

const POSITION = "55555555-5555-4555-8555-555555555555";
const EDITAL = "66666666-6666-4666-8666-666666666666";
const CONTEST_A = "44444444-4444-4444-8444-444444444444";

function uploadRequest(fields: Record<string, string> = {}): NextRequest {
  const fd = new FormData();
  fd.append(
    "file",
    new File([Buffer.from("conteudo de apostila")], "aula-01.pdf", {
      type: "application/pdf",
    })
  );
  for (const [key, value] of Object.entries(fields)) fd.append(key, value);
  return new NextRequest("http://localhost/api/knowledge/upload", {
    method: "POST",
    body: fd,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  state.queue = [];
  state.selectCalls = 0;
  mockAuth.mockResolvedValue({ user: { id: "adm-1", email: "admin@exemplo.com" } });
  mockIngest.mockResolvedValue({
    documentId: "doc-9",
    storagePath: "documents/doc-9/aula-01.pdf",
    storageBackend: "supabase",
    fileHash: "h",
    fileSize: 10,
    mimeType: "application/pdf",
    status: "pending",
    createdAt: new Date(),
  });
  mockStorageUpload.mockResolvedValue(undefined);
  mockUpdateAssociations.mockResolvedValue(undefined);
});

describe("POST /api/knowledge/upload - escopo de compartilhamento", () => {
  it("cargo inexistente devolve 400 sem gravar nada", async () => {
    state.queue = [[]];

    const res = await POST(uploadRequest({ position_id: POSITION }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("SCOPE_NOT_FOUND");
    expect(mockIngest).not.toHaveBeenCalled();
    expect(mockStorageUpload).not.toHaveBeenCalled();
  });

  it("id malformado e recusado antes de tocar no banco", async () => {
    const res = await POST(uploadRequest({ edital_id: "edital-abc" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("INVALID_SCOPE_ID");
    expect(state.selectCalls).toBe(0);
    expect(mockIngest).not.toHaveBeenCalled();
  });

  it("escopo valido entra no documento apos a ingestao", async () => {
    state.queue = [[{ id: POSITION, contestId: CONTEST_A, editalId: EDITAL }]];

    const res = await POST(uploadRequest({ position_id: POSITION }));

    expect(res.status).toBe(201);
    expect(mockUpdateAssociations).toHaveBeenCalledWith("doc-9", {
      editalId: EDITAL,
      positionId: POSITION,
    });
  });

  it("upload sem ids permanece privado", async () => {
    const res = await POST(uploadRequest());

    expect(res.status).toBe(201);
    expect(state.selectCalls).toBe(0);
    expect(mockUpdateAssociations).not.toHaveBeenCalled();
  });
});