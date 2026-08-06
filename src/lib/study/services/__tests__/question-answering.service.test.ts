/**
 * Testes do QuestionAnsweringService com repositórios mockados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindPublicById = vi.fn();
const mockGetGabarito = vi.fn();
const mockCreate = vi.fn();
const mockListPublic = vi.fn();

vi.mock("../../repositories/question.repository", () => ({
  QuestionRepository: {
    findPublicById: (...a: unknown[]) => mockFindPublicById(...a),
    getGabarito: (...a: unknown[]) => mockGetGabarito(...a),
    listPublic: (...a: unknown[]) => mockListPublic(...a),
  },
}));

vi.mock("../../repositories/question-attempt.repository", () => ({
  QuestionAttemptRepository: {
    create: (...a: unknown[]) => mockCreate(...a),
  },
}));

import { QuestionAnsweringService } from "../question-answering.service";

describe("QuestionAnsweringService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("answer", () => {
    it("registra acerto quando letra = gabarito", async () => {
      mockFindPublicById.mockResolvedValue({ id: "q1" });
      mockGetGabarito.mockResolvedValue({ gabarito: "C", explicacao: "Explicação" });
      mockCreate.mockResolvedValue({ id: "a1" });

      const result = await QuestionAnsweringService.answer("u1", "q1", {
        selectedLetter: "c",
        mode: "estudo",
      });

      expect(result.correct).toBe(true);
      expect(result.gabarito).toBe("C");
      expect(result.explicacao).toBe("Explicação");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", selectedLetter: "C", isCorrect: true })
      );
    });

    it("registra erro quando letra ≠ gabarito", async () => {
      mockFindPublicById.mockResolvedValue({ id: "q1" });
      mockGetGabarito.mockResolvedValue({ gabarito: "C", explicacao: null });
      mockCreate.mockResolvedValue({ id: "a1" });

      const result = await QuestionAnsweringService.answer("u1", "q1", { selectedLetter: "B" });
      expect(result.correct).toBe(false);
    });

    it("lança QUESTION_NOT_FOUND se questão não existe", async () => {
      mockFindPublicById.mockResolvedValue(null);
      await expect(
        QuestionAnsweringService.answer("u1", "q1", { selectedLetter: "A" })
      ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });
    });

    it("lança INVALID_LETTER para letra fora de A-E", async () => {
      mockFindPublicById.mockResolvedValue({ id: "q1" });
      await expect(
        QuestionAnsweringService.answer("u1", "q1", { selectedLetter: "Z" })
      ).rejects.toMatchObject({ code: "INVALID_LETTER" });
    });
  });

  describe("listQuestions", () => {
    it("delega filtros ao repositório", async () => {
      mockListPublic.mockResolvedValue({ data: [], total: 0 });
      const result = await QuestionAnsweringService.listQuestions({
        subjectId: "s1",
        page: 2,
        pageSize: 15,
      });
      expect(result.total).toBe(0);
      expect(mockListPublic).toHaveBeenCalledWith({ subjectId: "s1", page: 2, pageSize: 15 });
    });
  });
});
