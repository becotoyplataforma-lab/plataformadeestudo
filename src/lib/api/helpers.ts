import { auth } from "@/lib/auth/auth";

/**
 * Guard de autenticação para API routes.
 * Retorna { userId } ou lança uma Response 401.
 */
export async function requireAuth(): Promise<{ userId: string }> {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("UNAUTHORIZED");
  }
  return { userId: session.user.id };
}

/** Helper para padronizar respostas de erro das API routes. */
export function apiError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/** Helper de sucesso padronizado. */
export function apiOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}
