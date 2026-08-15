/**
 * ConcursoAI — DocumentExtractionService
 *
 * Extrai texto bruto de PDF/DOCX/TXT/Markdown/HTML, preservando páginas
 * (PDF) quando disponível. Sem lógica de negócio além da extração.
 *
 * Segue: docs/08-ETL.md · .ai/blueprints/02-extraction.blueprint.md
 */
import "server-only";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export interface ExtractionResult {
  text: string;
  pageCount?: number;
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
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const textResult = await parser.getText();
    const pageCount = textResult.total;
    const text = (textResult.pages ?? [])
      .map((p) => p.text)
      .join("\n\n");
    return { text, pageCount };
  } finally {
    await parser.destroy().catch(() => undefined);
  }
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
