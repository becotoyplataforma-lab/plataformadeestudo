import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";

/**
 * Proxy / Middleware global de segurança (Next.js 16):
 * 1. Protege rotas autenticadas (/dashboard, /cronograma, /flashcards, /apostilas, /perfil, etc.).
 * 2. Bloqueia /admin para usuários que não sejam administradores.
 * 3. Permite acesso público ao playground de questões (/questoes), landing page e telas de auth.
 * 4. Atualiza a sessão do Supabase (cookies).
 */

const PUBLIC_EXACT = new Set([
  "/",
  "/login",
  "/cadastro",
  "/recuperar-senha",
  "/redefinir-senha",
]);

const PUBLIC_PREFIXES = [
  "/questoes",
  "/api/auth",
  "/api/billing/webhook",
  "/api/payments/webhook",
  "/api/health",
  "/_next/",
  "/favicon",
  "/manifest",
  "/icons/",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) return true;
  if (pathname.includes(".")) return true;
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
        return NextResponse.json(
          { error: "Acesso negado: privilégios de administrador necessários." },
          { status: 403 }
        );
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
