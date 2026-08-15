/**
 * ConcursoAI — LessonGenerationService
 *
 * Gera o roteiro estruturado de uma aula a partir de uma apostila
 * (INTRODUÇÃO → OBJETIVOS → EXPLICAÇÃO → EXEMPLOS → PONTOS IMPORTANTES →
 * REVISÃO → QUESTÕES → ENCERRAMENTO) e persiste como lesson.
 */
import "server-only";
import { DeepSeekProvider } from "./deepseek-provider.service";
import type { AIModel } from "@/lib/ai/types";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";
import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";
import { LessonRepository } from "@/lib/study/repositories/lesson.repository";

export interface LessonSection {
  tipo: string;
  titulo: string;
  conteudo: string;
}

export interface LessonRoteiro {
  title: string;
  duracaoMin: number;
  roteiro: LessonSection[];
  conteudo: string;
}

export class LessonGenerationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "LessonGenerationError";
    this.code = code;
  }
}

function extractJson(content: string): string {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new LessonGenerationError("INVALID_RESPONSE", "Resposta da IA sem JSON válido.");
  }
  return content
    .slice(start, end + 1)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
}

export const LessonGenerationService = {
  async generateFromDocument(input: {
    userId?: string | null;
    documentId: string;
    subjectId: string;
    avatarId?: string | null;
    chapter?: string;
  }): Promise<typeof import("@/db/schema/study").lessons.$inferSelect> {
    const doc = await DocumentRepository.findById(input.documentId);
    if (!doc) throw new LessonGenerationError("DOC_NOT_FOUND", "Documento não encontrado.");
    if (doc.status !== "chunked" && doc.status !== "indexed") {
      throw new LessonGenerationError(
        "DOC_NOT_READY",
        `Documento em estado ${doc.status}; processe a apostila antes de gerar a aula.`
      );
    }

    const subject = await KnowledgeSubjectRepository.findById(input.subjectId);
    const chunks = await DocumentChunkRepository.listByDocument(input.documentId);
    if (chunks.length === 0) throw new LessonGenerationError("NO_CHUNKS", "Documento sem chunks.");

    const context = chunks.map((c) => c.content ?? "").join("\n\n").slice(0, 14000);

    const prompt = [
      `Crie o ROTEIRO de uma videoaula para concurso público, baseado ESTRITAMENTE na apostila.`,
      `Matéria: ${subject?.name ?? "Matéria"}. Documento: ${doc.title}.${input.chapter ? ` Capítulo: ${input.chapter}.` : ""}`,
      `Estrutura obrigatória (seções): introducao, objetivos, explicacao, exemplo, ponto_importante, revisao, questao, encerramento.`,
      `Inclua exemplos, "pontos importantes" e "pegadinhas de concurso" retirados da fonte. NÃO invente informação fora da fonte.`,
      `Responda SOMENTE com JSON no formato:`,
      `{"title":"...","duracao_min":10,"roteiro":[{"tipo":"introducao","titulo":"...","conteudo":"..."}, ...]}`,
      "",
      "CONTEÚDO DA APOSTILA (fonte):",
      context,
    ].join("\n");

    const result = await DeepSeekProvider.complete({
      model: "pro" as AIModel,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.6,
      maxTokens: 6000,
    });

    const parsed = JSON.parse(extractJson(result.content)) as {
      title?: string;
      duracao_min?: number;
      roteiro?: LessonSection[];
    };
    if (!Array.isArray(parsed.roteiro) || parsed.roteiro.length === 0) {
      throw new LessonGenerationError("INVALID_RESPONSE", "Resposta da IA sem roteiro.");
    }

    const title = parsed.title ?? doc.title;
    const conteudo = parsed.roteiro.map((s) => `${s.titulo}\n${s.conteudo}`).join("\n\n");

    return LessonRepository.create({
      userId: input.userId ?? null,
      knowledgeSubjectId: input.subjectId,
      documentId: input.documentId,
      avatarId: input.avatarId ?? null,
      chapter: input.chapter ?? null,
      title,
      roteiro: parsed.roteiro,
      conteudo,
      duracaoMin: parsed.duracao_min ?? 10,
      status: "publicada",
    });
  },
};
