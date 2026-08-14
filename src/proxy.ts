import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { auth } from "@/lib/auth/auth";

/**
 * Middleware global:
 * 1. Protege rotas autenticadas usando a MESMA instância `auth` do Auth.js v5
 *    (reconhece o cookie de sessão JWT da mesma forma que auth() no servidor —
 *    corrige o redirect loop de /dashboard -> /login atrás de proxy).
 * 2. Atualiza a sessão do Supabase (cookies).
 */

const PUBLIC_PATHS = ["/", "/login", "/cadastro", "/recuperar-senha"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  );
}

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // Rotas protegidas exigem sessão (mesma detecção do auth() no servidor).
  if (!isPublic(pathname) && !req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Atualiza a sessão do Supabase (cookies) e segue o fluxo.
  return updateSession(req as unknown as NextRequest);
});

export const config = {
  matcher: [
    /*
     * Roda em tudo exceto arquivos estáticos e APIs NextAuth
     */
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
