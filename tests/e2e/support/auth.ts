/**
 * ConcursoAI — suporte E2E: autenticação via NextAuth v5 (credentials + Supabase).
 *
 * Padrão Playwright para Auth.js v5:
 *   GET /api/auth/csrf → POST /api/auth/callback/credentials (form) → sessão.
 */
import { request, type APIRequestContext } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/** true se há um usuário E2E configurado (backend real disponível). */
export const hasAuth = Boolean(
  process.env.E2E_USER_EMAIL && process.env.E2E_USER_PASSWORD
);

/** Contexto de API autenticado (guarda o cookie de sessão). */
export async function getAuthContext(): Promise<APIRequestContext> {
  const email = process.env.E2E_USER_EMAIL;
  const password = process.env.E2E_USER_PASSWORD;
  if (!email || !password) {
    throw new Error(
      "E2E_USER_EMAIL/E2E_USER_PASSWORD não configurados (ambiente de homologação)."
    );
  }

  const ctx = await request.newContext({ baseURL });

  const csrfRes = await ctx.get("/api/auth/csrf");
  const { csrfToken } = (await csrfRes.json()) as { csrfToken?: string };
  if (!csrfToken) throw new Error("Não foi possível obter o CSRF token.");

  const login = await ctx.post("/api/auth/callback/credentials", {
    form: { csrfToken, email, password },
  });
  if (!login.ok()) {
    throw new Error(`Falha ao autenticar E2E (status ${login.status()}).`);
  }
  return ctx;
}

/** Sessão do usuário autenticado (via /api/auth/session). */
export async function getSession(ctx: APIRequestContext): Promise<{
  user?: { id?: string; email?: string };
} | null> {
  const res = await ctx.get("/api/auth/session");
  return (await res.json()) as { user?: { id?: string; email?: string } } | null;
}

/**
 * Autentica o contexto de NAVEgador com o cookie de sessão obtido via API,
 * permitindo navegar em páginas protegidas sem re-fazer login na UI.
 */
export async function authenticateBrowser(
  page: import("@playwright/test").Page
): Promise<void> {
  const api = await getAuthContext();
  const state = await api.storageState();
  await page.context().addCookies(state.cookies);
  await api.dispose();
}
