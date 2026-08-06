/**
 * ConcursoAI — DocumentChunkRepository
 */
import { eq, and, isNull, inArray } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { documentChunks } from "@/db/schema/knowledge";

export const DocumentChunkRepository = {
  /** Buscar chunk por ID. */
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(documentChunks)
      .where(and(eq(documentChunks.id, id), isNull(documentChunks.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Buscar chunk por content_hash. */
  async findByHash(contentHash: string) {
    const [row] = await db
      .select()
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.contentHash, contentHash),
          isNull(documentChunks.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Criar múltiplos chunks em batch. */
  async createBatch(
    chunks: (typeof documentChunks.$inferInsert)[]
  ) {
    return db.insert(documentChunks).values(chunks).returning();
  },

  /** Listar chunks de um documento (ordenado por seq). */
  async listByDocument(documentId: string) {
    return db
      .select()
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.documentId, documentId),
          isNull(documentChunks.deletedAt)
        )
      )
      .orderBy(documentChunks.seq);
  },

  /** Buscar chunks por IDs. */
  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return db
      .select()
      .from(documentChunks)
      .where(
        and(
          inArray(documentChunks.id, ids),
          isNull(documentChunks.deletedAt)
        )
      );
  },

  /** Soft delete de todos os chunks de um documento. */
  async softDeleteByDocument(documentId: string) {
    return db
      .update(documentChunks)
      .set({ deletedAt: new Date() })
      .where(
        and(
          eq(documentChunks.documentId, documentId),
          isNull(documentChunks.deletedAt)
        )
      );
  },

  /** Chunks pendentes de embedding.
   *  Retorna todos os chunks ativos; o Service filtra quais já têm embedding. */
  async getPendingChunks(documentId: string) {
    return db
      .select({
        id: documentChunks.id,
        content: documentChunks.content,
        contentHash: documentChunks.contentHash,
        seq: documentChunks.seq,
        documentId: documentChunks.documentId,
      })
      .from(documentChunks)
      .where(
        and(
          eq(documentChunks.documentId, documentId),
          isNull(documentChunks.deletedAt)
        )
      )
      .orderBy(documentChunks.seq);
  },
};
