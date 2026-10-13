/**
 * Testes do reconhecedor de fixtura de teste.
 *
 * O que está em jogo: a tela de questões do aluno não pode listar linha escrita
 * por teste, mas também não pode engolir questão real cujo enunciado apenas
 * começa com "E2E…". As duas direções são travadas aqui.
 */
import { describe, it, expect } from "vitest";

import {
  ehEnunciadoDeFixtura,
  ehMateriaDeFixtura,
  ehNomeDeFixtura,
  ehSlugDeFixtura,
} from "../fixturas-de-teste";

describe("fixturas de teste no acervo", () => {
  it("reconhece as linhas que a suíte de integração publica", () => {
    expect(ehEnunciadoDeFixtura("E2E 58f07a7b")).toBe(true);
    expect(ehEnunciadoDeFixtura("Qual é a pergunta?")).toBe(true);
    expect(ehEnunciadoDeFixtura("P?")).toBe(true);
    expect(ehNomeDeFixtura("E2E a1b2c3d4")).toBe(true);
    expect(ehNomeDeFixtura("Matéria deadbeef")).toBe(true);
    expect(ehSlugDeFixtura("e2e-a1b2c3d4")).toBe(true);
    expect(ehSlugDeFixtura("materia-deadbeef")).toBe(true);
    expect(ehMateriaDeFixtura({ name: "Português", slug: "e2e-a1b2c3d4" })).toBe(true);
  });

  it("não confunde catálogo real com linha de teste", () => {
    expect(
      ehEnunciadoDeFixtura(
        "Identificam-se no vocábulo “lexicais” oito letras e oito fonemas."
      )
    ).toBe(false);
    expect(ehEnunciadoDeFixtura("E2E é a disciplina de Energia e Enduro?")).toBe(true); // prefixo manda
    expect(ehNomeDeFixtura("Matemática")).toBe(false);
    expect(ehNomeDeFixtura("Português")).toBe(false);
    expect(ehNomeDeFixtura("Elétrica")).toBe(false);
    expect(ehSlugDeFixtura("portugues")).toBe(false);
    // Slug legítimo mais longo que o sufixo de hex não vira fixtura.
    expect(ehSlugDeFixtura("direito-constitucional")).toBe(false);
    expect(ehMateriaDeFixtura({ name: "Informática", slug: "informatica" })).toBe(false);
  });

  it("ausência de metadado não é fixtura", () => {
    expect(ehEnunciadoDeFixtura(null)).toBe(false);
    expect(ehEnunciadoDeFixtura(undefined)).toBe(false);
    expect(ehNomeDeFixtura("")).toBe(false);
    expect(ehSlugDeFixtura(null)).toBe(false);
    expect(ehMateriaDeFixtura({})).toBe(false);
  });
});
