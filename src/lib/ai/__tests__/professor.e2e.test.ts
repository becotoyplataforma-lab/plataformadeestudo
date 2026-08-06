/**
 * FASE 15 — Testes End-to-End do pipeline Professor IA.
 *
 * Integra os serviços REAIS (ProfessorService → RagService/ChatService →
 * PromptService → ModelRouterService → DeepSeekProvider → UsageService) mockando
 * apenas as fronteiras externas: HTTP DeepSeek (chatCompletion), repositórios
 * (DB) e busca vetorial (HybridSearchService).
 *
 * Valida a integração sem duplicação e expõe as métricas de performance
 * (tempo de busca, tempo do provider, tempo do RAG, tempo total, tokens, custo)
 * e os logs estruturados (professor/rag/hybrid-search/deepseek/usage).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ============================================================
// Fronteiras mockadas (HTTP, DB, busca vetorial)
// ============================================================

const mockChatCompletion = vi.fn();
vi.mock("@/lib/ai/deepseek", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/deepseek")>();
  return {
    ...actual,
    chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  };
});

const mockFindUsage = vi.fn();
const mockIncrement = vi.fn();
vi.mock("../repositories/usage.repository", () => ({
  UsageRepository: {
    findByUserAndDay: (...args: unknown[]) => mockFindUsage(...args),
    increment: (...args: unknown[]) => mockIncrement(...args),
  },
}));

const mockFindSession = vi.fn();
const mockCreateSession = vi.fn();
const mockTouch = vi.fn();
const mockCreateMessage = vi.fn();
const mockGetRecent = vi.fn();
vi.mock("../repositories/chat.repository", () => ({
  ChatRepository: {
    findSessionById: (...args: unknown[]) => mockFindSession(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    touchSession: (...args: unknown[]) => mockTouch(...args),
    createMessage: (...args: unknown[]) => mockCreateMessage(...args),
    getRecentContext: (...args: unknown[]) => mockGetRecent(...args),
  },
}));

const mockSearch = vi.fn();
vi.mock("@/lib/knowledge/services/hybrid-search.service", () => ({
  HybridSearchService: { search: (...args: unknown[]) => mockSearch(...args) },
}));

// ============================================================
// Serviços REAIS
// ============================================================

import { ProfessorService, defaultResolveIntent } from "../services/professor.service";
import { RagService } from "../services/rag.service";
import { ChatService } from "../services/chat.service";
import { PromptService } from "../services/prompt.service";
import { DeepSeekProvider, ProviderError } from "../services/deepseek-provider.service";
import { ModelRouterService } from "../services/model-router.service";
import { UsageService } from "../services/usage.service";
import { HybridSearchService } from "@/lib/knowledge/services/hybrid-search.service";

function buildRag(): RagService {
  return new RagService({
    search: HybridSearchService,
    prompt: PromptService,
    provider: DeepSeekProvider,
    router: ModelRouterService,
  });
}

function buildProfessor(rag: RagService = buildRag()): ProfessorService {
  return new ProfessorService({
    rag,
    chat: ChatService,
    usage: UsageService,
    router: ModelRouterService,
    resolveIntent: defaultResolveIntent,
  });
}

// ============================================================
// Helpers
// ============================================================

function searchChunk(overrides: Record<string, unknown> = {}) {
  return {
    chunkId: "c1",
    documentId: "d1",
    documentTitle: "CF88.pdf",
    content: "Art. 5º — todos são iguais perante a lei.",
    score: 0.85,
    vectorScore: 0.9,
    ftsScore: 0.6,
    subjectName: "Direito Constitucional",
    ...overrides,
  };
}

function searchOutput(results: ReturnType<typeof searchChunk>[] = [], queryTimeMs = 5) {
  return { results, totalHits: results.length, queryTimeMs };
}

function collectLogScopes(): string[] {
  const logs = vi.mocked(console.log).mock.calls
    .map((call) => String(call[0]))
    .filter((line) => line.startsWith("{"))
    .map((line) => {
      try {
        return JSON.parse(line) as { scope?: string };
      } catch {
        return { scope: undefined };
      }
    })
    .map((e) => e.scope)
    .filter((s): s is string => Boolean(s));
  return logs;
}

// ============================================================
// Setup padrão
// ============================================================

beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();

  mockFindUsage.mockResolvedValue(null); // dia novo → pode enviar
  mockIncrement.mockResolvedValue({
    id: "u1",
    userId: "u1",
    usageDate: new Date(),
    messagesCount: 1,
    tokensIn: 0,
    tokensOut: 0,
    updatedAt: new Date(),
  });

  mockChatCompletion.mockResolvedValue({
    content: "Resposta do assistente.",
    model: "flash",
    tokensIn: 100,
    tokensOut: 20,
  });

  mockCreateSession.mockResolvedValue({
    id: "s1",
    userId: "u1",
    title: "T",
    knowledgeSubjectId: null,
    model: "flash",
  });
  mockGetRecent.mockResolvedValue([]);
  mockCreateMessage.mockResolvedValue({ id: "m1" });
});

describe("E2E — fluxo chat (pergunta simples)", () => {
  it("pergunta simples (auto) usa chat e retorna resposta real", async () => {
    const professor = buildProfessor();
    const out = await professor.ask({
      message: "Explique o que é a Constituição.",
      userId: "u1",
    });
    expect(out.mode).toBe("chat");
    expect(out.answer).toBe("Resposta do assistente.");
    expect(mockChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("resposta sem citações no chat", async () => {
    const out = await buildProfessor().ask({
      message: "Explique o que é a Constituição.",
      userId: "u1",
    });
    expect(out.citations).toEqual([]);
    expect(out.documents).toEqual([]);
    expect(out.chunksUsed).toBe(0);
    expect(out.confidence).toBe(0);
  });

  it("fluxo chat cria sessão e persiste mensagens (user + assistant)", async () => {
    await buildProfessor().ask({
      message: "Oi",
      userId: "u1",
    });
    expect(mockCreateSession).toHaveBeenCalledTimes(1);
    expect(mockCreateMessage).toHaveBeenCalledTimes(2);
    const userMsg = mockCreateMessage.mock.calls[0][0];
    const assistantMsg = mockCreateMessage.mock.calls[1][0];
    expect(userMsg.role).toBe("user");
    expect(assistantMsg.role).toBe("assistant");
  });

  it("chat usa PromptService real (system + user no chatCompletion)", async () => {
    await buildProfessor().ask({ message: "Oi", userId: "u1" });
    const req = mockChatCompletion.mock.calls[0][0];
    expect(req.messages[0].role).toBe("system");
    expect(req.messages.at(-1).role).toBe("user");
    expect(req.messages.at(-1).content).toBe("Oi");
  });

  it("fluxo chat registra usage via ChatService", async () => {
    await buildProfessor().ask({ message: "Oi", userId: "u1" });
    expect(mockIncrement).toHaveBeenCalledTimes(1);
  });
});

describe("E2E — fluxo RAG (pergunta contextual)", () => {
  it("pergunta contextual (subjectId) usa RAG com resposta real", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    const out = await buildProfessor().ask({
      message: "O que diz sobre igualdade?",
      userId: "u1",
      subjectId: "s1",
    });
    expect(out.mode).toBe("rag");
    expect(out.answer).toBe("Resposta do assistente.");
    expect(mockSearch).toHaveBeenCalledTimes(1);
    expect(mockChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("resposta com citações (documentId, title, chunkId, score)", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    const out = await buildProfessor().ask({
      message: "O que diz sobre igualdade?",
      userId: "u1",
      mode: "rag",
    });
    expect(out.citations).toHaveLength(1);
    const c = out.citations[0];
    expect(c.documentId).toBe("d1");
    expect(c.documentTitle).toBe("CF88.pdf");
    expect(c.chunkId).toBe("c1");
    expect(c.score).toBeCloseTo(0.85);
    expect(c.subject).toBe("Direito Constitucional");
  });

  it("múltiplos chunks → múltiplas citações e documents únicos", async () => {
    mockSearch.mockResolvedValue(
      searchOutput([
        searchChunk({ chunkId: "c1", documentId: "d1", documentTitle: "A.pdf" }),
        searchChunk({ chunkId: "c2", documentId: "d2", documentTitle: "B.pdf" }),
        searchChunk({ chunkId: "c3", documentId: "d1", documentTitle: "A.pdf" }),
      ])
    );
    const out = await buildProfessor().ask({
      message: "múltiplos chunks",
      userId: "u1",
      mode: "rag",
    });
    expect(out.citations).toHaveLength(3);
    expect(out.documents).toEqual(["d1", "d2"]);
    expect(out.chunksUsed).toBe(3);
  });

  it("múltiplos chunks → contexto numerado com títulos no prompt", async () => {
    mockSearch.mockResolvedValue(
      searchOutput([
        searchChunk({ chunkId: "c1", documentTitle: "A.pdf", content: "conteúdo A" }),
        searchChunk({ chunkId: "c2", documentTitle: "B.pdf", content: "conteúdo B" }),
      ])
    );
    await buildProfessor().ask({ message: "q", userId: "u1", mode: "rag" });
    const req = mockChatCompletion.mock.calls[0][0];
    const userMsg = String(req.messages.at(-1).content);
    expect(userMsg).toContain("[1]");
    expect(userMsg).toContain("A.pdf");
    expect(userMsg).toContain("conteúdo A");
    expect(userMsg).toContain("[2]");
    expect(userMsg).toContain("B.pdf");
  });

  it("subjectName é usado no system prompt", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    await buildProfessor().ask({ message: "q", userId: "u1", mode: "rag" });
    const req = mockChatCompletion.mock.calls[0][0];
    expect(String(req.messages[0].content)).toContain("Direito Constitucional");
  });

  it("RAG registra usage com tokens", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    await buildProfessor().ask({ message: "q", userId: "u1", mode: "rag" });
    expect(mockIncrement).toHaveBeenCalledTimes(1);
    expect(mockIncrement.mock.calls[0]).toEqual(
      expect.arrayContaining([expect.any(Date), 100, 20])
    );
  });

  it("RAG não duplica o fluxo (não cria sessão de chat)", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    await buildProfessor().ask({ message: "q", userId: "u1", mode: "rag" });
    expect(mockCreateSession).not.toHaveBeenCalled();
    expect(mockChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("exposição de métricas no output RAG (busca, provider, total, tokens)", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()], 4));
    const out = await buildProfessor().ask({
      message: "q",
      userId: "u1",
      mode: "rag",
    });
    expect(out.tokens.total).toBeGreaterThan(0);
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
    const rag = buildRag();
    const ragOut = await rag.answer({ question: "q", userId: "u1" });
    expect(ragOut.searchTimeMs).toBe(4);
    expect(ragOut.providerTimeMs).toBeGreaterThanOrEqual(0);
    expect(ragOut.latencyMs).toBeGreaterThanOrEqual(0);
  });
});

describe("E2E — pergunta sem documentos", () => {
  it("busca vazia → fallback sem chamada ao provider", async () => {
    mockSearch.mockResolvedValue(searchOutput([], 2));
    const out = await buildProfessor().ask({
      message: "Pergunta sem contexto",
      userId: "u1",
      mode: "rag",
    });
    expect(out.answer).toContain("Não encontrei material");
    expect(out.chunksUsed).toBe(0);
    expect(out.confidence).toBe(0);
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it("busca vazia → usage NÃO registrado", async () => {
    mockSearch.mockResolvedValue(searchOutput([], 2));
    await buildProfessor().ask({
      message: "Pergunta sem contexto",
      userId: "u1",
      mode: "rag",
    });
    expect(mockIncrement).not.toHaveBeenCalled();
  });
});

describe("E2E — timeout", () => {
  it("timeout no RAG (nível do engine) → RagError TIMEOUT", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    mockChatCompletion.mockImplementation(() => new Promise(() => {}));
    const rag = buildRag();
    await expect(
      rag.answer({ question: "q", userId: "u1", timeoutMs: 20 })
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("timeout no chat (backstop do ProfessorService) → ProfessorError TIMEOUT", async () => {
    mockChatCompletion.mockImplementation(() => new Promise(() => {}));
    await expect(
      buildProfessor().ask({
        message: "Explique X.",
        userId: "u1",
        timeoutMs: 20,
      })
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });
});

describe("E2E — erro do provider", () => {
  it("provider falha no RAG → ProviderError propagado", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    mockChatCompletion.mockRejectedValue(new Error("DeepSeek offline"));
    await expect(
      buildProfessor().ask({ message: "q", userId: "u1", mode: "rag" })
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("provider falha no chat → ProviderError propagado", async () => {
    mockChatCompletion.mockRejectedValue(new Error("DeepSeek offline"));
    await expect(
      buildProfessor().ask({ message: "Oi", userId: "u1" })
    ).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("E2E — limite de uso", () => {
  it("uso cheio → ProfessorError LIMIT_EXCEEDED", async () => {
    mockFindUsage.mockResolvedValue({
      messagesCount: 100,
      tokensIn: 9000,
      tokensOut: 0,
    });
    const professor = new ProfessorService({
      rag: buildRag(),
      chat: ChatService,
      usage: UsageService,
      router: ModelRouterService,
      resolveIntent: defaultResolveIntent,
      limit: { maxMessages: 100, maxTokens: 10000 },
    });
    await expect(
      professor.ask({ message: "Oi", userId: "u1" })
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });
});

describe("E2E — mudança automática de modelo", () => {
  it("sem modelo → flash (default)", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    await buildProfessor().ask({ message: "q", userId: "u1", mode: "rag" });
    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: "flash" })
    );
  });

  it("modelo pro quando solicitado", async () => {
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    await buildProfessor().ask({
      message: "q",
      userId: "u1",
      mode: "rag",
      model: "pro",
    });
    expect(mockChatCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ model: "pro" })
    );
  });
});

describe("E2E — observabilidade (logs estruturados)", () => {
  it("emite logs estruturados para professor/rag/hybrid-search/deepseek/usage", async () => {
    const logSpy = vi.spyOn(console, "log");
    mockSearch.mockResolvedValue(searchOutput([searchChunk()]));
    await buildProfessor().ask({ message: "q", userId: "u1", mode: "rag" });

    const scopes = collectLogScopes();
    for (const expected of [
      "professor",
      "hybrid-search",
      "rag",
      "deepseek",
      "usage",
    ]) {
      expect(scopes).toContain(expected);
    }

    const ragLog = logSpy.mock.calls
      .map((call) => String(call[0]))
      .map((l) => JSON.parse(l) as Record<string, unknown>)
      .find((e) => e.scope === "rag" && e.message === "resposta gerada com contexto");
    expect(ragLog).toBeTruthy();
    expect(ragLog).toHaveProperty("searchTimeMs");
    expect(ragLog).toHaveProperty("providerTimeMs");
  });
});
