/**
 * Testes dos DTOs do Professor IA — validação Zod e mappers.
 */
import { describe, it, expect } from "vitest";
import {
  ProfessorRequestDtoSchema,
  ProfessorResponseDtoSchema,
  mapProfessorOutputToDto,
} from "@/lib/dto/professor.dto";

const UUID = "00000000-0000-0000-0000-000000000001";
const UUID2 = "00000000-0000-0000-0000-000000000002";

describe("ProfessorRequestDtoSchema", () => {
  it("aceita message válida com defaults", () => {
    const r = ProfessorRequestDtoSchema.safeParse({ message: "O que é RLS?" });
    expect(r.success).toBe(true);
  });

  it("rejeita message vazia", () => {
    expect(ProfessorRequestDtoSchema.safeParse({ message: "" }).success).toBe(false);
  });

  it("rejeita message muito longa", () => {
    expect(
      ProfessorRequestDtoSchema.safeParse({ message: "a".repeat(2001) }).success
    ).toBe(false);
  });

  it("rejeita mode inválido", () => {
    const r = ProfessorRequestDtoSchema.safeParse({ message: "q", mode: "gpt" });
    expect(r.success).toBe(false);
  });

  it("aceita mode auto/chat/rag", () => {
    for (const mode of ["auto", "chat", "rag"]) {
      expect(
        ProfessorRequestDtoSchema.safeParse({ message: "q", mode }).success
      ).toBe(true);
    }
  });

  it("rejeita subject_id com uuid inválido", () => {
    expect(
      ProfessorRequestDtoSchema.safeParse({ message: "q", subject_id: "x" }).success
    ).toBe(false);
  });

  it("aceita filtros, top_k e model opcionais", () => {
    const r = ProfessorRequestDtoSchema.safeParse({
      message: "q",
      session_id: UUID,
      subject_id: UUID,
      document_ids: [UUID2],
      top_k: 7,
      model: "pro",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita top_k fora de 1-20", () => {
    expect(
      ProfessorRequestDtoSchema.safeParse({ message: "q", top_k: 0 }).success
    ).toBe(false);
    expect(
      ProfessorRequestDtoSchema.safeParse({ message: "q", top_k: 21 }).success
    ).toBe(false);
  });
});

describe("ProfessorResponseDtoSchema", () => {
  it("aceita resposta válida completa (rag)", () => {
    const r = ProfessorResponseDtoSchema.safeParse({
      answer: "Resposta",
      mode: "rag",
      model: "flash",
      citations: [],
      documents: [UUID],
      chunks_used: 1,
      tokens: { in: 10, out: 5, total: 15 },
      cost_brl: 0.001,
      latency_ms: 100,
      confidence: 0.8,
    });
    expect(r.success).toBe(true);
  });

  it("aceita resposta válida (chat)", () => {
    const r = ProfessorResponseDtoSchema.safeParse({
      answer: "Resposta",
      mode: "chat",
      model: "pro",
      citations: [],
      documents: [],
      chunks_used: 0,
      tokens: { in: 1, out: 2, total: 3 },
      cost_brl: 0,
      latency_ms: 0,
      confidence: 0,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita mode inválido", () => {
    const base = {
      answer: "R",
      model: "flash",
      citations: [],
      documents: [],
      chunks_used: 0,
      tokens: { in: 0, out: 0, total: 0 },
      cost_brl: 0,
      latency_ms: 0,
      confidence: 0,
    };
    expect(
      ProfessorResponseDtoSchema.safeParse({ ...base, mode: "gpt" }).success
    ).toBe(false);
  });

  it("rejeita tokens negativos", () => {
    const base = {
      answer: "R",
      mode: "chat",
      model: "flash",
      citations: [],
      documents: [],
      chunks_used: 0,
      tokens: { in: -1, out: 0, total: -1 },
      cost_brl: 0,
      latency_ms: 0,
      confidence: 0,
    };
    expect(ProfessorResponseDtoSchema.safeParse(base).success).toBe(false);
  });

  it("rejeita confidence fora de 0-1", () => {
    const base = {
      answer: "R",
      mode: "chat",
      model: "flash",
      citations: [],
      documents: [],
      chunks_used: 0,
      tokens: { in: 0, out: 0, total: 0 },
      cost_brl: 0,
      latency_ms: 0,
    };
    expect(
      ProfessorResponseDtoSchema.safeParse({ ...base, confidence: 1.5 }).success
    ).toBe(false);
  });
});

describe("mapProfessorOutputToDto", () => {
  it("produz DTO snake_case conforme schema", () => {
    const dto = mapProfessorOutputToDto({
      answer: "Resposta",
      mode: "rag",
      model: "flash",
      citations: [
        {
          documentId: UUID,
          documentTitle: "Doc",
          chunkId: UUID2,
          score: 0.9,
          subject: "Direito",
          topic: null,
        },
      ],
      documents: [UUID],
      chunksUsed: 1,
      tokens: { in: 10, out: 5, total: 15 },
      costBRL: 0.001,
      latencyMs: 100,
      confidence: 0.9,
    });
    const parsed = ProfessorResponseDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    expect(dto.mode).toBe("rag");
    expect(dto.citations[0].document_id).toBe(UUID);
    expect(dto.chunks_used).toBe(1);
    expect(dto.cost_brl).toBe(0.001);
  });
});
