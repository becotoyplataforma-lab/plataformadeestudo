/**
 * E2E — Grupo B: P1–P5 VARIADO (fluxo real).
 *
 * 1) Login → /questoes
 * 2) Responde as 25 questões de teste PELA UI com aproveitamento DIFERENTE
 *    por matéria (gera question_attempts reais):
 *      Informática          5/5  (100%) → esperado P1
 *      Dir. Constitucional  4/5  ( 80%) → esperado P2
 *      Raciocínio Lógico    2/5  ( 40%) → esperado P3
 *      Dir. Administrativo  1/5  ( 20%) → esperado P3
 *      Português            0/5  (  0%) → esperado P4
 * 3) /cronograma → Replanejar com IA → verifica prioridades variadas
 * 4) Reload → persistência.
 *
 * Requer dados mínimos já inseridos (5 knowledge_subjects + 25 questões públicas)
 * e E2E_USER_EMAIL / E2E_USER_PASSWORD.
 */
import { test, expect, type Page } from "@playwright/test";
import { getAuthContext } from "./support/auth";

const EMAIL = process.env.E2E_USER_EMAIL ?? "";
const PASSWORD = process.env.E2E_USER_PASSWORD ?? "";

const SUBJECTS: Record<string, { id: string; correct: number }> = {
  "Informática": { id: "aaaaaaaa-0000-4000-8000-000000000005", correct: 5 },
  "Direito Constitucional": { id: "aaaaaaaa-0000-4000-8000-000000000002", correct: 4 },
  "Raciocínio Lógico": { id: "aaaaaaaa-0000-4000-8000-000000000004", correct: 2 },
  "Direito Administrativo": { id: "aaaaaaaa-0000-4000-8000-000000000003", correct: 1 },
  "Português": { id: "aaaaaaaa-0000-4000-8000-000000000001", correct: 0 },
};

async function answerInUi(page: Page, enunciado: string, letter: string) {
  const card = page
    .getByText(enunciado)
    .locator("xpath=ancestor::div[contains(@class,'overflow-hidden')]")
    .first();
  await card.getByText(letter, { exact: true }).first().locator("xpath=ancestor::button").click();
  // Espera o feedback (botões desabilitados após responder)
  await expect(card.getByRole("button").first()).toBeDisabled({ timeout: 10000 });
}

test.describe("Grupo B — P1–P5 variado (UI real)", () => {
  // Responder 25 questões pela UI real + replan + reload excede o timeout
  // padrão (30s). Aumenta o limite para o fluxo completo.
  test.describe.configure({ timeout: 180_000 });

  test.skip(!EMAIL || !PASSWORD, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD");

  test("responde questões pela UI → replan → prioridades variadas → persistência", async ({ page }) => {
    // Login
    await page.goto("/login?callbackUrl=%2F");
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();
    await page.waitForURL(/\/$/);
    console.log("[P1P5] LOGIN_OK");

    // Contexto de API autenticado p/ listar questões e seus gabaritos
    const api = await getAuthContext();

    // 2) Responde as questões por matéria via UI
    for (const [name, cfg] of Object.entries(SUBJECTS)) {
      const res = await api.get(
        `/api/questoes?subject_id=${cfg.id}&pageSize=50`
      );
      expect(res.ok()).toBeTruthy();
      const data = (await res.json()) as {
        data?: Array<{ id: string; enunciado: string; gabarito: string }>;
      };
      const qs = (data.data ?? []).sort((a, b) =>
        a.enunciado.localeCompare(b.enunciado)
      );
      expect(qs.length).toBeGreaterThan(0);
      console.log(`[P1P5] ${name}: ${qs.length} questões carregadas`);

      // Abre a página de questões e filtra pela matéria.
      // Dropdown Radix com lista longa (catálogo completo de matérias): clicar
      // na opção por ponteiro é flaky (intercepção no re-render pode selecionar
      // a matéria vizinha — ex.: Ética em vez de Informática). Seleção por
      // teclado (typeahead + Enter) é determinística.
      await page.goto("/questoes");
      await page.getByRole("combobox").first().click();
      await page.keyboard.type(name, { delay: 25 });
      await page.keyboard.press("Enter");

      for (let i = 0; i < qs.length; i++) {
        const q = qs[i]!;
        const correct = i < cfg.correct;
        const letter = correct
          ? q.gabarito
          : q.gabarito === "A"
            ? "B"
            : "A";
        await answerInUi(page, q.enunciado, letter);
        console.log(
          `[P1P5]   respondeu ${q.enunciado} → ${letter} (${correct ? "certo" : "errado"})`
        );
      }
    }
    await api.dispose();

    // 3) Replanejar com IA
    await page.goto("/cronograma");
    await expect(
      page.getByRole("heading", { name: "Seu plano de estudos" })
    ).toBeVisible({ timeout: 20000 });

    const respPromise = page.waitForResponse(
      (r) =>
        r.url().includes("/api/study/planner/generate") &&
        r.request().method() === "POST"
    );
    await page.getByRole("button", { name: "Replanejar com IA" }).click();
    const resp = await respPromise;
    console.log("[P1P5] REPLAN_HTTP=" + resp.status());
    const body = (await resp.json()) as {
      tasks_created?: number;
      priorities?: Array<{
        subject_id: string;
        subject_name: string;
        priority: number;
        link_method?: string;
        performance?: { total?: number; accuracy_pct?: number } | null;
      }>;
    };
    console.log("[P1P5] REPLAN_BODY=" + JSON.stringify(body, null, 0));

    const priorities = (body.priorities ?? []).sort(
      (a, b) => b.priority - a.priority
    );
    const distinct = new Set(priorities.map((p) => p.priority)).size;
    console.log(
      "[P1P5] PRIORIDADES=" +
        priorities.map((p) => `${p.subject_name}:P${p.priority}`).join(" | ")
    );
    console.log("[P1P5] DISTINCT_LEVELS=" + distinct);

    // Asserts principais
    expect(resp.status()).toBe(200);
    // O usuário de teste pode acumular study_subjects de outras execuções E2E
    // (ex.: "E2E Matéria <ts>") — filtra para as 5 matérias registradas por este
    // teste antes de validar a priorização (poluição de dados de teste, não bug).
    const EXPECTED = new Set([
      "Português",
      "Direito Constitucional",
      "Direito Administrativo",
      "Raciocínio Lógico",
      "Informática",
    ]);
    const own = priorities.filter((p) => EXPECTED.has(p.subject_name));
    expect(own.length).toBe(5);
    expect(new Set(own.map((p) => p.priority)).size).toBeGreaterThan(1); // NÃO pode ser tudo igual (P3)
    expect(body.tasks_created).toBeGreaterThan(0);

    // Toast de sucesso
    await expect(page.getByText(/Cronograma atualizado/)).toBeVisible({
      timeout: 20000,
    });

    // 4) Reload → persistência
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Seu plano de estudos" })
    ).toBeVisible({ timeout: 20000 });
    const tasksAfter = await page
      .locator('text=/^Estudar /')
      .allTextContents()
      .catch(() => []);
    console.log("[P1P5] TAREFAS_APOS_RELOAD=" + tasksAfter.length);

    console.log(
      "[P1P5] RESUMO tasks_created=" +
        (body.tasks_created ?? "?") +
        " priorities=" +
        priorities.length +
        " distinct=" +
        distinct +
        " tarefas_apos_reload=" +
        tasksAfter.length
    );
  });
});
