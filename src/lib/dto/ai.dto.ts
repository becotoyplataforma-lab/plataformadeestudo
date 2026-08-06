/**
 * ConcursoAI — AI DTOs
 *
 * Data Transfer Objects para o domínio AI.
 * Segue: DD-006 (DTO obrigatório), DD-007 (Zod obrigatório),
 *        docs/08-DATABASE-PHYSICAL.md
 */
import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

// ============================================================
// Chat (Request / Response)
// ============================================================

export const ChatRequestDtoSchema = z.object({
  message: z.string().min(1).max(4000),
  session_id: z.string().uuid().optional(),
  subject_id: z.string().uuid().optional(),
  model: z.enum(["flash", "pro"]).optional(),
});
export type ChatRequestDto = OutputOf<typeof ChatRequestDtoSchema>;

export const ChatResponseDtoSchema = z.object({
  session_id: z.string().uuid(),
  message_id: z.string().uuid(),
  response: z.string(),
  model: z.enum(["flash", "pro"]),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
  cost_brl: z.number().nonnegative(),
  latency_ms: z.number().int().nonnegative(),
});
export type ChatResponseDto = OutputOf<typeof ChatResponseDtoSchema>;

// ============================================================
// Session
// ============================================================

export const ChatSessionDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  subject_id: z.string().uuid().nullable(),
  model: z.enum(["flash", "pro"]),
  created_at: z.string(),
  updated_at: z.string(),
});
export type ChatSessionDto = OutputOf<typeof ChatSessionDtoSchema>;

// ============================================================
// Message
// ============================================================

export const ChatMessageDtoSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
  model: z.enum(["flash", "pro"]).nullable(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  created_at: z.string(),
});
export type ChatMessageDto = OutputOf<typeof ChatMessageDtoSchema>;

// ============================================================
// Usage
// ============================================================

export const UsageDtoSchema = z.object({
  usage_date: z.string(),
  messages_count: z.number().int().nonnegative(),
  tokens_in: z.number().int().nonnegative(),
  tokens_out: z.number().int().nonnegative(),
  total_tokens: z.number().int().nonnegative(),
});
export type UsageDto = OutputOf<typeof UsageDtoSchema>;

export const UsageStatusDtoSchema = z.object({
  messages_used: z.number().int().nonnegative(),
  messages_limit: z.number().int().nonnegative(),
  can_send: z.boolean(),
  tokens_used: z.number().int().nonnegative(),
  tokens_limit: z.number().int().nonnegative(),
});
export type UsageStatusDto = OutputOf<typeof UsageStatusDtoSchema>;

// ============================================================
// Mappers
// ============================================================

import type { chatSessions, chatMessages, aiUsage } from "@/db/schema/ai";

type SessionRow = typeof chatSessions.$inferSelect;
type MessageRow = typeof chatMessages.$inferSelect;
type UsageRow = typeof aiUsage.$inferSelect;

export function mapSessionToDto(row: SessionRow): ChatSessionDto {
  return {
    id: row.id,
    user_id: row.userId,
    title: row.title,
    subject_id: row.knowledgeSubjectId,
    model: row.model,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export function mapMessageToDto(row: MessageRow): ChatMessageDto {
  return {
    id: row.id,
    session_id: row.sessionId,
    role: row.role,
    content: row.content,
    model: row.model,
    tokens_in: row.tokensIn,
    tokens_out: row.tokensOut,
    created_at: row.createdAt.toISOString(),
  };
}

export function mapUsageToDto(row: UsageRow): UsageDto {
  return {
    usage_date: row.usageDate.toISOString(),
    messages_count: row.messagesCount,
    tokens_in: row.tokensIn,
    tokens_out: row.tokensOut,
    total_tokens: row.tokensIn + row.tokensOut,
  };
}

export function toChatSessionDto(input: unknown): ChatSessionDto | null {
  return parseDto(ChatSessionDtoSchema, input);
}
