/**
 * ConcursoAI — QuestionAttemptRepository
 *
 * Camada de persistência do aggregate QuestionAttempt (tentativa imutável).
 */
import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { questionAttempts, questions } from "@/db/schema";

export const QuestionAttemptRepository = {
  /** Criar tentativa. */
  async create(input: typeof questionAttempts.$inferInsert) {
    const [row] = await db.insert(questionAttempts).values(input).returning();
    return row;
  },

  /** Buscar tentativa por ID (valida ownership). */
  async findById(id: string, userId: string) {
    const [row] = await db
      .select()
      .from(questionAttempts)
      .where(
        and(
          eq(questionAttempts.id, id),
          eq(questionAttempts.userId, userId)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Listar tentativas do usuário (com enunciado da questão). */
  async listByUser(userId: string, limit = 50, offset = 0) {
    return db
      .select({
        id: questionAttempts.id,
        questionId: questionAttempts.questionId,
        selectedLetter: questionAttempts.selectedLetter,
        isCorrect: questionAttempts.isCorrect,
        timeSpentSec: questionAttempts.timeSpentSec,
        mode: questionAttempts.mode,
        createdAt: questionAttempts.createdAt,
        enunciado: questions.enunciado,
      })
      .from(questionAttempts)
      .leftJoin(questions, eq(questionAttempts.questionId, questions.id))
      .where(eq(questionAttempts.userId, userId))
      .orderBy(desc(questionAttempts.createdAt))
      .limit(limit)
      .offset(offset);
  },

  /** Contar tentativas do usuário. */
  async countByUser(userId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questionAttempts)
      .where(eq(questionAttempts.userId, userId));
    return row?.count ?? 0;
  },
};
