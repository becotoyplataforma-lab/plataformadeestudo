import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";

/**
 * Middleware global de segurança (Next.js):
 * 1. Protege rotas autenticadas (/dashboard, /cronograma, /flashcards, etc.).
 * 2. Bloqueia /admin para usuários que não sejam administradores.
 * 3. Atualiza a sessão do Supabase (cookies).
 */

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/cadastro",
  "/recuperar-senha",
]);

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  // Assets, favicon, next-auth handlers, webhooks e manifest
  if (
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/billing/webhook") ||
    pathname.startsWith("/api/payments/webhook") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/manifest") ||
    pathname.startsWith("/icons/") ||
    pathname.includes(".")
  ) {
    return true;
  }
  return false;
}

export default auth(async (req) => {
  const { pathname } = req.nextUrl;

  // 1. Redireciona usuários deslogados tentando acessar rotas privadas
  if (!isPublic(pathname) && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Protege rota /admin no servidor contra qualquer não-admin
  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const userEmail = req.auth?.user?.email;
    const isAdmin = await AdminGuardService.isAdminOrSuperadmin(userEmail ?? null);
    if (!isAdmin) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Acesso negado: privilégios de administrador necessários." }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  // 3. Atualiza a sessão do Supabase (cookies) e segue o fluxo
  return updateSession(req as unknown as NextRequest);
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
