/**
 * Testes da API POST /api/professor/chat.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockAsk = vi.fn();

vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/ai/services/professor.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/ai/services/professor.service")>();
  return {
    ...actual,
    professorService: { ask: (...args: unknown[]) => mockAsk(...args) },
  };
});

import { POST } from "@/app/api/professor/chat/route";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/professor/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const UUID = "00000000-0000-0000-0000-000000000001";

describe("POST /api/professor/chat", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem autenticação", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest({ message: "q" }));
    expect(res.status).toBe(401);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it("retorna 400 para corpo inválido", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const res = await POST(makeRequest({ message: "" }));
    expect(res.status).toBe(400);
    expect(mockAsk).not.toHaveBeenCalled();
  });

  it("retorna 200 com resposta RAG válida", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockAsk.mockResolvedValue({
      answer: "Resposta RAG.",
      mode: "rag",
      model: "flash",
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
      costBRL: 0.001,
      latencyMs: 50,
      confidence: 0.8,
    });

    const res = await POST(
      makeRequest({ message: "No meu material, o que diz?", top_k: 3 })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      answer: string;
      mode: string;
      chunks_used: number;
      confidence: number;
    };
    expect(json.answer).toBe("Resposta RAG.");
    expect(json.mode).toBe("rag");
    expect(json.chunks_used).toBe(1);
    expect(json.confidence).toBe(0.8);
    expect(mockAsk).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", topK: 3 })
    );
  });

  it("retorna 200 com resposta chat válida", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockAsk.mockResolvedValue({
      answer: "Resposta direta.",
      mode: "chat",
      model: "flash",
      citations: [],
      documents: [],
      chunksUsed: 0,
      tokens: { in: 10, out: 5, total: 15 },
      costBRL: 0.001,
      latencyMs: 20,
      confidence: 0,
    });

    const res = await POST(makeRequest({ message: "Explique X." }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { mode: string; chunks_used: number };
    expect(json.mode).toBe("chat");
    expect(json.chunks_used).toBe(0);
  });
});
