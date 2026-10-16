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

    // O Supabase e a unica fonte autoritativa de unicidade de e-mail.
    // listUsers() nao serve como pre-checagem: pagina (cerca de 50 usuarios), deixa
    // duplicados passarem e abre janela de corrida entre consultar e criar.
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (error) {
      const providerStatus = (error as { status?: number }).status ?? 0;
      const providerMessage = error.message ?? "";
      const isDuplicate =
        providerStatus === 422 ||
        /already exists|already registered|user already/i.test(providerMessage);

      if (isDuplicate) {
        return apiError(409, "Este e-mail já está cadastrado.");
      }

      // A mensagem crua do provedor fica no log do servidor, nunca no cliente.
      console.error("[register] provedor de auth recusou o cadastro:", {
        status: providerStatus,
        code: (error as unknown as { code?: string }).code,
      });
      return apiError(
        providerStatus >= 400 && providerStatus < 500 ? 400 : 502,
        "Não foi possível concluir o cadastro. Tente novamente."
      );
    }

    if (!data?.user) {
      console.error("[register] provedor nao retornou o usuario criado.");
      return apiError(502, "Não foi possível concluir o cadastro. Tente novamente.");
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
