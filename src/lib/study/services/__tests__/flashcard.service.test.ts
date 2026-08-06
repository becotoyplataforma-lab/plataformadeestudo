/**
 * Testes do FlashcardService com repositórios mockados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindById = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
const mockListByUser = vi.fn();
const mockListDue = vi.fn();
const mockSubjectFindById = vi.fn();
const mockScheduleCreate = vi.fn();

vi.mock("../../repositories/flashcard.repository", () => ({
  FlashcardRepository: {
    findById: (...a: unknown[]) => mockFindById(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    softDelete: (...a: unknown[]) => mockSoftDelete(...a),
    listByUser: (...a: unknown[]) => mockListByUser(...a),
    listDue: (...a: unknown[]) => mockListDue(...a),
  },
}));

vi.mock("../../repositories/study-subject.repository", () => ({
  StudySubjectRepository: {
    findById: (...a: unknown[]) => mockSubjectFindById(...a),
  },
}));

vi.mock("../../repositories/review-schedule.repository", () => ({
  ReviewScheduleRepository: {
    create: (...a: unknown[]) => mockScheduleCreate(...a),
  },
}));

import { FlashcardService } from "../flashcard.service";

describe("FlashcardService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("create", () => {
    it("cria flashcard e schedule inicial", async () => {
      mockCreate.mockResolvedValue({ id: "fc1", userId: "u1" });
      mockScheduleCreate.mockResolvedValue({ id: "sc1" });

      const result = await FlashcardService.create("u1", {
        front: "Frente",
        back: "Verso",
        tags: ["concurso"],
      });

      expect(result.id).toBe("fc1");
      expect(mockScheduleCreate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", flashcardId: "fc1", intervalDays: 0 })
      );
    });

    it("rejeita frente vazia", async () => {
      await expect(
        FlashcardService.create("u1", { front: "  ", back: "verso" })
      ).rejects.toMatchObject({ code: "INVALID_CONTENT" });
    });

    it("rejeita disciplina inexistente", async () => {
      mockSubjectFindById.mockResolvedValue(null);
      await expect(
        FlashcardService.create("u1", {
          front: "f",
          back: "b",
          studySubjectId: "sx",
        })
      ).rejects.toMatchObject({ code: "SUBJECT_NOT_FOUND" });
    });
  });

  describe("update", () => {
    it("lança NOT_FOUND se flashcard não existe", async () => {
      mockFindById.mockResolvedValue(null);
      await expect(FlashcardService.update("u1", "fc1", { front: "x" })).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });

    it("atualiza flashcard", async () => {
      mockFindById.mockResolvedValue({ id: "fc1", userId: "u1" });
      mockUpdate.mockResolvedValue({ id: "fc1", front: "Novo" });
      const result = await FlashcardService.update("u1", "fc1", { front: "Novo" });
      expect(result.front).toBe("Novo");
    });
  });

  describe("delete", () => {
    it("remove flashcard existente", async () => {
      mockFindById.mockResolvedValue({ id: "fc1", userId: "u1" });
      mockSoftDelete.mockResolvedValue({ id: "fc1", deletedAt: new Date() });
      await expect(FlashcardService.delete("u1", "fc1")).resolves.toBeTruthy();
    });
  });
});
