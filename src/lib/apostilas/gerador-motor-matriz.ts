import fs from "node:fs";
import path from "node:path";

function sanitizeOrigin(str: string): string {
  if (!str) return "";
  return str.trim();
}

export interface SecaoCapitulo {
  id: string;
  n: string;
  title: string;
  conteudoHtml: string;
}

export interface QuestaoMatriz {
  num: string;
  enunciado: string;
  alternativas: { A?: string; B?: string; C?: string; D?: string; E?: string };
  gabarito: string;
  comentario: string;
}

export interface SecaoQuestoes {
  id: string;
  n: string;
  title: string;
  tipo: "comentada" | "fixacao";
  itens: QuestaoMatriz[];
}

export interface ConfigAula {
  numero: string; // "06", "07", etc.
  tituloMateria: string; // "Língua Portuguesa"
  tituloAula: string; // "Aula 06 — Pontuação e Emprego da Crase"
  subtituloCapa: string; // "CBM-RJ — CORPO DE BOMBEIROS MILITAR"
  totalPaginas: string; // "150 Páginas Integrais"
  totalQuestoes: string; // "90+ Questões AOCP & Fixação"
  arquivoPdfOriginal?: string; // "curso-384118-aula-06-15f7-completo.pdf"
  secoesTeoria: SecaoCapitulo[];
  secoesQuestoes: SecaoQuestoes[];
}

export function gerarHtmlAulaMatriz(config: ConfigAula): string {
  const rootDir = process.cwd();

  // Tenta copiar o PDF do drive para public/apostilas se existir
  if (config.arquivoPdfOriginal) {
    try {
      const src = path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "apostila", config.arquivoPdfOriginal);
      if (fs.existsSync(src)) {
        const dest = path.join(rootDir, "public", "apostilas", config.arquivoPdfOriginal);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        if (!fs.existsSync(dest)) {
          fs.copyFileSync(src, dest);
        }
      }
    } catch (e) {
      console.warn(`[motor-matriz] Cópia PDF Aula ${config.numero}:`, e);
    }
  }

  // Bloco CSS Matriz de aula-01
  let cssBlock = "";
  const a1Path = path.join(rootDir, "public", "preview", "aula-01-preview.html");
  if (fs.existsSync(a1Path)) {
    const a1Html = fs.readFileSync(a1Path, "utf-8");
    const m = a1Html.match(/<style>([\s\S]*?)<\/style>/);
    if (m) cssBlock = m[1];
  }

  const svgDeepSeekMini = `<svg class="mini-logo-svg" height="18" viewBox="0 0 24 24" width="18" xmlns="http://www.w3.org/2000/svg"><title>DeepSeek</title><path d="M23.748 4.482c-.254-.124-.364.113-.512.234-.051.039-.094.09-.137.136-.372.397-.806.657-1.373.626-.829-.046-1.537.214-2.163.848-.133-.782-.575-1.248-1.247-1.548-.352-.156-.708-.311-.955-.65-.172-.241-.219-.51-.305-.774-.055-.16-.11-.323-.293-.35-.2-.031-.278.136-.356.276-.313.572-.434 1.202-.422 1.84.027 1.436.633 2.58 1.838 3.393.137.093.172.187.129.323-.082.28-.18.552-.266.833-.055.179-.137.217-.329.14a5.526 5.526 0 01-1.736-1.18c-.857-.828-1.631-1.742-2.597-2.458a11.365 11.365 0 00-.689-.471c-.985-.957.13-1.743.388-1.836.27-.098.093-.432-.779-.428-.872.004-1.67.295-2.687.684a3.055 3.055 0 01-.465.137 9.597 9.597 0 00-2.883-.102c-1.885.21-3.39 1.102-4.497 2.623C.082 8.606-.231 10.684.152 12.85c.403 2.284 1.569 4.175 3.36 5.653 1.858 1.533 3.997 2.284 6.438 2.14 1.482-.085 3.133-.284 4.994-1.86.47.234.962.327 1.78.397.63.059 1.236-.03 1.705-.128.735-.156.684-.837.419-.961-2.155-1.004-1.682-.595-2.113-.926 1.096-1.296 2.746-2.642 3.392-7.003.05-.347.007-.565 0-.845-.004-.17.035-.237.23-.256a4.173 4.173 0 001.545-.475c1.396-.763 1.96-2.015 2.093-3.517.02-.23-.004-.467-.247-.588zM11.581 18c-2.089-1.642-3.102-2.183-3.52-2.16-.392.024-.321.471-.235.763.09.288.207.486.371.739.114.167.192.416-.113.603-.673.416-1.842-.14-1.897-.167-1.361-.802-2.5-1.86-3.301-3.307-.774-1.393-1.224-2.887-1.298-4.482-.02-.386.093-.522.477-.592a4.696 4.696 0 011.529-.039c2.132.312 3.946 1.265 5.468 2.774.868.86 1.525 1.887 2.202 2.891.72 1.066 1.494 2.082 2.48 2.914.348.292.625.514.891.677-.802.09-2.14.11-3.054-.614zm1-6.44a.306.306 0 01.415-.287.302.302 0 01.2.288.306.306 0 01-.31.307.303.303 0 01-.304-.308zm3.11 1.596c-.2.081-.399.151-.59.16a1.245 1.245 0 01-.798-.254c-.274-.23-.47-.358-.552-.758a1.73 1.73 0 01.016-.588c.07-.327-.008-.537-.239-.727-.187-.156-.426-.199-.688-.199a.559.559 0 01-.254-.078c-.11-.054-.2-.19-.114-.358.028-.054.16-.186.192-.21.356-.202.767-.136 1.146.016.352.144.618.408 1.001.782.391.451.462.576.685.914.176.265.336.537.445.848.067.195-.019.354-.25.452z" fill="#4D6BFE"></path></svg>`;

  // Junta todas as seções para o índice
  const todasSecoes: { id: string; n: string; title: string }[] = [
    ...config.secoesTeoria.map(s => ({ id: s.id, n: s.n, title: s.title })),
    ...config.secoesQuestoes.map(s => ({ id: s.id, n: s.n, title: s.title })),
  ];

  let out = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>CBM-RJ | Português — ${config.tituloAula}</title>
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
    <span class="pill-materia">${config.tituloMateria} · Aula ${config.numero}</span>
    <a href="/api/apostilas/download?aula=${config.numero}" download title="Baixar Apostila Adaptada em formato PDF" style="display:inline-flex; align-items:center; gap:6px; background:#4D6BFE; color:#ffffff; font-weight:700; font-size:12px; padding:6px 14px; border-radius:6px; text-decoration:none; margin-left:12px; box-shadow:0 2px 6px rgba(77,107,254,0.3); transition:background 0.15s ease;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
      Baixar Apostila Adaptada (PDF)
    </a>
  </div>
</header>

<!-- WORKSPACE CONTAINER -->
<div class="workspace-layout">

  <!-- SIDEBAR FIXO COM OS CAPÍTULOS -->
  <aside class="sidebar-column">
    <div class="sidebar-heading">
      <span>📖</span>
      <span>Índice dos Capítulos</span>
    </div>
    <nav class="sidebar-menu-list">
`;

  todasSecoes.forEach((sec) => {
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
      <div class="cover-subtitle-top">${config.subtituloCapa}</div>
      <h1 class="cover-title-main">${config.tituloMateria}</h1>
      <div class="cover-lesson-title">${config.tituloAula}</div>
      <div class="cover-sep-line"></div>
      <div class="cover-badge-row">
        <span class="cover-pill-stat">📄 ${config.totalPaginas}</span>
        <span class="cover-pill-stat">🎯 ${config.totalQuestoes}</span>
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
        <span>Sumário dos Capítulos</span>
      </div>
      <div class="toc-items-grid">
`;

  todasSecoes.forEach((sec) => {
    out += `        <a href="#${sec.id}" class="toc-item-link">
          <span class="toc-num-tag">${sec.n}.</span>
          <span>${sec.title}</span>
        </a>\n`;
  });

  out += `      </div>
    </div>

    <!-- CONTEÚDO TEÓRICO -->
`;

  config.secoesTeoria.forEach((sec) => {
    out += `
    <section class="matrix-chapter-section" id="${sec.id}">
      <div class="matrix-chapter-banner">
        <div class="banner-badge-box">
          ${svgDeepSeekMini}
          <span class="banner-num-text">CAPÍTULO ${sec.n}</span>
        </div>
        <h2 class="banner-title-text">${sec.title}</h2>
      </div>
      <div class="chapter-content-body">
        ${sec.conteudoHtml}
      </div>
      <div class="chapter-end-signature">
        <span>⚡ DeepSeek Study Platform · CBM-RJ Português</span>
        <a href="#top" class="back-to-top-link">↑ Voltar ao Índice</a>
      </div>
    </section>
`;
  });

  // CONTEÚDO DE QUESTÕES
  config.secoesQuestoes.forEach((qSec) => {
    out += `
    <section class="matrix-chapter-section" id="${qSec.id}">
      <div class="matrix-chapter-banner">
        <div class="banner-badge-box">
          ${svgDeepSeekMini}
          <span class="banner-num-text">CAPÍTULO ${qSec.n}</span>
        </div>
        <h2 class="banner-title-text">${qSec.title}</h2>
      </div>
      <div class="chapter-content-body">
        <p class="theory-p">Seleção aplicada de questões do <strong>Instituto AOCP</strong> para treino e fixação das matérias estudadas.</p>
`;

    qSec.itens.forEach((q, idx) => {
      const cardId = `q_card_${qSec.id}_${idx + 1}`;
      out += `
    <article class="platform-question-card" id="${cardId}">
      <header class="q-card-header">
        <span class="q-pill q-pill-num">#${q.num}</span>
        <span class="q-pill q-pill-subject">${config.tituloMateria}</span>
        <span class="q-pill q-pill-banca">INSTITUTO AOCP</span>
        <span class="q-pill q-pill-orgao">CBM-RJ</span>
        <span class="q-pill q-pill-ano">2026</span>
        <span class="q-pill q-pill-type ml-auto">${qSec.tipo === "comentada" ? "Comentada" : "Fixação"}</span>
      </header>
      <div class="q-card-content">
        <div class="q-enunciado">${sanitizeOrigin(q.enunciado)}</div>
        <div class="q-options-list">
`;

      const letras = ["A", "B", "C", "D", "E"] as const;
      for (const l of letras) {
        if (q.alternativas[l]) {
          out += `          <div class="q-option-item" onclick="selectAnswer(this, '${cardId}', '${l}', '${q.gabarito}')">
            <span class="q-letter-badge">${l}</span>
            <span class="q-option-label">${sanitizeOrigin(q.alternativas[l]!)}</span>
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
              ${sanitizeOrigin(q.comentario)}
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
  });

  // Fechamento regulamentar
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

  return out;
}
