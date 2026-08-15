import { describe, it, expect } from "vitest";
import { buildQuestionGenerationPrompt } from "../question-generation.provider";

describe("buildQuestionGenerationPrompt", () => {
  it("inclui matéria, documento e conteúdo-fonte", () => {
    const prompt = buildQuestionGenerationPrompt({
      documentTitle: "Apostila de Português",
      subjectName: "Português",
      quantity: 5,
      nivel: "medio",
      context: "Sintaxe do período.",
    });
    expect(prompt).toContain("Matéria: Português");
    expect(prompt).toContain("Documento: Apostila de Português");
    expect(prompt).toContain("Sintaxe do período.");
    expect(prompt).toContain("Dificuldade alvo: medio");
  });

  it("inclui o peso do edital quando informado", () => {
    const prompt = buildQuestionGenerationPrompt({
      documentTitle: "Apostila",
      subjectName: "Direito Constitucional",
      quantity: 3,
      editalWeight: 30,
      context: "art. 1º",
    });
    expect(prompt).toContain("Peso desta matéria no edital: 30%");
  });

  it("não menciona peso quando ausente", () => {
    const prompt = buildQuestionGenerationPrompt({
      documentTitle: "Apostila",
      subjectName: "Português",
      quantity: 2,
      context: "texto",
    });
    expect(prompt).not.toContain("Peso desta matéria no edital");
  });

  it("inclui tema em foco quando informado", () => {
    const prompt = buildQuestionGenerationPrompt({
      documentTitle: "Apostila",
      subjectName: "Português",
      quantity: 2,
      focusTopic: "Concordância Verbal",
      context: "texto",
    });
    expect(prompt).toContain("Tema em foco (priorize questões sobre): Concordância Verbal");
  });
});
