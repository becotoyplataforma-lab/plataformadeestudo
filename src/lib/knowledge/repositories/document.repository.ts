/**
 * ConcursoAI — DocumentRepository
 *
 * Camada de persistência para o agregado Document.
 * Toda query passa por aqui (DD-004: Repository Pattern obrigatório).
 */
import { eq, and, isNull, or, sql, sum, inArray } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { documents } from "@/db/schema/knowledge";
import {
  documentAccessCondition,
  type DocumentAccessScope,
} from "../security/document-access";

/**
 * Estagios do pipeline de conversao, na ordem em que o documento anda.
 * `chunked` e o ponto de espera honesto quando nao ha servico de embeddings:
 * o conteudo esta pronto e pesquisavel por FTS, mas a busca vetorial segue
 * pendente. `indexed` afirma que existe vetor no banco.
 */
export const PIPELINE_STATUSES = [
  "pending",
  "processing",
  "processed",
  "chunked",
  "indexing",
  "indexed",
  "failed",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

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

  /** Marcar/desmarcar documento como favorito (por usuário/dono). */
  async updateFavorite(id: string, userId: string, isFavorite: boolean) {
    const [row] = await db
      .update(documents)
      .set({ isFavorite, updatedAt: new Date() })
      .where(and(eq(documents.id, id), eq(documents.userId, userId)))
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

  /**
   * Contagem por estagio do pipeline: fila operacional do operador.
   * So documentos ativos (deleted_at IS NULL) contam.
   */
  async countByPipelineStatus(): Promise<Array<{ status: string; count: number }>> {
    const rows = await db
      .select({ status: documents.status, count: sql<number>`count(*)::int` })
      .from(documents)
      .where(isNull(documents.deletedAt))
      .groupBy(documents.status);
    return rows.map((r) => ({ status: r.status, count: r.count }));
  },

  /**
   * Documentos parados em um conjunto de estagios, do mais antigo ao mais
   * novo: e a ordem em que uma retomada de lote deve tentar.
   */
  async listByPipelineStatuses(
    statuses: readonly PipelineStatus[],
    limit = 50
  ) {
    if (statuses.length === 0) return [];
    return db
      .select()
      .from(documents)
      .where(
        and(
          isNull(documents.deletedAt),
          inArray(documents.status, [...statuses])
        )
      )
      .orderBy(sql`${documents.createdAt} ASC`)
      .limit(limit);
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

  /**
   * Documentos que o usuario pode ler: os proprios mais os compartilhados com o
   * escopo dele (cargo ou edital vigente). Uma unica consulta com limite, e sem
   * tocar em document_chunks: o texto integral so sai por rota autorizada.
   */
  async listAccessible(scope: DocumentAccessScope, limit = 50, offset = 0) {
    return db
      .select()
      .from(documents)
      .where(and(isNull(documents.deletedAt), documentAccessCondition(scope)))
      .orderBy(sql`${documents.createdAt} DESC`)
      .limit(limit)
      .offset(offset);
  },

  /** Contar documentos legiveis no escopo (paginacao segura). */
  async countAccessible(scope: DocumentAccessScope): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(documents)
      .where(and(isNull(documents.deletedAt), documentAccessCondition(scope)));
    return row?.n ?? 0;
  },

  /**
   * Buscar um documento ja filtrado pela autorizacao: devolve null para
   * inexistente, excluido ou fora do escopo, entao a pagina nao precisa decidir
   * sozinha o que mostrar nem vaza existencia de id de outro usuario.
   */
  async findByIdAccessible(id: string, scope: DocumentAccessScope) {
    const [row] = await db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.id, id),
          isNull(documents.deletedAt),
          documentAccessCondition(scope)
        )
      )
      .limit(1);
    return row ?? null;
  },
  /** Contar documentos ativos do usuário (quota maxDocuments, best-effort). */
  async countActiveByUser(userId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(documents)
      .where(and(eq(documents.userId, userId), isNull(documents.deletedAt)));
    return row?.count ?? 0;
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

  /**
   * Listar documentos com storage_backend específico (migração).
   * @param backend "supabase" | "r2"
   * @param limit/offset paginação
   */
  async listByStorageBackend(backend: string, limit = 100, offset = 0) {
    return db
      .select()
      .from(documents)
      .where(
        and(
          eq(documents.storageBackend, backend),
          isNull(documents.deletedAt)
        )
      )
      .orderBy(sql`${documents.createdAt} ASC`)
      .limit(limit)
      .offset(offset);
  },

  /**
   * Marcar documento como migrado para o backend informado.
   * Usado pela rotina de migração R2 após validar o objeto no destino.
   */
  async updateStorageBackend(id: string, backend: "r2" | "supabase") {
    const [row] = await db
      .update(documents)
      .set({ storageBackend: backend, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return row ?? null;
  },
};
