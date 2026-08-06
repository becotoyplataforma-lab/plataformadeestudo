/**
 * ConcursoAI — KnowledgeTagRepository
 */
import { eq, ilike } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { knowledgeTags } from "@/db/schema/knowledge";

export const KnowledgeTagRepository = {
  /** Buscar tag por slug. */
  async findBySlug(slug: string) {
    const [row] = await db
      .select()
      .from(knowledgeTags)
      .where(eq(knowledgeTags.slug, slug))
      .limit(1);
    return row ?? null;
  },

  /** Buscar ou criar tag. */
  async findOrCreate(name: string) {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const existing = await this.findBySlug(slug);
    if (existing) return existing;

    const [row] = await db
      .insert(knowledgeTags)
      .values({ name, slug })
      .returning();
    return row;
  },

  /** Busca textual por nome. */
  async searchByName(name: string) {
    return db
      .select()
      .from(knowledgeTags)
      .where(ilike(knowledgeTags.name, `%${name}%`))
      .limit(20);
  },

  /** Listar todas as tags. */
  async getAll() {
    return db.select().from(knowledgeTags).orderBy(knowledgeTags.name);
  },

  /** Buscar múltiplas tags por IDs. */
  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    const { inArray } = await import("drizzle-orm");
    return db
      .select()
      .from(knowledgeTags)
      .where(inArray(knowledgeTags.id, ids));
  },
};
