import { createAdminClient } from "@/lib/supabase/admin";
import { registerSchema } from "@/lib/validations/auth";
import { apiError, apiOk } from "@/lib/api/helpers";

/**
 * POST /api/register
 * Cria a conta no Supabase Auth. O trigger handle_new_user cria o profile.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Dados inválidos";
      return apiError(422, message);
    }

    const { name, email, password } = parsed.data;

    const supabase = createAdminClient();

    // Verifica se já existe — tratando erro da consulta para não lançar 500
    // (listUsers pode retornar data nulo; antes, existing?.users.some() estourava TypeError).
    const { data: existing, error: listError } =
      await supabase.auth.admin.listUsers();

    if (listError || !existing) {
      console.error(
        "[register] Falha ao consultar usuários existentes:",
        listError?.message
      );
      return apiError(
        503,
        "Serviço temporariamente indisponível. Tente novamente em instantes."
      );
    }

    const already = existing.users.some(
      (u: { email?: string | null }) =>
        u.email?.toLowerCase() === email.toLowerCase()
    );
    if (already) {
      return apiError(409, "Este e-mail já está cadastrado.");
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (error) {
      return apiError(400, error.message);
    }

    return apiOk(
      {
        user: {
          id: data.user.id,
          email: data.user.email,
          plano: "free",
        },
      },
      201
    );
  } catch (error) {
    console.error("[register] Erro ao criar conta:", error);
    return apiError(500, "Erro interno ao criar a conta.");
  }
}
