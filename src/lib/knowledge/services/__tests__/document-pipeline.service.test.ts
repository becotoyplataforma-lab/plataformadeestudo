/**
 * Testes do DocumentPipelineService.
 *
 * O que se trava aqui e o contrato observavel pelo operador:
 *   - a pagina do PDF vira fronteira real para o chunk (metadata.page);
 *   - estado so afirma o que de fato aconteceu (nada de indexed sem vetor);
 *   - falha de um documento fica registrada sem apagar os dados dos outros.
 * Storage, extracao, chunking e embeddings sao mockados: nenhum banco e nenhum
 * servico externo e tocado aqui.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindById = vi.fn();
const mockUpdatePipeline = vi.fn();
const mockUpdateMetadata = vi.fn();
const mockUpdateStatus = vi.fn();
vi.mock("../../repositories/document.repository", () => ({
  DocumentRepository: {
    findById: (...a: unknown[]) => mockFindById(...a),
    updatePipeline: (...a: unknown[]) => mockUpdatePipeline(...a),
    updateMetadata: (...a: unknown[]) => mockUpdateMetadata(...a),
    updateStatus: (...a: unknown[]) => mockUpdateStatus(...a),
  },
}));

const mockDownload = vi.fn();
vi.mock("../../storage.service", () => ({
  DocumentStorageService: { download: (...a: unknown[]) => mockDownload(...a) },
}));

const mockExtract = vi.fn();
// A classe real de erro vem do modulo original: o pipeline decide o status
// final por instanceof, e mockar a classe quebraria justamente essa decisao.
vi.mock("../extraction.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../extraction.service")>();
  return {
    ...actual,
    DocumentExtractionService: {
      extract: (...a: unknown[]) => mockExtract(...a),
    },
  };
});

const mockChunk = vi.fn();
vi.mock("../chunk.service", () => ({
  ChunkService: {
    chunk: (...a: unknown[]) => mockChunk(...a),
  },
}));

const mockEmbedDocument = vi.fn();
vi.mock("../embedding.service", () => ({
  EmbeddingService: {
    embedDocument: (...a: unknown[]) => mockEmbedDocument(...a),
  },
}));

const mockIsConfigured = vi.fn();
vi.mock("../../embedding/client", () => ({
  embeddingClient: { isConfigured: () => mockIsConfigured() },
}));

import { DocumentPipelineService, PipelineError } from "../document-pipeline.service";
import { ExtractionError } from "../extraction.service";
import type { PageRange } from "../chunk.service";

function docRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "doc-1",
    type: "pdf",
    mimeType: "application/pdf",
    storagePath: "user/doc-1/aula.pdf",
    storageBackend: "supabase",
    status: "pending",
    metadata: null,
    ...overrides,
  };
}

function lastPipelinePatch() {
  const calls = mockUpdatePipeline.mock.calls;
  return calls[calls.length - 1][1] as Record<string, unknown>;
}

function chunkInput() {
  return mockChunk.mock.calls[0][0] as {
    text: string;
    pageRanges?: PageRange[];
  };
}

describe("DocumentPipelineService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdatePipeline.mockResolvedValue({});
    mockUpdateMetadata.mockResolvedValue({});
    mockUpdateStatus.mockResolvedValue({});
    mockChunk.mockResolvedValue({ chunkCount: 3, strategy: "fixed" });
    mockFindById.mockResolvedValue(docRow());
    mockDownload.mockResolvedValue(Buffer.from("bytes", "utf8"));
    mockIsConfigured.mockReturnValue(false);
  });

  it("transforma as paginas do PDF em fronteiras para o chunker", async () => {
    const p1 = ("UM ").repeat(25);
    const p2 = ("DOIS ").repeat(20);
    mockExtract.mockResolvedValue({
      text: p1 + String.fromCharCode(10, 10) + p2,
      pageCount: 2,
      pages: [p1, p2],
    });

    await DocumentPipelineService.processDocument("doc-1");

    const ranges = chunkInput().pageRanges as PageRange[];
    expect(ranges).toHaveLength(2);
    // 75 e 100 caracteres com espaco no fim; a normalizacao corta a borda,
    // entao a fronteira da pagina seguinte comeca depois do separador.
    expect(ranges[0]).toEqual({ page: 1, start: 0, end: 74 });
    expect(ranges[1]).toEqual({ page: 2, start: 76, end: 175 });
    expect(lastPipelinePatch().pageCount).toBe(2);
    expect(lastPipelinePatch().status).toBe("chunked");
  });

  it("normaliza pagina a pagina, preservando o conteudo de cada uma", async () => {
    const pageOne = "Alpha  \n\n\n\nPRIMEIRA " + "x".repeat(40);
    const pageTwo = "Beta\r\nSEGUNDA " + "y".repeat(40);
    mockExtract.mockResolvedValue({
      text: "nada disso e usado: o pipeline recalcula a partir de pages",
      pageCount: 2,
      pages: [pageOne, pageTwo],
    });

    await DocumentPipelineService.processDocument("doc-1");

    const input = chunkInput();
    const ranges2 = input.pageRanges as PageRange[];
    expect(ranges2).toHaveLength(2);
    expect(input.text.slice(ranges2[0].start, ranges2[0].end)).toBe(
      "Alpha" + String.fromCharCode(10, 10) + "PRIMEIRA " + "x".repeat(40)
    );
    expect(input.text.slice(ranges2[1].start, ranges2[1].end)).toBe(
      "Beta" + String.fromCharCode(10) + "SEGUNDA " + "y".repeat(40)
    );
    expect(input.text).not.toContain(String.fromCharCode(13));
  });

  it("documento sem pagina nao recebe fronteira nenhuma", async () => {
    mockExtract.mockResolvedValue({ text: "apostila em texto puro", pageCount: undefined });
    await DocumentPipelineService.processDocument("doc-1");
    expect(chunkInput().pageRanges).toBeUndefined();
    expect(lastPipelinePatch().pageCount).toBeNull();
  });

  it("sem servico de embeddings termina em chunked, nunca em indexed", async () => {
    mockExtract.mockResolvedValue({ text: "conteudo real de apostila", pageCount: 1 });
    mockIsConfigured.mockReturnValue(false);

    const result = await DocumentPipelineService.processDocument("doc-1");

    expect(result.status).toBe("chunked");
    expect(mockEmbedDocument).not.toHaveBeenCalled();
    const meta = mockUpdateMetadata.mock.calls.map((c) => c[1] as Record<string, unknown>);
    expect(meta.some((m) => m.embedding_skipped === true)).toBe(true);
  });

  it("com vetores gerados o status passa a indexed", async () => {
    mockExtract.mockResolvedValue({ text: "conteudo real de apostila", pageCount: 1 });
    mockIsConfigured.mockReturnValue(true);
    mockEmbedDocument.mockResolvedValue({
      generatedCount: 3,
      cachedCount: 0,
      failedCount: 0,
    });

    const result = await DocumentPipelineService.processDocument("doc-1");

    expect(result.status).toBe("indexed");
    expect(result.embeddingCount).toBe(3);
  });

  it("nada de indexed quando o servico roda mas nenhum vetor sobra", async () => {
    mockExtract.mockResolvedValue({ text: "conteudo real de apostila", pageCount: 1 });
    mockIsConfigured.mockReturnValue(true);
    mockEmbedDocument.mockResolvedValue({
      generatedCount: 0,
      cachedCount: 0,
      failedCount: 3,
    });

    const result = await DocumentPipelineService.processDocument("doc-1");

    expect(result.status).toBe("chunked");
    expect(result.embeddingCount).toBe(0);
  });

  it("texto vazio falha como EMPTY_TEXT e marca ocr_needed", async () => {
    mockExtract.mockResolvedValue({ text: "   ", pageCount: 0 });
    await expect(
      DocumentPipelineService.processDocument("doc-1")
    ).rejects.toMatchObject({ code: "EMPTY_TEXT" });
    expect(lastPipelinePatch().status).toBe("failed");
    const meta = mockUpdateMetadata.mock.calls.map((c) => c[1] as Record<string, unknown>);
    expect(meta.some((m) => m.ocr_needed === true)).toBe(true);
  });

  it("PDF de muitas paginas com quase nada de texto e tratado como escaneado", async () => {
    mockExtract.mockResolvedValue({ text: "abc", pageCount: 40 });
    await expect(
      DocumentPipelineService.processDocument("doc-1")
    ).rejects.toBeInstanceOf(PipelineError);
    expect(lastPipelinePatch().status).toBe("failed");
  });

  it("formato sem extrator propaga ExtractionError e registra a falha", async () => {
    mockExtract.mockRejectedValue(
      new ExtractionError("UNSUPPORTED_FORMAT", "Sem extrator de texto.")
    );
    await expect(
      DocumentPipelineService.processDocument("doc-1")
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
    expect(lastPipelinePatch().status).toBe("failed");
  });

  it("documento sem arquivo fisico falha antes de qualquer leitura", async () => {
    mockFindById.mockResolvedValue(docRow({ storagePath: null }));
    await expect(
      DocumentPipelineService.processDocument("doc-1")
    ).rejects.toMatchObject({ code: "NO_STORAGE" });
    expect(mockDownload).not.toHaveBeenCalled();
  });

  it("falha de um documento nao reescreve estado de outro documento", async () => {
    mockExtract.mockRejectedValue(new Error("corrompido"));
    await expect(
      DocumentPipelineService.processDocument("doc-1")
    ).rejects.toMatchObject({ code: "PROCESSING_FAILED" });
    expect(lastPipelinePatch().status).toBe("failed");
    expect(lastPipelinePatch().processingError).toBe("corrompido");
  });
});

describe("transformacao editorial dentro do pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindById.mockResolvedValue(docRow({ fileHash: "b".repeat(64), title: "aula-01.pdf" }));
    mockUpdatePipeline.mockResolvedValue({});
    mockUpdateMetadata.mockResolvedValue({});
    mockUpdateStatus.mockResolvedValue({});
    mockChunk.mockResolvedValue({ chunkCount: 2, strategy: "fixed" });
    mockDownload.mockResolvedValue(Buffer.from("bytes", "utf8"));
    mockIsConfigured.mockReturnValue(false);
  });

  /**
   * O teste que prova o plug-and-play: o transform nao e chamado pela rota de
   * upload nem pelo CLI, e sim pelo pipeline. Entao quem quer que chame
   * `processDocument` (upload web, `--apply`, `--sync`, `--reprocess`) recebe a
   * mesma edicao, e nao existe canal que consiga pular a regra.
   */
  it("redige PII antes do chunker, preserva a autoria e persiste o relatorio", async () => {
    const pageOne = "Estratégia Concursos - material do professor\n\n" + "x".repeat(60);
    const pageTwo = "CPF: 111.444.777-35\n\n" + "y".repeat(60);
    mockExtract.mockResolvedValue({
      text: pageOne + "\n\n" + pageTwo,
      pageCount: 2,
      pages: [pageOne, pageTwo],
    });

    const result = await DocumentPipelineService.processDocument("doc-1");

    const input = chunkInput();
    expect(input.text).not.toContain("111.444.777-35");
    expect(input.text).toContain("CPF: [REDACTADO]");
    expect(input.text).toContain("Estratégia Concursos");

    const ranges = input.pageRanges as PageRange[];
    expect(ranges).toHaveLength(2);
    expect(input.text.slice(ranges[1].start, ranges[1].end)).toContain("[REDACTADO]");

    expect(result.transformReport?.modo_usado).toBe("sanitize-only");
    expect(result.transformReport?.pii_removidos).toBeGreaterThanOrEqual(1);
    expect(result.transformReport?.fronteiras_pagina).toBe("preservadas");

    const stamped = mockUpdateMetadata.mock.calls
      .map((call) => call[1] as Record<string, unknown>)
      .find((patch) => "transform_report" in patch);
    expect(stamped?.transform_mode).toBe("sanitize-only");
    expect(JSON.stringify(stamped?.transform_report)).not.toContain("111.444.777-35");
  });

  it("com o transform desligado o texto cru chega ao chunker", async () => {
    process.env.APOSTILA_TRANSFORM_DISABLED = "1";
    try {
      const raw = "Aluno: Maria Conceição\n\n" + "z".repeat(80);
      mockExtract.mockResolvedValue({ text: raw, pageCount: 1, pages: [raw] });

      const result = await DocumentPipelineService.processDocument("doc-1");

      expect(chunkInput().text).toContain("Aluno: Maria Conceição");
      expect(result.transformReport?.pii_removidos).toBe(0);
      expect(result.transformReport?.avisos.join(" ")).toContain("APOSTILA_TRANSFORM_DISABLED");
    } finally {
      delete process.env.APOSTILA_TRANSFORM_DISABLED;
    }
  });

  it("documento sem paginas (txt/md) tambem sai redigido", async () => {
    mockExtract.mockResolvedValue({
      text: "Resumo em markdown\n\nAluno: Maria Conceição da Silva\nMatrícula: 2024.0012-34",
      pageCount: undefined,
    });

    const result = await DocumentPipelineService.processDocument("doc-1");

    const input = chunkInput();
    expect(input.text).toContain("Aluno: [REDACTADO]");
    expect(input.text).toContain("Matrícula: [REDACTADO]");
    expect(input.pageRanges).toBeUndefined();
    expect(result.transformReport?.fronteiras_pagina).toBe("inexistente");
  });
});

