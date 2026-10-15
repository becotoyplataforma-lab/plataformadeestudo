/**
 * Testes da paginacao do ChunkService.
 *
 * O contrato que a busca ja consumia (metadata.page) nunca foi escrito pelo
 * pipeline. Aqui se trava o comportamento real: chunk dentro de uma pagina,
 * chunk que atravessa paginas e chunk de documento sem pagina.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../repositories/document.repository", () => ({
  DocumentRepository: {
    updateStatus: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock("../../repositories/chunk.repository", () => ({
  DocumentChunkRepository: {
    softDeleteByDocument: vi.fn().mockResolvedValue({}),
    createBatch: vi.fn().mockResolvedValue([]),
  },
}));

import { ChunkService, type PageRange } from "../chunk.service";
import { DocumentChunkRepository } from "../../repositories/chunk.repository";

const NL = "\n";
const PAGE_JOIN = "\n\n";

/** Mesma regra do pipeline: fronteiras em offsets do texto ja juntado. */
function rangesFromPages(pages: string[]): PageRange[] {
  const ranges: PageRange[] = [];
  let cursor = 0;
  for (let i = 0; i < pages.length; i += 1) {
    const start = cursor;
    const end = cursor + pages[i].length;
    ranges.push({ page: i + 1, start, end });
    cursor = end + PAGE_JOIN.length;
  }
  return ranges;
}

function joined(pages: string[]): string {
  return pages.join(PAGE_JOIN);
}

function insertedChunks() {
  const call = (DocumentChunkRepository.createBatch as ReturnType<typeof vi.fn>).mock
    .calls[0][0];
  return call as Array<{ seq: number; content: string; metadata: Record<string, unknown> }>;
}

describe("ChunkService com paginas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("carimba a pagina de origem de cada trecho", async () => {
    const pages = [("ALFA ").repeat(20), ("BRAVO ").repeat(20)];
    await ChunkService.chunk({
      documentId: "doc-1",
      text: joined(pages),
      documentType: "txt",
      chunkSize: 100,
      overlap: 10,
      pageRanges: rangesFromPages(pages),
    });

    const chunks = insertedChunks();
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].metadata.page).toBe(1);
    expect(chunks[0].metadata.page_end).toBeUndefined();
    const last = chunks[chunks.length - 1];
    expect(last.metadata.page).toBe(2);
  });

  it("trecho que atravessa paginas declara inicio e fim em vez de esconder", async () => {
    const pages = [("ALFA ").repeat(20), ("BRAVO ").repeat(20)];
    await ChunkService.chunk({
      documentId: "doc-1",
      text: joined(pages),
      documentType: "txt",
      chunkSize: 100,
      overlap: 10,
      pageRanges: rangesFromPages(pages),
    });

    const spanning = insertedChunks().filter(
      (c) => c.metadata.page_end !== undefined
    );
    expect(spanning.length).toBeGreaterThan(0);
    for (const chunk of spanning) {
      expect(chunk.metadata.pages).toBeInstanceOf(Array);
      const listed = chunk.metadata.pages as number[];
      expect(listed).toContain(chunk.metadata.page as number);
      expect(listed).toContain(chunk.metadata.page_end as number);
      expect((chunk.metadata.page_end as number) >
        (chunk.metadata.page as number)).toBe(true);
    }
  });

  it("sem pageRanges nao existe chave de pagina: nao se inventa origem", async () => {
    await ChunkService.chunk({
      documentId: "doc-2",
      text: ("CHARLIE ").repeat(40),
      documentType: "txt",
      chunkSize: 100,
      overlap: 10,
    });

    for (const chunk of insertedChunks()) {
      expect(chunk.metadata).not.toHaveProperty("page");
      expect(chunk.metadata).not.toHaveProperty("page_end");
      expect(chunk.metadata).not.toHaveProperty("pages");
    }
  });

  it("pagina e monotona com o seq, mesmo na estratégia estrutural", async () => {
    const pages = [
      "# Introducao" + NL + NL + "Texto da introducao com tamanho que ocupa a primeira pagina.",
      "# Regras" + NL + NL + "Texto das regras com tamanho que ocupa a segunda pagina do PDF.",
      "# Resumo" + NL + NL + "Texto do resumo com tamanho que ocupa a terceira pagina final.",
    ];
    const result = await ChunkService.chunk({
      documentId: "doc-3",
      text: joined(pages),
      documentType: "markdown",
      chunkSize: 1000,
      pageRanges: rangesFromPages(pages),
    });

    expect(result.strategy).toBe("structural");
    const chunks = insertedChunks();
    expect(chunks.length).toBeGreaterThan(1);
    const seen: number[] = [];
    for (const chunk of chunks) {
      expect(typeof chunk.metadata.page).toBe("number");
      seen.push(chunk.metadata.page as number);
      // offsets gravados sao absolutos: precisam caber na pagina declarada
      const range = rangesFromPages(pages)[(chunk.metadata.page as number) - 1];
      expect(chunk.metadata.char_start as number >= range.start).toBe(true);
    }
    const sorted = [...seen].sort((a, b) => a - b);
    expect(seen).toEqual(sorted);
    expect(seen[seen.length - 1]).toBe(3);
  });

  it("pagina vazia de PDF escaneado nao desloca a numeracao", async () => {
    const pages = ["CONTEUDO DA PRIMEIRA", "", "CONTEUDO DA TERCEIRA PAGINA"];
    const ranges = rangesFromPages(pages);
    expect(ranges[1].page).toBe(2);
    expect(ranges[1].end - ranges[1].start).toBe(0);
    await ChunkService.chunk({
      documentId: "doc-4",
      text: joined(pages),
      documentType: "txt",
      chunkSize: 1000,
      pageRanges: ranges,
    });
    const chunks = insertedChunks();
    expect(chunks[0].metadata.page).toBe(1);
    expect(chunks[0].metadata.page_end).toBe(3);
  });
});
