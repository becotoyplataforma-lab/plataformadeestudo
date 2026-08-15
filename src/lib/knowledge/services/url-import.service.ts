/**
 * ConcursoAI — UrlImportService
 *
 * Importa conteúdo externo (editais, leis, PDFs públicos) por URL: baixa,
 * valida, registra e processa pela mesma pipeline da apostila.
 * Reaproveita IngestionService (dedup/validação) + DocumentStorageService + pipeline.
 */
import "server-only";
import { IngestionService } from "./ingestion.service";
import { DocumentStorageService } from "../storage.service";
import { DocumentPipelineService } from "./document-pipeline.service";

export class UrlImportError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "UrlImportError";
    this.code = code;
  }
}

const MAX_SIZE = 25 * 1024 * 1024;

function extensionFor(mime: string): string {
  if (mime.includes("pdf")) return ".pdf";
  if (mime.includes("wordprocessingml")) return ".docx";
  if (mime.includes("html")) return ".html";
  if (mime.includes("markdown")) return ".md";
  if (mime.includes("text/plain")) return ".txt";
  return ".txt";
}

function buildFileName(title: string | undefined, url: string, mime: string): string {
  let base = title?.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "_") ?? "";
  if (!base) {
    const last = url.split("/").pop() ?? "";
    base = decodeURIComponent(last).replace(/\.\w+$/, "").replace(/[^\w-]+/g, "_") || "conteudo";
  }
  return `${base.slice(0, 120)}${extensionFor(mime)}`;
}

export const UrlImportService = {
  async importFromUrl(input: {
    userId: string;
    url: string;
    title?: string;
    sourceUrl?: string;
  }) {
    let res: Response;
    try {
      res = await fetch(input.url, {
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
        headers: { "User-Agent": "ConcursoAI-Importer/1.0" },
      });
    } catch {
      throw new UrlImportError("FETCH_FAILED", "Não foi possível baixar o conteúdo da URL.");
    }
    if (!res.ok) {
      throw new UrlImportError("HTTP_ERROR", `A URL retornou HTTP ${res.status}.`);
    }

    const contentType = res.headers.get("content-type") ?? "text/plain";
    const mime = contentType.split(";")[0].trim();
    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.byteLength === 0) {
      throw new UrlImportError("EMPTY_CONTENT", "A URL não retornou conteúdo.");
    }
    if (bytes.byteLength > MAX_SIZE) {
      throw new UrlImportError("FILE_TOO_LARGE", "Conteúdo excede o limite de 25 MB.");
    }

    const fileName = buildFileName(input.title, input.url, mime);
    const file = new File([bytes], fileName, { type: mime });

    const result = await IngestionService.ingest({
      userId: input.userId,
      file,
      sourceType: "url",
      sourceUrl: input.sourceUrl ?? input.url,
    });

    await DocumentStorageService.upload({
      userId: input.userId,
      documentId: result.documentId,
      fileName,
      buffer: bytes,
      mimeType: mime,
    });

    await DocumentPipelineService.processDocument(result.documentId).catch(() => undefined);

    return result;
  },
};
