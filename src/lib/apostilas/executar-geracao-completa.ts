import fs from "node:fs";
import path from "node:path";
import { gerarHtmlAulaMatriz } from "./gerador-motor-matriz";
import { AULA_06_CONFIG, AULA_07_CONFIG } from "./aulas-conteudo-data";
import {
  AULA_08_CONFIG,
  AULA_09_CONFIG,
  AULA_10_CONFIG,
  AULA_11_CONFIG,
  AULA_12_CONFIG,
  AULA_13_CONFIG,
} from "./aulas-conteudo-data-part2";

export function executarGeracaoAulas06a13() {
  const rootDir = process.cwd();
  const configs = [
    AULA_06_CONFIG,
    AULA_07_CONFIG,
    AULA_08_CONFIG,
    AULA_09_CONFIG,
    AULA_10_CONFIG,
    AULA_11_CONFIG,
    AULA_12_CONFIG,
    AULA_13_CONFIG,
  ];

  const resultados = [];

  for (const cfg of configs) {
    const previewFileName = `aula-${cfg.numero}-preview.html`;
    const previewPath = path.join(rootDir, "public", "preview", previewFileName);

    try {
      const html = gerarHtmlAulaMatriz(cfg);
      fs.mkdirSync(path.dirname(previewPath), { recursive: true });
      fs.writeFileSync(previewPath, html, "utf-8");

      resultados.push({
        aula: cfg.numero,
        titulo: cfg.tituloAula,
        arquivo: previewFileName,
        url: `/preview/${previewFileName}#s01`,
        tamanhoBytes: Buffer.byteLength(html, "utf-8"),
        status: "sucesso",
      });
    } catch (err: any) {
      console.error(`[executar-geracao] Erro na aula ${cfg.numero}:`, err);
      resultados.push({
        aula: cfg.numero,
        status: "erro",
        mensagem: err?.message,
      });
    }
  }

  // Grava o relatório de geração no workspace
  const reportPath = path.join(rootDir, "public", "relatorio-geracao-06-13.json");
  fs.writeFileSync(reportPath, JSON.stringify(resultados, null, 2), "utf-8");

  return resultados;
}
