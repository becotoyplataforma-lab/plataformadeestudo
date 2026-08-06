/**
 * Testes do StudyPlannerService (disciplinas e tarefas) com repositórios mockados.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListByUser = vi.fn();
const mockExistsByName = vi.fn();
const mockCreate = vi.fn();
const mockFindById = vi.fn();
const mockUpdate = vi.fn();
const mockSoftDelete = vi.fn();
const mockComplete = vi.fn();
const mockListTasks = vi.fn();

vi.mock("../../repositories/study-subject.repository", () => ({
  StudySubjectRepository: {
    listByUser: (...a: unknown[]) => mockListByUser(...a),
    existsByName: (...a: unknown[]) => mockExistsByName(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    findById: (...a: unknown[]) => mockFindById(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    softDelete: (...a: unknown[]) => mockSoftDelete(...a),
  },
}));

vi.mock("../../repositories/study-task.repository", () => ({
  StudyTaskRepository: {
    listByUser: (...a: unknown[]) => mockListTasks(...a),
    create: (...a: unknown[]) => mockCreate(...a),
    findById: (...a: unknown[]) => mockFindById(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
    complete: (...a: unknown[]) => mockComplete(...a),
    softDelete: (...a: unknown[]) => mockSoftDelete(...a),
  },
}));

import { StudyPlannerService } from "../study-planner.service";

describe("StudyPlannerService", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("createSubject", () => {
    it("cria disciplina com sucesso", async () => {
      mockExistsByName.mockResolvedValue(false);
      mockCreate.mockResolvedValue({ id: "subj-1", userId: "u1", name: "Português" });

      const result = await StudyPlannerService.createSubject("u1", { name: "  Português  " });

      expect(result.id).toBe("subj-1");
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({ userId: "u1", name: "Português" })
      );
    });

    it("rejeita nome vazio", async () => {
      await expect(
        StudyPlannerService.createSubject("u1", { name: "   " })
      ).rejects.toMatchObject({ code: "INVALID_NAME" });
    });

    it("rejeita disciplina duplicada", async () => {
      mockExistsByName.mockResolvedValue(true);
      await expect(
        StudyPlannerService.createSubject("u1", { name: "Português" })
      ).rejects.toMatchObject({ code: "DUPLICATE_SUBJECT" });
    });
  });

  describe("updateSubject", () => {
    it("lança NOT_FOUND quando disciplina não existe", async () => {
      mockFindById.mockResolvedValue(null);
      await expect(
        StudyPlannerService.updateSubject("u1", "x", { name: "Novo" })
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
    });

    it("atualiza com sucesso quando não há duplicação", async () => {
      mockFindById.mockResolvedValue({ id: "s1", userId: "u1", name: "Antigo" });
      mockExistsByName.mockResolvedValue(false);
      mockUpdate.mockResolvedValue({ id: "s1", name: "Novo" });

      const result = await StudyPlannerService.updateSubject("u1", "s1", { name: "Novo" });
      expect(result.name).toBe("Novo");
    });
  });

  describe("createTask", () => {
    it("rejeita data inválida", async () => {
      await expect(
        StudyPlannerService.createTask("u1", {
          title: "Tarefa",
          scheduled_date: "data-invalida",
        })
      ).rejects.toMatchObject({ code: "INVALID_DATE" });
    });

    it("cria tarefa com data válida", async () => {
      mockCreate.mockResolvedValue({ id: "t1" });
      const result = await StudyPlannerService.createTask("u1", {
        title: "Revisar",
        scheduled_date: "2026-08-10T12:00:00Z",
        duration_min: 30,
      });
      expect(result.id).toBe("t1");
    });

    it("rejeita título vazio", async () => {
      await expect(
        StudyPlannerService.createTask("u1", { title: "", scheduled_date: "2026-08-10T12:00:00Z" })
      ).rejects.toMatchObject({ code: "INVALID_TITLE" });
    });
  });

  describe("completeTask", () => {
    it("conclui tarefa", async () => {
      mockFindById.mockResolvedValue({ id: "t1", userId: "u1", status: "pendente" });
      mockComplete.mockResolvedValue({ id: "t1", status: "concluida" });
      const result = await StudyPlannerService.completeTask("u1", "t1");
      expect(result.status).toBe("concluida");
    });

    it("lança NOT_FOUND se tarefa não existe", async () => {
      mockFindById.mockResolvedValue(null);
      await expect(StudyPlannerService.completeTask("u1", "t1")).rejects.toMatchObject({
        code: "NOT_FOUND",
      });
    });
  });
});
