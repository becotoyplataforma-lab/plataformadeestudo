/**
 * ConcursoAI — PositionRepository (Administration)
 *
 * Escrita/leitura administrativa de cargos (positions).
 * Soft delete: marca deleted_at (nunca apaga fisicamente).
 * Duplicidade: slug único por concurso (contest_id, slug) onde deleted_at
 * IS NULL → tratar 409 na API.
 */
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { positions } from "@/db/schema/contest";

export interface CreatePositionInput {
  contestId: string;
  name: string;
  slug: string;
  description?: string | null;
  editalId?: string | null;
  status?: "active" | "inactive";
}

export interface UpdatePositionInput {
  name?: string;
  slug?: string;
  description?: string | null;
  editalId?: string | null;
  status?: "active" | "inactive";
}

export const PositionRepository = {
  /** Lista cargos de um concurso (todos os status) para o admin. */
  async listByContest(contestId: string) {
    return db
      .select()
      .from(positions)
      .where(
        and(eq(positions.contestId, contestId), isNull(positions.deletedAt))
      )
      .orderBy(asc(positions.name));
  },

  /** Busca cargo por id (não excluído). */
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(positions)
      .where(and(eq(positions.id, id), isNull(positions.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Busca cargo por slug dentro de um concurso — detecta duplicidade. */
  async findBySlug(contestId: string, slug: string) {
    const [row] = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.contestId, contestId),
          eq(positions.slug, slug),
          isNull(positions.deletedAt)
        )
      )
      .limit(1);
    return row ?? null;
  },

  /** Busca por slug ignorando um id (edição): null se só o próprio registro casa. */
  async findBySlugExcluding(contestId: string, slug: string, excludeId: string) {
    const rows = await db
      .select()
      .from(positions)
      .where(
        and(
          eq(positions.contestId, contestId),
          eq(positions.slug, slug),
          isNull(positions.deletedAt)
        )
      )
      .limit(2);
    const other = rows.find((r) => r.id !== excludeId);
    return other ?? null;
  },

  /** Cria um cargo vinculado a um concurso. */
  async create(input: CreatePositionInput) {
    const [row] = await db
      .insert(positions)
      .values({
        contestId: input.contestId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        editalId: input.editalId ?? null,
        status: input.status ?? "active",
      })
      .returning();
    return row;
  },

  /** Atualiza campos de um cargo (parcial). */
  async update(id: string, input: UpdatePositionInput) {
    const patch: Partial<typeof positions.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) patch.name = input.name;
    if (input.slug !== undefined) patch.slug = input.slug;
    if (input.description !== undefined) patch.description = input.description;
    if (input.editalId !== undefined) patch.editalId = input.editalId;
    if (input.status !== undefined) patch.status = input.status;

    const [row] = await db
      .update(positions)
      .set(patch)
      .where(and(eq(positions.id, id), isNull(positions.deletedAt)))
      .returning();
    return row ?? null;
  },

  /** Soft delete: marca deleted_at (preserva dados). */
  async softDelete(id: string) {
    const [row] = await db
      .update(positions)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(positions.id, id), isNull(positions.deletedAt)))
      .returning();
    return row ?? null;
  },

  /** Valida se o cargo pertence ao concurso (contrato do aluno, FK composta). */
  async belongsToContest(positionId: string, contestId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: positions.id })
      .from(positions)
      .where(
        and(
          eq(positions.id, positionId),
          eq(positions.contestId, contestId),
          isNull(positions.deletedAt)
        )
      )
      .limit(1);
    return Boolean(row);
  },
};
