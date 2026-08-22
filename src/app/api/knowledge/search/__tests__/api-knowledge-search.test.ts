/**
 * Testes da API POST /api/knowledge/search.
 *
 * Foco: isolamento por curso/cargo/edital — o escopo é resolvido no backend
 * a partir do perfil autenticado (fonte de verdade). O cliente NÃO pode
 * definir ou sobrescrever positionId/editalId.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockSearch = vi.fn();
const mockGetProfile = vi.fn();
const mockResolveCourseScope = vi.fn();

vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/knowledge/services/hybrid-search.service", () => ({
  HybridSearchService: { search: (...args: unknown[]) => mockSearch(...args) },
}));

vi.mock("@/lib/db/repositories/perfil", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));

vi.mock("@/lib/knowledge/security/course-scope", () => ({
  resolveCourseScope: (...args: unknown[]) => mockResolveCourseScope(...args),
}));

import { POST } from "@/app/api/knowledge/search/route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/knowledge/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const emptyResult = { results: [], totalHits: 0, queryTimeMs: 0 };

describe("POST /api/knowledge/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: usuário sem curso → nenhum filtro inventado.
    mockGetProfile.mockResolvedValue(null);
    mockResolveCourseScope.mockResolvedValue({});
  });

  it("retorna 401 sem autenticação", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ query: "q" }));
    expect(res.status).toBe(401);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("retorna 400 para corpo inválido", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(makeRequest({ query: "" }));
    expect(res.status).toBe(400);
    expect(mockSearch).not.toHaveBeenCalled();
  });

  it("retorna 200 com resultados para busca válida", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockSearch.mockResolvedValue({
      results: [
        {
          chunkId: "chunk-1",
          documentId: "doc-1",
          documentTitle: "Apostila.pdf",
          subjectName: "Português",
          sectionTitle: "Morfologia",
          snippet: "Substantivo...",
          ftsScore: 0.42,
          vectorScore: 0,
          score: 0.42,
        },
      ],
      totalHits: 1,
      queryTimeMs: 5,
    });

    const res = await POST(makeRequest({ query: "substantivo", top_k: 5 }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { results: unknown[]; totalHits: number };
    expect(json.results).toHaveLength(1);
    expect(json.totalHits).toBe(1);
    expect(mockSearch).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", topK: 5 })
    );
  });

  describe("isolamento por curso/cargo/edital", () => {
    it("usuário com position_id recebe positionId no HybridSearchService.search", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: "pos-Y", contest_id: null });
      mockResolveCourseScope.mockResolvedValue({ positionId: "pos-Y" });
      mockSearch.mockResolvedValue(emptyResult);

      const res = await POST(makeRequest({ query: "q" }));
      expect(res.status).toBe(200);
      expect(mockGetProfile).toHaveBeenCalledWith("u1");
      expect(mockResolveCourseScope).toHaveBeenCalledWith(
        expect.objectContaining({ position_id: "pos-Y" })
      );
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ positionId: "pos-Y", editalId: undefined }),
        })
      );
    });

    it("usuário sem position_id mas com contest_id recebe editalId", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: null, contest_id: "contest-X" });
      mockResolveCourseScope.mockResolvedValue({ editalId: "edital-X" });
      mockSearch.mockResolvedValue(emptyResult);

      const res = await POST(makeRequest({ query: "q" }));
      expect(res.status).toBe(200);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ editalId: "edital-X", positionId: undefined }),
        })
      );
    });

    it("usuário sem curso não recebe filtro inventado", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: null, contest_id: null });
      mockResolveCourseScope.mockResolvedValue({});
      mockSearch.mockResolvedValue(emptyResult);

      const res = await POST(makeRequest({ query: "q" }));
      expect(res.status).toBe(200);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ positionId: undefined, editalId: undefined }),
        })
      );
    });

    it("cliente NÃO pode sobrescrever o escopo via body", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: "pos-Y", contest_id: null });
      mockResolveCourseScope.mockResolvedValue({ positionId: "pos-Y" });
      mockSearch.mockResolvedValue(emptyResult);

      // O DTO ignora (strips) position_id/edital_id do cliente — a fonte de
      // verdade do escopo é o backend (perfil autenticado), nunca o body.
      const res = await POST(
        makeRequest({ query: "q", position_id: "pos-HACK", edital_id: "edital-HACK" })
      );
      expect(res.status).toBe(200);
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ positionId: "pos-Y", editalId: undefined }),
        })
      );
      expect(mockSearch).not.toHaveBeenCalledWith(
        expect.objectContaining({
          filters: expect.objectContaining({ positionId: "pos-HACK" }),
        })
      );
    });
  });
});
