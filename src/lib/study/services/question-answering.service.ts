/**
 * ConcursoAI — QuestionAnsweringService
 *
 * Resolve uma questão: valida alternativa, compara com gabarito e
 * registra a tentativa (aggregate QuestionAttempt).
 */
import { QuestionRepository } from "../repositories/question.repository";
import { QuestionAttemptRepository } from "../repositories/question-attempt.repository";

export class QuestionAnsweringError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "QuestionAnsweringError";
    this.code = code;
  }
}

export interface AnswerInput {
  selectedLetter: string;
  timeSpentSec?: number;
  mode?: "estudo" | "simulado" | "revisao";
}

export interface AnswerResult {
  attemptId: string;
  correct: boolean;
  gabarito: string;
  explicacao: string | null;
}

export const QuestionAnsweringService = {
  /**
   * Registrar resposta a uma questão pública.
   */
  async answer(userId: string, questionId: string, input: AnswerInput): Promise<AnswerResult> {
    // 1. Questão deve existir e ser pública/publicada
    const question = await QuestionRepository.findPublicById(questionId);
    if (!question) {
      throw new QuestionAnsweringError("QUESTION_NOT_FOUND", "Questão não encontrada ou não publicada.");
    }

    const letter = input.selectedLetter.toUpperCase();
    if (!/^[A-E]$/.test(letter)) {
      throw new QuestionAnsweringError("INVALID_LETTER", "Alternativa deve ser A-E.");
    }

    // 2. Obter gabarito oficial (com options para checagem de consistência)
    const gabarito = await QuestionRepository.getGabarito(questionId);
    if (!gabarito) {
      throw new QuestionAnsweringError("NO_GABARITO", "Questão sem gabarito configurado.");
    }

    const correct = letter === gabarito.gabarito;

    // 3. Registrar tentativa
    const attempt = await QuestionAttemptRepository.create({
      userId,
      questionId,
      selectedLetter: letter,
      isCorrect: correct,
      timeSpentSec: input.timeSpentSec ?? 0,
      mode: input.mode ?? "estudo",
    });

    return {
      attemptId: attempt.id,
      correct,
      gabarito: gabarito.gabarito,
      explicacao: gabarito.explicacao,
    };
  },

  /**
   * Buscar questão pública com opções (para exibição).
   */
  async getQuestion(questionId: string) {
    return QuestionRepository.findPublicById(questionId);
  },

  /**
   * Listar questões públicas com filtros.
   */
  async listQuestions(filters: {
    subjectId?: string;
    banca?: string;
    nivel?: "facil" | "medio" | "dificil";
    page?: number;
    pageSize?: number;
  }) {
    return QuestionRepository.listPublic(filters);
  },
};
