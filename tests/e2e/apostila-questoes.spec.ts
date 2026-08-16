import { test, expect } from "@playwright/test";

/**
 * E2E — Fluxo apostila do aluno → indexação → geração de questões.
 * Upload TXT (não depende de IA/embeddings) e valida a listagem + erro
 * elegante de geração sem DEEPSEEK (ou 201 com a chave configurada).
 */
const EMAIL = process.env.E2E_USER_EMAIL;
const PASSWORD = process.env.E2E_USER_PASSWORD;
const hasAuth = Boolean(EMAIL && PASSWORD);

test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");

test("aluno sobe apostila TXT, vê indexação e gera questões (ou erro elegante)", async ({
  page,
}) => {
  // login
  await page.goto("/login");
  await page.fill("#email", EMAIL!);
  await page.fill("#password", PASSWORD!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20_000 });

  // upload de apostila TXT
  const content = [
    "Princípios fundamentais da República Federativa do Brasil.",
    "Art. 1º: soberania, cidadania, dignidade da pessoa humana, valores sociais do trabalho e da livre iniciativa, pluralismo político.",
    "Art. 2º: separação dos Poderes (Executivo, Legislativo e Judiciário).",
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
  expect(upload.ok()).toBeTruthy();
  const uploadJson = await upload.json();
  const documentId: string = uploadJson.document.id;
  const title: string = uploadJson.document.title;
  expect(["chunked", "indexed"]).toContain(uploadJson.document.status);

  try {
    // apostila aparece na listagem do aluno
    await page.goto("/apostilas", { timeout: 60_000 });
    await expect(page.getByText(title)).toBeVisible({ timeout: 20_000 });

    // matérias do edital respondem 200 (vazio se concurso não definido)
    const edital = await page.request.get("/api/study/edital-subjects");
    expect(edital.ok()).toBeTruthy();

    // geração a partir da apostila
    const gen = await page.request.post("/api/questions/generate", {
      timeout: 60_000,
      data: {
        document_id: documentId,
        subject_id: "aaaaaaaa-0000-4000-8000-000000000001", // Português
        quantity: 3,
      },
    });
    if (gen.status() === 201) {
      const g = await gen.json();
      expect(g.generated).toBeGreaterThanOrEqual(0);
    } else {
      // Sem chave válida a rota retorna erro elegante (AI_NOT_CONFIGURED/PROVIDER_FAILED).
      expect([502, 503]).toContain(gen.status());
      const g = await gen.json();
      expect(["AI_NOT_CONFIGURED", "PROVIDER_FAILED"]).toContain(g.error);
    }
  } finally {
    // Cleanup best-effort (não deve falhar o teste por cold-start).
    try {
      await page.request.delete(`/api/knowledge/documents/${documentId}`, {
        timeout: 60_000,
      });
    } catch {
      /* ignore */
    }
  }
});
