/**
 * ConcursoAI — DailySummaryRepository (Analytics)
 *
 * Persistência do aggregate DailySummary (um por usuário e dia).
 * Materialização (quando escrever) é decisão aberta — OPEN-006 (docs/06).
 */
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { dailySummaries } from "@/db/schema/analytics";

export const DailySummaryRepository = {
  /** Buscar resumo de um usuário em uma data. */
  async findByUserAndDate(userId: string, date: Date) {
    const [row] = await db
      .select()
      .from(dailySummaries)
      .where(and(eq(dailySummaries.userId, userId), eq(dailySummaries.summaryDate, date)))
      .limit(1);
    return row ?? null;
  },

  /** Listar resumos de um usuário em um intervalo. */
  async listByUserInRange(userId: string, from: Date, to: Date) {
    return db
      .select()
      .from(dailySummaries)
      .where(
        and(
          eq(dailySummaries.userId, userId),
          gte(dailySummaries.summaryDate, from),
          lte(dailySummaries.summaryDate, to)
        )
      )
      .orderBy(dailySummaries.summaryDate);
  },

  /** Upsert do resumo diário (usado por job/V1.1 — OPEN-006). */
  async upsert(input: typeof dailySummaries.$inferInsert) {
    const [row] = await db
      .insert(dailySummaries)
      .values(input)
      .onConflictDoUpdate({
        target: [dailySummaries.userId, dailySummaries.summaryDate],
        set: {
          totalQuestions: sql`excluded.total_questions`,
          correctAnswers: sql`excluded.correct_answers`,
          studyMinutes: sql`excluded.study_minutes`,
          reviewsDone: sql`excluded.reviews_done`,
          aiMessages: sql`excluded.ai_messages`,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  },
};
