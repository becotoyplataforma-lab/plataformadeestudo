/**
 * ConcursoAI - Parte pura do link de recuperacao de senha.
 *
 * Sem server-only e sem rede: o componente do navegador precisa interpretar o
 * fragmento #access_token=...&type=recovery e a pagina de teste exercita essas
 * funcoes sem credencial alguma. A solicitacao do e-mail fica em
 * src/lib/auth/password-recovery.ts, que e exclusiva de servidor.
 */

import { z } from "zod";

export type RecoveryLinkParams = {
  accessToken?: string;
  refreshToken?: string;
  type?: string;
  /** Codigo que o proprio Supabase Auth coloca no fragmento quando o link falhou. */
  error?: string;
  errorDescription?: string;
};

/**
 * Interpreta o fragmento do link de recuperacao. Aceita com ou sem # inicial e nao
 * conserva nada alem dos campos que interessam: nenhum token e gravado ou impresso.
 */
export function parseRecoveryHash(hash: string): RecoveryLinkParams {
  const raw = (hash ?? "").replace(/^#/, "");
  if (raw.length === 0) return {};
  const params = new URLSearchParams(raw);
  const out: RecoveryLinkParams = {};
  const accessToken = params.get("access_token");
  const refreshToken = params.get("refresh_token");
  const type = params.get("type");
  const error = params.get("error");
  const errorDescription = params.get("error_description");
  if (accessToken) out.accessToken = accessToken;
  if (refreshToken) out.refreshToken = refreshToken;
  if (type) out.type = type;
  if (error) out.error = error;
  if (errorDescription) out.errorDescription = errorDescription;
  return out;
}

export type RecoveryLinkVerdict = { valid: boolean; code: string };

/** So um link recovery completo pode concluir a troca de senha. */
export function evaluateRecoveryLink(params: RecoveryLinkParams): RecoveryLinkVerdict {
  if (params.error) return { valid: false, code: "PROVIDER_ERROR" };
  if (!params.accessToken && !params.refreshToken) {
    return { valid: false, code: "TOKEN_MISSING" };
  }
  if (params.type !== "recovery") {
    return { valid: false, code: "NOT_A_RECOVERY_LINK" };
  }
  if (!params.refreshToken) {
    return { valid: false, code: "TOKEN_INCOMPLETE" };
  }
  return { valid: true, code: "READY" };
}

/** Senha nova: mesma exigencia do cadastro (letras + numeros, 8 a 72 caracteres). */
export const recoveryPasswordSchema = z
  .string()
  .min(8, "A senha deve ter no minimo 8 caracteres")
  .max(72, "A senha e muito longa")
  .regex(/[A-Za-z]/, "A senha deve conter letras")
  .regex(/[0-9]/, "A senha deve conter numeros");

export function validateRecoveryPassword(password: string): { ok: boolean; message?: string } {
  const parsed = recoveryPasswordSchema.safeParse(password);
  if (parsed.success) return { ok: true };
  return { ok: false, message: parsed.error.issues[0]?.message ?? "Senha invalida" };
}
