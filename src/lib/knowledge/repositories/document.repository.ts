/**
 * ConcursoAI — DocumentRepository
 *
 * Camada de persistência para o agregado Document.
 * Toda query passa por aqui (DD-004: Repository Pattern obrigatório).
 */
import { eq, and, isNull, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { documents } from "@/db/schema/knowledge";

export const DocumentRepository = {
  /** Buscar documento por ID (apenas ativos). */
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(documents)
      .where(and(eq(documents.id, id), isNull(documents.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Buscar documento por hash (deduplicação por usuário). */
  async findByHash(userId: string, fileHash: string) {
    const [row] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.userId, userId),
          eq(documents.fileHash, fileHash),
          isNull(documents.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Criar documento. */
  async create(input: typeof documents.$inferInsert) {
    const [row] = await db.insert(documents).values(input).returning();
    return row;
  },

  /** Atualizar metadados do documento (merge em JSONB). */
  async updateMetadata(id: string, metadata: Record<string, unknown>) {
    const [row] = await db
      .update(documents)
      .set({
        metadata: sql`${documents.metadata} || ${JSON.stringify(metadata)}::jsonb`,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();
    return row ?? null;
  },

  /** Atualizar status do documento. */
  async updateStatus(id: string, status: string) {
    const [row] = await db
      .update(documents)
      .set({ status: status as typeof documents.$inferSelect["status"], updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return row ?? null;
  },

  /** Soft delete. */
  async softDelete(id: string) {
    const [row] = await db
      .update(documents)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return row ?? null;
  },

  /** Listar documentos de um usuário. */
  async listByUser(userId: string, limit = 50, offset = 0) {
    return db
      .select()
      .from(documents)
      .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)))
      .orderBy(sql`${documents.createdAt} DESC`)
      .limit(limit)
      .offset(offset);
  },

  /** Somar storage usado pelo usuário (em bytes). */
  async getStorageUsage(userId: string): Promise<number> {
    const [row] = await db
      .select({ total: sum(documents.fileSize).mapWith(Number) })
      .from(documents)
      .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)));
    return row?.total ?? 0;
  },
};
