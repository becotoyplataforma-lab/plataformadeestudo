import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/lib/api/helpers";

const schema = z.object({ email: z.string().email() });

/**
 * POST /api/auth/recuperar-senha
 * Envia e-mail de redefinição de senha via Supabase Auth.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(422, "E-mail inválido");

    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
    });

    if (error) {
      // Não revela se o e-mail existe — resposta genérica
      console.warn("[recuperar-senha]", error.message);
    }

    return apiOk({ ok: true });
  } catch {
    return apiError(500, "Erro interno.");
  }
}
