import { describe, it, expect } from "vitest";
import { QuestionValidationService } from "../question-validation.service";
import type { GeneratedQuestionInput } from "../../generation/question-generation.provider";

function baseQuestion(): GeneratedQuestionInput {
  return {
    enunciado: "Qual é a capital do Brasil?",
    alternativas: ["Brasília", "Rio de Janeiro", "São Paulo", "Salvador", "Belo Horizonte"],
    gabarito: "A",
    explicacao: "Brasília é a capital federal, conforme a Constituição.",
    dificuldade: "facil",
    topico: "Geografia",
  };
}

describe("QuestionValidationService", () => {
  it("valida uma questão bem formada", () => {
    const result = QuestionValidationService.validate(baseQuestion());
    expect(result.valid).toBe(true);
    expect(result.score).toBe(1);
    expect(result.issues).toHaveLength(0);
  });

  it("rejeita questão com menos de 5 alternativas", () => {
    const q = { ...baseQuestion(), alternativas: ["A", "B", "C"] };
    const result = QuestionValidationService.validate(q);
    expect(result.valid).toBe(false);
    expect(result.issues.some((i) => i.rule === "EXACTLY_5_ALTERNATIVES")).toBe(true);
  });

  it("rejeita gabarito inválido", () => {
    const q = { ...baseQuestion(), gabarito: "F" };
    const result = QuestionValidationService.validate(q);
    expect(result.issues.some((i) => i.rule === "VALID_GABARITO")).toBe(true);
  });

  it("rejeita enunciado vazio", () => {
    const q = { ...baseQuestion(), enunciado: "" };
    const result = QuestionValidationService.validate(q);
    expect(result.issues.some((i) => i.rule === "NON_EMPTY_STATEMENT")).toBe(true);
  });

  it("rejeita explicação ausente", () => {
    const q = { ...baseQuestion(), explicacao: "" };
    const result = QuestionValidationService.validate(q);
    expect(result.issues.some((i) => i.rule === "EXPLANATION_REQUIRED")).toBe(true);
  });

  it("rejeita dificuldade inválida", () => {
    const q = { ...baseQuestion(), dificuldade: "impossivel" };
    const result = QuestionValidationService.validate(q);
    expect(result.issues.some((i) => i.rule === "VALID_DIFFICULTY")).toBe(true);
  });

  it("rejeita alternativas duplicadas", () => {
    const q = {
      ...baseQuestion(),
      alternativas: ["X", "X", "Y", "Z", "W"],
    };
    const result = QuestionValidationService.validate(q);
    expect(result.issues.some((i) => i.rule === "NO_CONTRADICTION")).toBe(true);
  });

  it("detecta duplicidade pelo enunciado normalizado", () => {
    const q = baseQuestion();
    const seen = new Set(["qual é a capital do brasil"]);
    const result = QuestionValidationService.validate(q, { existingEnunciados: seen });
    expect(result.issues.some((i) => i.rule === "NOT_DUPLICATED")).toBe(true);
  });

  it("detecta falta de relação com o conteúdo", () => {
    const q = baseQuestion();
    const result = QuestionValidationService.validate(q, {
      context: "direito constitucional artigos e princípios fundamentais",
    });
    expect(result.issues.some((i) => i.rule === "RELATED_TO_CONTENT")).toBe(true);
  });

  it("calcula score parcial proporcional aos problemas", () => {
    const q = { ...baseQuestion(), gabarito: "F", dificuldade: "x" };
    const result = QuestionValidationService.validate(q);
    expect(result.valid).toBe(false);
    expect(result.score).toBeLessThan(1);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
