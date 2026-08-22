/**
 * Testes do HybridSearchService — escopo da busca FTS por status.
 *
 * Garante que documentos em `chunked` (pipeline sem embeddings) sejam
 * encontrados pela busca textual, e que status incompletos/falhos, soft-deleted
 * e de outros usuários continuem fora.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// db mockado: captura o WHERE da primeira query (documentos) para inspecionar
// os filtros aplicados (userId + deleted_at IS NULL + status IN (...)).
const mockDbSelect = vi.fn();

vi.mock("@/lib/db/drizzle", () => ({
  db: {
    select: (...args: unknown[]) => mockDbSelect(...args),
  },
}));

// Mock do embeddingClient com flag controlável por teste.
// isConfigured() retorna `mockEmbeddingConfigured` (default false → FTS-only).
const mockEmbed = vi.fn();
let mockEmbeddingConfigured = false;
vi.mock("@/lib/knowledge/embedding/client", () => ({
  embeddingClient: {
    isConfigured: () => mockEmbeddingConfigured,
    embed: (...args: unknown[]) => mockEmbed(...args),
    dimension: 1024,
    model: "BAAI/bge-m3",
  },
}));

import { HybridSearchService } from "../hybrid-search.service";

/**
 * Constrói uma query Drizzle mockada (thenable) que resolve para `value`.
 * O Drizzle usa um thenable: o `await` chama `then(onFulfilled, onRejected)`
 * — por isso o mock deve chamar `onFulfilled(value)` e retornar a promise.
 */
function makeQuery<T>(value: T) {
  const chain: Record<string, unknown> = {};
  chain.from = () => chain;
  chain.where = vi.fn(() => chain);
  chain.orderBy = () => chain;
  chain.limit = () => chain;
  chain.innerJoin = () => chain;
  chain.then = (onFulfilled: (v: T) => unknown) => {
    return Promise.resolve(onFulfilled(value));
  };
  return chain;
}

/** Renderiza a condição Drizzle em texto (para inspecionar o WHERE). */
function renderSql(cond: unknown): string {
  if (cond == null) return "";
  if (typeof cond === "string") return cond;
  if (Array.isArray(cond)) return cond.map(renderSql).join(",");
  const c = cond as {
    queryChunks?: unknown[];
    value?: unknown[];
    table?: { name?: string };
    name?: string;
  };
  if (Array.isArray(c.queryChunks)) return c.queryChunks.map(renderSql).join("");
  if (Array.isArray(c.value)) return c.value.join("");
  if (typeof c.value === "string") return c.value;
  if (c.table && c.name) return `"${c.table.name}"."${c.name}"`;
  return String(cond);
}

beforeEach(() => {
  vi.clearAllMocks();
  mockEmbeddingConfigured = false;
  mockEmbed.mockResolvedValue([new Array(1024).fill(0.1)]);
});

describe("HybridSearchService — escopo FTS por status", () => {
  it("permite busca em documento `chunked` (pipeline sem embeddings)", async () => {
    // 4 queries: userDocs → ftsResults → chunk detail → subject lookup
    mockDbSelect
      .mockReturnValueOnce(makeQuery([{ id: "doc-1", title: "Apostila Português.pdf" }]))
      .mockReturnValueOnce(makeQuery([{ chunkId: "chunk-1", documentId: "doc-1", score: 0.42 }]))
      .mockReturnValueOnce(
        makeQuery([
          {
            id: "chunk-1",
            content: "Classes de palavras: substantivo, adjetivo, verbo.",
            metadata: { section_title: "Morfologia" },
          },
        ])
      )
      .mockReturnValueOnce(makeQuery([{ name: "Português" }]));

    const out = await HybridSearchService.search({ query: "substantivo", userId: "u1" });

    expect(out.results).toHaveLength(1);
    expect(out.results[0].documentId).toBe("doc-1");
    expect(out.results[0].documentTitle).toBe("Apostila Português.pdf");
    expect(out.results[0].subjectName).toBe("Português");
    expect(out.results[0].sectionTitle).toBe("Morfologia");
    // vetorial continua desativado (0) e o score vem 100% do FTS
    expect(out.results[0].vectorScore).toBe(0);
    expect(out.results[0].ftsScore).toBeGreaterThan(0);
  });

  it("continua aceitando documento `indexed` (quando houver embeddings futuros)", async () => {
    mockDbSelect
      .mockReturnValueOnce(makeQuery([{ id: "doc-2", title: "CF88.pdf" }]))
      .mockReturnValueOnce(makeQuery([{ chunkId: "chunk-2", documentId: "doc-2", score: 0.5 }]))
      .mockReturnValueOnce(makeQuery([{ id: "chunk-2", content: "Art. 5º...", metadata: {} }]))
      .mockReturnValueOnce(makeQuery([{ name: "Direito Constitucional" }]));

    const out = await HybridSearchService.search({ query: "constituição", userId: "u1" });

    expect(out.results).toHaveLength(1);
    expect(out.results[0].documentId).toBe("doc-2");
  });

  it("usa filtro IN (chunked, indexed) — sem incluir status incompletos", async () => {
    mockDbSelect.mockReturnValueOnce(makeQuery([]));

    const out = await HybridSearchService.search({ query: "qualquer", userId: "u1" });

    expect(out.results).toHaveLength(0);
    expect(out.totalHits).toBe(0);

    // A query de documentos deve usar IN (chunked, indexed)
    const firstQuery = mockDbSelect.mock.results[0]?.value as { where?: unknown };
    const whereSpy = (firstQuery?.where as unknown as { mock?: { calls: unknown[][] } })?.mock;
    const sqlText = whereSpy?.calls?.[0]?.[0] ? renderSql(whereSpy.calls[0][0]) : "";
    expect(sqlText).toContain('"status" in chunked,indexed');
    expect(sqlText).not.toContain("pending");
    expect(sqlText).not.toContain("failed");
  });

  it("retorna vazio quando o documento é de OUTRO usuário", async () => {
    mockDbSelect.mockReturnValueOnce(makeQuery([]));

    const out = await HybridSearchService.search({ query: "qualquer", userId: "u2" });

    expect(out.results).toHaveLength(0);

    const firstQuery = mockDbSelect.mock.results[0]?.value as { where?: unknown };
    const whereSpy = (firstQuery?.where as unknown as { mock?: { calls: unknown[][] } })?.mock;
    const sqlText = whereSpy?.calls?.[0]?.[0] ? renderSql(whereSpy.calls[0][0]) : "";
    expect(sqlText).toContain('"user_id" = u2');
  });

  it("filtra documentos soft-deleted (deleted_at IS NULL)", async () => {
    mockDbSelect.mockReturnValueOnce(makeQuery([]));

    const out = await HybridSearchService.search({ query: "qualquer", userId: "u1" });

    expect(out.results).toHaveLength(0);

    const firstQuery = mockDbSelect.mock.results[0]?.value as { where?: unknown };
    const whereSpy = (firstQuery?.where as unknown as { mock?: { calls: unknown[][] } })?.mock;
    const sqlText = whereSpy?.calls?.[0]?.[0] ? renderSql(whereSpy.calls[0][0]) : "";
    expect(sqlText).toContain("deleted_at");
    expect(sqlText).toContain("is null");
  });

  it("retorna vazio para query vazia (sem tocar no banco)", async () => {
    const out = await HybridSearchService.search({ query: "   ", userId: "u1" });
    expect(out.results).toHaveLength(0);
    expect(out.totalHits).toBe(0);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});

describe("HybridSearchService — isolamento por curso/cargo/edital", () => {
  it("aplica filtro positionId no WHERE quando informado", async () => {
    mockDbSelect.mockReturnValueOnce(makeQuery([]));

    const out = await HybridSearchService.search({
      query: "qualquer",
      userId: "u1",
      filters: { positionId: "pos-A" },
    });

    expect(out.results).toHaveLength(0);

    const firstQuery = mockDbSelect.mock.results[0]?.value as { where?: unknown };
    const whereSpy = (firstQuery?.where as unknown as { mock?: { calls: unknown[][] } })?.mock;
    const sqlText = whereSpy?.calls?.[0]?.[0] ? renderSql(whereSpy.calls[0][0]) : "";
    expect(sqlText).toContain('"position_id" = pos-A');
  });

  it("aplica filtro editalId no WHERE quando informado", async () => {
    mockDbSelect.mockReturnValueOnce(makeQuery([]));

    const out = await HybridSearchService.search({
      query: "qualquer",
      userId: "u1",
      filters: { editalId: "edital-1" },
    });

    expect(out.results).toHaveLength(0);

    const firstQuery = mockDbSelect.mock.results[0]?.value as { where?: unknown };
    const whereSpy = (firstQuery?.where as unknown as { mock?: { calls: unknown[][] } })?.mock;
    const sqlText = whereSpy?.calls?.[0]?.[0] ? renderSql(whereSpy.calls[0][0]) : "";
    expect(sqlText).toContain('"edital_id" = edital-1');
  });

  it("usuário com positionId A encontra documento positionId A", async () => {
    mockDbSelect
      .mockReturnValueOnce(makeQuery([{ id: "doc-A", title: "Apostila PMERJ.pdf" }]))
      .mockReturnValueOnce(makeQuery([{ chunkId: "chunk-A", documentId: "doc-A", score: 0.4 }]))
      .mockReturnValueOnce(
        makeQuery([{ id: "chunk-A", content: "Conteúdo do curso A.", metadata: {} }])
      )
      .mockReturnValueOnce(makeQuery([{ name: "Português" }]));

    const out = await HybridSearchService.search({
      query: "conteúdo",
      userId: "u1",
      filters: { positionId: "pos-A" },
    });

    expect(out.results).toHaveLength(1);
    expect(out.results[0].documentId).toBe("doc-A");
  });

  it("usuário com positionId A NÃO encontra documento positionId B", async () => {
    // A query de documentos com filtro positionId=A retorna vazio (o doc B não passa)
    mockDbSelect.mockReturnValueOnce(makeQuery([]));

    const out = await HybridSearchService.search({
      query: "conteúdo",
      userId: "u1",
      filters: { positionId: "pos-A" },
    });

    expect(out.results).toHaveLength(0);
    expect(out.totalHits).toBe(0);
  });

  it("documento sem positionId não aparece quando o filtro por positionId está ativo", async () => {
    // Documento sem position_id (NULL) não passa no filtro positionId=A
    mockDbSelect.mockReturnValueOnce(makeQuery([]));

    const out = await HybridSearchService.search({
      query: "conteúdo",
      userId: "u1",
      filters: { positionId: "pos-A" },
    });

    expect(out.results).toHaveLength(0);

    const firstQuery = mockDbSelect.mock.results[0]?.value as { where?: unknown };
    const whereSpy = (firstQuery?.where as unknown as { mock?: { calls: unknown[][] } })?.mock;
    const sqlText = whereSpy?.calls?.[0]?.[0] ? renderSql(whereSpy.calls[0][0]) : "";
    expect(sqlText).toContain('"position_id" = pos-A');
  });

  it("sem filtro de curso mantém comportamento anterior (sem position_id/edital_id no WHERE)", async () => {
    mockDbSelect.mockReturnValueOnce(makeQuery([]));

    const out = await HybridSearchService.search({ query: "qualquer", userId: "u1" });

    expect(out.results).toHaveLength(0);

    const firstQuery = mockDbSelect.mock.results[0]?.value as { where?: unknown };
    const whereSpy = (firstQuery?.where as unknown as { mock?: { calls: unknown[][] } })?.mock;
    const sqlText = whereSpy?.calls?.[0]?.[0] ? renderSql(whereSpy.calls[0][0]) : "";
    expect(sqlText).not.toContain("position_id");
    expect(sqlText).not.toContain("edital_id");
  });
});

describe("HybridSearchService — busca vetorial (pgvector)", () => {
  beforeEach(() => {
    mockEmbeddingConfigured = true;
  });

  it("usa busca vetorial quando embeddings existem e EMBEDDING_API_URL configurado", async () => {
    // Queries: userDocs → ftsResults → hasEmbeddings → vectorResults → chunk detail → subject
    mockDbSelect
      .mockReturnValueOnce(makeQuery([{ id: "doc-1", title: "Apostila.pdf" }]))
      .mockReturnValueOnce(makeQuery([{ chunkId: "chunk-1", documentId: "doc-1", score: 0.3 }]))
      .mockReturnValueOnce(makeQuery([{ count: 5 }])) // hasEmbeddings > 0
      .mockReturnValueOnce(
        makeQuery([{ chunkId: "chunk-1", documentId: "doc-1", score: 0.9 }])
      )
      .mockReturnValueOnce(
        makeQuery([{ id: "chunk-1", content: "Conteúdo relevante.", metadata: {} }])
      )
      .mockReturnValueOnce(makeQuery([{ name: "Português" }]));

    const out = await HybridSearchService.search({ query: "relevante", userId: "u1" });

    expect(out.vectorSearchEnabled).toBe(true);
    expect(out.results).toHaveLength(1);
    expect(out.results[0].vectorScore).toBe(0.9);
    expect(mockEmbed).toHaveBeenCalledTimes(1);
  });

  it("cai para FTS-only quando não há embeddings para os documentos", async () => {
    // Queries: userDocs → ftsResults → hasEmbeddings (count 0)
    mockDbSelect
      .mockReturnValueOnce(makeQuery([{ id: "doc-1", title: "Apostila.pdf" }]))
      .mockReturnValueOnce(makeQuery([{ chunkId: "chunk-1", documentId: "doc-1", score: 0.3 }]))
      .mockReturnValueOnce(makeQuery([{ count: 0 }])) // hasEmbeddings = 0
      .mockReturnValueOnce(
        makeQuery([{ id: "chunk-1", content: "Conteúdo.", metadata: {} }])
      )
      .mockReturnValueOnce(makeQuery([{ name: "Português" }]));

    const out = await HybridSearchService.search({ query: "conteúdo", userId: "u1" });

    expect(out.vectorSearchEnabled).toBe(false);
    expect(out.results).toHaveLength(1);
    expect(out.results[0].vectorScore).toBe(0);
    expect(mockEmbed).not.toHaveBeenCalled();
  });
});
