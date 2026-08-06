import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { getToken } from "next-auth/jwt";

/**
 * Middleware global:
 * 1. Atualiza a sessão do Supabase (cookies).
 * 2. Protege rotas autenticadas (NextAuth) — redireciona para /login.
 */

const PUBLIC_PATHS = ["/", "/login", "/cadastro", "/recuperar-senha"];

async function isAuthenticated(request: NextRequest): Promise<boolean> {
  const token = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET,
  });
  return !!token;
}

export async function middleware(request: NextRequest) {
  // Atualiza sessão do Supabase
  const supabaseResponse = await updateSession(request);

  const { pathname } = request.nextUrl;

  const isPublic =
    PUBLIC_PATHS.some((p) => pathname === p) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".");

  if (!isPublic) {
    const authed = await isAuthenticated(request);
    if (!authed) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Roda em tudo exceto arquivos estáticos e APIs NextAuth
     */
    "/((?!_next/static|_next/image|favicon.ico|api/auth).*)",
  ],
};
