/**
 * ConcursoAI — StorageBackend (resolução explícita do backend de storage)
 *
 * Substitui o antigo comportamento automático (isR2Configured() ? "r2" : "supabase"),
 * que permitia que a simples presença de variáveis R2_* mudasse o storage
 * silenciosamente. Agora o backend é DECIDIDO por STORAGE_BACKEND:
 *
 *   STORAGE_BACKEND=r2        → SOMENTE Cloudflare R2 (falha se R2 não configurado)
 *   STORAGE_BACKEND=supabase  → SOMENTE Supabase Storage
 *   ausente em produção       → fail-fast (NUNCA fallback silencioso)
 *
 * Em desenvolvimento/teste, o default é "supabase" para manter a suíte de
 * testes e o fluxo local funcionando sem credenciais R2.
 */
import "server-only";

export type StorageBackend = "r2" | "supabase";

const VALID: StorageBackend[] = ["r2", "supabase"];

export class StorageBackendError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "StorageBackendError";
    this.code = code;
  }
}

/**
 * Resolve o backend de storage ativo.
 * - Valor explícito ("r2" | "supabase") → retorna o valor.
 * - Ausente: em produção lança erro (fail-fast); em dev/teste assume "supabase".
 * - Valor inválido → erro em qualquer ambiente.
 */
export function resolveStorageBackend(
  env: { STORAGE_BACKEND?: string; NODE_ENV?: string } = process.env
): StorageBackend {
  const raw = env.STORAGE_BACKEND?.trim().toLowerCase() ?? "";

  if (raw === "") {
    if (env.NODE_ENV === "production") {
      throw new StorageBackendError(
        "STORAGE_BACKEND_REQUIRED",
        "STORAGE_BACKEND não definido. Defina explicitamente 'r2' ou 'supabase' em produção. Não é permitido fallback automático."
      );
    }
    return "supabase";
  }

  if (!VALID.includes(raw as StorageBackend)) {
    throw new StorageBackendError(
      "STORAGE_BACKEND_INVALID",
      `STORAGE_BACKEND inválido: "${raw}". Use "r2" ou "supabase".`
    );
  }

  return raw as StorageBackend;
}

/**
 * Backend de storage ativo (usado pelos services para registrar o backend
 * de novos documentos). Em produção exige STORAGE_BACKEND explícito.
 */
export function storageBackend(): StorageBackend {
  return resolveStorageBackend();
}
