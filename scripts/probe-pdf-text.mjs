#!/usr/bin/env node
/**
 * ConcursoAI - Pre-voo de extracao de texto de PDFs (read-only).
 *
 * POR QUE ISTO EXISTE:
 *   o planeamento do CLI recebe apenas metadados. Em
 *   scripts/ingest-apostilas.ts, provider.plan() e chamado com fileName,
 *   mimeType, sizeBytes, sha256, relativePath e allZeroContent (L278-286). O
 *   conteudo extraido nao entra ali. Por isso o --dry-run classifica formato,
 *   tamanho e duplicacao, mas nao enxerga um PDF escaneado sem camada de texto:
 *   esse arquivo sai como "pending" no dry-run e so falha na extracao, durante
 *   o --apply, no meio da escrita. Este probe fecha essa lacuna antes.
 *
 * SEGURANCA DE LEITURA:
 *   nao abre conexao com banco, nao toca em storage nem em R2, nao escreve
 *   arquivo algum e nao faz commit de git. Le a arvore e imprime uma sintese
 *   por arquivo no stdout.
 *
 * LIMITES:
 *   o provedor que extrai no --apply e o MCP apostila-mcp, que pode usar outro
 *   parser. Texto presente aqui e forte indicio, nao a mesma byte-code do
 *   provedor: a confirmacao definitiva e o passo 6 do runbook com --limit 1.
 *   Avisos do tipo "Warning: TT: undefined function" vao no stderr e sao do
 *   pdf.js (fontes TrueType nao embutidas); nao significam falha de extracao.
 *
 * REDACAO: nada aqui imprime credencial, connection string ou project ref.
 *
 * Uso:
 *   node scripts/probe-pdf-text.mjs [origem] [--min-chars N]
 *   node scripts/probe-pdf-text.mjs materiais
 *   node scripts/probe-pdf-text.mjs "H:\Meu Drive\plataforma de estudo"
 *
 * Codigo de saida: 0 se nenhum PDF ficou sem texto; 1 se algum ficou;
 * 2 se a origem nao existe.
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

// Import profundo de proposito: o index do pdf-parse trata "sem pai" como modo
// de debug e tenta ler um PDF de teste do proprio pacote, o que so ia falhar.
const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;

function parseArgs(argv) {
  const args = { origem: "materiais", minChars: 200 };
  const posicionais = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--min-chars") {
      args.minChars = Number.parseInt(argv[i + 1], 10);
      i += 1;
      continue;
    }
    if (token.startsWith("--")) {
      throw new Error("Flag desconhecida: " + token);
    }
    posicionais.push(token);
  }
  if (posicionais.length > 0) args.origem = posicionais[0];
  if (!Number.isFinite(args.minChars) || args.minChars < 0) {
    throw new Error("--min-chars precisa ser um inteiro >= 0.");
  }
  return args;
}

async function walk(dir, root, out) {
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const abs = join(dir, item.name);
    if (item.isDirectory()) {
      await walk(abs, root, out);
    } else if (item.isFile() && item.name.toLowerCase().endsWith(".pdf")) {
      out.push({ abs, rel: abs.slice(root.length + 1) });
    }
  }
  return out;
}

const args = parseArgsSafe(process.argv.slice(2));

function parseArgsSafe(argv) {
  try {
    return parseArgs(argv);
  } catch (error) {
    console.error("[probe] " + (error && error.message));
    process.exit(2);
  }
}

try {
  if (!(await stat(args.origem)).isDirectory()) {
    console.error("[probe] origem nao e um diretorio: " + args.origem);
    process.exitCode = 2;
  } else {
    const files = (await walk(args.origem, args.origem, [])).sort(function (a, b) {
      return a.rel.localeCompare(b.rel);
    });
    let semTexto = 0;
    let totalChars = 0;
    for (const file of files) {
      const buffer = await readFile(file.abs);
      let pages = "?";
      let chars = 0;
      let falha = "";
      try {
        const data = await pdfParse(buffer);
        chars = (data.text ?? "").replace(/\s+/g, " ").trim().length;
        pages = data.numpages;
      } catch (error) {
        falha = String(error && error.message ? error.message : error).slice(0, 70);
      }
      const limpo = chars >= args.minChars;
      if (!limpo) semTexto += 1;
      totalChars += chars;
      console.log(
        [
          limpo ? "COM_TEXTO" : "SEM_TEXTO",
          "pg=" + pages,
          "chars=" + chars,
          "mb=" + (buffer.length / 1048576).toFixed(2),
          falha ? "ERRO:" + falha : "",
          file.rel,
        ]
          .filter(Boolean)
          .join(" | "),
      );
    }
    console.log(
      "RESUMO origem=" + args.origem + " pdf=" + files.length +
        " sem_texto=" + semTexto + " chars_totais=" + totalChars +
        " limiar=" + args.minChars,
    );
    if (semTexto > 0) process.exitCode = 1;
  }
} catch (error) {
  console.error("[probe] origem inacessivel: " + (error && error.message));
  process.exitCode = 2;
}
