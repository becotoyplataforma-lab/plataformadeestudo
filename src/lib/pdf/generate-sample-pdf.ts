/**
 * Gerador de PDF mínimo 100% em conformidade com a especificação PDF-1.4.
 * Gera documento com visual profissional contendo Apostila, Questões e Gabarito Oficial.
 */

function escapePdfText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove diacríticos para compatibilidade com Type1 Helvetica
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

export function generateSamplePdf(titulo: string, materia: string, concurso: string): Buffer {
  const safeTitulo = escapePdfText(titulo);
  const safeMateria = escapePdfText(materia);
  const safeConcurso = escapePdfText(concurso);

  const lines = [
    `BT`,
    `/F1 20 Tf`,
    `50 780 Td`,
    `(${safeTitulo}) Tj`,
    `0 -28 Td`,
    `/F1 12 Tf`,
    `(Disciplina: ${safeMateria}   |   Concurso: ${safeConcurso}) Tj`,
    `0 -18 Td`,
    `(Plataforma de Estudos - Material Oficial com Gabarito) Tj`,
    `0 -32 Td`,
    `/F1 14 Tf`,
    `(1. INTRODUCAO E RESUMO TEORICO) Tj`,
    `0 -20 Td`,
    `/F1 10 Tf`,
    `(Este material contem os principais topicos e conceitos exigidos nos editais mais recentes.) Tj`,
    `0 -14 Td`,
    `(Estude os pontos fundamentais, resolva os exercicios praticos e confira o gabarito ao final.) Tj`,
    `0 -30 Td`,
    `/F1 14 Tf`,
    `(2. CADERNO DE EXERCICIOS E SIMULADOS) Tj`,
    `0 -22 Td`,
    `/F1 10 Tf`,
    `(Questao 01: Julgue a conformidade dos atos e preceitos constitucionais vigentes.) Tj`,
    `0 -14 Td`,
    `(    [ C ] Certo        [ E ] Errado) Tj`,
    `0 -20 Td`,
    `(Questao 02: Assinale a alternativa que guarda perfeita harmonia com os principios da administracao.) Tj`,
    `0 -14 Td`,
    `(    (A) Principio restritivo     (B) Legalidade e Eficiencia     (C) Excecao generica) Tj`,
    `0 -20 Td`,
    `(Questao 03: Quanto a aplicacao pratica da materia em questoes de banca examinadora:) Tj`,
    `0 -14 Td`,
    `(    [ C ] Certo        [ E ] Errado) Tj`,
    `0 -36 Td`,
    `/F1 14 Tf`,
    `(3. GABARITO OFICIAL DEFINITIVO) Tj`,
    `0 -22 Td`,
    `/F1 11 Tf`,
    `(============================================================) Tj`,
    `0 -16 Td`,
    `(  Questao 01: CERTO  |  Justificativa: Conforme texto expresso do dispositivo legal.) Tj`,
    `0 -16 Td`,
    `(  Questao 02: B      |  Justificativa: Principios consagrados no caput do Art. 37.) Tj`,
    `0 -16 Td`,
    `(  Questao 03: CERTO  |  Justificativa: Jurisprudencia pacifica e consolidada.) Tj`,
    `0 -16 Td`,
    `(============================================================) Tj`,
    `0 -26 Td`,
    `/F1 9 Tf`,
    `(Material gerado para uso exclusivo do estudante. Bons estudos!) Tj`,
    `ET`,
  ];

  const streamContent = lines.join("\n");
  const streamLength = Buffer.byteLength(streamContent, "utf-8");

  const objects = [
    `1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`,
    `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`,
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n`,
    `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${streamContent}\nendstream\nendobj\n`,
    `5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n`,
  ];

  let header = "%PDF-1.4\n";
  let offset = header.length;
  const offsets: number[] = [];

  for (const obj of objects) {
    offsets.push(offset);
    offset += obj.length;
  }

  const xrefOffset = offset;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  const fullPdf = header + objects.join("") + xref + trailer;
  return Buffer.from(fullPdf, "utf-8");
}
