import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const POSSIBLE_BROWSER_PATHS = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Users\\dev\\AppData\\Local\\Microsoft\\Edge SxS\\Application\\msedge.exe",
];

export function encontrarNavegador(): string | null {
  for (const p of POSSIBLE_BROWSER_PATHS) {
    if (fs.existsSync(p)) {
      return p;
    }
  }

  // Tenta pelo PATH do sistema via where
  try {
    const whereEdge = execSync("where msedge", { encoding: "utf-8" }).split(/\r?\n/)[0].trim();
    if (whereEdge && fs.existsSync(whereEdge)) return whereEdge;
  } catch (_) {}

  try {
    const whereChrome = execSync("where chrome", { encoding: "utf-8" }).split(/\r?\n/)[0].trim();
    if (whereChrome && fs.existsSync(whereChrome)) return whereChrome;
  } catch (_) {}

  return null;
}

/**
 * Converte a apostila adaptada em HTML para PDF de alta fidelidade
 */
export function converterHtmlParaPdf(aulaNumero: string): {
  sucesso: boolean;
  pdfPath?: string;
  tamanhoBytes?: number;
  erro?: string;
} {
  const browser = encontrarNavegador();
  if (!browser) {
    return { sucesso: false, erro: "Nenhum navegador Chromium (Edge/Chrome) encontrado para renderização." };
  }

  const num = aulaNumero.padStart(2, "0");
  const htmlPath = path.join(process.cwd(), "public", "preview", `aula-${num}-preview.html`);

  if (!fs.existsSync(htmlPath)) {
    return { sucesso: false, erro: `Arquivo HTML não encontrado: ${htmlPath}` };
  }

  const dirDestino = path.join(process.cwd(), "public", "apostilas-adaptadas");
  if (!fs.existsSync(dirDestino)) {
    fs.mkdirSync(dirDestino, { recursive: true });
  }

  const pdfDest = path.join(dirDestino, `CBM-RJ_Portugues_Aula_${num}_Adaptada.pdf`);
  const aliasDest = path.join(dirDestino, `aula-${num}-adaptada.pdf`);

  // Injeta estilos de impressão no HTML se necessário
  garantirEstiloImpressao(htmlPath);

  try {
    const fileUrl = `file:///${htmlPath.replace(/\\/g, "/")}`;
    const cmd = `"${browser}" --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${pdfDest}" "${fileUrl}"`;

    execSync(cmd, {
      timeout: 90000,
      windowsHide: true,
      stdio: ["ignore", "ignore", "ignore"],
    });

    if (fs.existsSync(pdfDest)) {
      const stat = fs.statSync(pdfDest);
      try {
        fs.copyFileSync(pdfDest, aliasDest);
      } catch (_) {}

      return {
        sucesso: true,
        pdfPath: pdfDest,
        tamanhoBytes: stat.size,
      };
    } else {
      return { sucesso: false, erro: "O executável do navegador finalizou sem gerar o PDF." };
    }
  } catch (err: any) {
    return { sucesso: false, erro: err?.message || "Erro durante a execução do Chromium headless." };
  }
}

/**
 * Injeta bloco @media print caso ainda não exista no arquivo HTML
 */
function garantirEstiloImpressao(htmlPath: string) {
  try {
    const content = fs.readFileSync(htmlPath, "utf-8");
    if (content.includes("@media print")) {
      return;
    }

    const printCss = `
<style>
@media print {
  @page {
    size: A4;
    margin: 15mm 12mm 15mm 12mm;
  }
  .top-navbar, .sidebar-column, .back-to-top-link, .q-accordion-trigger, .btn-top-download {
    display: none !important;
  }
  .q-accordion-body {
    display: block !important;
    visibility: visible !important;
  }
  .workspace-layout {
    display: block !important;
    padding: 0 !important;
    margin: 0 !important;
    max-width: 100% !important;
  }
  .apostila-page-container {
    width: 100% !important;
    max-width: 100% !important;
    padding: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  body {
    background: #ffffff !important;
    color: #0f172a !important;
    font-size: 11.5pt !important;
  }
  .master-cover-page {
    page-break-after: always;
    break-after: page;
    padding: 80px 20px !important;
  }
  .theory-chapter-block {
    page-break-inside: auto;
    break-inside: auto;
  }
  .platform-question-card {
    page-break-inside: avoid;
    break-inside: avoid;
    border: 1px solid #cbd5e1 !important;
    box-shadow: none !important;
    margin: 18px 0 !important;
  }
}
</style>
</head>`;

    const updated = content.replace("</head>", printCss);
    fs.writeFileSync(htmlPath, updated, "utf-8");
  } catch (e) {
    console.warn("[pdf-conversor] Aviso ao injetar estilo de impressão:", e);
  }
}

/**
 * Converte todas as 13 apostilas adaptadas em lote
 */
export function converterTodasAulas(): Record<string, any> {
  const relatorio: Record<string, any> = {};
  for (let i = 1; i <= 13; i++) {
    const num = String(i).padStart(2, "0");
    const res = converterHtmlParaPdf(num);
    relatorio[num] = res;
  }

  try {
    fs.writeFileSync(
      path.join(process.cwd(), "public", "relatorio-conversao-pdf.json"),
      JSON.stringify(relatorio, null, 2),
      "utf-8"
    );
  } catch (_) {}

  return relatorio;
}

// Auto-geração garantida no servidor Node (Next.js SSR)
if (typeof window === "undefined") {
  try {
    const dirDestino = path.join(process.cwd(), "public", "apostilas-adaptadas");
    if (!fs.existsSync(dirDestino)) {
      fs.mkdirSync(dirDestino, { recursive: true });
    }

    const relatorio: Record<string, any> = {};
    for (let i = 1; i <= 13; i++) {
      const num = String(i).padStart(2, "0");
      const destPdf = path.join(dirDestino, `CBM-RJ_Portugues_Aula_${num}_Adaptada.pdf`);
      if (!fs.existsSync(destPdf)) {
        relatorio[num] = converterHtmlParaPdf(num);
      } else {
        relatorio[num] = { sucesso: true, jaExistia: true, tamanhoBytes: fs.statSync(destPdf).size };
      }
    }

    fs.writeFileSync(
      path.join(process.cwd(), "public", "relatorio-conversao-pdf.json"),
      JSON.stringify(relatorio, null, 2),
      "utf-8"
    );
  } catch (err: any) {
    console.warn("[pdf-conversor] Erro na geração automática:", err?.message);
  }
}
