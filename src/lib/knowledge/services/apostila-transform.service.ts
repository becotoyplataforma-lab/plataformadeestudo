/**
 * ConcursoAI — ApostilaTransformService
 *
 * Transforma o conteúdo extraído de uma apostila no layout oficial
 * "em fases" com a marca DeepSeek (baleia), usando o prompt versionado
 * em /prompts/apostila/transformar.md.
 *
 * Fluxo:
 *   1. Extrai o texto da apostila (via DocumentExtractionService).
 *   2. Monta o prompt com o layout obrigatório (dark theme, fases, caixas
 *      REGRA/ATENÇÃO/DICA/CUIDADO, marca d'água DeepSeek).
 *   3. Chama DeepSeek (modelo "pro") e recebe HTML completo.
 *   4. Salva o HTML transformado em storage (mesmo bucket, path derivado)
 *      e registra em metadata: transformed_html_path, transformed_at.
 *
 * Regra de negócio: a transformação preserva TODO o conteúdo técnico;
 * a IA NUNCA inventa conteúdo e NUNCA cita a fonte original.
 */
import "server-only";
import { DeepSeekProvider } from "@/lib/ai/services/deepseek-provider.service";
import { prompts, interpolate } from "@/lib/ai/prompts";
import type { AIModel } from "@/lib/ai/types";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentStorageService } from "@/lib/knowledge/storage.service";
import { DocumentExtractionService } from "@/lib/knowledge/services/extraction.service";
import { logger } from "@/lib/observability";

export class ApostilaTransformError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ApostilaTransformError";
    this.code = code;
  }
}

/** Tamanho máximo do texto enviado à IA (tokens aproximados). */
const MAX_CONTEXT_CHARS = 32000;

/**
 * Extrai o título da apostila a partir da primeira página do PDF.
 * Procura por padrões como "Aula 02", "Aula 2", "Aula 10" no início do texto.
 * Retorna null se não encontrar.
 */
function extractTitleFromFirstPage(firstPageText: string | undefined): string | null {
  if (!firstPageText) return null;
  const text = firstPageText.trim();
  // Procura por "Aula N" ou "Aula NN" (com ou sem zero à esquerda) no início.
  const match = text.match(/^(Aula\s+\d{1,3})/i);
  if (match) return match[1];
  // Fallback: procura em qualquer lugar da primeira linha.
  const lineMatch = text.split("\n")[0]?.match(/(Aula\s+\d{1,3})/i);
  if (lineMatch) return lineMatch[1];
  return null;
}

/** Extrai o fragmento HTML dentro de `<body>` ou ````html` fences. */
function extractHtml(content: string): string {
  let html = content.trim();
  // Remove code fences markdown (```html ... ``` ou ``` ... ```).
  html = html.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "");
  // Se contém <html>, normaliza para documento completo.
  if (/<html[\s>]/i.test(html)) {
    const start = html.search(/<!doctype html>/i);
    const docStart = start !== -1 ? start : html.search(/<html[\s>]/i);
    if (docStart !== -1) html = html.slice(docStart);
    return html;
  }
  // Se a IA retornou só o fragmento de body, envolve num HTML mínimo.
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Apostila em Fases | Alterada por IA (DeepSeek)</title>
</head>
<body>
${html}
</body>
</html>`;
}

export const ApostilaTransformService = {
  /**
   * Transforma o documento no layout de fases. Retorna o HTML completo.
   * Opcionalmente salva o HTML no storage e registra metadados.
   */
  async transformDocument(input: {
    documentId: string;
    saveHtml?: boolean;
  }): Promise<{ html: string; title: string }> {
    const { documentId, saveHtml = true } = input;
    const doc = await DocumentRepository.findById(documentId);
    if (!doc) {
      throw new ApostilaTransformError("DOC_NOT_FOUND", "Documento não encontrado.");
    }

    // 1. Extração do texto bruto.
    let text = "";
    let firstPageText: string | undefined;
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
      text = extracted.text;
      firstPageText = extracted.firstPageText;
    } catch (error) {
      throw new ApostilaTransformError(
        "EXTRACTION_FAILED",
        error instanceof Error ? error.message : "Falha na extração do texto."
      );
    }
    if (!text.trim()) {
      throw new ApostilaTransformError(
        "EMPTY_TEXT",
        "Nenhum texto extraído — verifique se a apostila não é um PDF escaneado."
      );
    }

    // 1b. Título: prioriza o extraído da primeira página do PDF (ex.: "Aula 02"),
    // senão usa o título derivado do nome do arquivo.
    const aulaTitulo = extractTitleFromFirstPage(firstPageText);
    const title =
      aulaTitulo ??
      (doc.title.replace(/\.(pdf|docx|txt|md|html)$/i, "") || "Apostila");

    // 2. Monta o prompt com o conteúdo (limita para caber no contexto).
    const content = text.slice(0, MAX_CONTEXT_CHARS);
    const template = await prompts.apostilaTransformar();
    const prompt = interpolate(template, {
      apostila_conteudo: content,
      apostila_titulo: title,
    });

    // 3. Chamada DeepSeek.
    // USO do modelo "flash" (deepseek-chat), NÃO "pro" (deepseek-reasoner):
    // o reasoner consome os tokens de saída no raciocínio interno e pode
    // retornar `content` vazio (finish_reason=length) em prompts longos.
    // O deepseek-chat retorna o HTML diretamente no content.
    // maxTokens alto (32768) para o HTML completo fechar (finish_reason=stop)
    // sem truncar o rodapé em apostilas longas. Com 16384 o HTML de apostilas
    // grandes (ex.: 32k chars de conteúdo) era truncado (finish_reason=length).
    const result = await DeepSeekProvider.complete({
      model: "flash" as AIModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      maxTokens: 32768,
    });

    const html = extractHtml(result.content);
    if (!html || html.length < 500) {
      throw new ApostilaTransformError(
        "INVALID_RESPONSE",
        "A IA não retornou HTML válido."
      );
    }

    // 4. Persiste o HTML transformado (mesmo bucket, path derivado).
    if (saveHtml) {
      try {
        const transformedPath = `${doc.userId}/${doc.id}/transformado.html`;
        await DocumentStorageService.upload({
          userId: doc.userId,
          documentId: doc.id,
          fileName: "transformado.html",
          buffer: Buffer.from(html, "utf-8"),
          mimeType: "text/html; charset=utf-8",
        });
        await DocumentRepository.updateMetadata(doc.id, {
          transformed_html_path: transformedPath,
          transformed_at: new Date().toISOString(),
          transformed_by: "deepseek",
        });
        // Marca o documento como processado e limpa o erro de processamento
        // (caso tenha falhado numa tentativa anterior).
        await DocumentRepository.updatePipeline(doc.id, {
          status: "processed",
          processingError: null,
        });
      } catch (error) {
        logger.warn("apostila-transform", "Falha ao salvar HTML transformado", {
          documentId: doc.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { html, title };
  },

  /**
   * Verifica se o documento já possui versão transformada salva.
   */
  async hasTransformed(documentId: string): Promise<boolean> {
    const doc = await DocumentRepository.findById(documentId);
    if (!doc) return false;
    const meta = (doc.metadata ?? {}) as Record<string, unknown>;
    return typeof meta.transformed_html_path === "string";
  },

  /**
   * Recupera o HTML transformado salvo (ou null se não existir).
   */
  async downloadTransformed(documentId: string): Promise<string | null> {
    const doc = await DocumentRepository.findById(documentId);
    if (!doc) return null;
    const meta = (doc.metadata ?? {}) as Record<string, unknown>;
    const path = meta.transformed_html_path as string | undefined;
    if (!path) return null;
    try {
      const buffer = await DocumentStorageService.download(
        path,
        doc.storageBackend as "r2" | "supabase" | undefined
      );
      return buffer.toString("utf-8");
    } catch {
      return null;
    }
  },
};
