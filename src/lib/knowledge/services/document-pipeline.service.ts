/**
 * ConcursoAI — DocumentPipelineService
 *
 * Orquestra o pipeline real da apostila:
 *   storage → extração → normalização → chunking → embedding → indexed
 *
 * Estados (document_status): pending → processing → processed/chunked →
 * indexing → indexed | failed. Sem embedding configurado, termina em
 * "chunked" (conteúdo pronto, busca vetorial pendente) — NÃO é falha.
 */
import "server-only";
import { DocumentRepository } from "../repositories/document.repository";
import { DocumentStorageService } from "../storage.service";
import { DocumentExtractionService, ExtractionError } from "./extraction.service";
import { ChunkService } from "./chunk.service";
import { EmbeddingService } from "./embedding.service";
import { embeddingClient } from "../embedding/client";

export class PipelineError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "PipelineError";
    this.code = code;
  }
}

export interface PipelineResult {
  documentId: string;
  status: string;
  chunkCount: number;
  embeddingCount: number;
  pageCount: number | null;
  embeddingConfigured: boolean;
}

function normalizeText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const DocumentPipelineService = {
  /** Executa (ou reexecuta, no retry) o processamento de um documento. */
  async processDocument(documentId: string): Promise<PipelineResult> {
    const doc = await DocumentRepository.findById(documentId);
    if (!doc) throw new PipelineError("NOT_FOUND", "Documento não encontrado.");
    if (!doc.storagePath) {
      throw new PipelineError("NO_STORAGE", "Documento sem arquivo físico (storage_path).");
    }

    await DocumentRepository.updatePipeline(documentId, {
      status: "processing",
      processingError: null,
    });

    try {
      const buffer = await DocumentStorageService.download(doc.storagePath);
      const { text, pageCount } = await DocumentExtractionService.extract(
        buffer,
        doc.mimeType ?? "",
        doc.type
      );
      const normalized = normalizeText(text);

      // Item 8 (OCR): PDFs escaneados não têm camada de texto. Detecta e
      // sinaliza em vez de falhar genericamente.
      const mediaType = (doc.metadata as Record<string, unknown> | null)?.media_type;
      if (mediaType && mediaType !== "text") {
        const note =
          "Mídia (áudio/vídeo) detectada: transcrição requer serviço externo (Whisper) não configurado.";
        await DocumentRepository.updateMetadata(documentId, {
          transcription_needed: true,
          transcription_note: note,
        });
        throw new PipelineError("TRANSCRIPTION_NOT_CONFIGURED", note);
      }

      if (!normalized) {
        await DocumentRepository.updateMetadata(documentId, { ocr_needed: true });
        throw new PipelineError(
          "EMPTY_TEXT",
          "Nenhum texto extraído. Se for PDF escaneado, é necessário OCR (não configurado)."
        );
      }
      if ((pageCount ?? 0) > 1 && normalized.length < 60) {
        await DocumentRepository.updateMetadata(documentId, { ocr_needed: true });
        throw new PipelineError(
          "EMPTY_TEXT",
          "Texto extraído muito curto para um documento com páginas. Provável PDF escaneado — OCR não configurado."
        );
      }

      const chunkResult = await ChunkService.chunk({
        documentId,
        text: normalized,
        documentType: doc.type,
      });

      const embeddingConfigured = embeddingClient.isConfigured();
      let embeddingCount = 0;
      let status: string = "chunked";

      if (embeddingConfigured) {
        const emb = await EmbeddingService.embedDocument({ documentId });
        embeddingCount = emb.generatedCount + emb.cachedCount;
        status = "indexed";
      } else {
        await DocumentRepository.updateMetadata(documentId, {
          embedding_skipped: true,
          embedding_note:
            "Embedding não configurado (EMBEDDING_API_URL ausente). Busca vetorial indisponível até configurar.",
        });
      }

      await DocumentRepository.updatePipeline(documentId, {
        status,
        chunkCount: chunkResult.chunkCount,
        embeddingCount,
        pageCount: pageCount ?? null,
        processedAt: new Date(),
        processingError: null,
      });

      return {
        documentId,
        status,
        chunkCount: chunkResult.chunkCount,
        embeddingCount,
        pageCount: pageCount ?? null,
        embeddingConfigured,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Falha desconhecida no processamento.";
      await DocumentRepository.updatePipeline(documentId, {
        status: "failed",
        processingError: message,
      });
      if (error instanceof ExtractionError || error instanceof PipelineError) {
        throw error;
      }
      throw new PipelineError("PROCESSING_FAILED", message);
    }
  },
};
