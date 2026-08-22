/**
 * ConcursoAI — ContestRepository (Administration)
 *
 * Escrita/leitura administrativa de concursos (contests).
 * Diferente do repositório de catálogo (src/lib/db/repositories/contest.ts,
 * que expõe apenas leitura pública), este repositório lida com TODOS os
 * status (rascunho/publicado/encerrado/arquivado) para o admin.
 *
 * Soft delete: marca deleted_at (nunca apaga fisicamente).
 * Duplicidade: slug único onde deleted_at IS NULL → tratar 409 na API.
 */
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { contests } from "@/db/schema/contest";

export interface CreateContestInput {
  organId: string;
  boardId: string;
  title: string;
  slug: string;
  description?: string | null;
  status?: "rascunho" | "publicado" | "encerrado" | "arquivado";
  startDate?: Date | null;
  endDate?: Date | null;
}

export interface UpdateContestInput {
  organId?: string;
  boardId?: string;
  title?: string;
  slug?: string;
  description?: string | null;
  status?: "rascunho" | "publicado" | "encerrado" | "arquivado";
  startDate?: Date | null;
  endDate?: Date | null;
}

export const ContestRepository = {
  /** Lista concursos (todos os status) para o admin, mais recentes primeiro. */
  async listAll(limit = 100) {
    return db
      .select()
      .from(contests)
      .where(isNull(contests.deletedAt))
      .orderBy(desc(contests.createdAt))
      .limit(limit);
  },

  /** Busca concurso por id (não excluído). */
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(contests)
      .where(and(eq(contests.id, id), isNull(contests.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Busca concurso por slug (não excluído) — detecta duplicidade. */
  async findBySlug(slug: string) {
    const [row] = await db
      .select()
      .from(contests)
      .where(and(eq(contests.slug, slug), isNull(contests.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Cria um concurso. */
  async create(input: CreateContestInput) {
    const [row] = await db
      .insert(contests)
      .values({
        organId: input.organId,
        boardId: input.boardId,
        title: input.title,
        slug: input.slug,
        description: input.description ?? null,
        status: input.status ?? "rascunho",
        startDate: input.startDate ?? null,
        endDate: input.endDate ?? null,
      })
      .returning();
    return row;
  },

  /** Atualiza campos de um concurso (parcial). */
  async update(id: string, input: UpdateContestInput) {
    const patch: Partial<typeof contests.$inferInsert> = { updatedAt: new Date() };
    if (input.organId !== undefined) patch.organId = input.organId;
    if (input.boardId !== undefined) patch.boardId = input.boardId;
    if (input.title !== undefined) patch.title = input.title;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.description !== undefined) patch.description = input.description;
    if (input.status !== undefined) patch.status = input.status;
    if (input.startDate !== undefined) patch.startDate = input.startDate;
    if (input.endDate !== undefined) patch.endDate = input.endDate;

    const [row] = await db
      .update(contests)
      .set(patch)
      .where(and(eq(contests.id, id), isNull(contests.deletedAt)))
      .returning();
    return row ?? null;
  },

  /** Soft delete: marca deleted_at (preserva dados). */
  async softDelete(id: string) {
    const [row] = await db
      .update(contests)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(contests.id, id), isNull(contests.deletedAt)))
      .returning();
    return row ?? null;
  },

  /** Busca por slug ignorando um id (edição): retorna null se só o próprio registro casa. */
  async findBySlugExcluding(slug: string, excludeId: string) {
    const rows = await db
      .select()
      .from(contests)
      .where(and(eq(contests.slug, slug), isNull(contests.deletedAt)))
      .limit(2);
    const other = rows.find((r) => r.id !== excludeId);
    return other ?? null;
  },
};
