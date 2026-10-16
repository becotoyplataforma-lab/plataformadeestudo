/**
 * catalog-digest.ts (FASE 5) - o unico hash do dominio catalogo.
 *
 * O vetor de "abc" e do FIPS 180-4 e nao e decoracao: se ele mudar de cor, algum digest
 * historico do catalogo mudou junto, e ai a assinatura de um humano sobre uma analise
 * deixa de valer sem ninguem ter decidido nada. E exatamente esse o risco que o
 * re-export de source-validator.service.ts tem de afastar.
 *
 * A fronteira de imports e lida dos especificadores `from ...`, nao de substrato solto:
 * o cabecalho deste dominio explica em prosa o que nao importa (mammoth, supabase), e um
 * scan ingenuo de texto condenaria a propria documentacao.
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { sha256Hex } from "../catalog-digest";
import { sha256Hex as sha256ViaValidador } from "../source-validator.service";

const ABC_SHA256 = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const QUOTE = String.fromCharCode(34);

function codigoDe(arquivo: string): string {
  return readFileSync(arquivo, "utf8");
}

function importSources(codigo: string): string[] {
  const out: string[] = [];
  for (const linha of codigo.split("\n")) {
    if (!linha.startsWith("import ")) continue;
    const marker = linha.lastIndexOf("from ");
    if (marker === -1) continue;
    out.push(linha.slice(marker + 5).split(QUOTE).join("").replace(";", "").trim());
  }
  return out;
}

describe("sha256Hex", () => {
  it("bate o vetor conhecido do FIPS 180-4", () => {
    expect(sha256Hex("abc")).toBe(ABC_SHA256);
  });

  it("devolve sempre 64 hex em minusculo", () => {
    const hex = sha256Hex("edital de concurso publico");
    expect(hex).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hex)).toBe(true);
  });

  it("ve string e Uint8Array como os mesmos bytes UTF-8", () => {
    const texto = "Lingua Portuguesa: semantica e pontuacao";
    const bytes = new TextEncoder().encode(texto);
    expect(sha256Hex(bytes)).toBe(sha256Hex(texto));
  });

  it("e deterministico e separa entradas diferentes", () => {
    expect(sha256Hex("mesma entrada")).toBe(sha256Hex("mesma entrada"));
    expect(sha256Hex("edital a")).not.toBe(sha256Hex("edital b"));
  });

  it("o validador da FASE 4 re-exporta exatamente a mesma funcao", () => {
    expect(sha256ViaValidador).toBe(sha256Hex);
    expect(sha256ViaValidador("abc")).toBe(ABC_SHA256);
  });

  it("catalog-digest.ts depende de server-only e node:crypto e nada alem", () => {
    const codigo = codigoDe("src/lib/catalog/services/catalog-digest.ts");
    expect(importSources(codigo)).toEqual(["node:crypto"]);
    expect(codigo.indexOf("server-only")).not.toBe(-1);
  });

  it("catalog-digest.ts nao convida fs, ambiente, relogio, rede ou banco", () => {
    const codigo = codigoDe("src/lib/catalog/services/catalog-digest.ts");
    for (const proibido of ["@/db", "drizzle", "fetch(", "process.env", "node:fs", "readFileSync", "Date.now", "Buffer.from"]) {
      expect([proibido, codigo.includes(proibido)]).toEqual([proibido, false]);
    }
  });
});