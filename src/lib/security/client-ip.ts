/**
 * Extrai o IP real do cliente.
 * Prioridade:
 * 1. x-real-ip (setado pelo nginx reverse proxy)
 * 2. Primeiro IP de x-forwarded-for (se nginx confiável)
 * 3. "unknown" (fallback seguro)
 *
 * ⚠️ IMPORTANTE: Configure o nginx para setar x-real-ip:
 *    proxy_set_header X-Real-IP $remote_addr;
 *    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
 */
export function getClientIP(req: Request): string {
  const realIP = req.headers.get("x-real-ip");
  if (realIP) return realIP.trim();

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    // Pega o primeiro IP (mais próximo do cliente, se nginx confiável)
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  return "unknown";
}
