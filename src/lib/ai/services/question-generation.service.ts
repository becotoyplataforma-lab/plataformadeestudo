/**
 * ConcursoAI — QuestionGenerationService
 *
 * Gera questões a partir de uma apostila (documento → chunks → DeepSeek),
 * valida automaticamente e persiste como EM_REVISÃO (nunca publicada).
 * Rastreabilidade: documento + chunk de origem.
 */
import "server-only";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";
import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";
import {
  questionGenerationProvider,
} from "../generation/question-generation.provider";
import { QuestionValidationService } from "./question-validation.service";
import { QuestionWriteRepository } from "@/lib/administration/repositories/question.repository";

export class GenerationServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "GenerationServiceError";
    this.code = code;
  }
}

export interface GenerateFromDocumentInput {
  adminUserId: string;
  documentId: string;
  subjectId: string;
  quantity: number;
  nivel?: "facil" | "medio" | "dificil";
  banca?: string;
  cargo?: string;
  editalId?: string;
  positionId?: string;
  focusTopic?: string;
  editalWeight?: number;
}

export interface GeneratedQuestionSummary {
  questionId: string;
  valid: boolean;
  confidence: number;
  issues: string[];
}

export interface GenerateFromDocumentOutput {
  documentId: string;
  generated: number;
  rejected: number;
  questions: GeneratedQuestionSummary[];
}

const VALID_LETTERS = ["A", "B", "C", "D", "E"];

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9áàâãéêíóôõúüç\s]/g, " ").replace(/\s+/g, " ").trim();
}

/** Escolhe o chunk com maior sobreposição de termos com o enunciado (rastreabilidade). */
function pickSourceChunkId(
  enunciado: string,
  chunks: { id: string; content: string | null }[]
): string | null {
  if (chunks.length === 0) return null;
  const words = new Set(normalize(enunciado).split(" ").filter((w) => w.length > 3));
  let bestId: string | null = chunks[0].id;
  let bestScore = -1;
  for (const chunk of chunks) {
    const chunkWords = normalize(chunk.content ?? "").split(" ").filter((w) => w.length > 3);
    const score = chunkWords.filter((w) => words.has(w)).length;
    if (score > bestScore) {
      bestScore = score;
      bestId = chunk.id;
    }
  }
  return bestId;
}

export const QuestionGenerationService = {
  async generateFromDocument(
    input: GenerateFromDocumentInput
  ): Promise<GenerateFromDocumentOutput> {
    const doc = await DocumentRepository.findById(input.documentId);
    if (!doc) throw new GenerationServiceError("DOC_NOT_FOUND", "Documento não encontrado.");
    if (doc.status !== "chunked" && doc.status !== "indexed") {
      throw new GenerationServiceError(
        "DOC_NOT_READY",
        `Documento em estado ${doc.status}; processe a apostila antes de gerar questões.`
      );
    }
    if (doc.reviewStatus === "rejeitado") {
      throw new GenerationServiceError(
        "DOC_REJECTED",
        "Este material foi rejeitado na revisão de conteúdo e está bloqueado para geração de questões."
      );
    }

    const subject = await KnowledgeSubjectRepository.findById(input.subjectId);
    const chunks = await DocumentChunkRepository.listByDocument(input.documentId);
    if (chunks.length === 0) {
      throw new GenerationServiceError("NO_CHUNKS", "Documento sem chunks processados.");
    }

    const context = chunks
      .map((c) => c.content ?? "")
      .join("\n\n")
      .slice(0, 12000);

    const generated = await questionGenerationProvider.generateQuestions({
      documentTitle: doc.title,
      subjectName: subject?.name ?? "Matéria",
      quantity: input.quantity,
      nivel: input.nivel,
      banca: input.banca,
      cargo: input.cargo,
      focusTopic: input.focusTopic,
      editalWeight: input.editalWeight,
      context,
    });

    const summaries: GeneratedQuestionSummary[] = [];
    const existing = new Set<string>();
    let rejected = 0;

    for (const q of generated) {
      const result = QuestionValidationService.validate(q, { context, existingEnunciados: existing });
      const normEnunciado = normalize(q.enunciado ?? "");
      existing.add(normEnunciado);

      if (!result.valid) {
        rejected++;
        summaries.push({
          questionId: "",
          valid: false,
          confidence: result.score,
          issues: result.issues.map((i) => i.message),
        });
        continue;
      }

      const dificuldade = (q.dificuldade ?? "medio").trim().toLowerCase();
      const gabarito = (q.gabarito ?? "").trim().toUpperCase();
      const alternativas = (q.alternativas ?? []).map((a) => (a ?? "").trim());
      const sourceChunkId = pickSourceChunkId(q.enunciado ?? "", chunks);

      const row = await QuestionWriteRepository.createQuestion({
        knowledgeSubjectId: input.subjectId,
        banca: input.banca ?? null,
        cargo: input.cargo ?? null,
        ano: null,
        nivel: dificuldade as "facil" | "medio" | "dificil",
        enunciado: q.enunciado ?? "",
        gabarito,
        explicacao: q.explicacao ?? null,
        tipo: "multipla_escolha",
        fonte: q.fonte ?? doc.title,
        isPublic: false,
        contentHash: null,
        status: "em_revisao",
        origin: "ia",
        confidence: String(result.score),
        aiGenerated: true,
        needsReview: true,
        topic: q.topico ?? null,
        sourceDocumentId: input.documentId,
        sourceChunkId,
        sourceEditalId: input.editalId ?? null,
        sourcePositionId: input.positionId ?? null,
      });

      await QuestionWriteRepository.createOptions(
        alternativas.map((text, i) => ({
          questionId: row.id,
          letter: VALID_LETTERS[i],
          text,
          isCorrect: VALID_LETTERS[i] === gabarito,
        }))
      );

      await QuestionWriteRepository.createModerationEvent({
        questionId: row.id,
        adminUserId: input.adminUserId,
        action: "gerada_por_ia",
        notes: `Confiança ${result.score}; origem ${doc.title}`,
      });

      summaries.push({
        questionId: row.id,
        valid: true,
        confidence: result.score,
        issues: [],
      });
    }

    return {
      documentId: input.documentId,
      generated: generated.length,
      rejected,
      questions: summaries,
    };
  },
};
