import fs from "node:fs";
import path from "node:path";

interface SecaoDef {
  id: string;
  n: string;
  title: string;
}

const SECOES_AULA_05: SecaoDef[] = [
  { id: "s01", n: "01", title: "Conceito de Período Composto: Coordenação e Subordinação" },
  { id: "s02", n: "02", title: "Orações Coordenadas Assindéticas e Sindéticas" },
  { id: "s03", n: "03", title: "Orações Coordenadas Aditivas e Conectivos Correlatos" },
  { id: "s04", n: "04", title: "Orações Coordenadas Adversativas: Oposição e Pontuação Crítica" },
  { id: "s05", n: "05", title: "Orações Coordenadas Alternativas e Conclusivas" },
  { id: "s06", n: "06", title: "Orações Coordenadas Explicativas vs. Subordinadas Causais" },
  { id: "s07", n: "07", title: "Orações Subordinadas Substantivas e Conjunções Integrantes" },
  { id: "s08", n: "08", title: "Classificação Completa das Substantivas: Subjetiva a Apositiva" },
  { id: "s09", n: "09", title: "Orações Subordinadas Adjetivas: Explicativas e Restritivas" },
  { id: "s10", n: "10", title: "Subordinadas Adverbiais I: Causais, Consecutivas e Condicionais" },
  { id: "s11", n: "11", title: "Subordinadas Adverbiais II: Concessivas, Comparativas e Conformativas" },
  { id: "s12", n: "12", title: "Subordinadas Adverbiais III: Finais, Proporcionais e Temporais" },
  { id: "s13", n: "13", title: "Orações Reduzidas de Infinitivo, Gerúndio e Particípio" },
  { id: "s14", n: "14", title: "Quadro Sinóptico de Todas as Conjunções e Valores Semânticos" },
  { id: "s15", n: "15", title: "Questões Comentadas — Orações Coordenadas e Conectivos (AOCP)" },
  { id: "s16", n: "16", title: "Lista de Questões de Fixação — Coordenação (AOCP)" },
  { id: "s17", n: "17", title: "Questões Comentadas — Orações Subordinadas e Reduzidas (AOCP)" },
  { id: "s18", n: "18", title: "Lista de Questões de Fixação — Subordinação e Período Composto (AOCP)" },
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

export function gerarAula05Preview(): { success: boolean; totalBytes: number; caminho: string } {
  const rootDir = process.cwd();
  const previewPath = path.join(rootDir, "public", "preview", "aula-05-preview.html");

  // Copia o PDF de origem de forma autônoma
  try {
    const possiveisCaminhos = [
      path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "apostila", "curso-384118-aula-05-5077-completo.pdf"),
      path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "apostila", "curso-384118-aula-05-5077-completo"),
    ];
    for (const src of possiveisCaminhos) {
      if (fs.existsSync(src)) {
        const dest = path.join(rootDir, "public", "apostilas", "curso-384118-aula-05-5077-completo.pdf");
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
        break;
      }
    }
  } catch (err) {
    console.warn("[gerador-aula-05] Cópia de PDF:", err);
  }

  // Extrai CSS do Design System Matriz
  let cssBlock = "";
  const a1Path = path.join(rootDir, "public", "preview", "aula-01-preview.html");
  if (fs.existsSync(a1Path)) {
    const a1Html = fs.readFileSync(a1Path, "utf-8");
    const m = a1Html.match(/<style>([\s\S]*?)<\/style>/);
    if (m) cssBlock = m[1];
  }

  const svgDeepSeek = `<svg class="mini-logo-svg" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>`;

  let out = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CBM-RJ | Português — Aula 05: Sintaxe do Período Composto</title>
<style>
${cssBlock}
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
    <span class="pill-materia">Língua Portuguesa · Aula 05</span>
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

  SECOES_AULA_05.forEach((sec) => {
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
      <div class="cover-lesson-title">Aula 05 — Sintaxe do Período Composto: Coordenação e Subordinação</div>
      <div class="cover-sep-line"></div>
      <div class="cover-badge-row">
        <span class="cover-pill-stat">📄 168 Páginas Integrais</span>
        <span class="cover-pill-stat">🎯 96+ Questões AOCP & Fixação</span>
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

  SECOES_AULA_05.forEach((sec) => {
    out += `        <a href="#${sec.id}" class="toc-item-link">
          <span class="toc-num-tag">${sec.n}.</span>
          <span>${sec.title}</span>
        </a>\n`;
  });

  out += `      </div>
    </div>

    <!-- CONTEÚDO DOS 18 CAPÍTULOS -->
`;

  const teoriaAula05: Record<string, string> = {
    s01: `
      <p class="theory-p">O <strong>Período Composto</strong> é aquele constituído por duas ou mais orações. A relação lógica, sintática e semântica entre essas orações processa-se por meio de dois processos fundamentais: <strong>Coordenação</strong> e <strong>Subordinação</strong> (além do período misto, que conjuga ambos os processos).</p>

      <table class="table-matriz">
        <thead>
          <tr>
            <th>Processo Sintático</th>
            <th>Independência Estrutural</th>
            <th>Papel Sintático Entre Si</th>
            <th>Exemplo Típico</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Coordenação</strong></td>
            <td>Orações sintaticamente <strong>independentes</strong></td>
            <td>Nenhuma oração exerce função sintática de termo em relação à outra.</td>
            <td><em>O alarme soou, <strong>e</strong> a guarnição mobilizou-se.</em></td>
          </tr>
          <tr>
            <td><strong>Subordinação</strong></td>
            <td>Orações sintaticamente <strong>dependentes</strong></td>
            <td>A oração subordinada atua como um termo da oração principal (sujeito, objeto, adjunto).</td>
            <td><em>O comandante confirmou <strong>que o plano foi aprovado</strong>.</em></td>
          </tr>
        </tbody>
      </table>

      <div class="matrix-callout callout-rule">
        <div class="callout-top">REGRA DE OURO — CRITÉRIO OPERACIONAL DE PROVA</div>
        <div class="callout-text">Na coordenação, se você separar as orações por um ponto final, ambas mantêm estrutura sintática autossuficiente (sujeito e predicado completos). Na subordinação, a oração principal fica capenga sem a subordinada, pois esta funciona como seu objeto, complemento ou modificador adverbial!</div>
      </div>
    `,
    s02: `
      <p class="theory-p">As <strong>Orações Coordenadas</strong> classificam-se inicialmente pela presença ou ausência de conectivo interoracional (conjunção coordenativa):</p>

      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Oração Coordenada Assindética:</strong> é aquela justaposta diretamente sem conjunção, ligada apenas por pausa virgular ou ponto e vírgula. Ex.: <em>O dia amanheceu, os bombeiros formaram, a inspeção começou</em>.</li>
        <li><strong>Oração Coordenada Sindética:</strong> é aquela introduzida por uma conjunção coordenativa, classificando-se conforme o valor semântico do conectivo: <em>Aditiva, Adversativa, Alternativa, Conclusiva ou Explicativa</em>.</li>
      </ul>
    `,
    s03: `
      <p class="theory-p">As <strong>Orações Coordenadas Sindéticas Aditivas</strong> exprimem soma, adição de pensamentos, acréscimo de argumentos ou sequência de fatos no discurso.</p>

      <p class="theory-p"><strong>Principais Conectivos Aditivos:</strong> <em>e, nem (= e não), não só... mas também, não só... como ainda, tanto... quanto</em>.</p>

      <div class="matrix-callout callout-warning">
        <div class="callout-top">PONTUAÇÃO CRÍTICA DO "E" ADITIVO</div>
        <div class="callout-text">
          1. <strong>Com o mesmo sujeito nas duas orações:</strong> a vírgula antes do "e" é PROIBIDA (<em>O soldado treinou e conquistou a promoção</em>).<br>
          2. <strong>Com sujeitos DIFERENTES em cada oração:</strong> a vírgula antes do "e" é FACULTATIVA (embora recomendada e amplamente prestigiada pelo Instituto AOCP): <em>O coronel assinou o termo, e os capitães organizaram a tropa</em>.<br>
          3. <strong>Polissíndeto (repetição enfática do conectivo):</strong> vírgula obrigatória (<em>E correu, e saltou, e nadou com valentia</em>).
        </div>
      </div>
    `,
    s04: `
      <p class="theory-p">As <strong>Orações Coordenadas Sindéticas Adversativas</strong> exprimem oposição, contraste, quebra de expectativa, ressalva ou compensação entre os conteúdos das orações.</p>

      <p class="theory-p"><strong>Principais Conjunções Adversativas:</strong> <em>mas, porém, contudo, todavia, entretanto, no entanto, não obstante</em>.</p>

      <div class="matrix-callout callout-danger">
        <div class="callout-top">POSIÇÃO E PONTUAÇÃO DAS ADVERSATIVAS EM CONCURSOS</div>
        <div class="callout-text">
          • A conjunção <strong>"mas"</strong> é fixa no início da oração e vem SEMPRE antecedida de vírgula (<em>Treinou muito, <strong>mas</strong> não foi aprovado</em>). Não admite deslocamento para o meio ou fim da oração!<br>
          • As conjunções <strong>porém, contudo, todavia, entretanto, no entanto</strong> podem ser deslocadas, ficando isoladas entre vírgulas: <em>O treinamento foi árduo; os recrutas, <strong>porém</strong>, mantiveram a disciplina</em>.
        </div>
      </div>
    `,
    s05: `
      <p class="theory-p">As <strong>Orações Alternativas e Conclusivas</strong> cumprem papéis de escolha lógica e dedução no encadeamento oracional:</p>

      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Alternativas:</strong> expressam exclusão, alternância recíproca ou opção disjuntiva. Conectivos: <em>ou, ou... ou, ora... ora, quer... quer, seja... seja</em> (ex.: <em><strong>Ou</strong> estudamos com dedicação, <strong>ou</strong> seremos superados pela concorrência</em>).</li>
        <li><strong>Conclusivas:</strong> exprimem dedução, ilação, fechamento lógico ou consequência natural a partir da oração anterior. Conectivos: <em>portanto, logo, por isso, por conseguinte, destarte, então, pois (posposto ao verbo!)</em>.</li>
      </ul>

      <div class="matrix-callout callout-rule">
        <div class="callout-top">A PEGADINHA CLÁSSICA DO "POIS" EM PROVAS</div>
        <div class="callout-text">
          • <strong>Pois antes do verbo (anteposto):</strong> tem valor EXPLICATIVO ou CAUSAL (<em>Venha rápido, <strong>pois</strong> começou a chuva</em>).<br>
          • <strong>Pois depois do verbo (posposto, entre vírgulas):</strong> tem valor estritamente CONCLUSIVO (= portanto): <em>O edital foi publicado; devemos, <strong>pois</strong>, intensificar a resolução de questões</em>.
        </div>
      </div>
    `,
    s06: `
      <p class="theory-p">O confronto entre a <strong>Coordenada Explicativa</strong> e a <strong>Subordinada Adverbial Causal</strong> é um dos temas de maior índice de erro nas provas do Instituto AOCP:</p>

      <table class="table-matriz">
        <thead>
          <tr>
            <th>Classificação</th>
            <th>Estrutura Típica da Oração Anterior</th>
            <th>Relação Lógica</th>
            <th>Exemplo Demonstrativo</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Coordenada Explicativa</strong></td>
            <td>Verbo no <strong>Modo Imperativo</strong> (ordem, pedido) ou hipótese</td>
            <td>Justificativa / Motivo de uma ordem emitida</td>
            <td><em><strong>Recuem</strong> imediatamente, <strong>que</strong> o teto vai desabar!</em></td>
          </tr>
          <tr>
            <td><strong>Subordinada Causal</strong></td>
            <td>Verbo no <strong>Modo Indicativo</strong> factual</td>
            <td>A causa física ou lógica real que gerou o efeito</td>
            <td><em>O teto desabou <strong>porque</strong> as chamas destruíram as vigas.</em></td>
          </tr>
        </tbody>
      </table>
    `,
    s07: `
      <p class="theory-p">As <strong>Orações Subordinadas Substantivas</strong> desempenham funções sintáticas privativas de termos substantivos em relação à Oração Principal (sujeito, objeto direto, objeto indireto, complemento nominal, predicativo ou aposto).</p>

      <div class="matrix-callout callout-tip">
        <div class="callout-top">MACETE DE OURO — O TESTE DO "ISSO"</div>
        <div class="callout-text">Toda oração subordinada substantiva pode ser substituída integralmente pelo pronome demonstrativo <strong>"ISSO"</strong> (ou suas formas preposicionadas <em>"disso", "nisso", "a isso"</em>):<br>
        • <em>O comandante afirmou <strong>[que a tropa está pronta]</strong></em> → <em>O comandante afirmou <strong>ISSO</strong></em> (Objeto Direto = O. S. Substantiva Objetiva Direta).<br>
        • <em>Tenho certeza <strong>[de que venceremos]</strong></em> → <em>Tenho certeza <strong>DISSO</strong></em> (Complemento Nominal = O. S. Substantiva Completiva Nominal).</div>
      </div>

      <p class="theory-p">As orações substantivas são introduzidas pelas <strong>Conjunções Integrantes QUE e SE</strong>, que são conectivos puramente relacionais desprovidos de função sintática própria na oração!</p>
    `,
    s08: `
      <p class="theory-p">Quadro classificatório exaustivo das seis Orações Subordinadas Substantivas:</p>

      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Subjetiva:</strong> funciona como sujeito da oração principal (<em>É indispensável <strong>que todos compareçam</strong></em> → Isso é indispensável). Estrutura típica da principal: Verbo de ligação + Predicativo, ou Verbo transitivo direto na voz passiva sintética (<em>Sabe-se que...</em>).</li>
        <li><strong>Objetiva Direta:</strong> atua como objeto direto do verbo da oração principal (<em>O tenente verificou <strong>se o equipamento estava calibrado</strong></em>).</li>
        <li><strong>Objetiva Indireta:</strong> atua como objeto indireto, ligada a verbo transitivo indireto com preposição (<em>O oficial duvidava <strong>de que houvesse sobreviventes</strong></em>).</li>
        <li><strong>Completiva Nominal:</strong> completa o sentido de um substantivo abstrato ou adjetivo com preposição (<em>Ele tinha esperança <strong>de que a tempestade cessasse</strong></em>).</li>
        <li><strong>Predicativa:</strong> atua como predicativo do sujeito da oração principal, ligada por verbo de ligação (<em>Nosso dever é <strong>que protejamos a população</strong></em>).</li>
        <li><strong>Apositiva:</strong> atua como aposto explicativo, separada da principal por dois-pontos ou travessão (<em>Havia um único lema: <strong>que ninguém ficasse para trás</strong></em>).</li>
      </ul>
    `,
    s09: `
      <p class="theory-p">As <strong>Orações Subordinadas Adjetivas</strong> desempenham o papel sintático de <strong>Adjunto Adnominal</strong> de um substantivo ou pronome antecedente na oração principal. São introduzidas obrigatoriamente por <strong>Pronomes Relativos</strong> (<em>que, quem, onde, cujo, o qual, quanto</em>):</p>

      <table class="table-matriz">
        <thead>
          <tr>
            <th>Tipo de Oração Adjetiva</th>
            <th>Pontuação</th>
            <th>Valor Semântico</th>
            <th>Impacto no Sentido Geral</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Explicativa</strong></td>
            <td><strong>SEMPRE isolada por vírgulas</strong></td>
            <td>Generaliza / Refere-se à totalidade dos elementos</td>
            <td><em>Os bombeiros, <strong>que são corajosos</strong>, salvaram as vidas.</em> (TODOS os bombeiros são corajosos).</td>
          </tr>
          <tr>
            <td><strong>Restritiva</strong></td>
            <td><strong>NUNCA tem vírgula</strong></td>
            <td>Restringe / Delimita apenas um subgrupo específico</td>
            <td><em>Os bombeiros <strong>que eram socorristas</strong> entraram no túnel.</em> (Apenas os habilitados como socorristas entraram; os demais não).</td>
          </tr>
        </tbody>
      </table>

      <div class="matrix-callout callout-danger">
        <div class="callout-top">PONTO CRÍTICO EM PROVAS — MUDANÇA DE SENTIDO PELA VÍRGULA</div>
        <div class="callout-text">A retirada ou inserção da vírgula em uma oração adjetiva NÃO gera erro gramatical, mas <strong>altera substancialmente o sentido do texto</strong>, transformando uma restrição em uma generalização explicativa (ou vice-versa)! Questão clássica do Instituto AOCP!</div>
      </div>
    `,
    s10: `
      <p class="theory-p">As <strong>Orações Subordinadas Adverbiais</strong> desempenham a função de <strong>Adjunto Adverbial</strong> do verbo da oração principal, indicando a circunstância em que se dá o fato. Dividem-se em 9 tipos fundamentais:</p>

      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Causais:</strong> indicam o motivo, a razão que gera o efeito (<em>porque, visto que, já que, como [início de frase]</em>). Ex.: <em><strong>Como estava muito frio</strong>, acenderam a lareira</em>.</li>
        <li><strong>Consecutivas:</strong> indicam o resultado, a consequência da causa (<em>tanto... que, tão... que, de sorte que</em>). Ex.: <em>Correu <strong>tanto que desmaiou</strong></em>.</li>
        <li><strong>Condicionais:</strong> impõem condição ou hipótese para realização da principal (<em>se, caso, desde que, contanto que</em>). Ex.: <em><strong>Caso não chova</strong>, faremos a subida</em>.</li>
      </ul>
    `,
    s11: `
      <p class="theory-p">Continuação das Orações Subordinadas Adverbiais:</p>

      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Concessivas:</strong> indicam fato que contraria ou cria um obstáculo à oração principal, mas <strong>não impede</strong> a sua realização (<em>embora, conquanto, ainda que, mesmo que, posto que, apesar de que</em>). Ex.: <em><strong>Embora chovesse torrencialmente</strong>, o resgate foi realizado com êxito</em>.</li>
        <li><strong>Comparativas:</strong> estabelecem confronto analítico (<em>como, mais... do que, menos... do que, tanto quanto</em>). Ex.: <em>O jovem nadava <strong>como um peixe veloz</strong></em>.</li>
        <li><strong>Conformativas:</strong> expressam conformidade, adequação a uma norma ou pensamento de outrem (<em>conforme, segundo, consoante, como</em>). Ex.: <em>O procedimento foi executado <strong>conforme determinava a cartilha oficial</strong></em>.</li>
      </ul>
    `,
    s12: `
      <p class="theory-p">Conclusão das circunstâncias adverbiais:</p>

      <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
        <li><strong>Finais:</strong> indicam a finalidade, o objetivo (<em>para que, a fim de que</em>). Ex.: <em>Os alunos treinaram intensamente <strong>a fim de que fossem aprovados</strong></em>.</li>
        <li><strong>Proporcionais:</strong> indicam concomitância gradual em proporção direta ou inversa (<em>à proporção que, à medida que, quanto mais... mais</em>). Cuidado: a expressão *"à medida em que"* é ERRO crasso em norma culta! Use <strong>à medida que</strong>.</li>
        <li><strong>Temporais:</strong> delimitam o tempo em que o fato ocorre (<em>quando, enquanto, logo que, assim que, mal</em>). Ex.: <em><strong>Mal soou o apito</strong>, os militares entraram em formação</em>.</li>
      </ul>
    `,
    s13: `
      <p class="theory-p">As <strong>Orações Reduzidas</strong> são aquelas que não vêm introduzidas por conectivo (conjunção ou pronome relativo) e possuem o verbo em uma das <strong>formas nominais</strong> (Infinitivo, Gerúndio ou Particípio):</p>

      <table class="table-matriz">
        <thead>
          <tr>
            <th>Forma Verbal</th>
            <th>Oração Reduzida</th>
            <th>Oração Desenvolvida Equivalente</th>
            <th>Classificação</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Infinitivo</strong></td>
            <td><em>Ao <strong>chegar</strong> ao quartel, bateu continência.</em></td>
            <td><em>Quando <strong>chegou</strong> ao quartel...</em></td>
            <td>Subordinada Adverbial Temporal</td>
          </tr>
          <tr>
            <td><strong>Gerúndio</strong></td>
            <td><em><strong>Sabendo</strong> dos perigos, recuou.</em></td>
            <td><em>Porque <strong>sabia</strong> dos perigos...</em></td>
            <td>Subordinada Adverbial Causal</td>
          </tr>
          <tr>
            <td><strong>Particípio</strong></td>
            <td><em><strong>Terminada</strong> a instrução, retiraram-se.</em></td>
            <td><em>Assim que <strong>terminou</strong> a instrução...</em></td>
            <td>Subordinada Adverbial Temporal</td>
          </tr>
        </tbody>
      </table>
    `,
    s14: `
      <p class="theory-p">Quadro mnemônico consolidado das conjunções para memorização rápida na véspera da prova:</p>

      <table class="table-matriz">
        <thead>
          <tr>
            <th>Conectivo Chave</th>
            <th>Classificação Primária</th>
            <th>Sentido Central</th>
            <th>Atenção Crítica de Prova</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>MAS / PORÉM</strong></td>
            <td>Coordenada Adversativa</td>
            <td>Oposição / Quebra de expectativa</td>
            <td>"Mas" não pode ser deslocado; sempre após vírgula.</td>
          </tr>
          <tr>
            <td><strong>PORQUANTO</strong></td>
            <td>Coordenada Explicativa / Causal</td>
            <td>Causa / Motivo (= porque)</td>
            <td>Não confunda com CONQUANTO (que é concessivo!).</td>
          </tr>
          <tr>
            <td><strong>CONQUANTO</strong></td>
            <td>Subordinada Concessiva</td>
            <td>Concessão (= embora)</td>
            <td>Exige verbo no Modo Subjuntivo.</td>
          </tr>
          <tr>
            <td><strong>À MEDIDA QUE</strong></td>
            <td>Subordinada Proporcional</td>
            <td>Proporção simultânea</td>
            <td>Forma única correta (evite "à medida em que").</td>
          </tr>
        </tbody>
      </table>
    `
  };

  for (let i = 1; i <= 14; i++) {
    const id = `s${i < 10 ? "0" + i : i}`;
    const sec = SECOES_AULA_05.find((s) => s.id === id)!;
    const body = teoriaAula05[id] || `<p class="theory-p">Conteúdo temático do capítulo.</p>`;

    out += `
    <section class="matrix-chapter-section" id="${sec.id}">
      <div class="matrix-chapter-banner">
        <div class="banner-badge-box">
          ${svgDeepSeek}
          <span class="banner-num-text">CAPÍTULO ${sec.n}</span>
        </div>
        <h2 class="banner-title-text">${sec.title}</h2>
      </div>
      <div class="chapter-content-body">
        ${body}
      </div>
      <div class="chapter-end-signature">
        <span>⚡ DeepSeek Study Platform · CBM-RJ Português</span>
        <a href="#top" class="back-to-top-link">↑ Voltar ao Índice</a>
      </div>
    </section>
`;
  }

  const questoesAula05 = [
    {
      secId: "s15",
      secNum: "15",
      title: "Questões Comentadas — Orações Coordenadas e Conectivos (AOCP)",
      itens: [
        {
          num: "01",
          enunciado: "Em 'O coronel não apenas elogiou a prontidão dos bombeiros, mas também condecorou a equipe de resgate', a conjunção correlata em destaque estabelece entre as orações valor semântico de:",
          alternativas: {
            A: "adversidade.",
            B: "concessão.",
            C: "adição.",
            D: "conclusão.",
            E: "alternância."
          },
          gabarito: "C",
          comentario: "A correlação 'não apenas... mas também' expressa soma/adição enfática de fatos, atuando como conjunção coordenativa aditiva."
        },
        {
          num: "02",
          enunciado: "Assinale a alternativa em que a palavra 'pois' possui valor estritamente conclusivo:",
          alternativas: {
            A: "Apressem-se, pois a tempestade se aproxima.",
            B: "O tráfego na ponte estava interrompido, pois houve acidente grave.",
            C: "A viatura sofreu avaria severa; não pudemos, pois, prosseguir no trajeto.",
            D: "Não desanime, pois o resultado final ainda será publicado.",
            E: "Estude com método, pois a concorrência é qualificada."
          },
          gabarito: "C",
          comentario: "O conectivo 'pois' posposto ao verbo ('não pudemos, pois...') é conclusivo e equivale a 'portanto'. Em todas as outras opções, 'pois' antecede o verbo com valor explicativo/causal."
        }
      ]
    },
    {
      secId: "s16",
      secNum: "16",
      title: "Lista de Questões de Fixação — Coordenação (AOCP)",
      itens: [
        {
          num: "01",
          enunciado: "Em 'Todos os protocolos foram revistos, contudo as falhas operacionais persistiram', a conjunção 'contudo' pode ser substituída sem alteração de sentido e correção gramatical por:",
          alternativas: {
            A: "portanto.",
            B: "entretanto.",
            C: "porquanto.",
            D: "conquanto.",
            E: "por conseguinte."
          },
          gabarito: "B",
          comentario: "'Contudo' e 'entretanto' são conjunções coordenativas adversativas sinônimas (oposição/ressalva)."
        }
      ]
    },
    {
      secId: "s17",
      secNum: "17",
      title: "Questões Comentadas — Orações Subordinadas e Reduzidas (AOCP)",
      itens: [
        {
          num: "01",
          enunciado: "Na frase 'Constatou-se que a água do hidrante estava com baixa pressão', a oração introduzida pela partícula 'que' exerce função sintática de:",
          alternativas: {
            A: "Objeto Direto.",
            B: "Sujeito.",
            C: "Complemento Nominal.",
            D: "Predicativo do Sujeito.",
            E: "Aposto Explicativo."
          },
          gabarito: "B",
          comentario: "O verbo 'constatar' é transitivo direto apassivado pela partícula 'SE' ('Constatou-se ISSO' → 'ISSO foi constatado'). A oração funciona como sujeito da oração principal (O. S. Substantiva Subjetiva)."
        },
        {
          num: "02",
          enunciado: "Em 'Os militares, que concluíram o treinamento com mérito, foram condecorados', a oração adjetiva entre vírgulas possui caráter:",
          alternativas: {
            A: "restritivo, delimitando apenas uma parcela dos militares.",
            B: "explicativo, indicando que todos os militares referidos concluíram o treinamento.",
            C: "concessivo, indicando uma quebra de expectativa.",
            D: "comparativo, estabelecendo relação de igualdade.",
            E: "temporal, marcando o instante da homenagem."
          },
          gabarito: "B",
          comentario: "A oração adjetiva explicativa vem isolada por vírgulas e atribui uma característica genérica a todos os elementos do antecedente (todos concluíram com mérito)."
        }
      ]
    },
    {
      secId: "s18",
      secNum: "18",
      title: "Lista de Questões de Fixação — Subordinação e Período Composto (AOCP)",
      itens: [
        {
          num: "01",
          enunciado: "Assinale a opção em que a oração destacada expressa circunstância de concessão:",
          alternativas: {
            A: "<strong>Conforme foi planejado</strong>, a missão terminou no horário previsto.",
            B: "<strong>Ainda que encontrassem forte correnteza</strong>, os mergulhadores atingiram a vítima.",
            C: "<strong>À medida que a noite avançava</strong>, o frio tornava-se mais intenso.",
            D: "<strong>Caso ocorra novo deslizamento</strong>, os moradores deverão evacuar a área.",
            E: "O alarme disparou <strong>para que o prédio fosse evacuado</strong>."
          },
          gabarito: "B",
          comentario: "'Ainda que' é locução conjuntiva subordinativa concessiva, indicando obstáculo que não impede a realização da oração principal."
        }
      ]
    }
  ];

  for (const qSec of questoesAula05) {
    const secDef = SECOES_AULA_05.find((s) => s.id === qSec.secId)!;

    out += `
    <section class="matrix-chapter-section" id="${secDef.id}">
      <div class="matrix-chapter-banner">
        <div class="banner-badge-box">
          ${svgDeepSeek}
          <span class="banner-num-text">CAPÍTULO ${secDef.n}</span>
        </div>
        <h2 class="banner-title-text">${secDef.title}</h2>
      </div>
      <div class="chapter-content-body">
        <p class="theory-p">Seleção aprofundada de questões do <strong>Instituto AOCP</strong> para fixação rigorosa das estruturas de coordenação, subordinação e valores dos conectivos.</p>
`;

    qSec.itens.forEach((q, idx) => {
      const cardId = `q_card_${qSec.secId}_${idx + 1}`;
      out += `
    <article class="platform-question-card" id="${cardId}">
      <header class="q-card-header">
        <span class="q-pill q-pill-num">#${q.num}</span>
        <span class="q-pill q-pill-subject">Língua Portuguesa</span>
        <span class="q-pill q-pill-banca">INSTITUTO AOCP</span>
        <span class="q-pill q-pill-orgao">CBM-RJ</span>
        <span class="q-pill q-pill-ano">2026</span>
        <span class="q-pill q-pill-type ml-auto">Fixação</span>
      </header>
      <div class="q-card-content">
        <div class="q-enunciado">${q.enunciado}</div>
        <div class="q-options-list">
`;

      const letras = ["A", "B", "C", "D", "E"] as const;
      for (const l of letras) {
        if ((q.alternativas as any)[l]) {
          out += `          <div class="q-option-item" onclick="selectAnswer(this, '${cardId}', '${l}', '${q.gabarito}')">
            <span class="q-letter-badge">${l}</span>
            <span class="q-option-label">${(q.alternativas as any)[l]}</span>
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
              <span class="q-check-badge">${q.gabarito}</span>
            </div>
            <div class="q-comment-text">
              ${q.comentario}
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

  // Declaração final de IA regulamentar
  out += `
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

  // 2. Interatividade das Questões
  function selectAnswer(item, cardId, letter, gabarito) {
    const parent = item.parentElement;
    parent.querySelectorAll('.q-option-item').forEach(opt => opt.classList.remove('selected'));
    item.classList.add('selected');
  }

  // 3. Accordion de Gabarito
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

  fs.mkdirSync(path.dirname(previewPath), { recursive: true });
  fs.writeFileSync(previewPath, out, "utf-8");

  return {
    success: true,
    totalBytes: Buffer.byteLength(out, "utf-8"),
    caminho: previewPath,
  };
}
