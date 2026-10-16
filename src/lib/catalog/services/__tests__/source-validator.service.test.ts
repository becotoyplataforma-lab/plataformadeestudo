import { describe, expect, it } from "vitest";
import { EXTENSION_TO_MIME, isTextExtractableExtension } from "@/lib/knowledge/format-contract";
import {
  countWords,
  isArchiveHost,
  pageMarkersOf,
  sha256Hex,
  validateCatalogSource,
} from "../source-validator.service";
import type { CatalogSourceInput } from "@/lib/catalog/types/catalog-ingestion";

function source(overrides: Partial<CatalogSourceInput>): CatalogSourceInput {
  return {
    kind: "archived-document",
    label: "Anexo VI - Retificacao 02 (arquivo 4)",
    extractor: "pdf-parse@1.1.1",
    capturedAt: "2026-10-02T00:00:00.000Z",
    reviewedByHuman: true,
    ...overrides,
  };
}

describe("validateCatalogSource", () => {
  it("aceita texto arbitrario ja extraido e mede a proveniencia", async () => {
    const text = "Lingua Portuguesa  Ortografia em vigor. Pontuacao. Sintaxe da oracao.";
    const result = await validateCatalogSource(source({ text }));
    expect(result.ok).toBe(true);
    expect(result.provenance.analysedTextSha256).toBe(sha256Hex(text));
    expect(result.provenance.characters).toBe(text.length);
    expect(result.provenance.words).toBe(countWords(text));
    expect(result.provenance.pageCount).toBe(1);
    expect(result.provenance.reviewedByHuman).toBe(true);
    expect(result.format).toBe("txt");
  });

  it("conta os marcadores de pagina da captura sem remove-los do texto", async () => {
    const text =
      "===== PAGE 22 =====\nLingua Portuguesa  Ortografia em vigor.\n===== PAGE 23 =====\nPontuacao. Sintaxe da oracao.\n";
    const result = await validateCatalogSource(source({ text, pageCount: 2 }));
    expect(pageMarkersOf(text)).toEqual([22, 23]);
    expect(result.provenance.pageCount).toBe(2);
    expect(result.text).toBe(text);
    expect(result.provenance.pageMarkerFormat).toBeDefined();
  });

  it("registra a URL como proveniencia e nao busca nada", async () => {
    const result = await validateCatalogSource(
      source({
        text: "Matematica  Geometria: angulo, poligonos, triangulos, Teorema de Pitagoras.\n",
        url: "https://web.archive.org/web/20220101000000/https://www.cbmerj.rj.gov.br/anexo-vi.pdf",
        capture: "20220101000000",
        declaredSha256: "aa5bcac520edb038",
      })
    );
    expect(result.ok).toBe(true);
    const codes = result.issues.map((item) => item.code);
    expect(codes).toContain("SOURCE_URL_NOT_FETCHED");
    expect(result.provenance.url).toContain("cbmerj");
    expect(result.provenance.capture).toBe("20220101000000");
  });

  it("marca revisao quando a URL esta fora do acervo arquivado", async () => {
    const result = await validateCatalogSource(
      source({ text: "Portugues  Ortografia em vigor. Pontuacao e acentuacao oficial.\n", url: "https://www.cbmerj.rj.gov.br/anexo-vi.pdf" })
    );
    const unsafe = result.issues.find((item) => item.code === "SOURCE_UNSAFE_PROVENANCE");
    expect(unsafe?.severity).toBe("review");
    expect(result.ok).toBe(true);
  });

  it("recusa fonte sem texto nem bytes", async () => {
    const result = await validateCatalogSource(source({}));
    expect(result.ok).toBe(false);
    expect(result.issues.some((item) => item.code === "SOURCE_TEXT_AND_BYTES_MISSING" && item.severity === "blocking")).toBe(true);
  });

  it("recusa texto vazio ou curto demais para segmentacao", async () => {
    const empty = await validateCatalogSource(source({ text: "   \n\t  " }));
    expect(empty.ok).toBe(false);
    expect(empty.issues.some((item) => item.code === "SOURCE_EMPTY" && item.severity === "blocking")).toBe(true);
    const short = await validateCatalogSource(source({ text: "Portugues e sintaxe." }));
    expect(short.ok).toBe(true);
    expect(short.issues.filter((item) => item.code === "SOURCE_EMPTY").map((item) => item.severity)).toEqual(["review"]);
  });

  it("exige rotulo, extractor e data de captura na proveniencia", async () => {
    const result = await validateCatalogSource({
      kind: "inline-text",
      label: "  ",
      text: "Lingua Portuguesa  Ortografia em vigor. Pontuacao. Sintaxe da oracao e concordancia.\n",
    });
    expect(result.ok).toBe(false);
    const codes = result.issues.filter((item) => item.code === "SOURCE_PROVENANCE_INCOMPLETE").map((item) => item.severity);
    expect(codes).toContain("blocking");
    expect(codes).toContain("review");
  });

  it("delega ao contrato de formato o que pode virar texto", async () => {
    expect(isTextExtractableExtension("pdf")).toBe(true);
    expect(isTextExtractableExtension("doc")).toBe(false);
    expect(EXTENSION_TO_MIME.pdf).toBe("application/pdf");
    expect(isArchiveHost("https://web.archive.org/web/1/https://x.gov.br/a.pdf")).toBe(true);
    expect(isArchiveHost("https://x.gov.br/a.pdf")).toBe(false);
  });

  it("recusa binario de formato sem extrator antes de abrir o payload", async () => {
    const result = await validateCatalogSource(
      source({
        kind: "local-file",
        fileName: "anexo-vi.doc",
        mimeType: "application/msword",
        bytes: new Uint8Array([1, 2, 3, 4]),
      })
    );
    expect(result.ok).toBe(false);
    const issue = result.issues.find((item) => item.code === "SOURCE_FORMAT_UNSUPPORTED");
    expect(issue?.severity).toBe("blocking");
    expect(result.text).toBe("");
  });

  it("extrai bytes de texto puro pelo servico de extracao existente", async () => {
    const payload = new TextEncoder().encode("Raciocinio Logico  Operacoes com conjuntos, principio fundamental da contagem.\n");
    const result = await validateCatalogSource(
      source({ kind: "local-file", fileName: "bloco.txt", mimeType: "text/plain", bytes: payload })
    );
    expect(result.ok).toBe(true);
    expect(result.text).toContain("Raciocinio Logico");
    expect(result.format).toBe("txt");
  });

  it("nao inventa hash: sha256 e sempre derivado do texto analisado", () => {
    expect(sha256Hex("a")).toBe(sha256Hex(new TextEncoder().encode("a")));
    expect(sha256Hex("a")).not.toBe(sha256Hex("b"));
  });
});
