/**
 * ConcursoAI — FlashcardService
 *
 * CRUD de flashcards + criação do agendamento inicial (ReviewSchedule 1:1).
 */
import { FlashcardRepository } from "../repositories/flashcard.repository";
import { ReviewScheduleRepository } from "../repositories/review-schedule.repository";
import { StudySubjectRepository } from "../repositories/study-subject.repository";

export class FlashcardError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FlashcardError";
    this.code = code;
  }
}

export interface FlashcardCreateInput {
  studySubjectId?: string;
  front: string;
  back: string;
  tags?: string[];
}

export const FlashcardService = {
  async list(
    userId: string,
    opts: { studySubjectId?: string; onlyDue?: boolean } = {}
  ) {
    return FlashcardRepository.listByUser(userId, opts);
  },

  async create(userId: string, input: FlashcardCreateInput) {
    const front = input.front.trim();
    const back = input.back.trim();
    if (!front || !back) {
      throw new FlashcardError("INVALID_CONTENT", "Frente e verso são obrigatórios.");
    }

    if (input.studySubjectId) {
      const subject = await StudySubjectRepository.findById(input.studySubjectId, userId);
      if (!subject) {
        throw new FlashcardError("SUBJECT_NOT_FOUND", "Disciplina informada não encontrada.");
      }
    }

    const flashcard = await FlashcardRepository.create({
      userId,
      studySubjectId: input.studySubjectId ?? null,
      front,
      back,
      tags: input.tags ?? [],
    });

    // Cria schedule inicial (SRS): vence hoje
    await ReviewScheduleRepository.create({
      userId,
      flashcardId: flashcard.id,
      intervalDays: 0,
      easeFactor: "2.50",
      repetitions: 0,
      dueDate: new Date(),
    });

    return flashcard;
  },

  async update(
    userId: string,
    id: string,
    patch: {
      front?: string;
      back?: string;
      tags?: string[];
      studySubjectId?: string | null;
    }
  ) {
    const existing = await FlashcardRepository.findById(id, userId);
    if (!existing) {
      throw new FlashcardError("NOT_FOUND", "Flashcard não encontrado.");
    }

    if (patch.studySubjectId) {
      const subject = await StudySubjectRepository.findById(patch.studySubjectId, userId);
      if (!subject) {
        throw new FlashcardError("SUBJECT_NOT_FOUND", "Disciplina informada não encontrada.");
      }
    }

    return FlashcardRepository.update(id, userId, {
      ...(patch.front !== undefined && { front: patch.front }),
      ...(patch.back !== undefined && { back: patch.back }),
      ...(patch.tags !== undefined && { tags: patch.tags }),
      ...(patch.studySubjectId !== undefined && { studySubjectId: patch.studySubjectId }),
    });
  },

  async delete(userId: string, id: string) {
    const existing = await FlashcardRepository.findById(id, userId);
    if (!existing) {
      throw new FlashcardError("NOT_FOUND", "Flashcard não encontrado.");
    }
    return FlashcardRepository.softDelete(id, userId);
  },

  /** Listar flashcards vencidos (revisão). */
  async listDue(userId: string, limit = 50) {
    return FlashcardRepository.listDue(userId, limit);
  },
};
