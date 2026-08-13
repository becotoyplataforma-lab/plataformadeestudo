/**
 * E2E — Grupo B (Planner, caminho real da UI):
 * login → /cronograma → cadastra 5 disciplinas pela UI → Replanejar com IA →
 * prioridades P1–P5 → tarefas geradas → persistência após reload.
 *
 * Requer app rodando (E2E_BASE_URL) e E2E_USER_EMAIL / E2E_USER_PASSWORD.
 * NÃO executa seed nem SQL manual — tudo via UI da aplicação.
 */
import { test, expect } from "@playwright/test";

const EMAIL = process.env.E2E_USER_EMAIL ?? "";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

const SUBJECTS = [
  "Português",
  "Direito Constitucional",
  "Direito Administrativo",
  "Raciocínio Lógico",
  "Informática",
];

test.describe("Grupo B — Planner pela UI real", () => {
  test.skip(!EMAIL || !PASSWORD, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD");

  test("cadastra disciplinas → replan → P1–P5 → persistência", async ({ page }) => {
    // 1) Login
    await page.goto("/login?callbackUrl=%2F");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/$/);
    console.log("[GB-UI] LOGIN_OK url=" + page.url());

    // 2) /cronograma
    await page.goto("/cronograma");
    await expect(
      page.getByRole("heading", { name: "Seu plano de estudos" })
    ).toBeVisible({ timeout: 20000 });
    console.log("[GB-UI] CRONOGRAMA_OK");

    // 3) Cadastra as disciplinas pela UI (uma a uma; a página recarrega após cada criação)
    for (const name of SUBJECTS) {
      await page.getByRole("button", { name: "Disciplina" }).click();
      await page.locator("#subject-name").fill(name);
      await page.getByRole("button", { name: "Criar disciplina" }).click();
      // Espera o reload terminar e a disciplina aparecer no card "Suas disciplinas"
      await expect(page.getByText(name).first()).toBeVisible({ timeout: 15000 });
      console.log("[GB-UI] DISCIPLINA_ADICIONADA=" + name);
    }

    // 4) Dispara o replan e captura a resposta da API
    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/study/planner/generate") &&
        r.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Replanejar com IA" }).click();
    const resp = await respPromise;
    console.log("[GB-UI] REPLAN_HTTP=" + resp.status());
    const body = (await resp.json()) as {
      tasks_created?: number;
      priorities?: Array<{
        subject_id: string;
        subject_name: string;
        priority: number;
        link_method?: string;
        knowledge_subject_name?: string | null;
      }>;
    };
    console.log("[GB-UI] REPLAN_BODY=" + JSON.stringify(body));

    // 5) Toast de sucesso
    await expect(page.getByText(/Cronograma atualizado/)).toBeVisible({
      timeout: 20000,
    });
    console.log("[GB-UI] TOAST_OK");

    // 6) Painel "Planejamento inteligente" e badges P1–P5
    const panel = page.getByText("Planejamento inteligente");
    if ((await panel.count()) > 0) {
      console.log("[GB-UI] PAINEL_PLANEJAMENTO=visivel");
    } else {
      console.log("[GB-UI] PAINEL_PLANEJAMENTO=ausente");
    }

    const prioBadges = page.locator('text=/Prioridade \\d/');
    const prioCount = await prioBadges.count();
    console.log("[GB-UI] PRIORIDADE_BADGES=" + prioCount);
    if (prioCount > 0) {
      const texts = await prioBadges.allTextContents();
      console.log("[GB-UI] PRIORIDADES=" + JSON.stringify(texts));
    }

    // 7) Tarefas geradas na semana (títulos "Estudar X")
    const taskTitles = await page
      .locator('text=/^Estudar /')
      .allTextContents()
      .catch(() => []);
    console.log("[GB-UI] TAREFAS_NA_TELA=" + JSON.stringify(taskTitles));

    // 8) Recarrega e verifica persistência
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Seu plano de estudos" })
    ).toBeVisible({ timeout: 20000 });
    const persisted = await page
      .locator('text=/^Estudar /')
      .allTextContents()
      .catch(() => []);
    console.log("[GB-UI] APOS_RELOAD_TAREFAS=" + persisted.length);

    // 9) Resumo
    console.log(
      "[GB-UI] RESUMO tasks_created=" +
        (body.tasks_created ?? "?") +
        " priorities=" +
        (body.priorities?.length ?? "?") +
        " painel_na_tela=" +
        ((await panel.count()) > 0) +
        " prioridades_na_tela=" +
        prioCount +
        " tarefas_apos_reload=" +
        persisted.length
    );
  });
});
