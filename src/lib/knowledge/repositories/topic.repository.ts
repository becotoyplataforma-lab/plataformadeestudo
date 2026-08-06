/**
 * ConcursoAI — KnowledgeTopicRepository
 */
import { eq, and, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { knowledgeTopics } from "@/db/schema/knowledge";

export const KnowledgeTopicRepository = {
  /** Tópicos de uma matéria (raiz, sem parent). */
  async getRootBySubject(subjectId: string) {
    return db
      .select()
      .from(knowledgeTopics)
      .where(
        and(
          eq(knowledgeTopics.subjectId, subjectId),
          isNull(knowledgeTopics.parentTopicId),
          isNull(knowledgeTopics.deletedAt)
        )
      )
      .orderBy(knowledgeTopics.name);
  },

  /** Sub-tópicos de um tópico pai. */
  async getChildren(parentTopicId: string) {
    return db
      .select()
      .from(knowledgeTopics)
      .where(
        and(
          eq(knowledgeTopics.parentTopicId, parentTopicId),
          isNull(knowledgeTopics.deletedAt)
        )
      )
      .orderBy(knowledgeTopics.name);
  },

  /** Todos os tópicos de uma matéria (flat). */
  async getAllBySubject(subjectId: string) {
    return db
      .select()
      .from(knowledgeTopics)
      .where(
        and(
          eq(knowledgeTopics.subjectId, subjectId),
          isNull(knowledgeTopics.deletedAt)
        )
      )
      .orderBy(knowledgeTopics.name);
  },

  /** Buscar por ID. */
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(knowledgeTopics)
      .where(and(eq(knowledgeTopics.id, id), isNull(knowledgeTopics.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Buscar por slug + subject. */
  async findBySlug(subjectId: string, slug: string) {
    const [row] = await db
      .select()
      .from(knowledgeTopics)
      .where(
        and(
          eq(knowledgeTopics.subjectId, subjectId),
          eq(knowledgeTopics.slug, slug),
          isNull(knowledgeTopics.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },
};
