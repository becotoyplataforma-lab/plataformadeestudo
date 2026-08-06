import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types";

type DB = SupabaseClient;

export async function getProfile(db: DB, userId: string): Promise<Profile | null> {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) return null;
  return data as Profile;
}

export async function updateProfile(
  db: DB,
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
    >
  >
): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .update(patch)
    .eq("id", userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Profile;
}
