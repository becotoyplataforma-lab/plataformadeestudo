/**
 * ConcursoAI — UsageRepository
 *
 * Camada de persistência do aggregate AiUsage (consumo por usuário e dia).
 */
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { aiUsage } from "@/db/schema/ai";

export const UsageRepository = {
  /** Buscar uso do usuário em uma data (início do dia). */
  async findByUserAndDay(userId: string, day: Date) {
    const [row] = await db
      .select()
      .from(aiUsage)
      .where(and(eq(aiUsage.userId, userId), eq(aiUsage.usageDate, day)))
      .limit(1);
    return row ?? null;
  },

  /** Incrementar uso (upsert) — usada quando o RPC register_ai_usage não existe. */
  async increment(userId: string, day: Date, tokensIn: number, tokensOut: number) {
    const [row] = await db
      .insert(aiUsage)
      .values({
        userId,
        usageDate: day,
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
      })
      .returning();
    return row;
  },
};
