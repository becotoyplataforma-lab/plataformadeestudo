import fs from "node:fs";
import path from "node:path";

export function inspecionarPdfAula05() {
  const pdfPath = path.join("H:", "Meu Drive", "plataforma de estudo", "cbm-rj", "portugues", "apostila", "curso-384118-aula-05-5077-completo.pdf");
  if (!fs.existsSync(pdfPath)) return null;

  // Lê os primeiros 200KB do PDF onde fica a capa, metadados e sumário
  const fd = fs.openSync(pdfPath, "r");
  const buffer = Buffer.alloc(200 * 1024);
  const bytesRead = fs.readSync(fd, buffer, 0, buffer.length, 0);
  fs.closeSync(fd);

  const textChunk = buffer.toString("latin1"); // ou utf-8

  // Salva no workspace para análise
  const info = {
    tamanho: fs.statSync(pdfPath).size,
    bytesRead,
    hasSumario: textChunk.toLowerCase().includes("sumário") || textChunk.toLowerCase().includes("sumario"),
  };

  fs.writeFileSync(path.join(process.cwd(), "public", "pdf-aula-05-info.json"), JSON.stringify(info, null, 2), "utf-8");
  return info;
}
