/**
 * ConcursoAI — Administration: helper de sessão admin
 *
 * Extrai a sessão do usuário autenticado para as rotas /api/admin/*.
 * Valida a allowlist no AdminGuardService no próprio servidor antes de conceder a sessão.
 */
import "server-only";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService, type AdminSession } from "@/lib/administration/services/admin-guard.service";

export async function getAdminSession(): Promise<AdminSession | null> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.email) return null;

  const isAdmin = await AdminGuardService.isAdminOrSuperadmin(session.user.email);
  if (!isAdmin) return null;

  return {
    userId: session.user.id,
    email: session.user.email,
  };
}
