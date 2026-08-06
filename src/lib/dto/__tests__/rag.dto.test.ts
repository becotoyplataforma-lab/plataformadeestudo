/**
 * Testes dos DTOs do RAG — validação Zod e mappers.
 */
import { describe, it, expect } from "vitest";
import {
  RagRequestDtoSchema,
  RagResponseDtoSchema,
  CitationDtoSchema,
  ContextChunkDtoSchema,
  mapCitationToDto,
  mapRagOutputToDto,
} from "@/lib/dto/rag.dto";

const UUID = "00000000-0000-0000-0000-000000000001";
const UUID2 = "00000000-0000-0000-0000-000000000002";

describe("RagRequestDtoSchema", () => {
  it("aceita pergunta válida com defaults", () => {
    const r = RagRequestDtoSchema.safeParse({ question: "O que é RLS?" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.top_k).toBe(5);
  });

  it("rejeita pergunta vazia", () => {
    expect(RagRequestDtoSchema.safeParse({ question: "" }).success).toBe(false);
  });

  it("rejeita pergunta muito longa", () => {
    expect(
      RagRequestDtoSchema.safeParse({ question: "a".repeat(2001) }).success
    ).toBe(false);
  });

  it("rejeita top_k fora de 1-20", () => {
    expect(
      RagRequestDtoSchema.safeParse({ question: "q", top_k: 0 }).success
    ).toBe(false);
    expect(
      RagRequestDtoSchema.safeParse({ question: "q", top_k: 21 }).success
    ).toBe(false);
  });

  it("aceita filtros e model opcionais", () => {
    const r = RagRequestDtoSchema.safeParse({
      question: "q",
      subject_id: UUID,
      document_ids: [UUID2],
      model: "pro",
    });
    expect(r.success).toBe(true);
  });

  it("rejeita document_ids com uuid inválido", () => {
    const r = RagRequestDtoSchema.safeParse({
      question: "q",
      document_ids: ["nao-e-uuid"],
    });
    expect(r.success).toBe(false);
  });
});

describe("CitationDtoSchema", () => {
  it("aceita citação válida", () => {
    const r = CitationDtoSchema.safeParse({
      document_id: UUID,
      document_title: "Doc",
      chunk_id: UUID2,
      score: 0.82,
      subject: "Direito",
      topic: null,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita score ausente", () => {
    const r = CitationDtoSchema.safeParse({
      document_id: UUID,
      document_title: "Doc",
      chunk_id: UUID2,
      subject: null,
      topic: null,
    });
    expect(r.success).toBe(false);
  });
});

describe("ContextChunkDtoSchema", () => {
  it("aceita chunk válido", () => {
    const r = ContextChunkDtoSchema.safeParse({
      chunk_id: UUID,
      document_id: UUID2,
      document_title: "Doc",
      content: "Trecho",
      score: 0.5,
      subject: null,
      topic: null,
    });
    expect(r.success).toBe(true);
  });
});

describe("RagResponseDtoSchema", () => {
  it("aceita resposta válida completa", () => {
    const r = RagResponseDtoSchema.safeParse({
      answer: "Resposta",
      citations: [],
      documents: [UUID],
      chunks_used: 1,
      tokens: { in: 10, out: 5, total: 15 },
      latency_ms: 200,
      model: "flash",
      confidence: 0.8,
    });
    expect(r.success).toBe(true);
  });

  it("rejeita tokens negativos", () => {
    const r = RagResponseDtoSchema.safeParse({
      answer: "R",
      citations: [],
      documents: [],
      chunks_used: 0,
      tokens: { in: -1, out: 0, total: -1 },
      latency_ms: 0,
      model: "flash",
      confidence: 0,
    });
    expect(r.success).toBe(false);
  });

  it("rejeita confidence fora de 0-1", () => {
    const base = {
      answer: "R",
      citations: [],
      documents: [],
      chunks_used: 0,
      tokens: { in: 0, out: 0, total: 0 },
      latency_ms: 0,
      model: "flash",
    };
    expect(
      RagResponseDtoSchema.safeParse({ ...base, confidence: 1.5 }).success
    ).toBe(false);
  });
});

describe("Mappers", () => {
  it("mapCitationToDto mapeia para snake_case", () => {
    const dto = mapCitationToDto({
      documentId: UUID,
      documentTitle: "Doc",
      chunkId: UUID2,
      score: 0.7,
      subject: "Direito",
      topic: null,
    });
    expect(dto.document_id).toBe(UUID);
    expect(dto.document_title).toBe("Doc");
    expect(dto.chunk_id).toBe(UUID2);
  });

  it("mapRagOutputToDto produz DTO conforme schema", () => {
    const dto = mapRagOutputToDto({
      answer: "R",
      citations: [
        {
          documentId: UUID,
          documentTitle: "Doc",
          chunkId: UUID2,
          score: 0.5,
          subject: null,
          topic: null,
        },
      ],
      documents: [UUID],
      chunksUsed: 1,
      tokens: { in: 1, out: 2, total: 3 },
      latencyMs: 10,
      model: "flash",
      confidence: 0.5,
      searchTimeMs: 3,
      providerTimeMs: 7,
    });
    const parsed = RagResponseDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    expect(dto.chunks_used).toBe(1);
  });
});
