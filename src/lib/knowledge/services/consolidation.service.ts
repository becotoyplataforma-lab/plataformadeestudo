/**
 * ConcursoAI — ConsolidationService (Fase 3 do PLANO-MESTRE-TESTE)
 *
 * Consolida N apostilas da MESMA matéria em um material único, via síntese
 * da IA (não concatenação). O resultado vira um documento `consolidated`
 * (source_type="consolidated", source_document_ids rastreável) que passa pelo
 * pipeline normal (chunking/embeddings) e entra na fila de revisão.
 */
import "server-only";
import { createHash } from "crypto";
import { DeepSeekProvider } from "@/lib/ai/services/deepseek-provider.service";
import type { AIModel } from "@/lib/ai/types";
import { DocumentRepository } from "../repositories/document.repository";
import { DocumentChunkRepository } from "../repositories/chunk.repository";
import { DocumentStorageService } from "../storage.service";
import { storageBackend } from "../storage/backend";
import { DocumentPipelineService } from "./document-pipeline.service";
import { DocumentSubjectRepository } from "../repositories/junction.repository";
import { KnowledgeSubjectRepository } from "../repositories/subject.repository";

export class ConsolidationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ConsolidationError";
    this.code = code;
  }
}

export interface ConsolidateInput {
  userId: string;
  isAdmin: boolean;
  documentIds: string[];
  subjectId: string;
}

export interface ConsolidateOutput {
  documentId: string;
  title: string;
  sourceDocumentIds: string[];
  status: string;
}

const MAX_DOCUMENTS = 10;
const MAX_CONTEXT_CHARS = 30000;

export const ConsolidationService = {
  isConfigured(): boolean {
    return Boolean(process.env.DEEPSEEK_API_KEY);
  },

  async consolidate(input: ConsolidateInput): Promise<ConsolidateOutput> {
    const ids = [...new Set(input.documentIds)];
    if (ids.length < 2) {
      throw new ConsolidationError(
        "MIN_DOCUMENTS",
        "Selecione ao menos 2 apostilas para consolidar."
      );
    }
    if (ids.length > MAX_DOCUMENTS) {
      throw new ConsolidationError(
        "MAX_DOCUMENTS",
        `Máximo de ${MAX_DOCUMENTS} apostilas por consolidação. Divida em lotes.`
      );
    }

    // 1. Resolve e valida os documentos.
    const docs = [];
    for (const id of ids) {
      const doc = await DocumentRepository.findById(id);
      if (!doc) {
        throw new ConsolidationError("DOC_NOT_FOUND", `Apostila ${id} não encontrada.`);
      }
      if (!input.isAdmin && doc.userId !== input.userId) {
        throw new ConsolidationError(
          "FORBIDDEN",
          "Você só pode consolidar as próprias apostilas."
        );
      }
      if (doc.status !== "indexed" && doc.status !== "chunked") {
        throw new ConsolidationError(
          "DOC_NOT_READY",
          `A apostila "${doc.title}" ainda não está pronta (status: ${doc.status}).`
        );
      }
      docs.push(doc);
    }

    // 2. Todas da mesma matéria (via vínculo document_subjects).
    const links = await DocumentSubjectRepository.listSubjectsByDocuments(ids);
    const subjectIds = new Set(links.map((l) => l.subjectId));
    if (subjectIds.size > 1) {
      throw new ConsolidationError(
        "MIXED_SUBJECTS",
        "Selecione apostilas da mesma matéria para consolidar."
      );
    }
    if (subjectIds.size === 1 && !subjectIds.has(input.subjectId)) {
      throw new ConsolidationError(
        "SUBJECT_MISMATCH",
        "A matéria informada não corresponde às apostilas selecionadas."
      );
    }

    const subject = await KnowledgeSubjectRepository.findById(input.subjectId);

    // 3. Junta os chunks das fontes (contexto para a síntese).
    const contextParts: string[] = [];
    for (const doc of docs) {
      const chunks = await DocumentChunkRepository.listByDocument(doc.id);
      const text = chunks.map((c) => c.content ?? "").join("\n\n");
      if (text.trim()) {
        contextParts.push(`### Fonte: ${doc.title}\n${text}`);
      }
    }
    const context = contextParts.join("\n\n").slice(0, MAX_CONTEXT_CHARS);
    if (!context.trim()) {
      throw new ConsolidationError("NO_CONTENT", "Nenhum conteúdo extraído das apostilas.");
    }

    // 4. Síntese via IA (não concatenação).
    if (!this.isConfigured()) {
      throw new ConsolidationError(
        "AI_NOT_CONFIGURED",
        "O serviço de IA (DeepSeek) não está configurado."
      );
    }
    const result = await DeepSeekProvider.complete({
      model: "pro" as AIModel,
      messages: [
        {
          role: "system",
          content:
            "Você é um especialista em concursos públicos que consolida material de estudo em um resumo estruturado, sem inventar informação fora da fonte.",
        },
        {
          role: "user",
          content: buildSynthesisPrompt({
            subjectName: subject?.name ?? "Matéria",
            sourceTitles: docs.map((d) => d.title),
            context,
          }),
        },
      ],
      temperature: 0.4,
      maxTokens: 4096,
    });
    const synthesized = result.content.trim();
    if (!synthesized) {
      throw new ConsolidationError("EMPTY_SYNTHESIS", "A IA não gerou conteúdo consolidado.");
    }

    // 5. Cria o documento consolidado.
    const id = crypto.randomUUID();
    const fileName = "consolidado.md";
    const buffer = Buffer.from(synthesized, "utf8");
    const title = `Consolidado — ${subject?.name ?? "Matéria"} (${docs.length} apostilas)`;

    const doc = await DocumentRepository.create({
      id,
      userId: input.userId,
      type: "markdown",
      title,
      storagePath: `${input.userId}/${id}/${fileName}`,
      storageBackend: storageBackend(),
      status: "pending",
      fileSize: buffer.byteLength,
      mimeType: "text/markdown",
      sourceType: "consolidated",
      sourceUrl: null,
      externalId: null,
      sourceDocumentIds: ids,
      fileHash: createHash("sha256").update(synthesized).digest("hex"),
      metadata: {
        consolidated: true,
        subject_id: input.subjectId,
        source_document_ids: ids,
        source_titles: docs.map((d) => d.title),
      },
    });
    void doc;

    // 6. Armazena, vincula matéria e processa (chunking/embeddings).
    await DocumentStorageService.upload({
      userId: input.userId,
      documentId: id,
      fileName,
      buffer,
      mimeType: "text/markdown",
    });
    await DocumentSubjectRepository.upsert(id, input.subjectId, 100);
    await DocumentPipelineService.processDocument(id).catch(() => undefined);

    const finalDoc = await DocumentRepository.findById(id);
    return {
      documentId: id,
      title,
      sourceDocumentIds: ids,
      status: finalDoc?.status ?? "processing",
    };
  },
};

function buildSynthesisPrompt(input: {
  subjectName: string;
  sourceTitles: string[];
  context: string;
}): string {
  return [
    `Consolide em UM material de estudo estruturado e coerente as apostilas de ${input.subjectName} abaixo.`,
    `NÃO é uma concatenação: organize por tópicos, elimine repetições, mantenha definições/regras/exemplos essenciais e cite a origem de cada bloco quando relevante.`,
    `Não invente informação fora da fonte. Formato: Markdown, com títulos (##) por tópico.`,
    `Fontes: ${input.sourceTitles.join("; ")}.`,
    "",
    "CONTEÚDO DAS FONTES:",
    input.context,
  ].join("\n");
}
