import { test, expect, type Page } from "@playwright/test";

import { authenticateBrowser, hasAuth } from "./support/auth";

/**
 * E2E — Smoke visual da rota da Aula 14 (`/cbm-rj/portugues/questoes/aula-14`).
 *
 * O que só este nível prova: que o JSON escrito pelo extrator chega renderizado
 * dentro do shell autenticado, sem erro de hidratação e sem erro de console.
 * É leitura pura — o "Responder" do card é estado React local e o spec chega a
 * falhar se alguma interação emitir POST para /api (nenhuma resposta de aluno é
 * gravada no banco durante o smoke).
 *
 * Casos fixados por id, porque o dataset já passou pelo verificador e estes três
 * são os formatos que a UI precisa sustentar ao mesmo tempo:
 *   A14-S01-001  certo/errado com gabarito  → círculos C/E
 *   A14-S01-015  múltipla escolha           → círculos A-E
 *   A14-S01-014  em quarentena              → selo + nenhuma resposta revelada
 */
const LISTA = "/cbm-rj/portugues/questoes/aula-14";

/**
 * `SMOKE_PROD=1` roda o mesmo spec contra `next start` (build de produção).
 * É o modo que aplica o CSP de verdade (em dev o header sai Report-Only e nada
 * é bloqueado) e que confere o corpo de 404 renderizado sem erro de console.
 * O código HTTP de 404, esse sim, não vem nem de dev nem de produção enquanto
 * houver `src/app/loading.tsx` na raiz: o documento começa a ser despejado como
 * 200 antes de `notFound()` resolver. Ver `EXIGE_STATUS_404`.
 */
const MODO_PROD = process.env.SMOKE_PROD === "1";

/**
 * Cobranca do status HTTP de 404. Desligada por padrao porque hoje ela nao
 * depende da Aula 14: `src/app/loading.tsx` e um fallback de suspense na RAIZ
 * do App Router, entao o documento comeca a ser enviado (200) antes de
 * `notFound()` resolver. O corpo ja e a pagina de 404 do app dentro do shell —
 * o que falta e o codigo. Ligue `SMOKE_EXPECT_HTTP_404=1` quando a plataforma
 * decidir trocar o loading global por fallbacks por grupo de rota.
 */
const EXIGE_STATUS_404 = process.env.SMOKE_EXPECT_HTTP_404 === "1";

/** Ruído que não pertence ao app (browser / dev server). */
function ehRuido(texto: string): boolean {
  return (
    /favicon\.ico/i.test(texto) ||
    /Download the React DevTools/i.test(texto) ||
    /webpack-hot-middleware|ws:\/\//.test(texto) ||
    // CSP pré-existente da plataforma (src/lib/security/csp.ts): em dev o
    // header vai como Report-Only e o Chrome reclama que
    // `upgrade-insecure-requests` é ignorado em policy report-only. Isso
    // acontece em TODAS as rotas do app, não é da Aula 14.
    /Content Security Policy directive 'upgrade-insecure-requests'/i.test(texto)
  );
}

/** Console error + pageerror + HTTP de sub-recurso >= 400. */
function capturarErros(page: Page): string[] {
  const erros: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error" && !ehRuido(msg.text())) {
      erros.push(`console: ${msg.text()}`);
    }
  });
  page.on("pageerror", (err) => erros.push(`pageerror: ${err.message}`));
  page.on("response", (res) => {
    // O status do documento o próprio spec confere; aqui só interessa o que a
    // página carregou de lado (CSS, JS, fontes, imagens).
    if (res.request().resourceType() === "document") return;
    if (res.status() >= 400 && !ehRuido(res.url())) {
      erros.push(`http ${res.status()}: ${res.url()}`);
    }
  });
  return erros;
}

test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (sessão real)");

test.describe("Aula 14 — listagem", () => {
  test("200, cards do dataset e zero erro de console", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    const resp = await page.goto(LISTA, { timeout: 90_000 });
    expect(resp?.status()).toBe(200);

    await expect(
      page.getByRole("heading", { name: /Aula 14 · Língua Portuguesa/ })
    ).toBeVisible();

    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);

    // Sem o artefato em disco a página mostra o aviso de dataset ausente;
    // isso não pode passar por smoke aprovado.
    await expect(page.getByText("Dataset ainda não gerado")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Só com gabarito" })).toBeVisible();

    expect(erros).toEqual([]);
  });

  test("?filtro=gabarito esconde quarentena e item sem resposta", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${LISTA}?filtro=gabarito`, { timeout: 90_000 });
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();

    // Selo de quarentena é o único badge âmbar do card; com o filtro ele some.
    await expect(page.getByText("Gabarito inconclusivo")).toHaveCount(0);
    await expect(page.getByText("Estrutura incompleta")).toHaveCount(0);

    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < Math.min(total, 12); i++) {
      await expect(cards.nth(i).getByText(/^Gabarito:/)).toBeVisible();
    }

    expect(erros).toEqual([]);
  });

  test("?secao=1 limita a lista à seção 1", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${LISTA}?secao=1`, { timeout: 90_000 });
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();

    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      const codigo = await cards.nth(i).locator("code").first().innerText();
      expect(codigo).toContain("-S01-");
    }

    expect(erros).toEqual([]);
  });

  test("item do menu lateral leva direto à tela de questões", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto("/dashboard", { timeout: 90_000 });
    const entrada = page.locator("aside").getByRole("link", { name: /Português · Aula 14/ });
    await expect(entrada).toHaveCount(1);
    await expect(entrada).toHaveAttribute("href", LISTA);

    await entrada.click();
    await page.waitForURL(`**${LISTA}`, { timeout: 60_000 });
    await expect(
      page.getByRole("heading", { name: /Aula 14 · Língua Portuguesa/ })
    ).toBeVisible();

    expect(erros).toEqual([]);
  });
});

test.describe("Aula 14 — detalhe", () => {
  test("certo/errado: círculos C/E, selos e sanfona de pendência", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    const resp = await page.goto(`${LISTA}/A14-S01-001`, { timeout: 90_000 });
    expect(resp?.status()).toBe(200);

    const card = page.locator("article");
    await expect(card).toHaveCount(1);
    await expect(card.locator("code").first()).toHaveText("A14-S01-001");

    // Círculo de seleção no formato C/E (e somente ele).
    const circulos = card.locator("button [data-alternativa]");
    await expect(circulos).toHaveCount(2);
    await expect(circulos.nth(0)).toHaveText("C");
    await expect(circulos.nth(1)).toHaveText("E");

    // Trilha Banca · Ano ▸ Disciplina ▸ Assunto ▸ Órgão: sem órgão declarado,
    // o selo não existe — a UI não inventa "Sem órgão".
    const trilha = card.locator("[aria-label='Metadados da questão']");
    await expect(trilha.locator("[data-selo='banca_ano']")).toHaveText("INOVERSASUL · 2025");
    await expect(trilha.locator("[data-selo='disciplina']")).toHaveText(
      /Língua Portuguesa/
    );
    await expect(trilha.locator("[data-selo='assunto']")).toHaveText("Ortografia");
    await expect(trilha.locator("[data-selo='orgao']")).toHaveCount(0);

    // Botão Responder nasce desabilitado: o aluno ainda não marcou nada.
    await expect(card.getByRole("button", { name: "Responder" })).toBeDisabled();

    // Rodapé em sanfona: resolução pendente, comentário de terceiro barrado.
    await card.getByRole("button", { name: /Gabarito e resolução/ }).click();
    await expect(
      card.getByText("Resolução por IA ainda não foi gerada para este item.")
    ).toBeVisible();

    await card.getByRole("button", { name: "Comentários" }).click();
    await expect(card.getByText(/Comentário de terceiro não é publicado/)).toBeVisible();

    expect(erros).toEqual([]);
  });

  test("marcar alternativa e responder é estado local (zero POST)", async ({ page }) => {
    const erros = capturarErros(page);
    const escritas: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/api/") && req.method() !== "GET") {
        escritas.push(`${req.method()} ${req.url()}`);
      }
    });

    await authenticateBrowser(page);
    await page.goto(`${LISTA}/A14-S01-001`, { timeout: 90_000 });

    const card = page.locator("article");
    const responder = card.getByRole("button", { name: "Responder" });

    // Gabarito é E: marcar "Certo" primeiro prova que o estado reage.
    await card.locator("button", { hasText: "Certo" }).first().click();
    await expect(responder).toBeEnabled();
    await responder.click();
    await expect(card.getByText("Você errou")).toBeVisible();

    await card.locator("button", { hasText: "Errado" }).first().click();
    await card.getByRole("button", { name: "Responder" }).click();
    await expect(card.getByText("Você acertou")).toBeVisible();

    expect(escritas).toEqual([]);
    expect(erros).toEqual([]);
  });

  test("múltipla escolha: cinco círculos A-E", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${LISTA}/A14-S01-015`, { timeout: 90_000 });
    const circulos = page.locator("article button [data-alternativa]");
    await expect(circulos).toHaveCount(5);
    const letras = await circulos.allInnerTexts();
    expect(letras.map((l) => l.trim())).toEqual(["A", "B", "C", "D", "E"]);
    await expect(page.locator("article").getByText(/^Gabarito:/)).toBeVisible();

    expect(erros).toEqual([]);
  });

  test("quarentena: mostra o selo e não revela resposta", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${LISTA}/A14-S01-014`, { timeout: 90_000 });
    const card = page.locator("article");

    await expect(card.getByText("Gabarito inconclusivo")).toBeVisible();
    await expect(card.getByText(/^Gabarito:/)).toHaveCount(0);

    await card.getByRole("button", { name: /Gabarito e resolução/ }).click();
    await expect(card.getByText(/não dá uma resposta confiável/)).toBeVisible();

    const responder = card.getByRole("button", { name: "Responder" });
    await card.locator("button [data-alternativa]").first().click();
    await responder.click();
    await expect(card.getByText(/Você (acertou|errou)/)).toHaveCount(0);

    expect(erros).toEqual([]);
  });

  test("prev/next permanecem na mesma seção", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${LISTA}/A14-S01-001`, { timeout: 90_000 });
    const proxima = page.getByRole("link", { name: /→/ }).first();
    await expect(proxima).toBeVisible();
    expect(await proxima.getAttribute("href")).toContain(`${LISTA}/A14-S01-`);

    await proxima.click();
    await page.waitForURL(`**${LISTA}/A14-S01-002`, { timeout: 60_000 });
    expect(page.url()).toMatch(/aula-14\/A14-S01-002$/);

    expect(erros).toEqual([]);
  });
});

test.describe("Aula 14 — 404 limpo", () => {
  /**
   * O contrato que a rota entrega ao aluno é o corpo: a página de 404 do app,
   * dentro do shell, sem stack e sem vazar que o id existe em outra seção.
   */
  async function esperar404(page: Page, caminho: string): Promise<number | undefined> {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    const resp = await page.goto(caminho, { timeout: 90_000 });
    await expect(
      page.getByRole("heading", { name: "Página não encontrada" })
    ).toBeVisible();
    await expect(page.locator("article")).toHaveCount(0);
    expect(erros).toEqual([]);
    return resp?.status();
  }

  /**
   * O contrato entregue ao aluno e o corpo, e `esperar404` ja o conferiu. O
   * codigo HTTP so e cobravel quando nao ha suspense de raiz despejando o
   * documento antes de `notFound()` resolver — ver `EXIGE_STATUS_404`. Enquanto
   * a plataforma mantiver o loading global, o desvio sai como anotacao visivel
   * no relatorio do Playwright em vez de um green silencioso.
   */
  function registrar404(status: number | undefined): void {
    if (MODO_PROD && EXIGE_STATUS_404) {
      expect(status).toBe(404);
      return;
    }
    if (MODO_PROD && status !== 404) {
      test.info().annotations.push({
        type: "soft-404",
        description:
          "HTTP " +
          status +
          " com corpo de 404: src/app/loading.tsx faz streaming do shell antes de " +
          "notFound(). Cobrar com SMOKE_EXPECT_HTTP_404=1 depois de mover o " +
          "loading global para grupos de rota.",
      });
    }
  }

  test("id malformado cai em notFound", async ({ page }) => {
    const status = await esperar404(page, `${LISTA}/A14-S1-1`);
    registrar404(status);
  });

  test("id bem formado e inexistente cai em notFound", async ({ page }) => {
    const status = await esperar404(page, `${LISTA}/A99-S01-001`);
    registrar404(status);
  });
});
