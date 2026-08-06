/**
 * Testes do ProfessorService (Application Service / orquestrador) com DI mockada.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  ProfessorService,
  ProfessorError,
  defaultResolveIntent,
} from "../professor.service";
import type { ProfessorDependencies, ProfessorOutput } from "../professor.service";

const answer = vi.fn();
const send = vi.fn();
const checkLimit = vi.fn();
const record = vi.fn();
const estimateCost = vi.fn();
const route = vi.fn();

function makeService(deps: Partial<ProfessorDependencies> = {}): ProfessorService {
  return new ProfessorService({
    rag: { answer },
    chat: { send },
    usage: { checkLimit, record, estimateCost },
    router: { route },
    limit: { maxMessages: 10, maxTokens: 1000 },
    ...deps,
  } as ProfessorDependencies);
}

function ragOut(overrides: Partial<ProfessorOutput> = {}) {
  return {
    answer: "Resposta fundamentada no material.",
    citations: [],
    documents: [],
    chunksUsed: 0,
    tokens: { in: 100, out: 20, total: 120 },
    latencyMs: 50,
    model: "flash" as const,
    confidence: 0.8,
    ...overrides,
  };
}

interface ChatResultShape {
  sessionId: string;
  messageId: string;
  response: string;
  model: "flash" | "pro";
  tokensIn: number;
  tokensOut: number;
  totalTokens: number;
  costBRL: number;
  latencyMs: number;
}

function chatRes(overrides: Partial<ChatResultShape> = {}): ChatResultShape {
  return {
    sessionId: "s1",
    messageId: "m1",
    response: "Resposta direta do chat.",
    model: "flash",
    tokensIn: 10,
    tokensOut: 5,
    totalTokens: 15,
    costBRL: 0.001,
    latencyMs: 20,
    ...overrides,
  };
}

describe("defaultResolveIntent (heurística)", () => {
  it("usa RAG quando há subjectId", () => {
    expect(defaultResolveIntent({ message: "O que é X?", subjectId: "s1" })).toBe("rag");
  });

  it("usa RAG quando há documentIds", () => {
    expect(defaultResolveIntent({ message: "O que é X?", documentIds: ["d1"] })).toBe("rag");
  });

  it("usa RAG quando a pergunta cita 'material'", () => {
    expect(defaultResolveIntent({ message: "No meu material, o que diz sobre X?" })).toBe("rag");
  });

  it("usa RAG quando a pergunta cita 'edital'", () => {
    expect(defaultResolveIntent({ message: "O que cai no edital?" })).toBe("rag");
  });

  it("usa RAG quando a pergunta cita 'lei'/'art.'", () => {
    expect(defaultResolveIntent({ message: "O que diz o art. 5º da lei?" })).toBe("rag");
  });

  it("usa chat para pergunta simples sem sinal de material", () => {
    expect(defaultResolveIntent({ message: "Explique o que é a Constituição." })).toBe("chat");
  });
});

describe("ProfessorService — validação e limites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkLimit.mockResolvedValue({ canSend: true });
    route.mockReturnValue("flash");
    estimateCost.mockReturnValue(0.01);
    send.mockResolvedValue(chatRes());
  });

  it("lança EMPTY_QUESTION para pergunta vazia", async () => {
    await expect(
      makeService().ask({ message: "   ", userId: "u1" })
    ).rejects.toMatchObject({ code: "EMPTY_QUESTION" });
  });

  it("lança LIMIT_EXCEEDED quando limite de mensagens é atingido", async () => {
    checkLimit.mockResolvedValue({ canSend: false });
    await expect(
      makeService().ask({ message: "Oi", userId: "u1" })
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
  });

  it("não executa engines quando o limite é excedido", async () => {
    checkLimit.mockResolvedValue({ canSend: false });
    await makeService().ask({ message: "Oi", userId: "u1" }).catch(() => {});
    expect(answer).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  it("usa o limite custom injetado no checkLimit", async () => {
    await makeService().ask({ message: "Oi", userId: "u1" });
    expect(checkLimit).toHaveBeenCalledWith("u1", { maxMessages: 10, maxTokens: 1000 });
  });
});

describe("ProfessorService — path chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkLimit.mockResolvedValue({ canSend: true });
    route.mockReturnValue("flash");
    estimateCost.mockReturnValue(0.01);
    send.mockResolvedValue(chatRes());
  });

  it("pergunta simples (modo auto) usa chat", async () => {
    const out = await makeService().ask({
      message: "Explique o que é a Constituição.",
      userId: "u1",
    });
    expect(out.mode).toBe("chat");
    expect(send).toHaveBeenCalledTimes(1);
    expect(answer).not.toHaveBeenCalled();
  });

  it("modo explícito 'chat' força chat mesmo com subjectId", async () => {
    await makeService().ask({
      message: "Pergunta contextual.",
      userId: "u1",
      subjectId: "s1",
      mode: "chat",
    });
    expect(send).toHaveBeenCalledTimes(1);
    expect(answer).not.toHaveBeenCalled();
  });

  it("path chat retorna resposta, tokens, custo, confidence 0 e sem citações", async () => {
    const out = await makeService().ask({ message: "Oi", userId: "u1" });
    expect(out.answer).toBe("Resposta direta do chat.");
    expect(out.mode).toBe("chat");
    expect(out.tokens).toEqual({ in: 10, out: 5, total: 15 });
    expect(out.costBRL).toBe(0.001);
    expect(out.confidence).toBe(0);
    expect(out.citations).toEqual([]);
    expect(out.chunksUsed).toBe(0);
  });

  it("path chat repassa modelo roteado ao ChatService", async () => {
    route.mockReturnValue("pro");
    await makeService().ask({ message: "Oi", userId: "u1" });
    expect(route).toHaveBeenCalledWith({ requested: undefined });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ model: "pro" }));
  });

  it("path chat repassa sessionId ao ChatService", async () => {
    await makeService().ask({ message: "Oi", userId: "u1", sessionId: "s9" });
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ sessionId: "s9" }));
  });

  it("path chat NÃO registra usage (ChatService já registra internamente)", async () => {
    await makeService().ask({ message: "Oi", userId: "u1" });
    expect(record).not.toHaveBeenCalled();
  });

  it("propaga erro do provider no path chat", async () => {
    send.mockRejectedValue(new Error("DeepSeek offline"));
    await expect(
      makeService().ask({ message: "Oi", userId: "u1" })
    ).rejects.toThrow("DeepSeek offline");
  });
});

describe("ProfessorService — path RAG", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkLimit.mockResolvedValue({ canSend: true });
    route.mockReturnValue("flash");
    estimateCost.mockReturnValue(0.01);
    answer.mockResolvedValue(ragOut());
  });

  it("pergunta contextual (subjectId) usa RAG", async () => {
    const out = await makeService().ask({
      message: "O que diz sobre X?",
      userId: "u1",
      subjectId: "s1",
    });
    expect(out.mode).toBe("rag");
    expect(answer).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("pergunta que cita 'material' (modo auto) usa RAG", async () => {
    const out = await makeService().ask({
      message: "No meu material, o que diz sobre X?",
      userId: "u1",
    });
    expect(out.mode).toBe("rag");
  });

  it("modo explícito 'rag' força RAG mesmo sem contexto", async () => {
    await makeService().ask({ message: "Pergunta simples", userId: "u1", mode: "rag" });
    expect(answer).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("path RAG repassa subjectId, documentIds e topK ao RagService", async () => {
    await makeService().ask({
      message: "q",
      userId: "u1",
      subjectId: "s1",
      documentIds: ["d1", "d2"],
      topK: 7,
    });
    expect(answer).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: "s1",
        documentIds: ["d1", "d2"],
        topK: 7,
        question: "q",
        userId: "u1",
      })
    );
  });

  it("path RAG repassa modelo roteado ao RagService", async () => {
    route.mockReturnValue("pro");
    await makeService().ask({ message: "q", userId: "u1", mode: "rag" });
    expect(answer).toHaveBeenCalledWith(expect.objectContaining({ model: "pro" }));
  });

  it("path RAG retorna resposta, citações, documents, chunksUsed e confidence", async () => {
    answer.mockResolvedValue(
      ragOut({
        citations: [
          {
            documentId: "d1",
            documentTitle: "Doc.pdf",
            chunkId: "c1",
            score: 0.9,
            subject: "Direito",
            topic: null,
          },
        ],
        documents: ["d1"],
        chunksUsed: 1,
        confidence: 0.9,
      })
    );
    const out = await makeService().ask({ message: "q", userId: "u1", mode: "rag" });
    expect(out.mode).toBe("rag");
    expect(out.citations).toHaveLength(1);
    expect(out.citations[0].documentTitle).toBe("Doc.pdf");
    expect(out.documents).toEqual(["d1"]);
    expect(out.chunksUsed).toBe(1);
    expect(out.confidence).toBe(0.9);
  });

  it("path RAG registra usage quando há tokens consumidos", async () => {
    answer.mockResolvedValue(ragOut({ tokens: { in: 100, out: 20, total: 120 } }));
    await makeService().ask({ message: "q", userId: "u1", mode: "rag" });
    expect(record).toHaveBeenCalledWith("u1", 100, 20);
  });

  it("path RAG NÃO registra usage no fallback sem tokens (pergunta sem contexto)", async () => {
    answer.mockResolvedValue(
      ragOut({ tokens: { in: 0, out: 0, total: 0 }, chunksUsed: 0, confidence: 0 })
    );
    await makeService().ask({ message: "q", userId: "u1", mode: "rag" });
    expect(record).not.toHaveBeenCalled();
  });

  it("pergunta sem contexto retorna fallback com confidence 0 e sem citações", async () => {
    answer.mockResolvedValue(
      ragOut({
        answer: "Não encontrei material suficiente...",
        citations: [],
        documents: [],
        chunksUsed: 0,
        confidence: 0,
      })
    );
    const out = await makeService().ask({ message: "q", userId: "u1", mode: "rag" });
    expect(out.answer).toContain("Não encontrei material");
    expect(out.confidence).toBe(0);
    expect(out.chunksUsed).toBe(0);
  });

  it("propaga erro do provider no path RAG", async () => {
    answer.mockRejectedValue(new Error("Provider falhou"));
    await expect(
      makeService().ask({ message: "q", userId: "u1", mode: "rag" })
    ).rejects.toThrow("Provider falhou");
  });
});

describe("ProfessorService — timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkLimit.mockResolvedValue({ canSend: true });
    route.mockReturnValue("flash");
  });

  it("lança TIMEOUT quando o path RAG excede o tempo", async () => {
    answer.mockImplementation(() => new Promise(() => {}));
    await expect(
      makeService().ask({ message: "q", userId: "u1", mode: "rag", timeoutMs: 20 })
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("lança TIMEOUT quando o path chat excede o tempo", async () => {
    send.mockImplementation(() => new Promise(() => {}));
    await expect(
      makeService().ask({ message: "q", userId: "u1", timeoutMs: 20 })
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("ProfessorService — modelo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    checkLimit.mockResolvedValue({ canSend: true });
    route.mockReturnValue("flash");
    estimateCost.mockReturnValue(0.01);
  });

  it("usa flash como default", async () => {
    send.mockResolvedValue(chatRes());
    await makeService().ask({ message: "Oi", userId: "u1" });
    expect(route).toHaveBeenCalledWith({ requested: undefined });
  });

  it("modelo pro quando solicitado", async () => {
    send.mockResolvedValue(chatRes({ model: "pro" }));
    route.mockReturnValue("pro");
    const out = await makeService().ask({ message: "Q complexa", userId: "u1", model: "pro" });
    expect(route).toHaveBeenCalledWith({ requested: "pro" });
    expect(out.model).toBe("pro");
  });

  it("propaga erro de roteamento (modelo inválido)", async () => {
    route.mockImplementation(() => {
      throw new Error("Modelo inválido. Use flash ou pro.");
    });
    await expect(
      makeService().ask({ message: "Oi", userId: "u1" })
    ).rejects.toThrow("Modelo inválido");
  });

  it("retorna latencyMs não negativa", async () => {
    send.mockResolvedValue(chatRes());
    const out = await makeService().ask({ message: "Oi", userId: "u1" });
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("resolveIntent injetado é usado no modo auto", async () => {
    const custom = vi.fn(() => "rag" as const);
    send.mockResolvedValue(chatRes());
    answer.mockResolvedValue(ragOut());
    const out = await makeService({ resolveIntent: custom }).ask({
      message: "Qualquer coisa",
      userId: "u1",
    });
    expect(custom).toHaveBeenCalled();
    expect(out.mode).toBe("rag");
  });
});

describe("ProfessorError", () => {
  it("carrega código e mensagem", () => {
    const err = new ProfessorError("TIMEOUT", "demorou");
    expect(err.name).toBe("ProfessorError");
    expect(err.code).toBe("TIMEOUT");
    expect(err.message).toBe("demorou");
  });
});
