/**
 * Testes do PATCH /api/knowledge/documents/[id]/favorite
 *
 * Cobre:
 *   1. usuário não autenticado → 401;
 *   2. documento não encontrado → 404;
 *   3. usuário que não é dono nem admin → 403;
 *   4. dono favorita com sucesso → 200 + is_favorite true;
 *   5. dono desfavorita com sucesso → 200 + is_favorite false;
 *   6. body inválido → 400.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/administration/session", () => ({
  getAdminSession: () => Promise.resolve(null),
}));

const mockFindById = vi.fn();
const mockUpdateFavorite = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  DocumentRepository: {
    findById: (...args: unknown[]) => mockFindById(...args),
    updateFavorite: (...args: unknown[]) => mockUpdateFavorite(...args),
  },
}));

vi.mock("@/lib/dto/knowledge.dto", () => ({
  mapDocumentToDto: (d: Record<string, unknown>) => ({
    ...d,
    is_favorite: d.isFavorite,
  }),
}));

import { PATCH } from "@/app/api/knowledge/documents/[id]/favorite/route";

const OWNER_ID = "user-owner";
const OTHER_ID = "user-other";
const DOC_ID = "11111111-1111-4111-8111-111111111111";

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: DOC_ID,
    userId: OWNER_ID,
    type: "apostila",
    title: "Aula 01",
    storagePath: "x/y",
    storageBackend: "r2",
    status: "chunked",
    fileSize: 10,
    mimeType: "text/plain",
    sourceType: "upload",
    sourceUrl: null,
    externalId: null,
    sourceDocumentIds: null,
    fileHash: "abc",
    metadata: {},
    pageCount: 1,
    processingError: null,
    reviewStatus: "pendente",
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    chunkCount: 5,
    embeddingCount: 0,
    isFavorite: false,
    processedAt: null,
    editalId: null,
    positionId: null,
    createdAt: new Date("2026-08-01T00:00:00.000Z"),
    updatedAt: new Date("2026-08-01T00:00:00.000Z"),
    deletedAt: null,
    ...overrides,
  };
}

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/documents/1/favorite", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ctx() {
  return { params: Promise.resolve({ id: DOC_ID }) };
}

describe("PATCH /api/knowledge/documents/[id]/favorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("401 quando não autenticado", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await PATCH(req({ favorite: true }), ctx());
    expect(res.status).toBe(401);
  });

  it("404 quando documento não existe", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } });
    mockFindById.mockResolvedValue(null);
    const res = await PATCH(req({ favorite: true }), ctx());
    expect(res.status).toBe(404);
  });

  it("403 quando não é dono nem admin", async () => {
    mockAuth.mockResolvedValue({ user: { id: OTHER_ID } });
    mockFindById.mockResolvedValue(makeDoc());
    const res = await PATCH(req({ favorite: true }), ctx());
    expect(res.status).toBe(403);
  });

  it("200 + is_favorite true quando o dono favorita", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } });
    mockFindById.mockResolvedValue(makeDoc());
    mockUpdateFavorite.mockResolvedValue(makeDoc({ isFavorite: true }));

    const res = await PATCH(req({ favorite: true }), ctx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.document.is_favorite).toBe(true);
    expect(mockUpdateFavorite).toHaveBeenCalledWith(DOC_ID, OWNER_ID, true);
  });

  it("200 + is_favorite false quando o dono desfavorita", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } });
    mockFindById.mockResolvedValue(makeDoc({ isFavorite: true }));
    mockUpdateFavorite.mockResolvedValue(makeDoc({ isFavorite: false }));

    const res = await PATCH(req({ favorite: false }), ctx());
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.document.is_favorite).toBe(false);
    expect(mockUpdateFavorite).toHaveBeenCalledWith(DOC_ID, OWNER_ID, false);
  });

  it("400 quando body é inválido", async () => {
    mockAuth.mockResolvedValue({ user: { id: OWNER_ID } });
    mockFindById.mockResolvedValue(makeDoc());

    const badReq = new NextRequest(
      "http://localhost/api/knowledge/documents/1/favorite",
      { method: "PATCH", body: "not-json" }
    );
    const res = await PATCH(badReq, ctx());
    expect(res.status).toBe(400);
  });
});
