/**
 * Testes de GET /api/admin/apostilas/pipeline.
 *
 * A fila e a unica forma do operador ver o estado da conversao sem abrir o
 * banco, entao se trava: bloqueio de nao-admin, presenca de todos os estagios,
 * corte do texto de erro e ausencia de identificador interno na resposta.
 * Nenhum banco e tocado: o repository inteiro e mockado.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockGetSession = vi.fn();
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: (...a: unknown[]) => mockGetSession(...a),
}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/admin-guard.service")
  >();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
    },
  };
});

// A lista vive dentro da fabrica do mock: vitest nao permite variavel
// de escopo superior que nao comece com "mock" dentro de vi.mock factory.

const mockCountByPipelineStatus = vi.fn();
const mockListByPipelineStatuses = vi.fn();
vi.mock("@/lib/knowledge/repositories/document.repository", () => ({
  PIPELINE_STATUSES: [
    "pending",
    "processing",
    "processed",
    "chunked",
    "indexing",
    "indexed",
    "failed",
  ],
  DocumentRepository: {
    countByPipelineStatus: (...a: unknown[]) => mockCountByPipelineStatus(...a),
    listByPipelineStatuses: (...a: unknown[]) => mockListByPipelineStatuses(...a),
  },
}));

import {
  GET,
} from "@/app/api/admin/apostilas/pipeline/route";
import { PIPELINE_STATUSES } from "@/lib/knowledge/repositories/document.repository";

const STATUSES = PIPELINE_STATUSES as unknown as string[];
import { AdminError } from "@/lib/administration/services/admin-guard.service";

function request(limit?: string) {
  const url = "http://localhost/api/admin/apostilas/pipeline" +
    (limit ? "?limit=" + limit : "");
  return new Request(url);
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    userId: "22222222-2222-4222-8222-222222222222",
    title: "Aula 01 - Direito Administrativo",
    type: "pdf",
    storagePath: "user-1/doc-1/aula-01.pdf",
    storageBackend: "supabase",
    status: "chunked",
    fileHash: "abc123",
    chunkCount: 12,
    embeddingCount: 0,
    pageCount: 8,
    processingError: null,
    updatedAt: new Date("2026-10-01T12:00:00.000Z"),
    ...overrides,
  };
}

describe("GET /api/admin/apostilas/pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ userId: "admin-1" });
    mockRequireAdmin.mockResolvedValue(true);
    mockCountByPipelineStatus.mockResolvedValue([
      { status: "chunked", count: 3 },
      { status: "indexed", count: 5 },
      { status: "failed", count: 1 },
    ]);
    mockListByPipelineStatuses.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("exige sessao de admin", async () => {
    mockGetSession.mockResolvedValue(null);
    const res = await GET(request());
    expect(res.status).toBe(401);
    expect(mockCountByPipelineStatus).not.toHaveBeenCalled();
  });

  it("exige autorizacao de admin antes de ler o banco", async () => {
    mockRequireAdmin.mockRejectedValue(new AdminError("FORBIDDEN", "Sem permissao."));
    const res = await GET(request());
    expect(res.status).toBe(403);
    expect(mockCountByPipelineStatus).not.toHaveBeenCalled();
  });

  it("devolve todos os estagios, inclusive os zerados, com total", async () => {
    const res = await GET(request());
    expect(res.status).toBe(200);
    const body = await res.json();
    for (const status of STATUSES) {
      expect(body.counts[status]).toBeTypeOf("number");
    }
    expect(body.counts.chunked).toBe(3);
    expect(body.counts.indexed).toBe(5);
    expect(body.counts.total).toBe(9);
    expect(body.searchable_statuses).toEqual(["chunked", "indexed"]);
  });

  it("nao expoe storage_path, file_hash nem user_id na fila", async () => {
    mockListByPipelineStatuses.mockResolvedValue([row()]);
    const res = await GET(request());
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain("storagePath");
    expect(text).not.toContain("storage_path");
    expect(text).not.toContain("aula-01.pdf");
    expect(text).not.toContain("fileHash");
    expect(text).not.toContain("abc123");
    expect(text).not.toContain("userId");
    expect(text).not.toContain("22222222-2222-4222-8222-222222222222");
  });

  it("mostra o motivo da falha do material quebrado, cortado", async () => {
    mockListByPipelineStatuses.mockImplementation(async () => [
      row({ status: "failed", processingError: "x".repeat(500) }),
    ]);
    const res = await GET(request());
    const body = await res.json();
    expect(body.failed[0].processing_error).toHaveLength(300);
    expect(body.failed[0].page_count).toBe(8);
  });

  it("limit e aceito dentro do teto e ignorado se for lixo", async () => {
    await GET(request("7"));
    expect(mockListByPipelineStatuses.mock.calls[0][1]).toBe(7);
    await GET(request("9999"));
    expect(mockListByPipelineStatuses.mock.calls[2][1]).toBe(200);
    await GET(request("abc"));
    expect(mockListByPipelineStatuses.mock.calls[4][1]).toBe(50);
  });

  it("falha interna nao vaza detalhe tecnico", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    mockCountByPipelineStatus.mockRejectedValue(
      new Error("connection to host=db.internal password=segredo failed")
    );
    const res = await GET(request());
    expect(res.status).toBe(500);
    const text = JSON.stringify(await res.json());
    expect(text).toContain("PIPELINE_QUEUE_UNAVAILABLE");
    expect(text).not.toContain("db.internal");
    expect(text).not.toContain("segredo");
  });
});
