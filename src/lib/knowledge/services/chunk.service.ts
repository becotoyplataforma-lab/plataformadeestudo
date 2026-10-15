/**
 * ConcursoAI — ChunkService
 *
 * Divide texto em chunks indexáveis com estratégia configurável
 * por tipo de documento (fixed ou structural).
 *
 * Segue: .ai/blueprints/03-chunk.blueprint.md
 */
import { createHash } from "crypto";
import { DocumentRepository } from "../repositories/document.repository";
import { DocumentChunkRepository } from "../repositories/chunk.repository";

// ============================================================
// Tipos
// ============================================================

/**
 * Faixa de texto que pertence a uma pagina do documento de origem.
 * start e inclusive, end e exclusive, sempre em offsets do texto ja normalizado.
 */
export interface PageRange {
  page: number;
  start: number;
  end: number;
}

export interface ChunkInput {
  documentId: string;
  text: string;
  documentType: string;
  chunkSize?: number;
  overlap?: number;
  /**
   * Fronteiras de pagina (PDF). Ausente = documento sem pagina real, e o
   * metadata do chunk fica sem chave nenhuma de pagina.
   */
  pageRanges?: PageRange[];
}

export interface ChunkData {
  documentId: string;
  seq: number;
  content: string;
  contentHash: string;
  metadata: Record<string, unknown>;
}

export interface ChunkOutput {
  documentId: string;
  chunks: Omit<ChunkData, "content">[];
  chunkCount: number;
  strategy: string;
}

// ============================================================
// Constantes
// ============================================================

const DEFAULT_CHUNK_SIZE = 1000;
const DEFAULT_OVERLAP = 200;

const STRUCTURAL_TYPES = new Set(["markdown", "html", "docx", "edital"]);

// ============================================================
// Helpers
// ============================================================

function computeHash(content: string): string {
  return createHash("sha256").update(content.trim()).digest("hex");
}

function selectStrategy(documentType: string): "fixed" | "structural" {
  return STRUCTURAL_TYPES.has(documentType) ? "structural" : "fixed";
}

function findBreakpoint(text: string, start: number, end: number): number {
  // Procurar quebra de parágrafo
  const paraBreak = text.lastIndexOf("\n\n", end);
  if (paraBreak > start) return paraBreak + 2;

  // Procurar fim de frase
  const sentenceBreak = text.lastIndexOf(". ", end);
  if (sentenceBreak > start) return sentenceBreak + 2;

  // Procurar espaço
  const spaceBreak = text.lastIndexOf(" ", end);
  if (spaceBreak > start) return spaceBreak + 1;

  return end;
}

// ============================================================
// Estratégias de chunking
// ============================================================

function fixedChunk(text: string, chunkSize: number, overlap: number): ChunkData[] {
  const chunks: ChunkData[] = [];
  let cursor = 0;
  let seq = 0;

  while (cursor < text.length) {
    let end = Math.min(cursor + chunkSize, text.length);

    if (end < text.length) {
      const breakpoint = findBreakpoint(text, end - overlap, end);
      end = breakpoint;
    }

    // Garantir progresso (evita loop infinito no fim do texto)
    if (end <= cursor) {
      end = Math.min(cursor + chunkSize, text.length);
    }

    const content = text.slice(cursor, end).trim();
    if (content.length > 0) {
      chunks.push({
        documentId: "", // será preenchido depois
        seq,
        content,
        contentHash: computeHash(content),
        metadata: { char_start: cursor, char_end: end },
      });
      seq++;
    }

    if (end >= text.length) {
      break; // chegou ao fim do texto
    }

    cursor = end - overlap;
    if (cursor <= 0 || cursor >= text.length) {
      cursor = end;
    }
  }

  return chunks;
}

function structuralChunk(text: string, chunkSize: number, overlap: number): ChunkData[] {
  // Divide por headings (##, ###) para Markdown
  // Se não houver headings, fallback para fixed
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  const sections: { title: string; start: number; end: number; level: number }[] = [];
  let match: RegExpExecArray | null;

  while ((match = headingRegex.exec(text)) !== null) {
    sections.push({
      title: match[2],
      start: match.index,
      end: text.length,
      level: match[1].length,
    });
  }

  if (sections.length < 2) {
    return fixedChunk(text, chunkSize, overlap);
  }

  // Ajustar fins das seções
  for (let i = 0; i < sections.length - 1; i++) {
    sections[i].end = sections[i + 1].start;
  }

  const chunks: ChunkData[] = [];
  let seq = 0;

  for (const section of sections) {
    const sectionText = text.slice(section.start, section.end).trim();
    if (sectionText.length <= chunkSize) {
      chunks.push({
        documentId: "",
        seq,
        content: sectionText,
        contentHash: computeHash(sectionText),
        metadata: {
          section_title: section.title,
          heading_level: section.level,
          char_start: section.start,
          char_end: section.end,
        },
      });
      seq++;
    } else {
      // Seção grande: aplicar fixed chunk internamente
      const subChunks = fixedChunk(sectionText, chunkSize, overlap);
      for (const sub of subChunks) {
        chunks.push({
          ...sub,
          seq,
          metadata: {
            ...sub.metadata,
            section_title: section.title,
            heading_level: section.level,
            char_start: section.start + (sub.metadata.char_start as number),
            char_end: section.start + (sub.metadata.char_end as number),
          },
        });
        seq++;
      }
    }
  }

  return chunks;
}

// ============================================================
// Service
// ============================================================

/**
 * Pagina de origem do trecho [start,end).
 *
 * Regras: sem faixas nao ha chave de pagina (nao se inventa pagina de TXT);
 * trecho que atravessa paginas ganha page (inicio) e page_end (fim), porque
 * esconder a travessia faria a citacao apontar para uma pagina errada.
 */
function pageMetadataFor(
  pageRanges: PageRange[] | undefined,
  start: number,
  end: number
): Record<string, unknown> {
  if (!pageRanges || pageRanges.length === 0) return {};
  const touched = pageRanges.filter((r) => start < r.end && end > r.start);
  if (touched.length === 0) return {};
  const first = touched[0];
  const last = touched[touched.length - 1];
  const meta: Record<string, unknown> = { page: first.page };
  if (last.page !== first.page) {
    meta.page_end = last.page;
    meta.pages = touched.map((r) => r.page);
  }
  return meta;
}

export const ChunkService = {
  /**
   * Orquestrar chunking completo.
   */
  async chunk(input: ChunkInput): Promise<ChunkOutput> {
    const {
      documentId,
      text,
      documentType,
      chunkSize = DEFAULT_CHUNK_SIZE,
      overlap = DEFAULT_OVERLAP,
      pageRanges,
    } = input;

    if (!text || text.trim().length === 0) {
      return { documentId, chunks: [], chunkCount: 0, strategy: "fixed" };
    }

    const strategy = selectStrategy(documentType);

    // 1. Gerar chunks
    let chunksData: ChunkData[];
    if (strategy === "structural") {
      chunksData = structuralChunk(text, chunkSize, overlap);
    } else {
      chunksData = fixedChunk(text, chunkSize, overlap);
    }

    // 2. Atribuir documentId e a pagina de origem de cada trecho
    for (const chunk of chunksData) {
      chunk.documentId = documentId;
      const rawStart = chunk.metadata.char_start;
      const rawEnd = chunk.metadata.char_end;
      const pageMeta = pageMetadataFor(
        pageRanges,
        typeof rawStart === "number" ? rawStart : 0,
        typeof rawEnd === "number" ? rawEnd : 0
      );
      if (Object.keys(pageMeta).length > 0) {
        chunk.metadata = { ...chunk.metadata, ...pageMeta };
      }
    }

    // 3. Soft delete chunks antigos
    await DocumentChunkRepository.softDeleteByDocument(documentId);

    // 4. Inserir novos chunks
    if (chunksData.length > 0) {
      await DocumentChunkRepository.createBatch(
        chunksData.map((chunk) => ({
          documentId: chunk.documentId,
          seq: chunk.seq,
          content: chunk.content,
          contentHash: chunk.contentHash,
          metadata: chunk.metadata,
        }))
      );
    }

    // 5. Atualizar status
    await DocumentRepository.updateStatus(documentId, "chunked");

    return {
      documentId,
      chunks: chunksData.map(({ documentId: _did, ...rest }) => ({
        documentId: _did,
        seq: rest.seq,
        contentHash: rest.contentHash,
        metadata: rest.metadata,
      })),
      chunkCount: chunksData.length,
      strategy,
    };
  },
};
