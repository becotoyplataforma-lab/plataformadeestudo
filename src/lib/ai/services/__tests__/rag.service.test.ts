/**
 * Testes do RagService (RAG Engine) — dependências injetadas/mockadas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { RagService } from "../rag.service";
import type { RagDependencies } from "../rag.service";

const search = vi.fn();
const buildSystemPrompt = vi.fn();
const buildMessages = vi.fn();
const complete = vi.fn();
const route = vi.fn();

function makeService(): RagService {
  return new RagService({
    search: { search },
    prompt: { buildSystemPrompt, buildMessages },
    provider: { complete },
    router: { route },
  } as unknown as RagDependencies);
}

function chunk(overrides: Partial<Parameters<typeof search>[0]> = {}) {
  return {
    chunkId: "00000000-0000-0000-0000-000000000001",
    documentId: "00000000-0000-0000-0000-000000000002",
    documentTitle: "CF88.pdf",
    content: "Art. 5º todos são iguais perante a lei.",
    score: 0.82,
    vectorScore: 0.9,
    ftsScore: 0.6,
    subjectName: "Direito Constitucional",
    ...overrides,
  };
}

describe("RagService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    route.mockReturnValue("flash");
    buildSystemPrompt.mockResolvedValue("system");
    buildMessages.mockResolvedValue([{ role: "system", content: "system" }]);
    complete.mockResolvedValue({
      content: "Resposta fundamentada.",
      model: "flash",
      tokensIn: 120,
      tokensOut: 30,
    });
  });

  it("lança EMPTY_QUESTION para pergunta vazia", async () => {
    await expect(
      makeService().answer({ question: "   ", userId: "u1" })
    ).rejects.toMatchObject({ code: "EMPTY_QUESTION" });
  });

  it("retorna fallback quando a busca não encontra nada", async () => {
    search.mockResolvedValue({ results: [], totalHits: 0, queryTimeMs: 10 });

    const out = await makeService().answer({ question: "Questão sem docs", userId: "u1" });

    expect(out.citations).toEqual([]);
    expect(out.documents).toEqual([]);
    expect(out.chunksUsed).toBe(0);
    expect(out.confidence).toBe(0);
    expect(out.tokens.total).toBe(0);
    expect(complete).not.toHaveBeenCalled();
    expect(out.answer).toContain("Não encontrei material suficiente");
  });

  it("responde com 1 documento e 1 citação", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });

    const out = await makeService().answer({ question: "O que diz o art 5?", userId: "u1" });

    expect(out.chunksUsed).toBe(1);
    expect(out.citations).toHaveLength(1);
    expect(out.documents).toEqual(["00000000-0000-0000-0000-000000000002"]);
    expect(out.citations[0].documentTitle).toBe("CF88.pdf");
    expect(out.citations[0].subject).toBe("Direito Constitucional");
    expect(out.citations[0].topic).toBeNull(); // nunca inventa tópico
    expect(complete).toHaveBeenCalledTimes(1);
  });

  it("responde com múltiplos documentos (lista única de documents)", async () => {
    search.mockResolvedValue({
      results: [
        chunk({ chunkId: "c1", documentId: "doc-a", documentTitle: "A.pdf" }),
        chunk({ chunkId: "c2", documentId: "doc-b", documentTitle: "B.pdf" }),
        chunk({ chunkId: "c3", documentId: "doc-a", documentTitle: "A.pdf" }),
      ],
      totalHits: 3,
      queryTimeMs: 10,
    });

    const out = await makeService().answer({ question: "múltiplos docs", userId: "u1" });

    expect(out.chunksUsed).toBe(3);
    expect(out.citations).toHaveLength(3);
    expect(out.documents).toEqual(["doc-a", "doc-b"]);
  });

  it("aplica o topK no HybridSearch e respeita limite máximo", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });

    await makeService().answer({ question: "q", userId: "u1", topK: 7 });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 7 })
    );

    search.mockClear();
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });
    await makeService().answer({ question: "q", userId: "u1", topK: 999 });
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 20 })
    );
  });

  it("repassa subject_id como filtro", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });

    await makeService().answer({
      question: "q",
      userId: "u1",
      subjectId: "subj-1",
    });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ subjectId: "subj-1" }),
      })
    );
  });

  it("repassa document_ids como filtro (primeiro)", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });

    await makeService().answer({
      question: "q",
      userId: "u1",
      documentIds: ["doc-1", "doc-2"],
    });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ documentId: "doc-1" }),
      })
    );
  });

  it("repassa positionId como filtro de isolamento", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });

    await makeService().answer({
      question: "q",
      userId: "u1",
      positionId: "pos-A",
    });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ positionId: "pos-A" }),
      })
    );
  });

  it("repassa editalId como filtro de isolamento", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });

    await makeService().answer({
      question: "q",
      userId: "u1",
      editalId: "edital-1",
    });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({ editalId: "edital-1" }),
      })
    );
  });

  it("não envia filtros de isolamento quando ausentes", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });

    await makeService().answer({ question: "q", userId: "u1" });

    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.not.objectContaining({ positionId: expect.anything() }),
      })
    );
    expect(search).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.not.objectContaining({ editalId: expect.anything() }),
      })
    );
  });

  it("propaga erro do provider", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });
    complete.mockRejectedValue(new Error("DeepSeek offline"));

    await expect(
      makeService().answer({ question: "q", userId: "u1" })
    ).rejects.toThrow("DeepSeek offline");
  });

  it("lança TIMEOUT quando o provider demora demais", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 10 });
    // Promise que nunca resolve dentro do timeout
    complete.mockImplementation(() => new Promise(() => {}));

    await expect(
      makeService().answer({ question: "q", userId: "u1", timeoutMs: 20 })
    ).rejects.toMatchObject({ code: "TIMEOUT" });
  });

  it("retorna resposta válida com tokens, modelo, confiança e latência", async () => {
    search.mockResolvedValue({ results: [chunk({ score: 0.8 })], totalHits: 1, queryTimeMs: 5 });
    complete.mockResolvedValue({
      content: "Resposta.",
      model: "pro",
      tokensIn: 200,
      tokensOut: 50,
    });

    const out = await makeService().answer({ question: "q", userId: "u1", model: "pro" });

    expect(out.answer).toBe("Resposta.");
    expect(out.model).toBe("pro");
    expect(out.tokens).toEqual({ in: 200, out: 50, total: 250 });
    expect(out.confidence).toBeCloseTo(0.8);
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
    expect(route).toHaveBeenCalledWith({ requested: "pro" });
  });

  it("confiança é limitada a 0-1", async () => {
    search.mockResolvedValue({ results: [chunk({ score: 3.0 })], totalHits: 1, queryTimeMs: 5 });

    const out = await makeService().answer({ question: "q", userId: "u1" });
    expect(out.confidence).toBe(1);
  });

  it("monta contexto incluindo título e conteúdo do chunk", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 5 });

    await makeService().answer({ question: "q", userId: "u1" });

    const userMessage = buildMessages.mock.calls[0][2] as string;
    expect(userMessage).toContain("CF88.pdf");
    expect(userMessage).toContain("Art. 5º todos são iguais perante a lei.");
    expect(userMessage).toContain("Pergunta do aluno");
  });

  it("usa o subjectName do melhor chunk no system prompt", async () => {
    search.mockResolvedValue({ results: [chunk()], totalHits: 1, queryTimeMs: 5 });

    await makeService().answer({ question: "q", userId: "u1" });

    expect(buildSystemPrompt).toHaveBeenCalledWith(
      expect.objectContaining({ subjectName: "Direito Constitucional" })
    );
  });
});
