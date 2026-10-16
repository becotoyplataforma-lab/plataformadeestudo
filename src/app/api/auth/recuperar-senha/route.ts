import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { apiError, apiOk } from "@/lib/api/helpers";
import { requestPasswordRecovery } from "@/lib/auth/password-recovery";
import { publicEnv } from "@/lib/env";
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
 *
 * Pede ao Supabase Auth o envio oficial do e-mail de redefinição
 * (resetPasswordForEmail). Antes desta correção a rota chamava
 * admin.generateLink(), que apenas constrói o link: nenhum e-mail era enviado e a
 * interface prometia "enviamos um link". Agora:
 *
 * - o link aponta para /redefinir-senha, onde a troca é concluída;
 * - enquanto o transporte não estiver confirmado pelo ambiente
 *   (PASSWORD_RECOVERY_ENABLED=true), a rota responde 503 em vez de prometer;
 * - e-mail existente e inexistente produzem exatamente a mesma resposta, porque o
 *   GoTrue não distingue os dois para clientes anônimos;
 * - nenhuma mensagem crua do provedor, link ou token chega ao cliente nem ao log.
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

    const result = await requestPasswordRecovery({
      email,
      createClient: () =>
        createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        }),
    });

    if (result.status === "unavailable") {
      return apiError(
        503,
        PASSWORD_RECOVERY_MESSAGE
      );
    }

    return apiOk({ ok: true });
  } catch {
    return apiError(500, "Erro interno.");
  }
}

/** Mensagem única para indisponibilidade: não revela cadastro nem configuração. */
const PASSWORD_RECOVERY_MESSAGE =
  "A recuperação de senha por e-mail ainda não está ativa neste ambiente. Solicite a redefinição à administração.";
