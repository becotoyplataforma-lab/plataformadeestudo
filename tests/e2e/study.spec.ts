/**
 * E2E — Study (cronograma/questões).
 *
 * Cria disciplina + tarefa via API (contratos reais do Study DTO) e valida a
 * presença na UI do cronograma. Requer backend real (E2E_USER_EMAIL/PASSWORD).
 */
import { test, expect } from "@playwright/test";
import { getAuthContext, hasAuth, authenticateBrowser } from "./support/auth";

test.describe("Study — fluxo principal", () => {
  test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");
  test("cria disciplina e tarefa via API e exibe no cronograma", async ({ page }) => {
    const api = await getAuthContext();
    const stamp = Date.now();

    const subjectRes = await api.post("/api/study/subjects", {
      data: { name: `E2E Matéria ${stamp}` },
    });
    expect(subjectRes.ok()).toBeTruthy();
    const subject = (await subjectRes.json()) as { id: string };
    expect(subject.id).toBeTruthy();

    const taskRes = await api.post("/api/study/tasks", {
      data: {
        title: `E2E Revisar CF ${stamp}`,
        scheduled_date: new Date().toISOString(),
        duration_min: 60,
      },
    });
    expect(taskRes.ok()).toBeTruthy();
    const task = (await taskRes.json()) as { id: string };
    expect(task.id).toBeTruthy();

    // Autentica o navegador com o cookie da sessão e abre o cronograma.
    await authenticateBrowser(page);
    await page.goto("/cronograma");
    await expect(page.getByText(`E2E Revisar CF ${stamp}`).first()).toBeVisible();

    // Cleanup — o teste não deixa dados acumulados (subject/task criados aqui).
    await api.delete(`/api/study/tasks/${task.id}`);
    await api.delete(`/api/study/subjects/${subject.id}`);
  });

  test("lista questões públicas via API", async () => {
    const api = await getAuthContext();
    const res = await api.get("/api/study/questions");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { data?: unknown[]; total?: number };
    expect(Array.isArray(body.data)).toBe(true);
  });
});
