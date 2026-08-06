/**
 * ConcursoAI — QuestionAttemptService
 *
 * Consultas sobre tentativas de resposta (histórico e estatísticas simples).
 */
import { QuestionAttemptRepository } from "../repositories/question-attempt.repository";

export class QuestionAttemptError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "QuestionAttemptError";
    this.code = code;
  }
}

export interface AttemptFilters {
  page?: number;
  pageSize?: number;
}

export const QuestionAttemptService = {
  async list(userId: string, filters: AttemptFilters = {}) {
    const { page = 1, pageSize = 50 } = filters;
    return QuestionAttemptRepository.listByUser(userId, pageSize, (page - 1) * pageSize);
  },

  async get(userId: string, attemptId: string) {
    const attempt = await QuestionAttemptRepository.findById(attemptId, userId);
    if (!attempt) {
      throw new QuestionAttemptError("NOT_FOUND", "Tentativa não encontrada.");
    }
    return attempt;
  },

  async count(userId: string): Promise<number> {
    return QuestionAttemptRepository.countByUser(userId);
  },
};
