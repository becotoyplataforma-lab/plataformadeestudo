/**
 * ConcursoAI — Professor DTOs
 *
 * Data Transfer Objects do Application Service Professor IA.
 * Segue: DD-006 (DTO obrigatório), DD-007 (Zod obrigatório),
 *        docs/ENGINE-ARCHITECTURE.md
 *
 * Reutiliza CitationDtoSchema/mapCitationToDto do RAG (sem duplicação).
 */
import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";
import { CitationDtoSchema, mapCitationToDto } from "@/lib/dto/rag.dto";
import type { ProfessorOutput } from "@/lib/ai/services/professor.service";

// ============================================================
// Request
// ============================================================

export const ProfessorRequestDtoSchema = z.object({
  message: z.string().min(1).max(2000),
  mode: z.enum(["auto", "chat", "rag"]).optional(),
  session_id: z.string().uuid().optional(),
  subject_id: z.string().uuid().optional(),
  document_ids: z.array(z.string().uuid()).max(20).optional(),
  top_k: z.number().int().min(1).max(20).optional(),
  model: z.enum(["flash", "pro", "muse"]).optional(),
});
export type ProfessorRequestDto = OutputOf<typeof ProfessorRequestDtoSchema>;

// ============================================================
// Response
// ============================================================

export const ProfessorResponseDtoSchema = z.object({
  answer: z.string(),
  mode: z.enum(["chat", "rag"]),
  model: z.enum(["flash", "pro", "muse"]),
  citations: z.array(CitationDtoSchema),
  documents: z.array(z.string().uuid()),
  chunks_used: z.number().int().nonnegative(),
  tokens: z.object({
    in: z.number().int().nonnegative(),
    out: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
  cost_brl: z.number().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
  confidence: z.number().min(0).max(1),
});
export type ProfessorResponseDto = OutputOf<typeof ProfessorResponseDtoSchema>;

// ============================================================
// Mappers
// ============================================================

export function toProfessorResponseDto(input: unknown): ProfessorResponseDto | null {
  return parseDto(ProfessorResponseDtoSchema, input);
}

export function mapProfessorOutputToDto(out: ProfessorOutput): ProfessorResponseDto {
  return {
    answer: out.answer,
    mode: out.mode,
    model: out.model,
    citations: out.citations.map(mapCitationToDto),
    documents: out.documents,
    chunks_used: out.chunksUsed,
    tokens: {
      in: out.tokens.in,
      out: out.tokens.out,
      total: out.tokens.total,
    },
    cost_brl: out.costBRL,
    latency_ms: out.latencyMs,
    confidence: out.confidence,
  };
}
