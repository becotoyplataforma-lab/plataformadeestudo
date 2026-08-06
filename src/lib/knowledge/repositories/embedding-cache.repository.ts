/**
 * ConcursoAI — EmbeddingCacheRepository
 */
import { eq, and } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { embeddingCache } from "@/db/schema/knowledge";

export const EmbeddingCacheRepository = {
  /** Buscar embedding cachedo por hash e modelo. */
  async get(contentHash: string, model: string) {
    const [row] = await db
      .select()
      .from(embeddingCache)
      .where(
        and(
          eq(embeddingCache.contentHash, contentHash),
          eq(embeddingCache.model, model)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Armazenar embedding no cache. */
  async set(contentHash: string, model: string, vector: number[]) {
    return db
      .insert(embeddingCache)
      .values({
        contentHash,
        model,
        embedding: vector,
      } as typeof embeddingCache.$inferInsert)
      .onConflictDoNothing()
      .returning();
  },

  /** Invalidar cache para um modelo (migration de modelo). */
  async invalidateByModel(model: string) {
    return db.delete(embeddingCache).where(eq(embeddingCache.model, model));
  },
};
