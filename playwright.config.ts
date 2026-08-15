import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

/**
 * ConcursoAI — E2E de navegador (Playwright) para os fluxos principais:
 * auth, study, professor, billing, analytics, administration.
 *
 * Pré-requisitos (ambiente de homologação):
 * - App rodando (`npm run dev` / `npm start`) com backend configurado (.env.local:
 *   Supabase, DATABASE_URL, DEEPSEEK, MERCADO_PAGO quando aplicável).
 * - `npx playwright install chromium` (uma vez).
 * - Variáveis E2E (usuário real de teste):
 *     E2E_BASE_URL      (default http://localhost:3000)
 *     E2E_USER_EMAIL    (usuário autenticado)
 *     E2E_USER_PASSWORD
 *     E2E_ADMIN_EMAIL   (opcional — deve estar na allowlist de admin)
 * - Specs que dependem do backend são pulados quando E2E_USER_EMAIL não existe.
 *
 * Execução: `npm run test:e2e`
 */
export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
    locale: "pt-BR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Sem webServer quando E2E_BASE_URL aponta para um servidor externo (CI/homolog).
  ...(process.env.E2E_BASE_URL
    ? {}
    : {
        webServer: {
          command: "npm run dev",
          url: baseURL,
          reuseExistingServer: true,
          timeout: 120_000,
        },
      }),
});
