/**
 * E2E — Autenticação (auth).
 *
 * Fluxos: renderização do login, redirecionamento de rotas protegidas,
 * credenciais inválidas e login válido (este último requer backend real).
 */
import { test, expect } from "@playwright/test";
import { hasAuth } from "./support/auth";

const EMAIL = process.env.E2E_USER_EMAIL ?? "e2e@concursoai.app";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "senha-invalida-e2e";

test.describe("Autenticação", () => {
  test("tela de login renderiza o formulário", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /Bem-vindo/ })).toBeVisible();
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
  });

  test("redireciona não autenticado de rota protegida para /login", async ({ page }) => {
    await page.goto("/cronograma");
    await expect(page).toHaveURL(/\/login/);
  });

  test("credenciais inválidas mostram mensagem de erro", async ({ page }) => {
    await page.goto("/login");
    await page.fill("#email", "nao-existe@example.com");
    await page.fill("#password", "senha-errada");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByText(/E-mail ou senha incorretos/i)).toBeVisible();
  });

  test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");
  test("login válido navega para o dashboard", async ({ page }) => {
    await page.goto("/login?callbackUrl=%2F");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).toHaveURL(/\/$/);
  });
});
