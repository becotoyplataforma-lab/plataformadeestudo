/**
 * ConcursoAI — RAG DTOs
 *
 * Data Transfer Objects para o RAG Engine.
 * Segue: DD-006 (DTO obrigatório), DD-007 (Zod obrigatório),
 *        docs/ENGINE-ARCHITECTURE.md (RAG Engine)
 */
import { z } from "zod";
import { parseDto, strictDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";
import type { Citation, RagOutput } from "@/lib/ai/services/rag.service";

// ============================================================
// Request
// ============================================================

export const RagRequestDtoSchema = z.object({
  question: z.string().min(1).max(2000),
  subject_id: z.string().uuid().optional(),
  document_ids: z.array(z.string().uuid()).max(20).optional(),
  top_k: z.number().int().min(1).max(20).default(5),
  model: z.enum(["flash", "pro", "kimi"]).optional(),
});
export type RagRequestDto = OutputOf<typeof RagRequestDtoSchema>;

// ============================================================
// Citation
// ============================================================

export const CitationDtoSchema = z.object({
  document_id: z.string().uuid(),
  document_title: z.string(),
  chunk_id: z.string().uuid(),
  score: z.number(),
  subject: z.string().nullable(),
  topic: z.string().nullable(),
});
export type CitationDto = OutputOf<typeof CitationDtoSchema>;

// ============================================================
// ContextChunk (representação interna de um chunk usado no RAG)
// ============================================================

export const ContextChunkDtoSchema = z.object({
  chunk_id: z.string().uuid(),
  document_id: z.string().uuid(),
  document_title: z.string(),
  content: z.string(),
  score: z.number(),
  subject: z.string().nullable(),
  topic: z.string().nullable(),
});
export type ContextChunkDto = OutputOf<typeof ContextChunkDtoSchema>;

// ============================================================
// Response
// ============================================================

export const RagResponseDtoSchema = z.object({
  answer: z.string(),
  citations: z.array(CitationDtoSchema),
  documents: z.array(z.string().uuid()),
  chunks_used: z.number().int().nonnegative(),
  tokens: z.object({
    in: z.number().int().nonnegative(),
    out: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  latency_ms: z.number().int().nonnegative(),
  model: z.enum(["flash", "pro", "kimi"]),
  confidence: z.number().min(0).max(1),
});
export type RagResponseDto = OutputOf<typeof RagResponseDtoSchema>;

// ============================================================
// Mappers
// ============================================================

export function mapCitationToDto(c: Citation): CitationDto {
  return {
    document_id: c.documentId,
    document_title: c.documentTitle,
    chunk_id: c.chunkId,
    score: c.score,
    subject: c.subject,
    topic: c.topic,
  };
}

export function toRagResponseDto(input: unknown): RagResponseDto | null {
  return parseDto(RagResponseDtoSchema, input);
}

/** Como `toRagResponseDto`, mas lança se não conformar (fail-fast no servidor). */
export function toRagResponseDtoStrict(input: unknown): RagResponseDto {
  return strictDto(RagResponseDtoSchema, input);
}

export function mapRagOutputToDto(out: RagOutput): RagResponseDto {
  return {
    answer: out.answer,
    citations: out.citations.map(mapCitationToDto),
    documents: out.documents,
    chunks_used: out.chunksUsed,
    tokens: {
      in: out.tokens.in,
      out: out.tokens.out,
      total: out.tokens.total,
    },
    latency_ms: out.latencyMs,
    model: out.model,
    confidence: out.confidence,
  };
}
