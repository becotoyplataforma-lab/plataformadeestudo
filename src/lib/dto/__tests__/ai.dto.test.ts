/**
 * Testes dos DTOs do AI — validação Zod e mappers.
 */
import { describe, it, expect } from "vitest";
import {
  ChatRequestDtoSchema,
  ChatResponseDtoSchema,
  ChatMessageDtoSchema,
  mapSessionToDto,
} from "@/lib/dto/ai.dto";

describe("AI DTOs", () => {
  describe("ChatRequestDtoSchema", () => {
    it("aceita mensagem válida", () => {
      const result = ChatRequestDtoSchema.safeParse({ message: "O que é RLS?" });
      expect(result.success).toBe(true);
    });

    it("rejeita mensagem vazia", () => {
      const result = ChatRequestDtoSchema.safeParse({ message: "" });
      expect(result.success).toBe(false);
    });

    it("rejeita mensagem muito longa", () => {
      const result = ChatRequestDtoSchema.safeParse({ message: "a".repeat(4001) });
      expect(result.success).toBe(false);
    });

    it("aceita session_id e model opcionais", () => {
      const result = ChatRequestDtoSchema.safeParse({
        message: "Oi",
        session_id: "00000000-0000-0000-0000-000000000001",
        model: "pro",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("ChatResponseDtoSchema", () => {
    it("aceita resposta válida", () => {
      const result = ChatResponseDtoSchema.safeParse({
        session_id: "00000000-0000-0000-0000-000000000001",
        message_id: "00000000-0000-0000-0000-000000000002",
        response: "Resposta",
        model: "flash",
        tokens_in: 10,
        tokens_out: 5,
        total_tokens: 15,
        cost_brl: 0.001,
        latency_ms: 123,
      });
      expect(result.success).toBe(true);
    });

    it("rejeita tokens negativos", () => {
      const result = ChatResponseDtoSchema.safeParse({
        session_id: "00000000-0000-0000-0000-000000000001",
        message_id: "00000000-0000-0000-0000-000000000002",
        response: "R",
        model: "flash",
        tokens_in: -1,
        tokens_out: 0,
        total_tokens: -1,
        cost_brl: 0,
        latency_ms: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("ChatMessageDtoSchema", () => {
    it("aceita role assistant com model", () => {
      const result = ChatMessageDtoSchema.safeParse({
        id: "00000000-0000-0000-0000-000000000001",
        session_id: "00000000-0000-0000-0000-000000000002",
        role: "assistant",
        content: "Olá",
        model: "flash",
        tokens_in: 1,
        tokens_out: 1,
        created_at: "2026-08-04T12:00:00Z",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("mapSessionToDto", () => {
    it("mapeia row para DTO", () => {
      const dto = mapSessionToDto({
        id: "00000000-0000-0000-0000-000000000001",
        userId: "00000000-0000-0000-0000-000000000002",
        title: "Conversa",
        knowledgeSubjectId: null,
        model: "flash",
        createdAt: new Date("2026-08-04T12:00:00Z"),
        updatedAt: new Date("2026-08-04T12:00:00Z"),
        deletedAt: null,
      });
      expect(dto.title).toBe("Conversa");
      expect(dto.model).toBe("flash");
      expect(dto.subject_id).toBeNull();
    });
  });
});
