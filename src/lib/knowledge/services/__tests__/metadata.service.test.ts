/**
 * Testes unitários do MetadataService — extração de referências legais.
 */
import { describe, it, expect } from "vitest";
import { extractLegalReferences } from "../metadata.helpers";

describe("extractLegalReferences", () => {
  it("detecta Art. 5º da CF/88", () => {
    const text = "Conforme o Art. 5º da CF/88, todos são iguais perante a lei.";
    const refs = extractLegalReferences(text);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].law).toBe("Constituição Federal");
  });

  it("detecta Lei nº 8.112/90", () => {
    const text = "A Lei nº 8.112/90 dispõe sobre o regime jurídico dos servidores.";
    const refs = extractLegalReferences(text);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].law).toBe("Lei");
  });

  it("detecta Súmula Vinculante 10 do STF", () => {
    const text = "Conforme a Súmula Vinculante 10 do STF.";
    const refs = extractLegalReferences(text);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].law).toBe("Súmula");
  });

  it("detecta Decreto", () => {
    const text = "O Decreto nº 10.000/2019 regulamenta a matéria.";
    const refs = extractLegalReferences(text);
    expect(refs.length).toBeGreaterThan(0);
    expect(refs[0].law).toBe("Decreto");
  });

  it("retorna vazio para texto sem referências legais", () => {
    const text = "O estudo é importante para concursos públicos.";
    const refs = extractLegalReferences(text);
    expect(refs.length).toBe(0);
  });

  it("limita a 20 referências", () => {
    const text = "Art. 1º da CF/88. ".repeat(30);
    const refs = extractLegalReferences(text);
    expect(refs.length).toBeLessThanOrEqual(20);
  });
});
