/**
 * ConcursoAI — Administration: helper de sessão admin
 *
 * Extrai a sessão do usuário autenticado para as rotas /api/admin/*.
 * A autorização (allowlist) fica no AdminGuardService (Service).
 */
import "server-only";
import { auth } from "@/lib/auth/auth";
import type { AdminSession } from "@/lib/administration/services/admin-guard.service";

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) return null;
  return {
    userId: session.user.id,
    email: session.user.email,
  };
}
