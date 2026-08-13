import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { contests, positions } from "@/db/schema/contest";
import type { ContestOption, PositionOption } from "@/types";

/**
 * Leitura do catálogo Contest pela camada Drizzle (servidor confiável).
 * Retorna apenas concursos publicados e posições ativas — mesmas regras que
 * o RLS expõe ao público, mantidas também na consulta (somente leitura).
 */

/** Concursos publicados e ativos (catálogo Contest). */
export async function listPublishedContests(): Promise<ContestOption[]> {
  const rows = await db
    .select({ id: contests.id, title: contests.title })
    .from(contests)
    .where(and(eq(contests.status, "publicado"), isNull(contests.deletedAt)))
    .orderBy(contests.title);
  return rows.map((r) => ({ id: r.id, title: r.title }));
}

/** Cargos/posições ativos (catálogo Contest). */
export async function listPositions(): Promise<PositionOption[]> {
  const rows = await db
    .select({
      id: positions.id,
      contestId: positions.contestId,
      name: positions.name,
    })
    .from(positions)
    .where(and(eq(positions.status, "active"), isNull(positions.deletedAt)))
    .orderBy(positions.name);
  return rows.map((r) => ({ id: r.id, contest_id: r.contestId, name: r.name }));
}

/** Valida se um cargo pertence ao concurso informado (server actions). */
export async function positionBelongsToContest(
  positionId: string,
  contestId: string
): Promise<boolean> {
  const [row] = await db
    .select({ id: positions.id })
    .from(positions)
    .where(and(eq(positions.id, positionId), eq(positions.contestId, contestId)))
    .limit(1);
  return Boolean(row);
}
