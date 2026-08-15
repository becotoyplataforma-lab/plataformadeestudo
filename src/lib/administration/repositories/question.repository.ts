/**
 * ConcursoAI — QuestionWriteRepository (Administration → Study)
 *
 * Escrita de questões/alternativas e histórico de moderação.
 */
import { eq, isNull, and } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  questions,
  questionOptions,
  questionModerationEvents,
} from "@/db/schema/study";

export const QuestionWriteRepository = {
  /** Criar questão (retorna a linha criada). */
  async createQuestion(input: typeof questions.$inferInsert) {
    const [row] = await db.insert(questions).values(input).returning();
    return row;
  },

  /** Criar alternativas em lote. */
  async createOptions(options: (typeof questionOptions.$inferInsert)[]) {
    if (options.length === 0) return [];
    return db.insert(questionOptions).values(options).returning();
  },

  /** Listar alternativas de uma questão (ativas). */
  async listOptions(questionId: string) {
    return db
      .select()
      .from(questionOptions)
      .where(
        and(eq(questionOptions.questionId, questionId), isNull(questionOptions.deletedAt))
      )
      .orderBy(questionOptions.letter);
  },

  /** Registrar evento de moderação. */
  async createModerationEvent(input: typeof questionModerationEvents.$inferInsert) {
    const [row] = await db.insert(questionModerationEvents).values(input).returning();
    return row;
  },
};
