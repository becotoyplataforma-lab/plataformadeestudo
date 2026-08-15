/**
 * ConcursoAI — FlashcardGenerationService
 *
 * Gera flashcards a partir de uma apostila processada (apostila → IA →
 * flashcards com rastreabilidade de fonte). Usa o FlashcardService existente
 * (com agendamento SRS) para persistir.
 */
import "server-only";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";
import { KnowledgeSubjectRepository } from "@/lib/knowledge/repositories/subject.repository";
import {
  flashcardGenerationProvider,
} from "../generation/flashcard-generation.provider";
import { FlashcardService } from "@/lib/study/services/flashcard.service";

export class FlashcardGenerationServiceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FlashcardGenerationServiceError";
    this.code = code;
  }
}

function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9áàâãéêíóôõúüç\s]/g, " ").replace(/\s+/g, " ").trim();
}

export const FlashcardGenerationService = {
  async generateFromDocument(input: {
    userId: string;
    documentId: string;
    subjectId: string;
    studySubjectId?: string;
    quantity: number;
  }): Promise<{ generated: number; flashcards: string[] }> {
    const doc = await DocumentRepository.findById(input.documentId);
    if (!doc) throw new FlashcardGenerationServiceError("DOC_NOT_FOUND", "Documento não encontrado.");
    if (doc.status !== "chunked" && doc.status !== "indexed") {
      throw new FlashcardGenerationServiceError(
        "DOC_NOT_READY",
        `Documento em estado ${doc.status}; processe a apostila antes de gerar flashcards.`
      );
    }

    const subject = await KnowledgeSubjectRepository.findById(input.subjectId);
    const chunks = await DocumentChunkRepository.listByDocument(input.documentId);
    if (chunks.length === 0) {
      throw new FlashcardGenerationServiceError("NO_CHUNKS", "Documento sem chunks.");
    }

    const context = chunks.map((c) => c.content ?? "").join("\n\n").slice(0, 10000);
    const cards = await flashcardGenerationProvider.generateFlashcards({
      documentTitle: doc.title,
      subjectName: subject?.name ?? "Matéria",
      quantity: input.quantity,
      context,
    });

    const created: string[] = [];
    for (const card of cards) {
      const front = (card.front ?? "").trim();
      const back = (card.back ?? "").trim();
      if (!front || !back) continue;

      const words = new Set(normalize(front).split(" ").filter((w) => w.length > 3));
      let sourceChunkId: string | null = chunks[0]?.id ?? null;
      let bestScore = -1;
      for (const chunk of chunks) {
        const score = normalize(chunk.content ?? "")
          .split(" ")
          .filter((w) => w.length > 3 && words.has(w)).length;
        if (score > bestScore) {
          bestScore = score;
          sourceChunkId = chunk.id;
        }
      }

      const row = await FlashcardService.create(input.userId, {
        studySubjectId: input.studySubjectId,
        front,
        back,
        tags: ["gerado-por-ia"],
        sourceDocumentId: input.documentId,
        sourceChunkId,
      });
      created.push(row.id);
    }

    return { generated: created.length, flashcards: created };
  },
};
