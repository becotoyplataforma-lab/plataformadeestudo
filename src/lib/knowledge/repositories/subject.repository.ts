/**
 * ConcursoAI — KnowledgeSubjectRepository
 */
import { eq, and, isNull, ilike } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { knowledgeSubjects } from "@/db/schema/knowledge";

export const KnowledgeSubjectRepository = {
  /** Listar todas as matérias ativas. */
  async getAll() {
    return db
      .select()
      .from(knowledgeSubjects)
      .where(isNull(knowledgeSubjects.deletedAt))
      .orderBy(knowledgeSubjects.name);
  },

  /** Buscar matéria por ID. */
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(knowledgeSubjects)
      .where(and(eq(knowledgeSubjects.id, id), isNull(knowledgeSubjects.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Buscar por slug. */
  async findBySlug(slug: string) {
    const [row] = await db
      .select()
      .from(knowledgeSubjects)
      .where(and(eq(knowledgeSubjects.slug, slug), isNull(knowledgeSubjects.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Buscar por nome exato. */
  async findByName(name: string) {
    const [row] = await db
      .select()
      .from(knowledgeSubjects)
      .where(and(eq(knowledgeSubjects.name, name), isNull(knowledgeSubjects.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Busca textual por nome (case-insensitive). */
  async searchByName(name: string) {
    return db
      .select()
      .from(knowledgeSubjects)
      .where(
        and(ilike(knowledgeSubjects.name, `%${name}%`), isNull(knowledgeSubjects.deletedAt))
      )
      .limit(10);
  },
};
