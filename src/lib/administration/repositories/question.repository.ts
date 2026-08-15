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

  /** Buscar questão pelo hash de conteúdo (dedup na importação). */
  async findByContentHash(contentHash: string) {
    const [row] = await db
      .select({ id: questions.id })
      .from(questions)
      .where(
        and(eq(questions.contentHash, contentHash), isNull(questions.deletedAt))
      )
      .limit(1);
    return row ?? null;
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
