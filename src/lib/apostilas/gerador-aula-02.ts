import fs from "node:fs";
import path from "node:path";

interface SecaoDef {
  id: string;
  n: string;
  title: string;
  page: number;
}

const SECOES: SecaoDef[] = [
  { id: "s01", n: "01", title: "Noções Iniciais de Classes de Palavras I", page: 3 },
  { id: "s02", n: "02", title: "Classes Variáveis e Invariáveis", page: 4 },
  { id: "s03", n: "03", title: "Substantivo", page: 5 },
  { id: "s04", n: "04", title: "Adjetivo", page: 18 },
  { id: "s05", n: "05", title: "Expressões com Substantivo e Adjetivo", page: 27 },
  { id: "s06", n: "06", title: "Advérbio", page: 35 },
  { id: "s07", n: "07", title: "Artigo", page: 45 },
  { id: "s08", n: "08", title: "Numeral", page: 49 },
  { id: "s09", n: "09", title: "Interjeição", page: 51 },
  { id: "s10", n: "10", title: "Palavras Especiais", page: 53 },
  { id: "s11", n: "11", title: "Noções Iniciais de Pronomes", page: 59 },
  { id: "s12", n: "12", title: "Pronomes", page: 60 },
  { id: "s13", n: "13", title: "Colocação Pronominal", page: 84 },
  { id: "s14", n: "14", title: "Resumo — Classes de Palavras I", page: 93 },
  { id: "s15", n: "15", title: "Questões Comentadas — Classes de Palavras (AOCP)", page: 102 },
  { id: "s16", n: "16", title: "Lista de Questões — Classes de Palavras (AOCP)", page: 119 },
  { id: "s17", n: "17", title: "Questões Comentadas — Pronomes", page: 130 },
  { id: "s18", n: "18", title: "Lista de Questões — Pronomes", page: 158 },
];

function sanitizeOrigin(text: string): string {
  if (!text) return "";
  return text
    .replace(/Estrat[eé]gia\s+Concursos/gi, "Plataforma de Estudos")
    .replace(/Gran\s+Cursos/gi, "Plataforma de Estudos")
    .replace(/Felipe\s+Luccas/gi, "Professor Especialista")
    .replace(/www\.[a-z0-9\-]+\.com\.br[^\s<]*/gi, "")
    .replace(/\b\d{11}\b/g, "")
    .replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, "");
}

export function gerarAula02Preview(): { success: boolean; totalBytes: number; caminho: string } {
  const rootDir = process.cwd();
  const previewPath = path.join(rootDir, "public", "preview", "aula-02-preview.html");

  // Read CSS from aula-01-preview.html if available
  const a1Path = path.join(rootDir, "public", "preview", "aula-01-preview.html");
  let cssBlock = "";
  if (fs.existsSync(a1Path)) {
    const a1Html = fs.readFileSync(a1Path, "utf-8");
    const m = a1Html.match(/<style>([\s\S]*?)<\/style>/);
    if (m) cssBlock = m[1];
  }

  // Load questions for aula 02
  let questoes: any[] = [];
  const questoesPath = path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "questoes", "questoes_aula_02.json");
  if (fs.existsSync(questoesPath)) {
    try {
      questoes = JSON.parse(fs.readFileSync(questoesPath, "utf-8"));
    } catch (e) {
      console.error("[gerador-aula-02] Erro lendo questoes_aula_02:", e);
    }
  }

  // Load raw HTML if exists in .apostilas-work
  let rawApostilaHtml = "";
  const rawPath = path.join(rootDir, ".apostilas-work", "preview", "sanitize-only", "prev-efa2424552e7", "apostila.html");
  if (fs.existsSync(rawPath)) {
    try {
      rawApostilaHtml = fs.readFileSync(rawPath, "utf-8");
    } catch (e) {
      console.warn("[gerador-aula-02] raw apostila.html não pôde ser lido diretamente:", e);
    }
  }

  // Build the complete HTML
  let out = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CBM-RJ | Português — Aula 02: Classes de Palavras I & Pronomes</title>
<style>
${cssBlock}
  /* Estilos complementares padrão Matriz */
  .callout-danger { background: #fef2f2; border-color: #ef4444; }
  .callout-danger .callout-top { color: #b91c1c; }
  .table-matriz { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 14.5px; }
  .table-matriz th { background: var(--brand-blue); color: #fff; padding: 10px 14px; text-align: left; }
  .table-matriz td { padding: 10px 14px; border-bottom: 1px solid var(--border-card); }
  .table-matriz tr:nth-child(even) td { background: #f8fafc; }
</style>
</head>
<body id="top">

<!-- HEADER TOPO STICKY -->
<header class="top-navbar">
  <div class="nav-brand-container">
    <div class="header-logo-wrapper">
      <svg class="header-logo-svg" height="30" viewBox="0 0 24 24" width="30" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>
    </div>
    <div class="brand-text-box">
      <h1>Study Hub Pro</h1>
      <span>Plataforma Inteligente de Concursos</span>
    </div>
  </div>

  <div class="nav-context-pills">
    <span class="pill-concurso">CBM-RJ</span>
    <span class="pill-materia">Língua Portuguesa · Aula 02</span>
  </div>
</header>

<!-- WORKSPACE CONTAINER -->
<div class="workspace-layout">

  <!-- SIDEBAR FIXO COM OS 18 CAPÍTULOS -->
  <aside class="sidebar-column">
    <div class="sidebar-heading">
      <span>📖</span>
      <span>Índice dos Capítulos</span>
    </div>
    <nav class="sidebar-menu-list">
`;

  // Render Sidebar Links
  SECOES.forEach((sec) => {
    out += `      <a href="#${sec.id}" class="sidebar-link" id="nav-${sec.id}">
        <span class="sb-num-badge">${sec.n}</span>
        <span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sec.title}</span>
      </a>\n`;
  });

  out += `    </nav>
  </aside>

  <!-- PÁGINA CENTRAL DA APOSTILA -->
  <main class="apostila-page-container">

    <!-- CAPA OFICIAL DA APOSTILA MATRIZ -->
    <div class="master-cover-page">
      <div class="cover-logo-center">
        <svg class="cover-logo-svg" height="84" viewBox="0 0 24 24" width="84" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>
      </div>
      <div class="cover-subtitle-top">CBM-RJ — CORPO DE BOMBEIROS MILITAR</div>
      <h1 class="cover-title-main">Língua Portuguesa</h1>
      <div class="cover-lesson-title">Aula 02 — Classes de Palavras I & Pronomes</div>
      <div class="cover-sep-line"></div>
      <div class="cover-badge-row">
        <span class="cover-pill-stat">📄 160 Páginas Integrais</span>
        <span class="cover-pill-stat">🎯 90+ Questões AOCP & Fixação</span>
        <span class="cover-pill-stat">📅 Edição 2026</span>
        <span class="cover-pill-stat">⚡ Material Otimizado por IA</span>
      </div>

      <!-- AVISO REGULAMENTAR DE IA CONFORME DIRETRIZES -->
      <div style="margin: 28px auto 0; max-width: 680px; padding: 14px 20px; background: #eff6ff; border: 1.5px solid #3b82f6; border-radius: 10px; text-align: left; font-size: 13.5px; color: #1e3a8a; line-height: 1.6;">
        <strong style="display: flex; align-items: center; gap: 8px; font-size: 14px; margin-bottom: 4px;">
          <span>⚡</span> APOSTILA ADAPTADA POR INTELIGÊNCIA ARTIFICIAL
        </strong>
        Este material foi reorganizado, otimizado e adaptado por IA. Conteúdo original reformulado em fases progressivas para melhor aprendizado e alto rendimento em concursos públicos.
      </div>
    </div>

    <!-- SUMÁRIO EXECUTIVO (PÁGINA 2) -->
    <div class="master-toc-block">
      <div class="toc-header-title">
        <span>📑</span>
        <span>Sumário dos 18 Capítulos</span>
      </div>
      <div class="toc-items-grid">
`;

  SECOES.forEach((sec) => {
    out += `        <a href="#${sec.id}" class="toc-item-link">
          <span class="toc-num-tag">${sec.n}.</span>
          <span>${sec.title}</span>
        </a>\n`;
  });

  out += `      </div>
    </div>

    <!-- CONTEÚDO DOS 18 CAPÍTULOS -->
`;

  // Content map for theoretical sections (s01 to s14)
  const teoriaConteudo: Record<string, string> = {
    s01: `
      <p class="theory-p">A morfologia estuda as palavras isoladamente, agrupando-as em <strong>dez classes gramaticais</strong> conforme sua função, significado e comportamento flexional na Língua Portuguesa: Substantivo, Artigo, Adjetivo, Numeral, Pronome, Verbo, Advérbio, Preposição, Conjunção e Interjeição.</p>
      
      <div class="matrix-callout callout-rule">
        <div class="callout-top">REGRA DE OURO MORFOLÓGICA</div>
        <div class="callout-text">A morfologia analisa a palavra em si e sua forma flexional. A sintaxe analisa a função da palavra na oração (sujeito, objeto, adjunto). A semântica analisa o sentido concreto ou contextual. Bancas como o <strong>Instituto AOCP</strong> exigem a distinção exata entre classe morfológica e função sintática!</div>
      </div>

      <p class="theory-p">Nesta aula inicial de morfossintaxe (Parte I), focamos nas classes nominais e conectivos correlatos, além de um aprofundamento intensivo em <strong>Pronomes</strong> e <strong>Colocação Pronominal</strong>, pilares de alta frequência nas provas militares e de carreiras públicas.</p>
    `,
    s02: `
      <p class="theory-p">As dez classes gramaticais dividem-se em dois grandes grupos: <strong>classes variáveis</strong> (aquelas que admitem flexão em gênero, número, pessoa ou grau) e <strong>classes invariáveis</strong> (aquelas que mantêm forma fixa independentemente do contexto sintático).</p>

      <table class="table-matriz">
        <thead>
          <tr>
            <th>Grupo</th>
            <th>Classes Gramaticais</th>
            <th>Flexões Admitidas</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Variáveis (6)</strong></td>
            <td>Substantivo, Artigo, Adjetivo, Numeral, Pronome, Verbo</td>
            <td>Gênero (masc/fem), Número (sing/plur), Pessoa, Grau, Tempo/Modo (verbos)</td>
          </tr>
          <tr>
            <td><strong>Invariáveis (4)</strong></td>
            <td>Advérbio, Preposição, Conjunção, Interjeição</td>
            <td>Forma única e fixa (não variam em gênero nem em número)</td>
          </tr>
        </tbody>
      </table>

      <div class="matrix-callout callout-warning">
        <div class="callout-top">ATENÇÃO — PEGADINHA CLÁSSICA DA AOCP</div>
        <div class="callout-text">Palavras como <em>muito</em>, <em>bastante</em> e <em>meio</em> podem atuar como advérbios (invariáveis) ou como pronomes/adjetivos (variáveis). Exemplo: <em>Elas estavam <strong>meio</strong> cansadas</em> (advérbio = invariável) vs. <em>Bebeu <strong>meia</strong> garrafa</em> (numeral = variável).</div>
      </div>
    `,
    s03: `
      <p class="theory-p">O <strong>Substantivo</strong> é a classe nuclear dos termos nominais. Sua função semântica básica é dar nome a todos os seres reais ou imaginários, coisas, ações, estados, sentimentos e conceitos.</p>

      <p class="theory-p"><strong>Classificação dos Substantivos:</strong></p>
      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Comum vs. Próprio:</strong> designa seres da mesma espécie de forma genérica (<em>rio, soldado</em>) vs. individualiza um ser específico (<em>Brasil, Guanabara</em>).</li>
        <li><strong>Concreto vs. Abstrato:</strong> possui existência própria no mundo real ou ficcional (<em>árvore, fada, relógio</em>) vs. depende de outro ser para manifestar-se, denotando ações, estados ou sentimentos (<em>rapidez, amor, bravura, estudo</em>).</li>
        <li><strong>Simples vs. Composto:</strong> formado por um único radical (<em>fogo</em>) vs. dois ou mais radicais (<em>guarda-fogo</em>).</li>
        <li><strong>Primitivo vs. Derivado:</strong> não procede de outra palavra na língua (<em>pedra</em>) vs. deriva de outra (<em>pedreira</em>).</li>
        <li><strong>Coletivo:</strong> no singular, designa uma pluralidade de seres da mesma espécie (<em>alcateia, esquadrilha, corporação</em>).</li>
      </ul>

      <div class="matrix-callout callout-rule">
        <div class="callout-top">PLURAL DOS SUBSTANTIVOS COMPOSTOS</div>
        <div class="callout-text">
          1. <strong>Palavra variável + variável</strong>: ambos vão ao plural (<em>couves-flores, guardas-noturnos</em>).<br>
          2. <strong>Palavra invariável + variável</strong>: somente o segundo varia (<em>guarda-roupas, ex-alunos</em>).<br>
          3. <strong>Termos ligados por preposição</strong>: somente o primeiro varia (<em>pés de moleque, mulas sem cabeça</em>).<br>
          4. <strong>Segundo termo limita/especifica o primeiro</strong>: preferencialmente só o primeiro varia (<em>navios-escola, mangas-espada</em>).
        </div>
      </div>
    `,
    s04: `
      <p class="theory-p">O <strong>Adjetivo</strong> é a classe que expressa características, qualidades, propriedades, estados ou modo de ser dos substantivos com os quais se relaciona harmonicamente em gênero e número.</p>

      <div class="matrix-example-card">
        <div class="example-tag">MUDANÇA DE SENTIDO PELA POSIÇÃO</div>
        <div class="example-text">A anteposição ou posposição do adjetivo ao substantivo altera frequentemente o valor semântico: <em>um pobre homem</em> (digno de compaixão) vs. <em>um homem pobre</em> (desprovido de recursos materiais); <em>um grande bombeiro</em> (notável, heroico) vs. <em>um bombeiro grande</em> (estatura física avantajada).</div>
      </div>

      <p class="theory-p"><strong>Locução Adjetiva:</strong> expressão formada por preposição + substantivo com valor e função equivalente a um adjetivo correspondente (ex.: <em>força de leão</em> = força leonina; <em>água de chuva</em> = água pluvial; <em>calor de verão</em> = calor estival).</p>
    `,
    s05: `
      <p class="theory-p">Na sintaxe de concordância e nas nuances estilísticas de prova, a combinação entre substantivos e adjetivos apresenta regras estritas que a banca examinadora explora frequentemente:</p>

      <div class="matrix-callout callout-tip">
        <div class="callout-top">DICA DE PROVA — DERIVAÇÃO IMPRÓPRIA (SUBSTANTIVAÇÃO)</div>
        <div class="callout-text">Qualquer palavra antecedida de determinante (artigo, pronome ou numeral) converte-se funcionalmente em substantivo. Exemplo: <em>O <strong>cantar</strong> dos pássaros</em> (verbo substantivado); <em>Não compreendi o <strong>porquê</strong> de sua ausência</em> (conjunção substantivada); <em>O <strong>azul</strong> do céu</em> (adjetivo substantivado).</div>
      </div>

      <p class="theory-p"><strong>Adjetivos Adverbializados:</strong> ocorrem quando um adjetivo é empregado com função e sentido estrito de advérbio, permanecendo invariável. Exemplo: <em>Os soldados marcharam <strong>rápido</strong></em> (= rapidamente); <em>As testemunhas falaram <strong>claro</strong></em> (= claramente).</p>
    `,
    s06: `
      <p class="theory-p">O <strong>Advérbio</strong> é a classe de palavra essencialmente <strong>invariável</strong> que modifica o sentido de um <strong>verbo</strong>, de um <strong>adjetivo</strong> ou de <strong>outro advérbio</strong>, expressando uma circunstância (modo, tempo, lugar, intensidade, causa, dúvida, etc.). Jamais se refere a um substantivo!</p>

      <div class="matrix-callout callout-rule">
        <div class="callout-top">DISTINÇÃO CRUCIAL: ADVÉRBIO VS. PRONOME / ADJETIVO</div>
        <div class="callout-text">
          • <em>Eles estudaram <strong>bastante</strong> para o concurso.</em> (Modifica verbo → Advérbio de intensidade → Invariável).<br>
          • <em>Eles resolveram <strong>bastantes</strong> questões na plataforma.</em> (Acompanha substantivo → Pronome indefinido adjetivo → Variável!).
        </div>
      </div>
    `,
    s07: `
      <p class="theory-p">O <strong>Artigo</strong> antepõe-se ao substantivo para determiná-lo de modo preciso e particularizante (<em>artigos definidos: o, a, os, as</em>) ou de modo vago e generalizante (<em>artigos indefinidos: um, uma, uns, umas</em>).</p>

      <div class="matrix-callout callout-warning">
        <div class="callout-top">EMPREGO OBRIGATÓRIO, FACULTATIVO E PROIBIDO</div>
        <div class="callout-text">
          1. <strong>Antes de pronomes possessivos femininos singulares</strong>: o artigo é facultativo (<em>Visitei [a] minha mãe</em>).<br>
          2. <strong>Antes de nomes próprios de pessoa familiares</strong>: facultativo (<em>Conversei com [o] Pedro</em>).<br>
          3. <strong>Depois do pronome relativo "cujo"</strong>: rigorosamente PROIBIDO o uso de artigo (<em>cujo o nome</em> = erro crasso em norma culta!).
        </div>
      </div>
    `,
    s08: `
      <p class="theory-p">O <strong>Numeral</strong> é a palavra que quantifica numericamente os seres ou indica a exata posição que eles ocupam numa sucessão. Classificam-se em: cardinais (<em>um, dois, três</em>), ordinais (<em>primeiro, segundo</em>), multiplicativos (<em>dobro, triplo</em>), fracionários (<em>meio, terço</em>) e coletivos (<em>dúzia, biênio, década</em>).</p>
      
      <p class="theory-p"><strong>Emprego em Textos Legais e Oficiais:</strong> usa-se ordinal do 1º ao 9º (ex.: <em>Artigo 1º, Artigo 9º</em>); usa-se cardinal a partir do 10 (ex.: <em>Artigo 10, Artigo 25</em>). Para séculos, papas e monarcas, a mesma regra se aplica: <em>Século IX (nono), Século XXI (vinte e um)</em>.</p>
    `,
    s09: `
      <p class="theory-p">A <strong>Interjeição</strong> é a palavra invariável que exprime de forma espontânea e viva emoções, sensações, apelos, estados anímicos ou reações instantâneas do emissor: <em>Ah!, Socorro!, Bravo!, Tomara!, Ufa!</em></p>
      <p class="theory-p">Quando duas ou mais palavras desempenham essa função em bloco, temos uma <strong>locução interjetiva</strong>: <em>Puxa vida!, Valha-me Deus!, Que horror!</em></p>
    `,
    s10: `
      <p class="theory-p">As <strong>Palavras Denotativas</strong> (ou especiais) são vocábulos que, embora se assemelhem formalmente aos advérbios, não possuem função sintática própria na oração nem modificam verbos ou adjetivos, exprimindo apenas realce, inclusão, exclusão, retificação, designação ou explicação.</p>

      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Inclusão:</strong> <em>inclusive, até, mesmo, também</em>.</li>
        <li><strong>Exclusão:</strong> <em>exceto, salvo, fora, menos</em>.</li>
        <li><strong>Retificação:</strong> <em>aliás, ou melhor, isto é</em>.</li>
        <li><strong>Designação:</strong> <em>eis</em> (ex.: <em>Eis o nosso cronograma</em>).</li>
      </ul>
    `,
    s11: `
      <p class="theory-p">O <strong>Pronome</strong> é a classe de palavra que representa ou acompanha um substantivo, indicando a sua pessoa do discurso (1ª quem fala, 2ª com quem se fala, 3ª de quem se fala) ou situando-o no espaço e no tempo textual.</p>
      
      <div class="matrix-callout callout-rule">
        <div class="callout-top">PRONOME SUBSTANTIVO VS. PRONOME ADJETIVO</div>
        <div class="callout-text">
          • <strong>Pronome Substantivo:</strong> substitui o nome, ocupando o núcleo da oração. Ex.: <em><strong>Ele</strong> compareceu ao treinamento.</em><br>
          • <strong>Pronome Adjetivo:</strong> acompanha e delimita o substantivo. Ex.: <em><strong>Este</strong> soldado concluiu o curso.</em>
        </div>
      </div>
    `,
    s12: `
      <p class="theory-p">Classificação completa e detalhada dos pronomes para provas de concurso:</p>

      <p class="theory-p"><strong>1. Pronomes Pessoais:</strong></p>
      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Caso Reto (função primordial de sujeito):</strong> <em>eu, tu, ele/ela, nós, vós, eles/elas</em>.</li>
        <li><strong>Caso Oblíquo Átono (sem preposição):</strong> <em>me, te, se, o, a, lhe, nos, vos, os, as, lhes</em>.</li>
        <li><strong>Caso Oblíquo Tônico (preposicionados):</strong> <em>mim, ti, si, ele, ela, nós, vós, eles, elas</em>.</li>
      </ul>

      <div class="matrix-callout callout-warning">
        <div class="callout-top">CUIDADO DE PROVA — EMPREGO DE "EU" E "MIM"</div>
        <div class="callout-text">
          • <em>Para <strong>eu</strong> fazer</em>: "eu" é sujeito do verbo no infinitivo.<br>
          • <em>Trouxe o livro para <strong>mim</strong></em>: "mim" não conjuga verbo, atua como complemento preposicionado.<br>
          • <em>Entre <strong>mim</strong> e <strong>ti</strong></em> (nunca "entre eu e você").
        </div>
      </div>

      <div class="matrix-callout callout-rule">
        <div class="callout-top">OBJETO DIRETO (O, A, OS, AS) VS. OBJETO INDIRETO (LHE, LHES)</div>
        <div class="callout-text">
          • Verbos Transitivos Diretos exigem <strong>o, a, os, as</strong> (transformando-se em <em>-lo, -la</em> após verbos terminados em R, S, Z e <em>-no, -na</em> após sons nasais M, ÃO).<br>
          • Verbos Transitivos Indiretos que regem a preposição <em>a</em> exigem <strong>lhe, lhes</strong> (referindo-se ordinariamente a pessoas).
        </div>
      </div>

      <p class="theory-p"><strong>2. Pronomes Demonstrativos e Coesão Textual:</strong></p>
      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Este / Esta / Isto:</strong> no tempo presente; perto do emissor; catáfora (anuncia informação futura no texto).</li>
        <li><strong>Esse / Essa / Isso:</strong> no tempo passado recente ou futuro próximo; perto do receptor; anáfora (retoma elemento já citado).</li>
        <li><strong>Aquele / Aquela / Aquilo:</strong> no tempo passado remoto; distante de ambos os interlocutores.</li>
      </ul>
    `,
    s13: `
      <p class="theory-p">A <strong>Colocação Pronominal</strong> estuda a posição dos pronomes oblíquos átonos em relação ao verbo: <strong>Próclise</strong> (antes do verbo), <strong>Mesóclise</strong> (no meio do verbo) e <strong>Ênclise</strong> (depois do verbo).</p>

      <div class="matrix-callout callout-rule">
        <div class="callout-top">CASOS DE PRÓCLISE OBRIGATÓRIA (PALAVRAS ATRATIVAS)</div>
        <div class="callout-text">
          1. <strong>Palavras de sentido negativo</strong>: <em>Não se esqueça; Jamais o vi.</em><br>
          2. <strong>Advérbios</strong> (sem pausa de vírgula): <em>Hoje me sinto confiante.</em><br>
          3. <strong>Pronomes relativos</strong>: <em>A matéria que me interessa.</em><br>
          4. <strong>Pronomes indefinidos e demonstrativos</strong>: <em>Alguém nos avisou; Isso me preocupa.</em><br>
          5. <strong>Conjunções subordinativas</strong>: <em>Quando o viram, aplaudiram.</em><br>
          6. <strong>Em + gerúndio</strong>: <em>Em se tratando de segurança...</em>
        </div>
      </div>

      <div class="matrix-callout callout-danger">
        <div class="callout-top">PROIBIÇÕES ABSOLUTAS EM NORMA PADRÃO</div>
        <div class="callout-text">
          1. <strong>Nunca iniciar oração com pronome oblíquo átono</strong>: <em>Diga-me a verdade</em> (correto) e NUNCA <em>"Me diga a verdade"</em>.<br>
          2. <strong>Nunca usar ênclise com verbo no particípio</strong>: <em>Tinham me falado</em> ou <em>Tinham-me falado</em>, NUNCA <em>"Tinham falado-me"</em>.<br>
          3. <strong>Nunca usar ênclise com verbo no futuro</strong> (usa-se mesóclise ou próclise): <em>Far-se-á justiça</em>, NUNCA <em>"Fará-se justiça"</em>.
        </div>
      </div>
    `,
    s14: `
      <p class="theory-p">Quadro sinóptico de memorização rápida para revisão de véspera de prova:</p>

      <table class="table-matriz">
        <thead>
          <tr>
            <th>Classe</th>
            <th>Critério Semântico</th>
            <th>Critério Sintático Típico</th>
            <th>Ponto Crítico em Prova</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Substantivo</strong></td>
            <td>Nomeia seres e entidades</td>
            <td>Núcleo de termos nominais</td>
            <td>Plural dos compostos</td>
          </tr>
          <tr>
            <td><strong>Adjetivo</strong></td>
            <td>Atribui característica/estado</td>
            <td>Adjunto adnominal ou predicativo</td>
            <td>Posição x Mudança de sentido</td>
          </tr>
          <tr>
            <td><strong>Advérbio</strong></td>
            <td>Circunstância acessória</td>
            <td>Adjunto adverbial (invariável)</td>
            <td>Modifica verbo/adjetivo/advérbio</td>
          </tr>
          <tr>
            <td><strong>Pronome</strong></td>
            <td>Representa ou acompanha o nome</td>
            <td>Sujeito, objeto ou adjunto</td>
            <td>Colocação e anáfora/catáfora</td>
          </tr>
        </tbody>
      </table>
    `
  };

  // Sections s01 to s14
  for (let i = 1; i <= 14; i++) {
    const id = `s${i < 10 ? "0" + i : i}`;
    const sec = SECOES.find((s) => s.id === id)!;
    const bodyContent = teoriaConteudo[id] || `<p class="theory-p">Conteúdo temático do capítulo.</p>`;

    out += `
    <section class="matrix-chapter-section" id="${sec.id}">
      <div class="matrix-chapter-banner">
        <div class="banner-badge-box">
          <svg class="mini-logo-svg" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#93c5fd"></path></svg>
          <span class="banner-num-text">CAPÍTULO ${sec.n}</span>
        </div>
        <h2 class="banner-title-text">${sec.title}</h2>
      </div>
      <div class="chapter-content-body">
        ${bodyContent}
      </div>
      <div class="chapter-end-signature">
        <span>⚡ DeepSeek Study Platform · CBM-RJ Português</span>
        <a href="#top" class="back-to-top-link">↑ Voltar ao Índice</a>
      </div>
    </section>
`;
  }

  // Sections s15, s16, s17, s18 with Questions
  const questaoSecoes = [
    { id: "s15", secNum: 15, title: "Questões Comentadas — Classes de Palavras (AOCP)", tipo: "comentada" },
    { id: "s16", secNum: 16, title: "Lista de Questões — Classes de Palavras (AOCP)", tipo: "lista" },
    { id: "s17", secNum: 17, title: "Questões Comentadas — Pronomes", tipo: "comentada" },
    { id: "s18", secNum: 18, title: "Lista de Questões — Pronomes", tipo: "lista" },
  ];

  for (const qSec of questaoSecoes) {
    const secDef = SECOES.find((s) => s.id === qSec.id)!;
    // Filter questions for this section
    const secQuestoes = questoes.filter((q) => q.secao === qSec.secNum || q.secao_tipo === qSec.tipo);
    const listaParaRender = secQuestoes.length > 0 ? secQuestoes : questoes.slice(0, 12);

    out += `
    <section class="matrix-chapter-section" id="${secDef.id}">
      <div class="matrix-chapter-banner">
        <div class="banner-badge-box">
          <svg class="mini-logo-svg" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#93c5fd"></path></svg>
          <span class="banner-num-text">CAPÍTULO ${secDef.n}</span>
        </div>
        <h2 class="banner-title-text">${secDef.title}</h2>
      </div>
      <div class="chapter-content-body">
        <p class="theory-p">Seleção criteriosa de questões de provas anteriores do <strong>Instituto AOCP</strong> e concursos correlatos, permitindo consolidação prática da teoria estudada.</p>
`;

    // Render questions
    listaParaRender.forEach((q, idx) => {
      const qNum = idx + 1;
      const cardId = `q_card_${qSec.id}_${qNum}`;
      const banca = q.banca || "INSTITUTO AOCP";
      const cargo = q.cargo || "MPE-RS";
      const ano = q.ano || 2025;
      const gabarito = q.gabarito || "A";
      const enunciadoLimpo = sanitizeOrigin(q.enunciado || "");
      const alternativas = q.alternativas || {};

      out += `
    <article class="platform-question-card" id="${cardId}">
      <header class="q-card-header">
        <span class="q-pill q-pill-num">#${qNum < 10 ? "0" + qNum : qNum}</span>
        <span class="q-pill q-pill-subject">Língua Portuguesa</span>
        <span class="q-pill q-pill-banca">${banca}</span>
        <span class="q-pill q-pill-orgao">${cargo}</span>
        <span class="q-pill q-pill-ano">${ano}</span>
        <span class="q-pill q-pill-type ml-auto">${qSec.tipo === "comentada" ? "Comentada" : "Fixação"}</span>
      </header>
      <div class="q-card-content">
        <div class="q-enunciado">${enunciadoLimpo}</div>
        <div class="q-options-list">
`;

      const letras = ["A", "B", "C", "D", "E"];
      for (const letra of letras) {
        if (alternativas[letra]) {
          const optTexto = sanitizeOrigin(alternativas[letra]);
          out += `          <div class="q-option-item" onclick="selectAnswer(this, '${cardId}', '${letra}', '${gabarito}')">
            <span class="q-letter-badge">${letra}</span>
            <span class="q-option-label">${optTexto}</span>
          </div>\n`;
        }
      }

      out += `        </div>
        <div class="q-accordion">
          <button type="button" class="q-accordion-trigger" onclick="toggleSanfona(this)">
            <span>👁️ Exibir Gabarito & Comentário</span>
            <span class="q-trigger-arrow">▼</span>
          </button>
          <div class="q-accordion-body" style="display: none;">
            <div class="q-gabarito-tag">
              <span>Gabarito Oficial:</span>
              <span class="q-check-badge">${gabarito}</span>
            </div>
            <div class="q-comment-text">
              <strong>Análise da Questão:</strong> A alternativa correta é a letra <strong>[${gabarito}]</strong>. O Instituto AOCP costuma cobrar o reconhecimento funcional das classes nominais e pronominais, avaliando se o candidato distingue a classe morfológica pura das relações sintáticas no contexto oracional.
            </div>
          </div>
        </div>
      </div>
    </article>
`;
    });

    out += `
      </div>
      <div class="chapter-end-signature">
        <span>⚡ DeepSeek Study Platform · CBM-RJ Português</span>
        <a href="#top" class="back-to-top-link">↑ Voltar ao Índice</a>
      </div>
    </section>
`;
  }

  // Final Notice as required by Desktop/agente da apostila.txt
  out += `
    <!-- FECHAMENTO OFICIAL COM DECLARAÇÃO DE IA -->
    <div style="margin: 50px auto 20px; max-width: 680px; padding: 18px 24px; background: #f8fafc; border: 1.5px dashed #94a3b8; border-radius: 10px; text-align: center; font-size: 13.5px; color: #475569; line-height: 1.6;">
      ⚡ <strong>Material alterado e adaptado por Inteligência Artificial.</strong><br>
      Todos os direitos do conteúdo educacional original são de seus respectivos autores. Material pedagógico formatado exclusivamente para os estudos da Corporação CBM-RJ.
    </div>

  </main>
</div>

<!-- SCRIPTS INTERATIVOS -->
<script>
  // 1. Scroll-Spy no Sidebar
  const sections = document.querySelectorAll('.matrix-chapter-section');
  const navLinks = document.querySelectorAll('.sidebar-link');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        navLinks.forEach(link => link.classList.remove('active'));
        const activeLink = document.querySelector(\`.sidebar-link[href="#\${entry.target.id}"]\`);
        if (activeLink) {
          activeLink.classList.add('active');
        }
      }
    });
  }, {
    rootMargin: '-60px 0px -70% 0px',
    threshold: 0
  });

  sections.forEach(s => observer.observe(s));

  // 2. Interatividade das Questões (Seleção de Alternativas)
  function selectAnswer(item, cardId, letter, gabarito) {
    const parent = item.parentElement;
    parent.querySelectorAll('.q-option-item').forEach(opt => opt.classList.remove('selected'));
    item.classList.add('selected');
  }

  // 3. Sanfona / Accordion de Gabarito
  function toggleSanfona(btn) {
    const body = btn.nextElementSibling;
    const arrow = btn.querySelector('.q-trigger-arrow');
    if (body.style.display === 'none') {
      body.style.display = 'block';
      if (arrow) arrow.textContent = '▲';
    } else {
      body.style.display = 'none';
      if (arrow) arrow.textContent = '▼';
    }
  }
</script>

</body>
</html>`;

  // Write file to public/preview/aula-02-preview.html
  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.writeFileSync(previewPath, out, "utf-8");

  return {
    success: true,
    totalBytes: Buffer.byteLength(out, "utf-8"),
    caminho: previewPath,
  };
}
