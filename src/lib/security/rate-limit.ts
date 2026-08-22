/**
 * ConcursoAI — Rate Limiter (in-memory, sliding window)
 *
 * Implementação simples e sem dependência de infra nova (sem Redis/Upstash).
 * Usa um Map em memória com janela deslizante por chave.
 *
 * Limitações conhecidas:
 * - Estado em memória: não persiste entre restarts do servidor.
 * - Não é distribuído: em múltiplas instâncias, cada uma tem seu contador.
 *   Para produção multi-instância, migrar para Redis/Upstash (ver docs/09-INFRASTRUCTURE.md).
 *
 * Uso:
 *   const result = rateLimit("recuperar-senha", "email:foo@bar.com", 3, 15 * 60 * 1000);
 *   if (!result.allowed) return apiError(429, "Muitas tentativas. Tente novamente em 15 minutos.");
 */
import "server-only";

interface WindowEntry {
  count: number;
  resetAt: number;
}

// Chave composta: `${bucket}:${key}` → janela.
const store = new Map<string, WindowEntry>();

// Limpeza periódica de janelas expiradas (evita vazamento de memória).
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // 10 min
let cleanupTimer: NodeJS.Timeout | null = null;

function scheduleCleanup(): void {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt <= now) store.delete(key);
    }
  }, CLEANUP_INTERVAL_MS);
  // Não impede o processo de encerrar.
  cleanupTimer.unref?.();
}

export interface RateLimitResult {
  allowed: boolean;
  /** Quantas requisições ainda podem ser feitas na janela atual. */
  remaining: number;
  /** Timestamp (ms) em que a janela atual reseta. */
  resetAt: number;
  /** Total de requisições permitidas por janela. */
  limit: number;
}

/**
 * Verifica e registra uma requisição na janela deslizante.
 *
 * @param bucket  Nome do recurso (ex.: "recuperar-senha", "knowledge-upload").
 * @param key     Identificador único do solicitante (ex.: "email:foo@bar.com", "ip:1.2.3.4", "user:uuid").
 * @param limit   Máximo de requisições permitidas na janela.
 * @param windowMs Duração da janela em milissegundos.
 */
export function rateLimit(
  bucket: string,
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  scheduleCleanup();

  const now = Date.now();
  const storeKey = `${bucket}:${key}`;
  const entry = store.get(storeKey);

  // Janela expirada → reinicia.
  if (!entry || entry.resetAt <= now) {
    const fresh: WindowEntry = { count: 1, resetAt: now + windowMs };
    store.set(storeKey, fresh);
    return { allowed: true, remaining: limit - 1, resetAt: fresh.resetAt, limit };
  }

  // Dentro da janela.
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt, limit };
  }

  entry.count += 1;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt, limit };
}

/** Limpa o estado (útil em testes). */
export function resetRateLimitStore(): void {
  store.clear();
}
