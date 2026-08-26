/**
 * ConcursoAI — Knowledge DTOs
 *
 * Data Transfer Objects para o domínio Knowledge.
 * Todo dado que cruza a fronteira API → Cliente passa por validação Zod.
 *
 * Segue: DD-006 (DTO obrigatório), DD-007 (Zod obrigatório),
 *        .ai/blueprints/01..07
 */
import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

// ============================================================
// Document DTOs
// ============================================================

/** Schema de resposta após upload bem-sucedido. */
export const DocumentDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  type: z.enum(["pdf", "docx", "txt", "markdown", "html", "edital", "apostila"]),
  title: z.string(),
  storage_path: z.string(),
  // storage_backend é opcional no DTO para manter compatibilidade com
  // respostas/consumidores existentes durante a transição de storage.
  storage_backend: z.enum(["r2", "supabase"]).optional().default("supabase"),
  status: z.enum(["pending", "processing", "processed", "chunked", "indexing", "indexed", "failed"]),
  file_size: z.number().int().nonnegative().nullable(),
  mime_type: z.string().nullable(),
  source_type: z.enum(["upload", "edital", "url", "consolidated"]),
  source_url: z.string().url().nullable().optional(),
  external_id: z.string().uuid().nullable().optional(),
  source_document_ids: z.array(z.string().uuid()).nullable().optional(),
  metadata: z.record(z.unknown()).default({}),
  page_count: z.number().int().nonnegative().nullable().optional(),
  chunk_count: z.number().int().nonnegative().default(0),
  embedding_count: z.number().int().nonnegative().default(0),
  processing_error: z.string().nullable().optional(),
  review_status: z.enum(["pendente", "aprovado", "rejeitado"]).default("pendente"),
  review_note: z.string().nullable().optional(),
  edital_id: z.string().uuid().nullable().optional(),
  position_id: z.string().uuid().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type DocumentDto = OutputOf<typeof DocumentDtoSchema>;

export function toDocumentDto(input: unknown): DocumentDto | null {
  return parseDto(DocumentDtoSchema, input);
}

// ============================================================
// Upload DTOs
// ============================================================

export const UploadResponseDtoSchema = z.object({
  document: DocumentDtoSchema,
});

export type UploadResponseDto = OutputOf<typeof UploadResponseDtoSchema>;

export function toUploadResponseDto(input: unknown): UploadResponseDto | null {
  return parseDto(UploadResponseDtoSchema, input);
}

// ============================================================
// Search DTOs
// ============================================================

export const SearchRequestDtoSchema = z.object({
  query: z.string().min(1).max(500),
  subject_id: z.string().uuid().optional(),
  topic_id: z.string().uuid().optional(),
  document_id: z.string().uuid().optional(),
  tags: z.array(z.string()).max(10).optional(),
  top_k: z.number().int().min(1).max(50).default(10),
});

export type SearchRequestDto = OutputOf<typeof SearchRequestDtoSchema>;

export const SearchResultItemSchema = z.object({
  chunk_id: z.string().uuid(),
  document_id: z.string().uuid(),
  document_title: z.string(),
  content: z.string(),
  score: z.number(),
  page: z.number().optional(),
  section_title: z.string().optional(),
  subject_name: z.string().optional(),
});

export const SearchResponseDtoSchema = z.object({
  results: z.array(SearchResultItemSchema),
  total_hits: z.number().int().nonnegative(),
  query_time_ms: z.number().int().nonnegative(),
});

export type SearchResponseDto = OutputOf<typeof SearchResponseDtoSchema>;

export function toSearchResponseDto(input: unknown): SearchResponseDto | null {
  return parseDto(SearchResponseDtoSchema, input);
}

// ============================================================
// Subject / Topic DTOs
// ============================================================

export const KnowledgeSubjectDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  status: z.string(),
});

export type KnowledgeSubjectDto = OutputOf<typeof KnowledgeSubjectDtoSchema>;

export const KnowledgeTopicDtoSchema = z.object({
  id: z.string().uuid(),
  subject_id: z.string().uuid(),
  parent_topic_id: z.string().uuid().nullable().optional(),
  name: z.string(),
  slug: z.string(),
  description: z.string().nullable().optional(),
  status: z.string(),
});

export type KnowledgeTopicDto = OutputOf<typeof KnowledgeTopicDtoSchema>;

export const KnowledgeTagDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

export type KnowledgeTagDto = OutputOf<typeof KnowledgeTagDtoSchema>;

// ============================================================
// Mappers
// ============================================================

import type { documents, knowledgeSubjects, knowledgeTopics, knowledgeTags } from "@/db/schema/knowledge";

type DocumentRow = typeof documents.$inferSelect;
type SubjectRow = typeof knowledgeSubjects.$inferSelect;
type TopicRow = typeof knowledgeTopics.$inferSelect;
type TagRow = typeof knowledgeTags.$inferSelect;

export function mapDocumentToDto(row: DocumentRow): DocumentDto {
  return {
    id: row.id,
    user_id: row.userId,
    type: row.type,
    title: row.title,
    storage_path: row.storagePath,
    storage_backend: (row.storageBackend as "r2" | "supabase" | undefined) ?? "supabase",
    status: row.status,
    file_size: row.fileSize,
    mime_type: row.mimeType,
    source_type: row.sourceType,
    source_url: row.sourceUrl ?? undefined,
    external_id: row.externalId ?? undefined,
    source_document_ids: (row.sourceDocumentIds as string[] | null) ?? undefined,
    metadata: (row.metadata as Record<string, unknown>) ?? {},
    page_count: row.pageCount ?? undefined,
    chunk_count: row.chunkCount ?? 0,
    embedding_count: row.embeddingCount ?? 0,
    processing_error: row.processingError ?? undefined,
    review_status: row.reviewStatus as "pendente" | "aprovado" | "rejeitado",
    review_note: row.reviewNote ?? undefined,
    edital_id: row.editalId ?? undefined,
    position_id: row.positionId ?? undefined,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function mapSubjectToDto(row: SubjectRow): KnowledgeSubjectDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    status: row.status,
  };
}

export function mapTopicToDto(row: TopicRow): KnowledgeTopicDto {
  return {
    id: row.id,
    subject_id: row.subjectId,
    parent_topic_id: row.parentTopicId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    status: row.status,
  };
}

export function mapTagToDto(row: TagRow): KnowledgeTagDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
  };
}
