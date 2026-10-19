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
import { logger, redactSecrets } from "@/lib/observability";
import { DocumentRepository } from "../repositories/document.repository";
import { DocumentStorageService } from "../storage.service";
import { DocumentExtractionService, ExtractionError } from "./extraction.service";
import { ChunkService, type PageRange } from "./chunk.service";
import { EmbeddingService } from "./embedding.service";
import { embeddingClient } from "../embedding/client";
import { ApostilaTransformerService, normalizeExtractedText } from "./apostila-transformer.service";
import type { ApostilaTransformReport } from "../dto/apostila-transform.dto";

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
  /** Auditoria da transformacao aplicada neste processamento; null se nao houve. */
  transformReport: ApostilaTransformReport | null;
}

/** Separador usado ao juntar paginas normalizadas (fonte unica das fronteiras). */
const PAGE_JOIN = "\n\n";

/**
 * Fronteiras de pagina em offsets do texto obtido por join(pages, PAGE_JOIN).
 * Pagina vazia mantem faixa propria (comprimento zero) para a numeracao nao
 * deslocar: pagina 7 de um PDF continua pagina 7, mesmo sem texto extraido.
 */
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

/**
 * Normalizacao pagina a pagina vive em `normalizeExtractedText`
 * (`apostila-transformer.service`): a previsualizacao do CLI e o pipeline tem de
 * aplicar exatamente a mesma forma, ou o preview mostra um texto que nunca
 * chegaria ao chunker.
 */

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
      const buffer = await DocumentStorageService.download(
        doc.storagePath,
        doc.storageBackend as "r2" | "supabase" | undefined
      );
      const extracted = await DocumentExtractionService.extract(
        buffer,
        doc.mimeType ?? "",
        doc.type
      );
      // Normalizacao pagina a pagina. Se o texto inteiro fosse normalizado de
      // uma vez, as fronteiras de pagina calculadas sobre o texto cru nao
      // valeriam mais para o texto final e cada chunk passaria a citar a
      // pagina errada - que e pior do que nao citar pagina nenhuma.
      const normalizedPages =
        extracted.pages && extracted.pages.length > 0
          ? extracted.pages.map((page) => normalizeExtractedText(page))
          : null;
      const normalized =
        normalizedPages !== null
          ? normalizedPages.join(PAGE_JOIN)
          : normalizeExtractedText(extracted.text);

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
      if ((extracted.pageCount ?? 0) > 1 && normalized.length < 60) {
        await DocumentRepository.updateMetadata(documentId, { ocr_needed: true });
        throw new PipelineError(
          "EMPTY_TEXT",
          "Texto extraído muito curto para um documento com páginas. Provável PDF escaneado — OCR não configurado."
        );
      }

      // Transformacao editorial (redacao de PII + estrutura em fases) entre a
      // extracao e o chunking. Existe um unico ponto de chamada, o pipeline, e e
      // por isso que upload web, CLI e reprocessamento passam todos por aqui:
      // regra duplicada por canal e regra que diverge no meio do lote.
      const transformed = await applyTransformBeforeChunking({
        documentId,
        text: normalized,
        pages: normalizedPages ?? undefined,
        sha256Original: doc.fileHash ?? undefined,
        fileName: doc.title ?? undefined,
      });

      // As fronteiras sao recalculadas sobre o texto transformado. Se a IA
      // reestruturou o documento inteiro, nao ha mais paginas para citar, e o
      // chunker recebe `undefined` em vez de uma faixa apontando para o lugar
      // errado - pagina errada em citacao e pior que citacao nenhuma.
      const pageRanges = transformed.pages ? rangesFromPages(transformed.pages) : undefined;

      const chunkResult = await ChunkService.chunk({
        documentId,
        text: transformed.text,
        documentType: doc.type,
        pageRanges,
      });

      const embeddingConfigured = embeddingClient.isConfigured();
      let embeddingCount = 0;
      let status: string = "chunked";

      if (embeddingConfigured) {
        const emb = await EmbeddingService.embedDocument({ documentId });
        embeddingCount = emb.generatedCount + emb.cachedCount;
        // So declara "indexed" quem ficou com vetor no banco. Sem nenhum
        // embedding gerado o documento permanece "chunked": pesquisavel
        // por FTS, indexacao vetorial pendente, reexecucao possivel.
        status = embeddingCount > 0 ? "indexed" : "chunked";
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
        pageCount: extracted.pageCount ?? null,
        processedAt: new Date(),
        processingError: null,
      });

      return {
        documentId,
        status,
        chunkCount: chunkResult.chunkCount,
        embeddingCount,
        pageCount: extracted.pageCount ?? null,
        embeddingConfigured,
        transformReport: transformed.report,
      };
    } catch (error) {
      const message =
        redactSecrets(error instanceof Error ? error.message : "Falha desconhecida no processamento.");
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

interface TransformStepInput {
  documentId: string;
  text: string;
  pages?: string[];
  sha256Original?: string;
  fileName?: string;
}

/**
 * Aplica o transform e devolve o texto que vai para o chunker, mais as paginas
 * transformadas quando elas continuam existindo.
 *
 * O relatorio vai para `documents.metadata.transform_report` por merge JSONB, o
 * mesmo caminho de `mcp_provider_id`: auditar depois exige que o registro do
 * lote morra junto do documento, e nao numa pasta do servidor que processou.
 *
 * Nada aqui derruba o processamento. Transform que falha devolve o texto extraido
 * intacto: conteudo sem edicao editorial ainda e conteudo pesquisavel, e conteudo
 * perdido nao e pesquisavel de jeito nenhum.
 */
async function applyTransformBeforeChunking(
  input: TransformStepInput,
): Promise<{ text: string; pages?: string[]; report: ApostilaTransformReport | null }> {
  try {
    const outcome = await ApostilaTransformerService.transformExtraction(input);
    const report = outcome.report;

    await DocumentRepository.updateMetadata(input.documentId, {
      transform_report: report,
      transform_mode: report.modo_usado,
      transform_rules_version: report.regras_versao,
      transform_pii_redacted: report.pii_removidos,
    }).catch((error) => {
      // O documento ja vai ser chunkado com o texto transformado: a ausencia do
      // carimbo de auditoria nao pode virar falha de processamento, mas tambem
      // nao pode passar sem registro.
      logger.warn("document-pipeline", "relatorio de transformacao nao persistido", {
        documentId: input.documentId,
        error: error instanceof Error ? error.message : String(error),
      });
    });

    if (!outcome.text || outcome.text.trim().length === 0) {
      return { text: input.text, pages: input.pages, report };
    }
    return { text: outcome.text, pages: outcome.pages, report };
  } catch (error) {
    logger.warn("document-pipeline", "transform falhou; texto extraido preservado", {
      documentId: input.documentId,
      error: error instanceof Error ? error.message : String(error),
    });
    return { text: input.text, pages: input.pages, report: null };
  }
}

