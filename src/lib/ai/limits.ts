import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { aiUsage } from "@/db/schema/ai";
import type { PlanLimits } from "@/lib/billing/types";

/**
 * Limites de IA são resolvidos pela camada Billing (OPEN-004) e INJETADOS
 * aqui. Este módulo não decide plano nem consulta o Billing em runtime —
 * fica desacoplado: responsável apenas por ler/gravar ai_usage e aplicar
 * os limites recebidos.
 */
export interface UsageStatus {
  usedMessages: number;
  usedTokens: number;
  maxMessages: number;
  maxTokens: number;
  remainingMessages: number;
  canSend: boolean;
}

/** Retorna o status de uso de IA do usuário no dia atual. */
export async function getAiUsage(
  userId: string,
  limits: PlanLimits
): Promise<UsageStatus> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);

  const [usageRow] = await db
    .select()
    .from(aiUsage)
    .where(
      and(
        eq(aiUsage.userId, userId),
        gte(aiUsage.usageDate, start),
        lt(aiUsage.usageDate, end)
      )
    )
    .limit(1);

  const usedMessages = usageRow?.messagesCount ?? 0;
  const usedTokens = (usageRow?.tokensIn ?? 0) + (usageRow?.tokensOut ?? 0);

  return {
    usedMessages,
    usedTokens,
    maxMessages: limits.maxMessages,
    maxTokens: limits.maxTokens,
    remainingMessages: Math.max(0, limits.maxMessages - usedMessages),
    canSend: usedMessages < limits.maxMessages,
  };
}

/** Registra uso de IA (upsert diário via Drizzle). */
export async function registerUsage(
  userId: string,
  tokensIn: number,
  tokensOut: number
): Promise<void> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  await db
    .insert(aiUsage)
    .values({
      userId,
      usageDate: start,
      messagesCount: 1,
      tokensIn,
      tokensOut,
    })
    .onConflictDoUpdate({
      target: [aiUsage.userId, aiUsage.usageDate],
      set: {
        messagesCount: sql`${aiUsage.messagesCount} + 1`,
        tokensIn: sql`${aiUsage.tokensIn} + ${tokensIn}`,
        tokensOut: sql`${aiUsage.tokensOut} + ${tokensOut}`,
        updatedAt: new Date(),
      },
    });
}
