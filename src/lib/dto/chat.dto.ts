import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";

/** DTO de sessão de conversa (chat). */
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

export function toChatSessionDto(input: unknown): ChatSessionDto | null {
  return parseDto(ChatSessionDtoSchema, input);
}

export function toChatSessionDtoList(input: unknown[]): ChatSessionDto[] {
  return input
    .map((row) => toChatSessionDto(row))
    .filter((dto): dto is ChatSessionDto => dto !== null);
}

/** DTO de mensagem (chat) — sem metadados internos desnecessários. */
export const ChatMessageDtoSchema = z.object({
  id: z.string().uuid(),
  session_id: z.string().uuid(),
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
  model: z.enum(["flash", "pro"]).nullable(),
  created_at: z.string(),
});
export type ChatMessageDto = OutputOf<typeof ChatMessageDtoSchema>;

export function toChatMessageDto(input: unknown): ChatMessageDto | null {
  return parseDto(ChatMessageDtoSchema, input);
}

export function toChatMessageDtoList(input: unknown[]): ChatMessageDto[] {
  return input
    .map((row) => toChatMessageDto(row))
    .filter((dto): dto is ChatMessageDto => dto !== null);
}

/** DTO de status de uso de IA (limites do plano). */
export const AiUsageDtoSchema = z.object({
  usedMessages: z.number().int().min(0),
  usedTokens: z.number().int().min(0),
  maxMessages: z.number().int().min(0),
  maxTokens: z.number().int().min(0),
  remainingMessages: z.number().int().min(0),
  canSend: z.boolean(),
  plan: z.enum(["free", "pro", "intensivo"]),
});
export type AiUsageDto = OutputOf<typeof AiUsageDtoSchema>;

export function toAiUsageDto(input: unknown): AiUsageDto | null {
  return parseDto(AiUsageDtoSchema, input);
}
