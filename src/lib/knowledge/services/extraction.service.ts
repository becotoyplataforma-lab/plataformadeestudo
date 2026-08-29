/**
 * ConcursoAI — DocumentExtractionService
 *
 * Extrai texto bruto de PDF/DOCX/TXT/Markdown/HTML, preservando páginas
 * (PDF) quando disponível. Sem lógica de negócio além da extração.
 *
 * Segue: docs/08-ETL.md · .ai/blueprints/02-extraction.blueprint.md
 */
import "server-only";
import { createRequire } from "node:module";
import mammoth from "mammoth";

// pdf-parse v1: importamos o lib/pdf-parse.js diretamente (não o index.js),
// pois o index.js tem um bloco de debug que tenta ler um arquivo de teste
// quando module.parent é undefined (caso do ESM/Turbopack).
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse/lib/pdf-parse.js") as (
  dataBuffer: Buffer,
  options?: {
    pagerender?: (pageData: {
      getTextContent: (options?: unknown) => Promise<{
        items: Array<{ str: string; transform: number[] }>;
      }>;
    }) => Promise<string> | string;
    max?: number;
    version?: string;
  }
) => Promise<{
  numpages: number;
  numrender: number;
  info: unknown;
  metadata: unknown;
  text: string;
  version: string;
}>;

export interface ExtractionResult {
  text: string;
  pageCount?: number;
  /** Texto da primeira página (PDF) — útil para extrair título/cabeçalho. */
  firstPageText?: string;
}

export class ExtractionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ExtractionError";
    this.code = code;
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ");
}

async function extractPdf(buffer: Buffer): Promise<ExtractionResult> {
  // pdf-parse v1 usa pdf.js com disableWorker=true (sem worker), evitando o
  // problema do Turbopack com o import() dinâmico do pdfjs-dist.
  // Capturamos o texto da primeira página via pagerender para extrair o título.
  let firstPageText: string | undefined;
  const result = await pdfParse(buffer, {
    pagerender: async (pageData: { getTextContent: (o?: unknown) => Promise<{ items: Array<{ str: string; transform: number[] }> }> }) => {
      const textContent = await pageData.getTextContent();
      let lastY: number | undefined;
      let text = "";
      for (const item of textContent.items) {
        if (lastY === item.transform[5] || lastY === undefined) {
          text += item.str;
        } else {
          text += "\n" + item.str;
        }
        lastY = item.transform[5];
      }
      if (firstPageText === undefined) {
        firstPageText = text;
      }
      return text;
    },
  });
  return {
    text: result.text,
    pageCount: result.numpages,
    firstPageText,
  };
}

async function extractDocx(buffer: Buffer): Promise<ExtractionResult> {
  const result = await mammoth.extractRawText({ buffer });
  return { text: result.value };
}

export const DocumentExtractionService = {
  /**
   * Extrai texto conforme MIME/type.
   * @param buffer bytes do arquivo
   * @param mimeType MIME informado no upload
   * @param type tipo de documento (pdf|docx|txt|markdown|html|edital|apostila)
   */
  async extract(
    buffer: Buffer,
    mimeType: string,
    type: string
  ): Promise<ExtractionResult> {
    try {
      if (type === "pdf" || mimeType === "application/pdf") {
        return await extractPdf(buffer);
      }
      if (
        type === "docx" ||
        mimeType ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        return await extractDocx(buffer);
      }
      if (type === "html" || mimeType === "text/html") {
        return { text: stripHtml(buffer.toString("utf8")) };
      }
      // txt / markdown / edital / apostila (texto)
      return { text: buffer.toString("utf8") };
    } catch (error) {
      if (error instanceof ExtractionError) throw error;
      throw new ExtractionError(
        "EXTRACTION_FAILED",
        error instanceof Error ? error.message : "Falha ao extrair texto do arquivo"
      );
    }
  },
};
