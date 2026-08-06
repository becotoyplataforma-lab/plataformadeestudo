/**
 * E2E — Analytics.
 *
 * KPIs via API (/api/analytics/summary) e renderização da página /analises.
 * Requer backend real.
 */
import { test, expect } from "@playwright/test";
import { getAuthContext, hasAuth, authenticateBrowser } from "./support/auth";

test.describe("Analytics — fluxo principal", () => {
  test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");
  test("summary de analytics responde KPIs", async () => {
    const api = await getAuthContext();
    const res = await api.get("/api/analytics/summary");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      total_questoes: number;
      acertos: number;
      taxa_acerto: number;
      streak_dias: number;
      estudado_hoje_min: number;
    };
    expect(body.total_questoes).toBeGreaterThanOrEqual(0);
    expect(body.acertos).toBeGreaterThanOrEqual(0);
    expect(body.taxa_acerto).toBeGreaterThanOrEqual(0);
    expect(body.streak_dias).toBeGreaterThanOrEqual(0);
    expect(body.estudado_hoje_min).toBeGreaterThanOrEqual(0);
  });

  test("evolução respeita o parâmetro days", async () => {
    const api = await getAuthContext();
    const res = await api.get("/api/analytics/evolution?days=14");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { data: unknown[] };
    expect(body.data).toHaveLength(14);
  });

  test("página /analises renderiza autenticada", async ({ page }) => {
    await authenticateBrowser(page);
    await page.goto("/analises");
    await expect(page).toHaveURL(/\/analises/);
  });
});
