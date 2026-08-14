import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { aiUsage } from "@/db/schema/ai";
import type { Plan } from "@/types";

/**
 * Cotas de IA por plano (ver docs/03-AIDD.md e sql/schema.sql).
 * A função SQL get_plan_limits é a fonte da verdade; este helper
 * espelha os valores para uso em TS no servidor.
 */
const PLAN_LIMITS: Record<Plan, { maxMessages: number; maxTokens: number }> = {
  // Espelha a função SQL get_plan_limits (sql/schema.sql) — fonte da verdade.
  free: { maxMessages: 50, maxTokens: 100_000 },
  pro: { maxMessages: 500, maxTokens: 1_000_000 },
  intensivo: { maxMessages: 2_000, maxTokens: 5_000_000 },
};

export interface UsageStatus {
  usedMessages: number;
  usedTokens: number;
  maxMessages: number;
  maxTokens: number;
  remainingMessages: number;
  canSend: boolean;
  plan: Plan;
}

/** Retorna o status de uso de IA do usuário no dia atual. */
export async function getAiUsage(userId: string): Promise<UsageStatus> {
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

  // Plano efetivo hoje: "free" (profiles não possui coluna `plano`; a fonte
  // real do plano fica em billing.subscriptions — fora do escopo desta frente).
  const plan: Plan = "free";
  const limits = PLAN_LIMITS[plan];
  const usedMessages = usageRow?.messagesCount ?? 0;
  const usedTokens = (usageRow?.tokensIn ?? 0) + (usageRow?.tokensOut ?? 0);

  return {
    usedMessages,
    usedTokens,
    maxMessages: limits.maxMessages,
    maxTokens: limits.maxTokens,
    remainingMessages: Math.max(0, limits.maxMessages - usedMessages),
    canSend: usedMessages < limits.maxMessages,
    plan,
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
