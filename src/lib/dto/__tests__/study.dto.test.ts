/**
 * Testes dos DTOs do Study — validação Zod e mappers.
 */
import { describe, it, expect } from "vitest";
import {
  StudySubjectCreateDtoSchema,
  StudyTaskCreateDtoSchema,
  QuestionAnswerRequestDtoSchema,
  ReviewRequestDtoSchema,
  FlashcardCreateDtoSchema,
  mapStudySubjectToDto,
} from "@/lib/dto/study.dto";

describe("Study DTOs", () => {
  describe("StudySubjectCreateDtoSchema", () => {
    it("aceita dados válidos com defaults", () => {
      const result = StudySubjectCreateDtoSchema.safeParse({ name: "Português" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.priority).toBe(3);
        expect(result.data.carga_horaria_total).toBe(0);
      }
    });

    it("rejeita prioridade fora de 1-5", () => {
      const result = StudySubjectCreateDtoSchema.safeParse({ name: "X", priority: 9 });
      expect(result.success).toBe(false);
    });

    it("rejeita nome vazio", () => {
      const result = StudySubjectCreateDtoSchema.safeParse({ name: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("StudyTaskCreateDtoSchema", () => {
    it("aceita data ISO válida", () => {
      const result = StudyTaskCreateDtoSchema.safeParse({
        title: "Tarefa",
        scheduled_date: "2026-08-10T12:00:00Z",
      });
      expect(result.success).toBe(true);
    });

    it("rejeita data não-ISO", () => {
      const result = StudyTaskCreateDtoSchema.safeParse({
        title: "Tarefa",
        scheduled_date: "10/08/2026",
      });
      expect(result.success).toBe(false);
    });

    it("rejeita duration fora de 5-600", () => {
      const result = StudyTaskCreateDtoSchema.safeParse({
        title: "Tarefa",
        scheduled_date: "2026-08-10T12:00:00Z",
        duration_min: 1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("QuestionAnswerRequestDtoSchema", () => {
    it("aceita letra A-E", () => {
      const result = QuestionAnswerRequestDtoSchema.safeParse({
        selected_letter: "B",
        time_spent_sec: 30,
        mode: "estudo",
      });
      expect(result.success).toBe(true);
    });

    it("rejeita letra fora de A-E", () => {
      const result = QuestionAnswerRequestDtoSchema.safeParse({ selected_letter: "F" });
      expect(result.success).toBe(false);
    });

    it("rejeita tempo negativo", () => {
      const result = QuestionAnswerRequestDtoSchema.safeParse({
        selected_letter: "A",
        time_spent_sec: -5,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ReviewRequestDtoSchema", () => {
    it("aceita rating válido", () => {
      const result = ReviewRequestDtoSchema.safeParse({ rating: "medio" });
      expect(result.success).toBe(true);
    });

    it("rejeita rating inválido", () => {
      const result = ReviewRequestDtoSchema.safeParse({ rating: "muito-facil" });
      expect(result.success).toBe(false);
    });
  });

  describe("FlashcardCreateDtoSchema", () => {
    it("aceita tags como default []", () => {
      const result = FlashcardCreateDtoSchema.safeParse({ front: "f", back: "b" });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.tags).toEqual([]);
    });

    it("rejeita mais de 20 tags", () => {
      const result = FlashcardCreateDtoSchema.safeParse({
        front: "f",
        back: "b",
        tags: Array(21).fill("tag"),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("mapStudySubjectToDto", () => {
    it("mapeia row para DTO", () => {
      const dto = mapStudySubjectToDto({
        id: "00000000-0000-0000-0000-000000000001",
        userId: "00000000-0000-0000-0000-000000000002",
        name: "Português",
        color: "#0ea5e9",
        priority: 3,
        cargaHorariaTotal: 50,
        createdAt: new Date("2026-08-04T12:00:00Z"),
        updatedAt: new Date("2026-08-04T12:00:00Z"),
      });
      expect(dto.user_id).toBe("00000000-0000-0000-0000-000000000002");
      expect(dto.priority).toBe(3);
      expect(dto.carga_horaria_total).toBe(50);
    });
  });
});
