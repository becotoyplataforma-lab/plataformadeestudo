/**
 * Testes do DocumentExtractionService.
 *
 * Cobrem o contrato real de extracao: o que vira texto, o que e recusado por
 * nao existir extrator, e - o ponto novo - a separacao por pagina do PDF, que
 * e o que permite ao chunk citar a pagina de origem. O PDF aqui e um fixture
 * artificial minimo, sem material privado real.
 */
import { describe, it, expect } from "vitest";

import { DocumentExtractionService } from "../extraction.service";

const NL = "\n";

function pageObj(objId: number, parentRef: number, contentsRef: number): string {
  const head = objId + " 0 obj" + NL;
  const dict =
    "<< /Type /Page /Parent " + parentRef + " 0 R " +
    "/MediaBox [0 0 300 200] " +
    "/Resources << /Font << /F1 4 0 R >> >> " +
    "/Contents " + contentsRef + " 0 R >>";
  return head + dict + NL + "endobj";
}

function streamObj(objId: number, text: string): string {
  const content = "BT /F1 12 Tf 20 100 Td (" + text + ") Tj ET";
  return (
    objId + " 0 obj" + NL +
    "<< /Length " + content.length + " >>" + NL +
    "stream" + NL + content + NL + "endstream" + NL +
    "endobj"
  );
}

/** PDF de duas paginas, sem compressao: a pagina de origem e verificavel. */
function minimalTwoPagePdf(): Buffer {
  const parts: string[] = [];
  parts.push("%PDF-1.4");
  parts.push("1 0 obj" + NL + "<< /Type /Catalog /Pages 2 0 R >>" + NL + "endobj");
  parts.push(
    "2 0 obj" + NL + "<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>" + NL + "endobj"
  );
  parts.push(pageObj(3, 2, 6));
  parts.push("4 0 obj" + NL + "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>" + NL + "endobj");
  parts.push(pageObj(5, 2, 7));
  parts.push(streamObj(6, "CONTEUDO DA PRIMEIRA PAGINA"));
  parts.push(streamObj(7, "CONTEUDO DA SEGUNDA PAGINA"));
  let body = parts.join(NL) + NL;
  body = body + "trailer" + NL;
  body = body + "<< /Size 8 /Root 1 0 R >>" + NL;
  body = body + "startxref" + NL;
  body = body + String(Buffer.byteLength(body, "latin1")) + NL;
  body = body + "%%EOF";
  return Buffer.from(body, "latin1");
}

describe("DocumentExtractionService", () => {
  it("extrai texto de PDF e devolve uma entrada por pagina, na ordem", async () => {
    const out = await DocumentExtractionService.extract(
      minimalTwoPagePdf(),
      "application/pdf",
      "pdf"
    );
    expect(out.pageCount).toBe(2);
    expect(out.pages).toHaveLength(2);
    expect(out.pages?.[0]).toContain("PRIMEIRA");
    expect(out.pages?.[1]).toContain("SEGUNDA");
    expect(out.text).toContain("PRIMEIRA");
    expect(out.text).toContain("SEGUNDA");
  });

  it("extrai UTF-8 de TXT", async () => {
    const buffer = Buffer.from("Aula 01 - Direito Administrativo", "utf8");
    const out = await DocumentExtractionService.extract(buffer, "text/plain", "txt");
    expect(out.text).toBe("Aula 01 - Direito Administrativo");
  });

  it("extrai Markdown", async () => {
    const buffer = Buffer.from("# Titulo" + NL + NL + "Corpo da secao.", "utf8");
    const out = await DocumentExtractionService.extract(buffer, "text/markdown", "markdown");
    expect(out.text).toContain("# Titulo");
    expect(out.text).toContain("Corpo da secao.");
  });

  it("remove tags, script e style de HTML", async () => {
    const html =
      "<html><head><script>alert(1)</script><style>p{color:red}</style></head>" +
      "<body><h1>Cabecalho</h1><p>Paragrafo de apostila.</p></body></html>";
    const out = await DocumentExtractionService.extract(
      Buffer.from(html, "utf8"),
      "text/html",
      "html"
    );
    expect(out.text).toContain("Paragrafo de apostila.");
    expect(out.text).toContain("Cabecalho");
    expect(out.text).not.toContain("alert");
    expect(out.text).not.toContain("color:red");
    expect(out.text).not.toContain("<h1>");
  });

  it("documento sem pagina nao ganha pages: nao se inventa pagina", async () => {
    const buffer = Buffer.from("texto simples sem paginas", "utf8");
    const out = await DocumentExtractionService.extract(buffer, "text/plain", "txt");
    expect(out.pages).toBeUndefined();
    expect(out.pageCount).toBeUndefined();
  });

  it("recusa formato sem extrator antes de tocar no binario", async () => {
    const buffer = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x00, 0x01]);
    await expect(
      DocumentExtractionService.extract(buffer, "application/epub+zip", "epub")
    ).rejects.toMatchObject({
      name: "ExtractionError",
      code: "UNSUPPORTED_FORMAT",
    });
  });

  it("recusa imagem mesmo com type de texto: OCR ainda nao existe", async () => {
    const buffer = Buffer.from("fake", "utf8");
    await expect(
      DocumentExtractionService.extract(buffer, "image/png", "txt")
    ).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("PDF corrompido falha explicito em vez de devolver texto vazio", async () => {
    const buffer = Buffer.from("%PDF-1.4 isto nao e um pdf valido", "latin1");
    await expect(
      DocumentExtractionService.extract(buffer, "application/pdf", "pdf")
    ).rejects.toBeInstanceOf(Error);
  });

  it("arquivo vazio devolve texto vazio sem lancar: quem decide o erro e o pipeline", async () => {
    const out = await DocumentExtractionService.extract(
      Buffer.from("", "utf8"),
      "text/plain",
      "txt"
    );
    expect(out.text).toBe("");
  });
});
