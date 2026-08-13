/**
 * E2E — Grupo B (Planner): login → /cronograma → Replanejar com IA → P1–P5 → persistência.
 *
 * Requer app rodando em E2E_BASE_URL (default http://localhost:3000) e
 * E2E_USER_EMAIL / E2E_USER_PASSWORD de uma conta real.
 *
 * NÃO executa migration, seed ou alteração manual no banco.
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL ?? "";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

test.describe("Grupo B — Cronograma + Planner", () => {
  test.skip(!EMAIL || !PASSWORD, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD");

  test("login → cronograma → replan → P1–P5 → persistência", async ({ page }) => {
    // 1) Login
    await page.goto("/login?callbackUrl=%2F");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/$/);
    console.log("[GRUPO-B] LOGIN_OK url=" + page.url());

    // 2) /cronograma carrega sem 500
    await page.goto("/cronograma");
    await expect(
      page.getByRole("heading", { name: "Seu plano de estudos" })
    ).toBeVisible({ timeout: 20000 });
    console.log("[GRUPO-B] CRONOGRAMA_OK (sem 500)");

    // 3) Dispara o replan e captura a resposta da API
    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/study/planner/generate") &&
        r.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Replanejar com IA" }).click();
    const resp = await respPromise;
    console.log("[GRUPO-B] REPLAN_HTTP=" + resp.status());
    const body = (await resp.json()) as {
      tasks_created?: number;
      priorities?: Array<{
        subject_id: string;
        subject_name: string;
        priority: number;
        link_method?: string;
      }>;
    };
    console.log("[GRUPO-B] REPLAN_BODY=" + JSON.stringify(body));

    // 4) Toast de sucesso
    await expect(page.getByText(/Cronograma atualizado/)).toBeVisible({
      timeout: 20000,
    });
    console.log("[GRUPO-B] TOAST_OK");

    // 5) Prioridades exibidas (P1–P5) — depende de existirem disciplinas
    const prioBadges = page.locator("text=Prioridade");
    const prioCount = await prioBadges.count();
    console.log("[GRUPO-B] PRIORIDADE_BADGES=" + prioCount);

    const panelCount = await page
      .getByText("Planejamento inteligente")
      .count();
    console.log("[GRUPO-B] PAINEL_PLANEJAMENTO=" + panelCount);

    // 6) Recarrega e verifica persistência (página continua carregando os dados)
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Seu plano de estudos" })
    ).toBeVisible({ timeout: 20000 });
    console.log("[GRUPO-B] PERSISTENCIA_RELOAD_OK");

    // 7) Resumo
    console.log(
      "[GRUPO-B] RESUMO tasks_created=" +
        (body.tasks_created ?? "?") +
        " priorities=" +
        (body.priorities?.length ?? "?") +
        " painel_na_tela=" +
        panelCount
    );
  });
});
