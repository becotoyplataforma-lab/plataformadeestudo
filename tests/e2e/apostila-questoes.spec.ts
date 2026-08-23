import { test, expect } from "@playwright/test";

/**
 * E2E — Regra de negócio: upload de apostilas é EXCLUSIVO de admin.
 * Alunos NUNCA enviam apostilas — recebem 403 ao tentar.
 * Valida também que o aluno vê a listagem de apostilas e o fluxo de
 * geração de questões a partir de apostilas já disponibilizadas.
 */
const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;
const hasAuth = Boolean(EMAIL && PASSWORD);

test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");

test("aluno NÃO pode enviar apostila (403) e vê a listagem", async ({ page }) => {
  // login
  await page.goto("/login");
  await page.fill("#email", EMAIL!);
  await page.fill("#password", PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });

  // aluno tenta enviar apostila → deve receber 403 (regra de negócio)
  const content = [
    "Princípios fundamentais da República Federativa do Brasil.",
    "Art. 1º: soberania, cidadania, dignidade da pessoa humana.",
  ].join("\n");

  const upload = await page.request.post("/api/knowledge/upload", {
    timeout: 60_000,
    multipart: {
      file: {
        name: `apostila-e2e-${Date.now()}.txt`,
        mimeType: "text/plain",
        buffer: Buffer.from(content, "utf8"),
      },
    },
  });
  expect(upload.status()).toBe(403);
  const uploadJson = await upload.json();
  expect(uploadJson.error).toBe("FORBIDDEN");

  // aluno vê a página de apostilas (listagem, sem componente de upload)
  await page.goto("/apostilas", { timeout: 60_000 });
  await expect(page.getByRole("heading", { name: "Apostilas" })).toBeVisible();
  // NÃO deve haver formulário de upload na área do aluno
  await expect(page.getByText("Enviar apostila")).toHaveCount(0);
  await expect(page.getByText("Enviar e processar")).toHaveCount(0);

  // matérias do edital respondem 200 (vazio se concurso não definido)
  const edital = await page.request.get("/api/study/edital-subjects");
  expect(edital.ok()).toBeTruthy();
});
