import { describe, it, expect } from "vitest";
import { computeFrequency } from "../topic-frequency.service";

describe("TopicFrequencyService — Cálculo de Frequência Histórica por Tópico", () => {
  describe("1. Fórmula e Percentual", () => {
    it("calcula corretamente 30% para 3 questões de tópico em 10 questões da banca", () => {
      const pct = computeFrequency(10, 3);
      expect(pct).toBe(30);
    });

    it("calcula corretamente valores com casas decimais (ex.: 1 em 3 = 33.33%)", () => {
      const pct = computeFrequency(3, 1);
      expect(pct).toBe(33.33);
    });

    it("calcula 100% quando todas as questões pertencem ao tópico", () => {
      const pct = computeFrequency(5, 5);
      expect(pct).toBe(100);
    });
  });

  describe("2. Dados Insuficientes e Casos Limite", () => {
    it("retorna 0% quando o denominador for zero (sem questões no recorte)", () => {
      const pct = computeFrequency(0, 0);
      expect(pct).toBe(0);
      expect(Number.isNaN(pct)).toBe(false);
      expect(Number.isFinite(pct)).toBe(true);
    });

    it("retorna 0% quando o tópico não tiver questões (0 de 15)", () => {
      const pct = computeFrequency(15, 0);
      expect(pct).toBe(0);
    });

    it("nunca produz NaN ou Infinity para entradas inválidas ou negativas", () => {
      expect(computeFrequency(-10, 5)).toBe(0);
      expect(computeFrequency(10, -5)).toBe(0);
      expect(computeFrequency(0, 10)).toBe(0);
      expect(computeFrequency(NaN, 5)).toBe(0);
      expect(computeFrequency(10, NaN)).toBe(0);
    });
  });

  describe("3. Simulação de Recortes de Banco (Banca, Disciplina e Combinações)", () => {
    // Simulação do dataset de questões
    interface MockQuestion {
      id: string;
      subjectId: string;
      topicId: string | null;
      banca: string | null;
    }

    const MOCK_QUESTIONS: MockQuestion[] = [
      // Português (FGV) - 10 questões, 3 de Crase (topic-1), 2 de Concordância (topic-2), 5 sem tópico
      { id: "q1", subjectId: "sub-portugues", topicId: "topic-crase", banca: "FGV" },
      { id: "q2", subjectId: "sub-portugues", topicId: "topic-crase", banca: "FGV" },
      { id: "q3", subjectId: "sub-portugues", topicId: "topic-crase", banca: "FGV" },
      { id: "q4", subjectId: "sub-portugues", topicId: "topic-concordancia", banca: "FGV" },
      { id: "q5", subjectId: "sub-portugues", topicId: "topic-concordancia", banca: "FGV" },
      { id: "q6", subjectId: "sub-portugues", topicId: null, banca: "FGV" },
      { id: "q7", subjectId: "sub-portugues", topicId: null, banca: "FGV" },
      { id: "q8", subjectId: "sub-portugues", topicId: null, banca: "FGV" },
      { id: "q9", subjectId: "sub-portugues", topicId: null, banca: "FGV" },
      { id: "q10", subjectId: "sub-portugues", topicId: null, banca: "FGV" },

      // Português (CESPE) - 5 questões, 1 de Crase (topic-1)
      { id: "q11", subjectId: "sub-portugues", topicId: "topic-crase", banca: "CESPE" },
      { id: "q12", subjectId: "sub-portugues", topicId: null, banca: "CESPE" },
      { id: "q13", subjectId: "sub-portugues", topicId: null, banca: "CESPE" },
      { id: "q14", subjectId: "sub-portugues", topicId: null, banca: "CESPE" },
      { id: "q15", subjectId: "sub-portugues", topicId: null, banca: "CESPE" },

      // Direito (FGV) - 8 questões, 4 de Atos (topic-3)
      { id: "q16", subjectId: "sub-direito", topicId: "topic-atos", banca: "FGV" },
      { id: "q17", subjectId: "sub-direito", topicId: "topic-atos", banca: "FGV" },
      { id: "q18", subjectId: "sub-direito", topicId: "topic-atos", banca: "FGV" },
      { id: "q19", subjectId: "sub-direito", topicId: "topic-atos", banca: "FGV" },
      { id: "q20", subjectId: "sub-direito", topicId: null, banca: "FGV" },
      { id: "q21", subjectId: "sub-direito", topicId: null, banca: "FGV" },
      { id: "q22", subjectId: "sub-direito", topicId: null, banca: "FGV" },
      { id: "q23", subjectId: "sub-direito", topicId: null, banca: "FGV" },
    ];

    function calculateMockFrequency(filter: { subjectId: string; topicId: string; banca?: string }) {
      const cutout = MOCK_QUESTIONS.filter(
        (q) =>
          q.subjectId === filter.subjectId &&
          (!filter.banca || q.banca === filter.banca)
      );
      const totalCutout = cutout.length;
      const topicCount = cutout.filter((q) => q.topicId === filter.topicId).length;
      return {
        total: totalCutout,
        topicQuestions: topicCount,
        percent: computeFrequency(totalCutout, topicCount),
      };
    }

    it("calcula frequência com filtro exclusivo por disciplina (sem banca)", () => {
      // Português geral: 15 questões no total (10 FGV + 5 CESPE), Crase tem 4 (3 FGV + 1 CESPE)
      // 4 / 15 = 26.67%
      const res = calculateMockFrequency({
        subjectId: "sub-portugues",
        topicId: "topic-crase",
      });
      expect(res.total).toBe(15);
      expect(res.topicQuestions).toBe(4);
      expect(res.percent).toBe(26.67);
    });

    it("calcula frequência combinando banca e disciplina (FGV + Português)", () => {
      // Português FGV: 10 questões, Crase tem 3 -> 30%
      const res = calculateMockFrequency({
        subjectId: "sub-portugues",
        topicId: "topic-crase",
        banca: "FGV",
      });
      expect(res.total).toBe(10);
      expect(res.topicQuestions).toBe(3);
      expect(res.percent).toBe(30);
    });

    it("calcula frequência combinando outra banca e disciplina (CESPE + Português)", () => {
      // Português CESPE: 5 questões, Crase tem 1 -> 20%
      const res = calculateMockFrequency({
        subjectId: "sub-portugues",
        topicId: "topic-crase",
        banca: "CESPE",
      });
      expect(res.total).toBe(5);
      expect(res.topicQuestions).toBe(1);
      expect(res.percent).toBe(20);
    });

    it("retorna 0% e total 0 quando não houver questões no recorte daquela banca", () => {
      // Português VUNESP: 0 questões
      const res = calculateMockFrequency({
        subjectId: "sub-portugues",
        topicId: "topic-crase",
        banca: "VUNESP",
      });
      expect(res.total).toBe(0);
      expect(res.topicQuestions).toBe(0);
      expect(res.percent).toBe(0);
    });
  });
});
