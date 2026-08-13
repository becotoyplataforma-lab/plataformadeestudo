"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { updateProfile } from "@/lib/db/repositories/perfil";
import { positionBelongsToContest } from "@/lib/db/repositories/contest";

const profileSchema = z.object({
  full_name: z.string().min(2).max(120),
  nivel: z.enum(["iniciante", "intermediario", "avancado"]),
  concurso_alvo: z.string().max(120).optional().nullable(),
  banca_preferida: z.string().max(60).optional().nullable(),
  contest_id: z.string().uuid().nullable().optional(),
  position_id: z.string().uuid().nullable().optional(),
  meta_diaria_min: z.coerce.number().int().min(15).max(720),
  modelo_ia_padrao: z.enum(["flash", "pro"]),
});

type ActionResult = { success: boolean; message: string };

export async function actionUpdateProfile(input: unknown): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user?.id) return { success: false, message: "Não autenticado." };

    const parsed = profileSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }

    const contestId = parsed.data.contest_id ?? null;
    const positionId = parsed.data.position_id ?? null;

    // Validações de combinação concurso × cargo (não permitir combinação inválida).
    if (positionId && !contestId) {
      return { success: false, message: "Selecione um concurso para o cargo." };
    }
    if (contestId && positionId) {
      const ok = await positionBelongsToContest(positionId, contestId);
      if (!ok) {
        return {
          success: false,
          message: "O cargo não pertence ao concurso selecionado.",
        };
      }
    }

    await updateProfile(session.user.id, {
      full_name: parsed.data.full_name,
      nivel: parsed.data.nivel,
      concurso_alvo: parsed.data.concurso_alvo || null,
      banca_preferida: parsed.data.banca_preferida || null,
      contest_id: contestId,
      position_id: positionId,
      meta_diaria_min: parsed.data.meta_diaria_min,
      modelo_ia_padrao: parsed.data.modelo_ia_padrao,
    });

    revalidatePath("/perfil");
    revalidatePath("/dashboard");
    return { success: true, message: "Perfil atualizado!" };
  } catch (error) {
    console.error("[perfil] update", error);
    return { success: false, message: "Erro ao atualizar perfil." };
  }
}
