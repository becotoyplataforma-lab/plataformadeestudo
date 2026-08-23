import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { apiError, apiOk } from "@/lib/api/helpers";
import { rateLimit } from "@/lib/security/rate-limit";
import { getClientIP } from "@/lib/security/client-ip";

const schema = z.object({ email: z.string().email() });

// Rate limit anti-abuso de e-mail: máx. 3 tentativas por e-mail/IP a cada 15 min.
// TODO: migrar rate limiter para Redis/Upstash quando escalar para múltiplas réplicas
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_EMAIL = 3;
const MAX_PER_IP = 5;

/**
 * POST /api/auth/recuperar-senha
 * Envia e-mail de redefinição de senha via Supabase Auth.
 * Rate limit por e-mail e por IP (anti brute-force / abuso de e-mail).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(422, "E-mail inválido");

    const email = parsed.data.email.toLowerCase();
    const ip = getClientIP(req);

    // Rate limit por e-mail (3/15min) e por IP (5/15min).
    const byEmail = rateLimit("recuperar-senha", `email:${email}`, MAX_PER_EMAIL, WINDOW_MS);
    if (!byEmail.allowed) {
      return apiError(
        429,
        "Muitas tentativas para este e-mail. Tente novamente em 15 minutos."
      );
    }
    const byIp = rateLimit("recuperar-senha", `ip:${ip}`, MAX_PER_IP, WINDOW_MS);
    if (!byIp.allowed) {
      return apiError(
        429,
        "Muitas tentativas. Tente novamente em 15 minutos."
      );
    }

    const supabase = createAdminClient();
    const { error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email,
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
