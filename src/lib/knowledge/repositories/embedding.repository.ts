/**
 * ConcursoAI — EmbeddingRepository
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { embeddings } from "@/db/schema/knowledge";

export const EmbeddingRepository = {
  /** Buscar embedding por chunk_id. */
  async findByChunkId(chunkId: string) {
    const [row] = await db
      .select()
      .from(embeddings)
      .where(eq(embeddings.chunkId, chunkId))
      .limit(1);
    return row ?? null;
  },

  /** Buscar embeddings por lista de chunk IDs. */
  async findByChunkIds(chunkIds: string[]) {
    if (chunkIds.length === 0) return [];
    return db
      .select()
      .from(embeddings)
      .where(inArray(embeddings.chunkId, chunkIds));
  },

  /** Criar múltiplos embeddings em batch. */
  async createBatch(
    data: (typeof embeddings.$inferInsert)[]
  ) {
    return db.insert(embeddings).values(data).returning();
  },

  /** Remover embeddings de chunks de um documento. */
  async deleteByChunkIds(chunkIds: string[]) {
    if (chunkIds.length === 0) return;
    return db.delete(embeddings).where(inArray(embeddings.chunkId, chunkIds));
  },
};
