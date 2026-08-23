import { createAdminClient } from "@/lib/supabase/admin";
import { registerSchema } from "@/lib/validations/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/client-ip";

// Rate limit de registro: 5 tentativas/IP/15min e 3 tentativas/email/15min.
// TODO: migrar rate limiter para Redis/Upstash quando escalar para múltiplas réplicas
const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_IP_LIMIT = 5;
const REGISTER_EMAIL_LIMIT = 3;

/**
 * POST /api/register
 * Cria a conta no Supabase Auth. O trigger handle_new_user cria o profile.
 */
export async function POST(req: Request) {
  try {
    // Rate limit por IP (anti-spam de criação de contas).
    const ip = getClientIP(req);
    const ipRl = rateLimit("register-ip", `ip:${ip}`, REGISTER_IP_LIMIT, REGISTER_WINDOW_MS);
    if (!ipRl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((ipRl.resetAt - Date.now()) / 1000));
      return new Response(
        JSON.stringify({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Muitas tentativas de cadastro. Tente novamente em alguns minutos.",
        }),
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      const message =
        parsed.error.issues[0]?.message ?? "Dados inválidos";
      return apiError(422, message);
    }

    const { name, email, password } = parsed.data;

    // Rate limit por email (evita tentativas repetidas no mesmo endereço).
    const emailRl = rateLimit(
      "register-email",
      `email:${email.toLowerCase()}`,
      REGISTER_EMAIL_LIMIT,
      REGISTER_WINDOW_MS
    );
    if (!emailRl.allowed) {
      const retryAfter = Math.max(1, Math.ceil((emailRl.resetAt - Date.now()) / 1000));
      return new Response(
        JSON.stringify({
          error: "RATE_LIMIT_EXCEEDED",
          message: "Muitas tentativas para este e-mail. Tente novamente em alguns minutos.",
        }),
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

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
