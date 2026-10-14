import { test, expect, type Page } from "@playwright/test";

import { authenticateBrowser, hasAuth } from "./support/auth";

/**
 * E2E — Smoke visual do caderno de questões (`/questoes/portugues`).
 *
 * O que só este nível prova: que o JSON escrito pelo extrator chega renderizado
 * dentro do shell autenticado pela rota de domínio, sem erro de hidratação e sem
 * erro de console. É leitura pura — o "Responder" do card é estado React local e
 * o spec falha se alguma interação emitir POST para /api (nenhuma resposta de
 * aluno é gravada no banco durante o smoke).
 *
 * A rota não menciona o material físico: menu e cabeçalho dizem
 * "Português · Banco de Questões", e a aula só aparece como tag de procedência
 * (`?origem=aula-14`) ou dentro da sanfona do card. O código do lote
 * (`A14-S01-001`) permanece na URL como identificador — é chave, não nome.
 *
 * Casos fixados por código, porque o acervo já passou pelo verificador e estes
 * são os formatos que a UI precisa sustentar ao mesmo tempo:
 *   A14-S01-001  certo/errado com gabarito  → círculos C/E
 *   A14-S01-015  múltipla escolha           → círculos A-E
 *   A14-S01-014  em quarentena              → selo + nenhuma resposta revelada
 */
const CADERNO = "/questoes/portugues";

/** Rota legada do PDF: continua respondendo, mas por redirecionamento. */
const LEGADO = "/cbm-rj/portugues/questoes/aula-14";

/**
 * `SMOKE_PROD=1` roda o mesmo spec contra `next start` (build de produção), que
 * é o modo que aplica o CSP de verdade: em dev o header sai Report-Only e nada
 * é bloqueado.
 */

/** Ruído que não pertence ao app (browser / dev server). */
function ehRuido(texto: string): boolean {
  return (
    /favicon\.ico/i.test(texto) ||
    /Download the React DevTools/i.test(texto) ||
    /webpack-hot-middleware|ws:\/\//.test(texto) ||
    // CSP pré-existente da plataforma (src/lib/security/csp.ts): em dev o
    // header vai como Report-Only e o Chrome reclama que
    // `upgrade-insecure-requests` é ignorado em policy report-only. Isso
    // acontece em TODAS as rotas do app.
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

test.describe("Caderno — listagem por matéria", () => {
  // A primeira navegação em dev compila a rota com o lote inteiro em disco; os
  // 30 s padrão não cobrem esse aquecimento quando o servidor está frio.
  test.describe.configure({ timeout: 120_000 });

  test("200, cards do acervo local e zero erro de console", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    const resp = await page.goto(CADERNO, { timeout: 90_000 });
    expect(resp?.status()).toBe(200);

    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Português · Banco de Questões/ })
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /Português · Banco de Questões/ })
    ).toBeVisible();

    expect(await cards.count()).toBeGreaterThan(0);

    // A barra de filtros é um formulário GET com selects nativos: o filtro vive
    // na URL, não em estado de cliente. A grade é a do filtro avançado de
    // QConcursos: palavra-chave + as facetas que o lote declara de verdade.
    const barra = page.locator("form[method='get']");
    await expect(barra).toHaveCount(1);
    await expect(barra.locator("input[name='palavra']")).toHaveCount(1);
    for (const nome of ["disciplina", "assunto", "banca", "orgao", "ano"]) {
      await expect(barra.locator(`select[name='${nome}']`)).toHaveCount(1);
    }
    // O que fica dentro do filtro avançado (linha 2 e refinamentos).
    const avancado = barra.locator("[data-filtro-avancado]");
    await expect(avancado.locator("select[name='cargo']")).toHaveCount(1);
    await expect(avancado.locator("select[name='tipo']")).toHaveCount(1);
    await expect(avancado.locator("select[name='origem']")).toHaveCount(1);
    // A caixa de qualidade fica fora do bloco avançado: é decisão de tela.
    await expect(barra.locator("input[name='gabarito']")).toHaveCount(1);
    await expect(barra.locator("select[name='banca'] option[value='INOVERSASUL']")).toHaveCount(1);
    // As duas abas do topo, com o total medido de cada uma.
    await expect(barra.locator("[data-aba]")).toHaveCount(2);
    await expect(barra.locator("[data-aba='objetivas']")).toContainText("Questões Objetivas");
    await expect(barra.locator("[data-aba='fixacao']")).toContainText("Exercícios de Fixação");

    // A contagem é a do acervo distinto depois do padrão de qualidade, não o
    // número de linhas do arquivo: 1.736 linhas → 4 descartadas por violação de
    // forma → 1.732 lidas → 918 distintas (814 cópias colapsadas) → 886 com
    // gabarito que o material sustenta. A asserção é exata de propósito: se
    // alguém voltar a somar as duas publicações do PDF, ou esconder a quarentena
    // sem dizer, este caso grita. Medido por `scripts/lib/audit-acervo.ts`.
    await expect(page.locator("[data-contagem]")).toHaveText(
      "Exibindo 1 a 20 de 886 questões"
    );
    // A pendência é dita, não escondida: 32 distintas ficam fora do padrão.
    await expect(page.locator("[data-pendencia]")).toContainText("918 no acervo inteiro");
    await expect(page.locator("[data-pendencia]")).toContainText("32 estão em revisão");
    // Sem filtro aplicado, a linha "Filtrar por" diz isso em vez de inventar chip.
    await expect(barra.getByText("Filtrar por:")).toBeVisible();
    await expect(barra.locator("[data-chip]")).toHaveCount(0);

    // Página de verdade: 20 cards, não a lista cortada em 60 sem paginação.
    expect(await cards.count()).toBe(20);
    await expect(page.getByRole("link", { name: "Próxima" })).toBeVisible();

    // Procedência é metadado discreto, não chip de rota, e o lixo de teste de
    // integração nunca chega à tela do aluno.
    await expect(page.getByText("Procedência do acervo local:")).toBeVisible();
    await expect(page.getByText(/aula-14/i)).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText(/E2E [0-9a-f]/i);
    await expect(page.locator("body")).not.toContainText("Qual é a pergunta?");

    expect(erros).toEqual([]);
  });

  test("o padrão já é o gabarito confiável; ?gabarito=todos devolve a revisão", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(CADERNO, { timeout: 90_000 });
    const barra = page.locator("form[method='get']");
    // A caixa existe, começa desligada e é ela que decide se a revisão entra.
    const caixa = barra.locator("input[name='gabarito']");
    await expect(caixa).toHaveCount(1);
    await expect(caixa).not.toBeChecked();

    await caixa.check();
    await barra.getByRole("button", { name: "Filtrar" }).click();

    await page.waitForURL(/gabarito=todos/, { timeout: 60_000 });
    // 886 + 32 = 918: as distintas sem resposta confirmada voltam todas.
    await expect(page.locator("[data-contagem]")).toHaveText(
      "Exibindo 1 a 20 de 918 questões"
    );
    await expect(barra.locator("[data-chip='gabarito']")).toContainText("incluindo revisão");
    // A caixa de qualidade fica fora do `<details>` — é decisão de tela, não
    // refinamento — e o bloco avançado vem aberto junto, porque é lá que as
    // anuladas aparecem: com a revisão dentro, há o que excluir.
    await expect(barra.locator("[data-filtro-avancado]")).toHaveJSProperty("open", true);
    await expect(barra.locator("input[name='anuladas']")).toBeVisible();

    expect(erros).toEqual([]);
  });

  test("aba de fixação é o bloco “Lista de Questões” do material", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(CADERNO, { timeout: 90_000 });
    const aba = page.locator("[data-aba='fixacao']");
    // O número prometido na aba é medido, não decorado.
    const anunciado = Number(/\d+/.exec((await aba.innerText()).replace(/\D+/g, " "))?.[0] ?? -1);
    expect(anunciado).toBe(138);

    await aba.click();
    await page.waitForURL(/bloco=fixacao/, { timeout: 60_000 });
    await expect(page.locator("[data-contagem]")).toHaveText(
      `Exibindo 1 a 20 de ${anunciado} questões`
    );
    // O chip diz a aba em palavras legíveis, e o × devolve a aba padrão.
    await expect(page.locator("[data-chip='bloco']")).toContainText("Exercícios de Fixação");
    // Fixação é subconjunto: as objetivas continuam prometendo o acervo inteiro.
    await expect(page.locator("[data-aba='objetivas']")).toContainText("886");

    await page.locator("[data-chip='bloco'] a").click();
    await page.waitForURL((url) => !url.searchParams.has("bloco"), { timeout: 60_000 });
    await expect(page.locator("[data-contagem]")).toHaveText(
      "Exibindo 1 a 20 de 886 questões"
    );

    expect(erros).toEqual([]);
  });

  test("palavra-chave, órgão e × do chip vivem todos na URL", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(CADERNO, { timeout: 90_000 });
    const barra = page.locator("form[method='get']");
    await barra.locator("input[name='palavra']").fill("crase");
    await barra.getByRole("button", { name: "Filtrar" }).click();

    await page.waitForURL(/palavra=crase/, { timeout: 60_000 });
    // Medido no lote: 34 distintas com gabarito confirmado mencionam "crase".
    await expect(page.locator("[data-contagem]")).toContainText("de 34 questões");
    await expect(page.locator("[data-chip='palavra']")).toContainText("crase");
    // O campo volta marcado com o que está na URL: o estado é o endereço.
    await expect(barra.locator("input[name='palavra']")).toHaveValue("crase");

    // Órgão: a faceta que o desenho de referência pede e o lote declara. O total
    // anunciado na opção tem que ser o total da tela depois do clique.
    const primeiraOpcao = barra.locator("select[name='orgao'] option").nth(1);
    const valor = await primeiraOpcao.getAttribute("value");
    expect(valor).toBeTruthy();
    const anunciado = Number(/\((\d+)\)/.exec(await primeiraOpcao.innerText())?.[1] ?? -1);
    expect(anunciado).toBeGreaterThan(0);

    await barra.locator("select[name='orgao']").selectOption(valor!);
    await barra.getByRole("button", { name: "Filtrar" }).click();
    await page.waitForURL(/orgao=/, { timeout: 60_000 });
    await expect(page.locator("[data-contagem]")).toContainText(`de ${anunciado} questões`);
    await expect(page.locator("[data-chip='orgao']")).toBeVisible();

    // O × desliga só aquela chave. A espera é pela ausência de `palavra`, não
    // pela presença de `banca`: a URL atual já tinha banca, e esperar por ela
    // passaria antes de a navegação acontecer.
    await page.goto(`${CADERNO}?banca=INPI&palavra=crase`, { timeout: 90_000 });
    await expect(page.locator("[data-chip='palavra']")).toBeVisible();
    await page.locator("[data-chip='palavra'] a").click();
    await page.waitForURL((url) => !url.searchParams.has("palavra"), { timeout: 60_000 });
    expect(page.url()).toMatch(/banca=INPI/);
    await expect(page.locator("[data-chip='banca']")).toBeVisible();
    await expect(page.locator("[data-chip='palavra']")).toHaveCount(0);

    expect(erros).toEqual([]);
  });

  test("a contagem ao lado da opção é a do clique, em qualquer modo", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    // Auto-consistência em dois contextos: com o padrão de qualidade e com a
    // revisão dentro. Faceta contada no acervo inteiro mentiria no segundo caso.
    for (const query of ["", "?gabarito=todos"]) {
      await page.goto(`${CADERNO}${query}`, { timeout: 90_000 });
      const anunciado = await page
        .locator("select[name='assunto'] option")
        .filter({ hasText: /^Pontuação \(\d+\)$/ })
        .innerText();
      const total = Number(/\((\d+)\)/.exec(anunciado)?.[1] ?? -1);
      expect(total).toBeGreaterThan(0);

      await page.selectOption("select[name='assunto']", "Pontuação");
      await page.locator("form[method='get']").getByRole("button", { name: "Filtrar" }).click();
      await page.waitForURL(/assunto=/, { timeout: 60_000 });
      await expect(page.locator("[data-contagem]")).toHaveText(
        `Exibindo 1 a 20 de ${total} questões`
      );
    }

    expect(erros).toEqual([]);
  });

  test("?origem=aula-14 é tag, nunca segmento de rota", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${CADERNO}?origem=aula-14`, { timeout: 90_000 });
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    expect(page.url()).not.toMatch(/\/aula-\d/);
    expect(erros).toEqual([]);
  });

  test("?assunto=Pontuação limita a lista ao assunto filtrado", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${CADERNO}?assunto=Pontua%C3%A7%C3%A3o`, { timeout: 90_000 });
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();

    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      await expect(cards.nth(i).locator("[data-selo='assunto']")).toHaveText("Pontuação");
    }

    expect(erros).toEqual([]);
  });

  test("?tipo=certo_errado só deixa itens C/E", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${CADERNO}?tipo=certo_errado`, { timeout: 90_000 });
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();

    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i++) {
      await expect(cards.nth(i).locator("button [data-alternativa]")).toHaveCount(2);
    }

    expect(erros).toEqual([]);
  });

  test("?gabarito=confiavel continua valendo: hoje é o padrão da tela", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${CADERNO}?gabarito=confiavel`, { timeout: 90_000 });
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();

    const total = await cards.count();
    expect(total).toBeGreaterThan(0);
    // 886 é o que o material sustenta como resposta; as outras 32 distintas ficam
    // de fora — e o link antigo que pedia o filtro chega na mesma tela limpa.
    await expect(page.locator("[data-contagem]")).toHaveText(
      "Exibindo 1 a 20 de 886 questões"
    );
    expect(page.url()).toContain("gabarito=confiavel");
    await expect(page.locator("[data-chip]")).toHaveCount(0);
    // Selo de quarentena é o único badge âmbar do card; com o filtro ele some.
    await expect(page.getByText("Gabarito inconclusivo")).toHaveCount(0);
    await expect(page.getByText("Estrutura incompleta")).toHaveCount(0);
    // E nenhum card revela a resposta antes de responder: o `Gabarito:` que
    // vivia ao lado do botão era spoiler, não informação de estudo. A sanfona é
    // DOM presente mas fechada — o que se verifica é o estado `[open]`, não a
    // ausência do texto (contar texto escondido seria falso negativo).
    await expect(page.getByText(/^Gabarito:/)).toHaveCount(0);
    await expect(page.locator("[data-sanfona='gabarito'][open]")).toHaveCount(0);

    expect(erros).toEqual([]);
  });

  test("?page=2 corta outra fatia e mantém o filtro na URL", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(`${CADERNO}?page=2`, { timeout: 90_000 });
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();

    const codigoPagina2 = await cards.first().locator("code").first().innerText();
    await expect(page.locator("[data-contagem]")).toContainText("Exibindo 21 a 40");
    // A página ativa é marcada, e o link anteriorPreserva a query.
    await expect(page.locator("[aria-current='page']")).toHaveText("2");
    const anterior = page.getByRole("link", { name: "Anterior" });
    expect(await anterior.getAttribute("href")).toBe("/questoes/portugues");

    // Filtro + página compartilháveis: o link da página 2 mantém o assunto.
    await page.goto(`${CADERNO}?assunto=Pontua%C3%A7%C3%A3o&page=2`, { timeout: 90_000 });
    await expect(page.locator("[data-contagem]")).toContainText("de");
    await expect(page.locator("[aria-current='page']")).toHaveText("2");
    await expect(
      page.getByRole("link", { name: "Próxima" })
    ).toHaveAttribute("href", /assunto=Pontua.*page=3/);

    expect(codigoPagina2).toMatch(/^A14-S\d{2}-\d{3}$/);
    expect(erros).toEqual([]);
  });

  test("a barra de filtros monta a URL sem JavaScript", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(CADERNO, { timeout: 90_000 });
    // Modalidade mora na linha 2, dentro do filtro avançado: o `<details>` é o
    // interruptor simples/avançado, e abrir é um clique nativo, sem ilha de cliente.
    await page.locator("[data-filtro-avancado] > summary").click();
    await expect(page.locator("[data-filtro-avancado]")).toHaveJSProperty("open", true);
    await page.selectOption("select[name='tipo']", "certo_errado");
    await page.getByRole("button", { name: "Filtrar" }).click();

    await page.waitForURL(/tipo=certo_errado/, { timeout: 60_000 });
    const cards = page.locator("article");
    await expect(cards.first()).toBeVisible();
    // O select volta marcado com o valor da URL: o estado é o endereço. E o bloco
    // avançado vem aberto, porque filtro escondido em barra fechada é filtro que
    // o aluno não vê aplicado.
    await expect(page.locator("select[name='tipo']")).toHaveValue("certo_errado");
    await expect(page.locator("[data-filtro-avancado]")).toHaveAttribute("open", "");
    await expect(page.locator("[data-chip='tipo']")).toContainText("Certo/Errado");

    expect(erros).toEqual([]);
  });

  test("um link que usa a linha 2 chega com o filtro avançado aberto", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    // Modalidade é linha 2. Um link assim não pode chegar com o controle fechado:
    // o aluno veria o chip do filtro sem o select que o aplica.
    await page.goto(`${CADERNO}?tipo=certo_errado`, { timeout: 90_000 });
    await expect(page.locator("[data-filtro-avancado]")).toHaveJSProperty("open", true);
    await expect(page.locator("select[name='tipo']")).toHaveValue("certo_errado");
    await expect(page.locator("[data-chip='tipo']")).toContainText("Certo/Errado");
    // A contagem anunciada no select e a da tela são a mesma medida.
    const rotulo = await page
      .locator("select[name='tipo'] option[value='certo_errado']")
      .innerText();
    const anunciado = Number(/\((\d+)\)/.exec(rotulo)?.[1] ?? -1);
    expect(anunciado).toBeGreaterThan(0);
    await expect(page.locator("[data-contagem]")).toContainText(`de ${anunciado} questões`);

    // Palavra-chave é linha 1, visível: chegar por ela não abre o avançado.
    await page.goto(`${CADERNO}?palavra=crase`, { timeout: 90_000 });
    await expect(page.locator("[data-filtro-avancado]")).toHaveJSProperty("open", false);
    await expect(page.locator("input[name='palavra']")).toHaveValue("crase");

    expect(erros).toEqual([]);
  });

  test("comentário do aluno é local e não emite POST", async ({ page }) => {
    const escritas: string[] = [];
    page.on("request", (req) => {
      if (req.method() !== "GET" && /\/api\//.test(req.url())) {
        escritas.push(`${req.method()} ${req.url()}`);
      }
    });
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto("/questoes/A14-S01-001", { timeout: 90_000 });
    const card = page.locator("article");
    await card.locator("summary", { hasText: "Comentários" }).click();

    const nota = "Minha anotação do teste";
    await card.locator("textarea").fill(nota);
    await card.getByRole("button", { name: "Salvar" }).click();
    await expect(card.getByText("Salvo neste navegador")).toBeVisible();

    await page.reload({ timeout: 90_000 });
    await page
      .locator("article")
      .locator("summary", { hasText: "Comentários" })
      .click();
    await expect(page.locator("article textarea")).toHaveValue(nota);

    expect(escritas).toEqual([]);
    expect(erros).toEqual([]);
  });

  test("/questoes abre o caderno da matéria, nunca o banco de teste", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    // A rota genérica era a listagem de `questions` — e é aí que "E2E 58f07a7b"
    // e "Qual é a pergunta?" apareciam para o aluno. Hoje ela resolve o caderno.
    await page.goto("/questoes?assunto=Pontua%C3%A7%C3%A3o", { timeout: 90_000 });
    await expect(page).toHaveURL(/\/questoes\/portugues\?assunto=/);
    await expect(
      page.getByRole("heading", { name: /Português · Banco de Questões/ })
    ).toBeVisible();
    // Auto-consistência em vez de número decorado: o total do cabeçalho tem que
    // bater com o total que a própria opção do select anuncia para o assunto.
    const rotuloOpcao = await page
      .locator("select[name='assunto'] option[value='Pontuação']")
      .innerText();
    const anunciado = Number(/\((\d+)\)/.exec(rotuloOpcao)?.[1] ?? -1);
    expect(anunciado).toBeGreaterThan(0);
    await expect(page.locator("[data-contagem]")).toHaveText(
      `Exibindo 1 a 20 de ${anunciado} questões`
    );
    await expect(page.locator("body")).not.toContainText(/E2E [0-9a-f]/i);

    expect(erros).toEqual([]);
  });

  test("o navegador do banco não lista fixtura de teste", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    const resp = await page.goto("/questoes/banco", { timeout: 90_000 });
    expect(resp?.status()).toBe(200);
    // Questões publicadas no banco só aparecem depois da importação; o que não
    // pode voltar é linha de teste: ela é excluída na leitura do repositório.
    await expect(page.locator("body")).not.toContainText(/E2E [0-9a-f]/i);
    await expect(page.locator("body")).not.toContainText("Qual é a pergunta?");

    expect(erros).toEqual([]);
  });

  test("item do menu lateral leva ao caderno da matéria", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    // A rota é aquecida antes do clique: em dev, a primeira navegação para o
    // caderno dispara a compilação do trecho e o Suspense mostra "Carregando…"
    // por mais de 5s. O que este caso prova é a origem do link (menu), não o
    // tempo de primeira compilação — isso já é medido no caso do goto direto.
    await page.goto(CADERNO, { timeout: 90_000 });
    await page.goto("/dashboard", { timeout: 90_000 });

    const aside = page.locator("aside");
    const entrada = aside.getByRole("link", { name: /Português · Banco de Questões/ });
    await expect(entrada).toHaveCount(1);
    await expect(entrada).toHaveAttribute("href", CADERNO);
    // O menu não pode voltar a mencionar o material físico.
    await expect(aside).not.toContainText(/Aula 14/);

    await entrada.click();
    await page.waitForURL(`**${CADERNO}`, { timeout: 90_000 });
    await expect(
      page.getByRole("heading", { name: /Português · Banco de Questões/ })
    ).toBeVisible({ timeout: 60_000 });

    expect(erros).toEqual([]);
  });

  test("a rota legada do PDF redireciona para o domínio", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto(LEGADO, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/questoes\/portugues/);
    await expect(
      page.getByRole("heading", { name: /Português · Banco de Questões/ })
    ).toBeVisible();

    await page.goto(`${LEGADO}/A14-S01-002`, { timeout: 90_000 });
    await expect(page).toHaveURL(/\/questoes\/A14-S01-002$/);

    expect(erros).toEqual([]);
  });
});

test.describe("Caderno — detalhe de questão", () => {
  test.describe.configure({ timeout: 120_000 });

  test("certo/errado: círculos C/E, selos e sanfona de pendência", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    const resp = await page.goto("/questoes/A14-S01-001", { timeout: 90_000 });
    expect(resp?.status()).toBe(200);

    const card = page.locator("article");
    await expect(card).toHaveCount(1);
    await expect(card.locator("code").first()).toHaveText("A14-S01-001");

    // O link de volta é o caderno da matéria, não a aula do PDF. O escopo é
    // `main`: a sidebar também tem um link com o mesmo rótulo do catálogo, e
    // sem escopo o seletor fica ambíguo (strict mode).
    await expect(
      page.locator("main").getByRole("link", { name: /Português · Banco de Questões/ })
    ).toHaveAttribute("href", CADERNO);

    const circulos = card.locator("button [data-alternativa]");
    await expect(circulos).toHaveCount(2);
    await expect(circulos.nth(0)).toHaveText("C");
    await expect(circulos.nth(1)).toHaveText("E");

    // Cabeçalho enxuto: Disciplina, Banca, Assunto e Ano medidos; órgão que o
    // material não declara não vira selo inventado.
    const trilha = card.locator("header");
    await expect(trilha.locator("[data-selo='disciplina']")).toHaveText(/Língua Portuguesa/);
    await expect(trilha.locator("[data-selo='banca']")).toHaveText("INOVERSASUL");
    await expect(trilha.locator("[data-selo='assunto']")).toHaveText("Ortografia");
    await expect(trilha.locator("[data-selo='ano']")).toHaveText("2025");
    await expect(trilha.locator("[data-selo='orgao']")).toHaveCount(0);

    // Botão Responder nasce desabilitado: o aluno ainda não marcou nada.
    await expect(card.getByRole("button", { name: "Responder" })).toBeDisabled();

    // Sanfona fechada por padrão; abrir é o que revela gabarito e resolução.
    const gabarito = card.locator("[data-sanfona='gabarito']");
    await expect(gabarito).not.toHaveAttribute("open", "");
    await gabarito.locator("summary").click();
    await expect(gabarito.getByText(/Resposta: E/)).toBeVisible();
    await expect(gabarito.getByText(/Resolução comentada ainda não foi gerada/)).toBeVisible();

    const comentarios = card.locator("[data-sanfona='comentarios']");
    await comentarios.locator("summary").click();
    await expect(comentarios.getByText(/Comentário de terceiros não é publicado/)).toBeVisible();

    // Procedência saiu do topo do card e vive aqui: PDF, alvo e firma de conteúdo.
    const procedencia = card.locator("[data-sanfona='procedencia']");
    await procedencia.locator("summary").click();
    await expect(procedencia.getByText("Seção do material")).toBeVisible();
    await expect(procedencia.getByText(/Sem respostas registradas/)).toBeVisible();

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
    await page.goto("/questoes/A14-S01-001", { timeout: 90_000 });

    const card = page.locator("article");
    const responder = card.getByRole("button", { name: "Responder" });

    // Gabarito é E: marcar "Certo" primeiro prova que o estado reage.
    await card.locator("button", { hasText: "Certo" }).first().click();
    await expect(responder).toBeEnabled();
    // Antes de responder nada revela a resposta — nem ao lado do botão, nem
    // escondido em texto selecionável da página.
    await expect(card.getByText(/^Gabarito:/)).toHaveCount(0);
    await responder.click();
    await expect(card.getByText("Você errou")).toBeVisible();

    // Responder trava as alternativas; Refazer devolve o card ao estado de marcação.
    await card.getByRole("button", { name: "Refazer" }).click();
    await card.locator("button", { hasText: "Errado" }).first().click();
    await card.getByRole("button", { name: "Responder" }).click();
    await expect(card.getByText("Você acertou")).toBeVisible();

    expect(escritas).toEqual([]);
    expect(erros).toEqual([]);
  });

  test("múltipla escolha: cinco círculos A-E", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto("/questoes/A14-S01-015", { timeout: 90_000 });
    const circulos = page.locator("article button [data-alternativa]");
    await expect(circulos).toHaveCount(5);
    const letras = await circulos.allInnerTexts();
    expect(letras.map((l) => l.trim())).toEqual(["A", "B", "C", "D", "E"]);
    // Sem resposta marcada, nada na página revela a letra correta.
    await expect(page.locator("article").getByText(/^Gabarito:/)).toHaveCount(0);
    await expect(page.locator("article [data-sanfona='gabarito'][open]")).toHaveCount(0);
    await page
      .locator("article")
      .locator("[data-sanfona='gabarito'] summary")
      .click();
    await expect(page.locator("article").getByText(/^Resposta: /)).toBeVisible();

    expect(erros).toEqual([]);
  });

  test("quarentena: mostra o selo e não revela resposta", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto("/questoes/A14-S01-014", { timeout: 90_000 });
    const card = page.locator("article");

    await expect(card.getByText("Gabarito inconclusivo")).toBeVisible();
    await expect(card.getByText(/^Gabarito:/)).toHaveCount(0);

    await card.locator("summary", { hasText: "Gabarito e resolução" }).click();
    await expect(card.getByText(/não dá uma resposta confiável/)).toBeVisible();

    // Sem gabarito que o material sustenta não há o que confrontar: o botão
    // continua bloqueado mesmo com marcação, e certo/errado nunca aparece.
    const responder = card.getByRole("button", { name: "Responder" });
    await card.locator("button [data-alternativa]").first().click();
    await expect(responder).toBeDisabled();
    await expect(card.getByText(/Você (acertou|errou)/)).toHaveCount(0);

    expect(erros).toEqual([]);
  });

  test("prev/next permanecem na mesma seção e na rota do domínio", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    await page.goto("/questoes/A14-S01-001", { timeout: 90_000 });
    const proxima = page.getByRole("link", { name: /→/ }).first();
    await expect(proxima).toBeVisible();
    expect(await proxima.getAttribute("href")).toBe("/questoes/A14-S01-002");

    await proxima.click();
    await page.waitForURL("**/questoes/A14-S01-002", { timeout: 60_000 });

    expect(erros).toEqual([]);
  });

  test("ref sem forma e código inexistente caem em 404", async ({ page }) => {
    const erros = capturarErros(page);
    await authenticateBrowser(page);

    for (const ref of ["/questoes/A14-S99-999", "/questoes/pedagogia"]) {
      await page.goto(ref, { timeout: 90_000 });
      // Não se cobra o código HTTP aqui: `src/app/loading.tsx` na raiz faz o
      // documento começar como 200 antes de notFound() resolver. O que este
      // smoke exige é que o corpo seja o 404 do app, sem erro de console.
      await expect(
        page.getByRole("link", { name: /Voltar|Dashboard|Home/i }).first()
      ).toBeVisible();
    }

    expect(erros).toEqual([]);
  });
});
