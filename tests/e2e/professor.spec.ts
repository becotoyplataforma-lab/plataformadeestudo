/**
 * E2E — Professor IA.
 *
 * Chama o Professor IA via API (/api/professor/chat) validando a resposta,
 * o modo (chat/rag) e as métricas. Requer backend real (DeepSeek configurado).
 */
import { test, expect } from "@playwright/test";
import { getAuthContext, hasAuth, authenticateBrowser } from "./support/auth";

test.describe("Professor IA — fluxo principal", () => {
  test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");
  test("responde a uma pergunta simples (modo chat) via API", async () => {
    const api = await getAuthContext();
    const res = await api.post("/api/professor/chat", {
      data: { message: "Explique o que é a Constituição." },
    });
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      answer: string;
      mode: "chat" | "rag";
      model: "flash" | "pro";
      citations: unknown[];
      tokens: { total: number };
      confidence: number;
    };
    expect(body.answer.length).toBeGreaterThan(0);
    expect(["chat", "rag"]).toContain(body.mode);
    expect(["flash", "pro"]).toContain(body.model);
    expect(Array.isArray(body.citations)).toBe(true);
    expect(body.tokens.total).toBeGreaterThanOrEqual(0);
    expect(body.confidence).toBeGreaterThanOrEqual(0);
  });

  test("página /professor carrega o chat autenticado", async ({ page }) => {
    await authenticateBrowser(page);
    await page.goto("/professor");
    await expect(page).toHaveURL(/\/professor/);
  });
});
