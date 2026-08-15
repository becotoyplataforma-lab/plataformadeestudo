/**
 * ConcursoAI — DocumentRepository
 *
 * Camada de persistência para o agregado Document.
 * Toda query passa por aqui (DD-004: Repository Pattern obrigatório).
 */
import { eq, and, isNull, or, sql, sum } from "drizzle-orm";
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

  /** Atualizar associações de edital/cargo do documento. */
  async updateAssociations(
    id: string,
    patch: { editalId?: string | null; positionId?: string | null }
  ) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.editalId !== undefined) set.editalId = patch.editalId;
    if (patch.positionId !== undefined) set.positionId = patch.positionId;
    const [row] = await db
      .update(documents)
      .set(set)
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

  /** Atualizar campos de pipeline (status, contagens, erro, data). */
  async updatePipeline(
    id: string,
    patch: {
      status?: string;
      chunkCount?: number;
      embeddingCount?: number;
      pageCount?: number | null;
      processingError?: string | null;
      processedAt?: Date | null;
    }
  ) {
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.chunkCount !== undefined) set.chunkCount = patch.chunkCount;
    if (patch.embeddingCount !== undefined) set.embeddingCount = patch.embeddingCount;
    if (patch.pageCount !== undefined) set.pageCount = patch.pageCount;
    if (patch.processingError !== undefined) set.processingError = patch.processingError;
    if (patch.processedAt !== undefined) set.processedAt = patch.processedAt;

    const [row] = await db
      .update(documents)
      .set(set)
      .where(eq(documents.id, id))
      .returning();
    return row ?? null;
  },

  /** Listar TODOS os documentos (admin) com paginação. */
  async listAll(limit = 100, offset = 0) {
    return db
      .select()
      .from(documents)
      .where(isNull(documents.deletedAt))
      .orderBy(sql`${documents.createdAt} DESC`)
      .limit(limit)
      .offset(offset);
  },

  /** Contar todos os documentos ativos (admin). */
  async countAll() {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(documents)
      .where(isNull(documents.deletedAt));
    return row?.n ?? 0;
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

  /** Atualizar revisão de conteúdo (admin). */
  async updateReview(
    id: string,
    patch: {
      reviewStatus: "pendente" | "aprovado" | "rejeitado";
      reviewedBy: string | null;
      reviewNote: string | null;
      reviewedAt: Date;
    }
  ) {
    const [row] = await db
      .update(documents)
      .set({
        reviewStatus: patch.reviewStatus,
        reviewedBy: patch.reviewedBy,
        reviewNote: patch.reviewNote,
        reviewedAt: patch.reviewedAt,
        updatedAt: new Date(),
      })
      .where(eq(documents.id, id))
      .returning();
    return row ?? null;
  },

  /** Fila de revisão de material (admin) — pendentes/não aprovados. */
  async listForReview(limit = 100, offset = 0) {
    return db
      .select()
      .from(documents)
      .where(
        and(
          isNull(documents.deletedAt),
          sql`${documents.reviewStatus} <> 'aprovado'`
        )
      )
      .orderBy(sql`${documents.createdAt} ASC`)
      .limit(limit)
      .offset(offset);
  },

  /** Biblioteca de fontes externas (admin) — docs com origem registrada. */
  async listExternalSources(limit = 200) {
    return db
      .select()
      .from(documents)
      .where(
        and(
          isNull(documents.deletedAt),
          or(
            eq(documents.sourceType, "url"),
            sql`${documents.sourceUrl} is not null`,
            sql`${documents.metadata}->>'fonte' is not null`,
            sql`${documents.metadata}->>'licenca' is not null`
          )
        )
      )
      .orderBy(sql`${documents.createdAt} DESC`)
      .limit(limit);
  },
};
