/**
 * ConcursoAI - Recuperacao de senha: solicitacao de e-mail (FASE B1).
 *
 * O que existia antes: POST /api/auth/recuperar-senha chamava
 * supabase.auth.admin.generateLink({ type: "recovery" }). generateLink APENAS CONSTROI
 * o link e nao envia nada, mas a interface dizia "enviamos um link para seu e-mail":
 * uma promessa falsa, sem pagina de conclusao do outro lado.
 *
 * Estado atual:
 *   1. A solicitacao usa o metodo oficial de envio, resetPasswordForEmail, que delega
 *      o transporte ao Supabase Auth (SMTP do projeto).
 *   2. O envio so e oferecido quando o ambiente confirma a configuracao, com
 *      PASSWORD_RECOVERY_ENABLED=true. Sem essa confirmacao a rota devolve 503 com
 *      codigo PASSWORD_RECOVERY_UNAVAILABLE e a interface informa que a recuperacao
 *      ainda nao esta ativa, em vez de prometer um e-mail que nao sairia.
 *   3. A conclusao acontece em /redefinir-senha: o fragmento do link
 *      (#access_token=...&type=recovery) e interpretado por
 *      src/lib/auth/recovery-link.ts, que valida tipo e tokens antes de qualquer
 *      tentativa de troca.
 *
 * Privacidade e seguranca: e-mail, token, senha e a mensagem crua do provedor nunca
 * vao para log nem para a resposta. A resposta de solicitacao e identica para e-mail
 * existente ou inexistente, entao nao ha revelacao de cadastro.
 */
import "server-only";

import { logger } from "@/lib/observability";
import { publicEnv } from "@/lib/env";

export type RecoveryTransportState = {
  enabled: boolean;
  /** Codigo estavel para log e diagnostico; nunca contem credencial. */
  code: string;
};

/** Codigo devolvido ao cliente quando o transporte ainda nao esta confirmado. */
export const PASSWORD_RECOVERY_UNAVAILABLE = "PASSWORD_RECOVERY_UNAVAILABLE";

/** Placeholders do schema de env: nao configuram Supabase de verdade. */
const PLACEHOLDER_SUPABASE_URL = "https://placeholder.supabase.co";
const PLACEHOLDER_ANON_KEY = "missing-anon-key";

function flag(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true";
}

/**
 * Decide se o ambiente pode prometer o envio do e-mail. A checagem e necessaria mas
 * nao suficiente: o SMTP do projeto Supabase e configurado no painel da plataforma,
 * por isso PASSWORD_RECOVERY_ENABLED existe para o dono assumir explicitamente esse
 * transporte depois de valida-lo.
 */
export function resolveRecoveryTransportState(
  env: NodeJS.ProcessEnv = process.env,
): RecoveryTransportState {
  const url = (env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const anonKey = (env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();

  if (url.length === 0 || url === PLACEHOLDER_SUPABASE_URL) {
    return { enabled: false, code: "SUPABASE_URL_NOT_CONFIGURED" };
  }
  if (anonKey.length === 0 || anonKey === PLACEHOLDER_ANON_KEY) {
    return { enabled: false, code: "SUPABASE_ANON_KEY_NOT_CONFIGURED" };
  }
  if (!flag(env.PASSWORD_RECOVERY_ENABLED)) {
    return { enabled: false, code: "PASSWORD_RECOVERY_NOT_ENABLED" };
  }
  return { enabled: true, code: "READY" };
}

/** Para onde o link de recuperacao deve levar o usuario. */
export function recoveryRedirectUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = (env.NEXT_PUBLIC_APP_URL ?? "").trim();
  const base = (configured.length > 0 ? configured : publicEnv.appUrl).replace(/\/$/, "");
  return base + "/redefinir-senha";
}

/** Contrato minimo do cliente usado no envio: so o metodo oficial de recovery. */
export type RecoveryEmailClient = {
  auth: {
    resetPasswordForEmail: (
      email: string,
      options?: { redirectTo?: string },
    ) => Promise<{ error: unknown }>;
  };
};

export type RecoveryRequestResult =
  | { status: "accepted" }
  | { status: "unavailable"; code: string };

/**
 * Solicita o e-mail de redefinio. O resultado publico nunca distingue e-mail
 * cadastrado de nao cadastrado, e nenhuma falha do provedor chega ao cliente.
 */
export async function requestPasswordRecovery(input: {
  email: string;
  env?: NodeJS.ProcessEnv;
  createClient: () => RecoveryEmailClient;
}): Promise<RecoveryRequestResult> {
  const env = input.env ?? process.env;
  const state = resolveRecoveryTransportState(env);

  if (!state.enabled) {
    logger.warn("auth-recovery", "transporte de e-mail indisponivel", {
      code: state.code,
    });
    return { status: "unavailable", code: PASSWORD_RECOVERY_UNAVAILABLE };
  }

  try {
    const { error } = await input.createClient().auth.resetPasswordForEmail(input.email, {
      redirectTo: recoveryRedirectUrl(env),
    });
    if (error) {
      // A mensagem crua fica fora do log: pode trazer endereco ou token.
      logger.warn("auth-recovery", "envio recusado pelo provedor", {
        code: "PROVIDER_REJECTED",
      });
    }
    // GoTrue responde 200 mesmo para e-mail inexistente: nada aqui revela cadastro.
    return { status: "accepted" };
  } catch {
    logger.error("auth-recovery", "falha ao solicitar recuperacao", {
      code: "TRANSPORT_ERROR",
    });
    return { status: "accepted" };
  }
}
