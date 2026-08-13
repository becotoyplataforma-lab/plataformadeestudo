import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { profiles } from "@/db/schema/identity";
import type { Profile } from "@/types";

type ProfileRow = typeof profiles.$inferSelect;

/**
 * Converte a linha do banco (colunas camelCase; `level` no lugar de `nivel`)
 * para o tipo de domínio `Profile` (snake_case) consumido pela UI.
 */
function toProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    full_name: row.fullName,
    email: null,
    avatar_url: row.avatarUrl,
    plano: "free",
    nivel: row.level,
    concurso_alvo: row.concursoAlvo,
    banca_preferida: row.bancaPreferida,
    contest_id: row.contestId,
    position_id: row.positionId,
    meta_diaria_min: row.metaDiariaMin,
    modelo_ia_padrao: row.modeloIaPadrao,
    is_admin: false,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const [row] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);
  return row ? toProfile(row) : null;
}

export async function updateProfile(
  userId: string,
  patch: Partial<
    Pick<
      Profile,
      | "full_name"
      | "avatar_url"
      | "nivel"
      | "concurso_alvo"
      | "banca_preferida"
      | "meta_diaria_min"
      | "modelo_ia_padrao"
      | "contest_id"
      | "position_id"
    >
  >
): Promise<Profile> {
  // Só inclui colunas presentes no patch (evita enviar undefined ao banco).
  const set: Partial<typeof profiles.$inferInsert> = {};
  if (patch.full_name !== undefined) set.fullName = patch.full_name;
  if (patch.avatar_url !== undefined) set.avatarUrl = patch.avatar_url;
  if (patch.nivel !== undefined) set.level = patch.nivel;
  if (patch.concurso_alvo !== undefined) set.concursoAlvo = patch.concurso_alvo;
  if (patch.banca_preferida !== undefined) set.bancaPreferida = patch.banca_preferida;
  if (patch.contest_id !== undefined) set.contestId = patch.contest_id;
  if (patch.position_id !== undefined) set.positionId = patch.position_id;
  if (patch.meta_diaria_min !== undefined) set.metaDiariaMin = patch.meta_diaria_min;
  if (patch.modelo_ia_padrao !== undefined) set.modeloIaPadrao = patch.modelo_ia_padrao;

  const [row] = await db
    .update(profiles)
    .set(set)
    .where(eq(profiles.id, userId))
    .returning();
  return toProfile(row);
}
