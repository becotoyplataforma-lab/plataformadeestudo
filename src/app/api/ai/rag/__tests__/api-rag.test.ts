/**
 * Testes da API POST /api/ai/rag.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockAnswer = vi.fn();
const mockGetProfile = vi.fn();
const mockResolveCourseScope = vi.fn();

vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/ai/services/rag.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/services/rag.service")>();
  return {
    ...actual,
    ragService: { answer: (...args: unknown[]) => mockAnswer(...args) },
  };
});

vi.mock("@/lib/db/repositories/perfil", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));

vi.mock("@/lib/knowledge/security/course-scope", () => ({
  resolveCourseScope: (...args: unknown[]) => mockResolveCourseScope(...args),
}));

import { POST } from "@/app/api/ai/rag/route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const UUID = "00000000-0000-0000-0000-000000000001";

describe("POST /api/ai/rag", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Defaults: usuário sem curso → nenhum filtro inventado.
    mockGetProfile.mockResolvedValue(null);
    mockResolveCourseScope.mockResolvedValue({});
  });

  it("retorna 401 sem autenticação", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ question: "q" }));
    expect(res.status).toBe(401);
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it("retorna 400 para corpo inválido", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(makeRequest({ question: "" }));
    expect(res.status).toBe(400);
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it("retorna 200 com resposta válida para pergunta válida", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockAnswer.mockResolvedValue({
      answer: "Resposta.",
      citations: [
        {
          documentId: UUID,
          documentTitle: "Doc.pdf",
          chunkId: UUID,
          score: 0.8,
          subject: "Direito",
          topic: null,
        },
      ],
      documents: [UUID],
      chunksUsed: 1,
      tokens: { in: 100, out: 20, total: 120 },
      latencyMs: 150,
      model: "flash",
      confidence: 0.8,
    });

    const res = await POST(makeRequest({ question: "O que diz o art 5?", top_k: 3 }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      answer: string;
      citations: unknown[];
      chunks_used: number;
      confidence: number;
      model: string;
    };
    expect(json.answer).toBe("Resposta.");
    expect(json.citations).toHaveLength(1);
    expect(json.chunks_used).toBe(1);
    expect(json.confidence).toBe(0.8);
    expect(json.model).toBe("flash");
    expect(mockAnswer).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", topK: 3 })
    );
  });

  it("retorna 200 com fallback quando não há contexto", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockAnswer.mockResolvedValue({
      answer: "Não encontrei material suficiente...",
      citations: [],
      documents: [],
      chunksUsed: 0,
      tokens: { in: 0, out: 0, total: 0 },
      latencyMs: 10,
      model: "flash",
      confidence: 0,
    });

    const res = await POST(makeRequest({ question: "Sem docs" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { chunks_used: number; confidence: number };
    expect(json.chunks_used).toBe(0);
    expect(json.confidence).toBe(0);
  });

  describe("isolamento por curso/cargo/edital", () => {
    const baseAnswer = {
      answer: "Resposta.",
      citations: [],
      documents: [],
      chunksUsed: 0,
      tokens: { in: 0, out: 0, total: 0 },
      latencyMs: 10,
      model: "flash" as const,
      confidence: 0,
    };

    it("usuário com position_id recebe positionId no ragService.answer", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: "pos-Y", contest_id: null });
      mockResolveCourseScope.mockResolvedValue({ positionId: "pos-Y" });
      mockAnswer.mockResolvedValue(baseAnswer);

      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(200);
      expect(mockGetProfile).toHaveBeenCalledWith("u1");
      expect(mockResolveCourseScope).toHaveBeenCalledWith(
        expect.objectContaining({ position_id: "pos-Y" })
      );
      expect(mockAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ positionId: "pos-Y", editalId: undefined })
      );
    });

    it("usuário sem position_id mas com contest_id recebe editalId", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: null, contest_id: "contest-X" });
      mockResolveCourseScope.mockResolvedValue({ editalId: "edital-X" });
      mockAnswer.mockResolvedValue(baseAnswer);

      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(200);
      expect(mockAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ editalId: "edital-X", positionId: undefined })
      );
    });

    it("usuário sem curso não recebe filtro inventado", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: null, contest_id: null });
      mockResolveCourseScope.mockResolvedValue({});
      mockAnswer.mockResolvedValue(baseAnswer);

      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(200);
      expect(mockAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ positionId: undefined, editalId: undefined })
      );
    });

    it("cliente NÃO pode sobrescrever o escopo via body", async () => {
      mockAuth.mockResolvedValue({ user: { id: "u1" } });
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: "pos-Y", contest_id: null });
      mockResolveCourseScope.mockResolvedValue({ positionId: "pos-Y" });
      mockAnswer.mockResolvedValue(baseAnswer);

      // O DTO ignora (strips) position_id/edital_id do cliente — a fonte de
      // verdade do escopo é o backend (perfil autenticado), nunca o body.
      const res = await POST(
        makeRequest({ question: "q", position_id: "pos-HACK", edital_id: "edital-HACK" })
      );
      expect(res.status).toBe(200);
      expect(mockAnswer).toHaveBeenCalledWith(
        expect.objectContaining({ positionId: "pos-Y", editalId: undefined })
      );
      expect(mockAnswer).not.toHaveBeenCalledWith(
        expect.objectContaining({ positionId: "pos-HACK" })
      );
    });
  });
});
