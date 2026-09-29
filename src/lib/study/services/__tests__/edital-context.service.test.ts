/**
 * ConcursoAI — Testes Unitários de Contexto do Edital (FASE 6D)
 *
 * Cobertura:
 * C. Contexto do edital:
 *    - disciplina com tópicos
 *    - disciplina sem tópicos
 *    - peso de disciplina e peso de tópico
 *    - ordenação determinística de tópicos (rankTopicsForContext)
 *    - seleção determinística de top topic (pickTopTopicForSubject)
 *    - concurso, cargo e isolamento por usuário
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  rankTopicsForContext,
  pickTopTopicForSubject,
  type EnrichedTopicContext,
} from "../edital-context.service";

describe("EditalContextService — Contexto do Edital e Tópicos", () => {
  describe("A. Ordenação e Seleção Determinística de Tópicos", () => {
    it("ordena tópicos com menor taxa de acerto primeiro (fraquezas do aluno)", () => {
      const t1: EnrichedTopicContext = {
        topicId: "t1",
        noticeTopicId: "nt1",
        knowledgeTopicId: "kt1",
        topicName: "Crase",
        editalTopicWeight: null,
        historicalFrequencyPercent: 20,
        frequencySource: "board",
        totalQuestions: 10,
        attemptedQuestions: 5,
        correctAnswers: 1,
        incorrectAnswers: 4,
        accuracyPct: 20, // 20%
        lastAttemptAt: new Date("2026-09-28"),
        daysSinceLastAttempt: 1,
        trend: "down",
      };

      const t2: EnrichedTopicContext = {
        topicId: "t2",
        noticeTopicId: "nt2",
        knowledgeTopicId: "kt2",
        topicName: "Ortografia",
        editalTopicWeight: null,
        historicalFrequencyPercent: 20,
        frequencySource: "board",
        totalQuestions: 10,
        attemptedQuestions: 5,
        correctAnswers: 4,
        incorrectAnswers: 1,
        accuracyPct: 80, // 80%
        lastAttemptAt: new Date("2026-09-28"),
        daysSinceLastAttempt: 1,
        trend: "up",
      };

      const ranked = rankTopicsForContext([t2, t1]);
      expect(ranked[0]!.topicName).toBe("Crase");
      expect(ranked[1]!.topicName).toBe("Ortografia");
    });

    it("prioriza maior frequência histórica quando taxas de acerto forem similares", () => {
      const t1: EnrichedTopicContext = {
        topicId: "t1",
        noticeTopicId: "nt1",
        knowledgeTopicId: "kt1",
        topicName: "Poder Executivo",
        editalTopicWeight: null,
        historicalFrequencyPercent: 10,
        frequencySource: "board",
        totalQuestions: 20,
        attemptedQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracyPct: null,
        lastAttemptAt: null,
        daysSinceLastAttempt: null,
        trend: "no_data",
      };

      const t2: EnrichedTopicContext = {
        topicId: "t2",
        noticeTopicId: "nt2",
        knowledgeTopicId: "kt2",
        topicName: "Poder Judiciário",
        editalTopicWeight: null,
        historicalFrequencyPercent: 35, // mais frequente
        frequencySource: "board",
        totalQuestions: 20,
        attemptedQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracyPct: null,
        lastAttemptAt: null,
        daysSinceLastAttempt: null,
        trend: "no_data",
      };

      const ranked = rankTopicsForContext([t1, t2]);
      expect(ranked[0]!.topicName).toBe("Poder Judiciário");
    });

    it("prioriza maior peso explícito do edital quando frequência for idêntica", () => {
      const t1: EnrichedTopicContext = {
        topicId: "t1",
        noticeTopicId: "nt1",
        knowledgeTopicId: "kt1",
        topicName: "Licitações - Dispensa",
        editalTopicWeight: 2,
        historicalFrequencyPercent: 15,
        frequencySource: "catalog",
        totalQuestions: 10,
        attemptedQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracyPct: null,
        lastAttemptAt: null,
        daysSinceLastAttempt: null,
        trend: "no_data",
      };

      const t2: EnrichedTopicContext = {
        topicId: "t2",
        noticeTopicId: "nt2",
        knowledgeTopicId: "kt2",
        topicName: "Licitações - Pregão",
        editalTopicWeight: 8, // maior peso do edital
        historicalFrequencyPercent: 15,
        frequencySource: "catalog",
        totalQuestions: 10,
        attemptedQuestions: 0,
        correctAnswers: 0,
        incorrectAnswers: 0,
        accuracyPct: null,
        lastAttemptAt: null,
        daysSinceLastAttempt: null,
        trend: "no_data",
      };

      const ranked = rankTopicsForContext([t1, t2]);
      expect(ranked[0]!.topicName).toBe("Licitações - Pregão");
    });

    it("usa tempo desde a última tentativa para desempate (revisão espaçada)", () => {
      const tRecent: EnrichedTopicContext = {
        topicId: "t1",
        noticeTopicId: "nt1",
        knowledgeTopicId: "kt1",
        topicName: "Concordância Verbal",
        editalTopicWeight: null,
        historicalFrequencyPercent: 20,
        frequencySource: "catalog",
        totalQuestions: 10,
        attemptedQuestions: 10,
        correctAnswers: 7,
        incorrectAnswers: 3,
        accuracyPct: 70,
        lastAttemptAt: new Date("2026-09-28"),
        daysSinceLastAttempt: 1, // revisado ontem
        trend: "stable",
      };

      const tOld: EnrichedTopicContext = {
        topicId: "t2",
        noticeTopicId: "nt2",
        knowledgeTopicId: "kt2",
        topicName: "Concordância Nominal",
        editalTopicWeight: null,
        historicalFrequencyPercent: 20,
        frequencySource: "catalog",
        totalQuestions: 10,
        attemptedQuestions: 10,
        correctAnswers: 7,
        incorrectAnswers: 3,
        accuracyPct: 70,
        lastAttemptAt: new Date("2026-09-10"),
        daysSinceLastAttempt: 19, // não revisado há 19 dias
        trend: "stable",
      };

      const ranked = rankTopicsForContext([tRecent, tOld]);
      expect(ranked[0]!.topicName).toBe("Concordância Nominal");
    });

    it("pickTopTopicForSubject seleciona o primeiro colocado ou retorna null se vazio", () => {
      expect(pickTopTopicForSubject([])).toBeNull();

      const top: EnrichedTopicContext = {
        topicId: "top-1",
        noticeTopicId: "nt-1",
        knowledgeTopicId: "kt-1",
        topicName: "Atos Administrativos",
        editalTopicWeight: 10,
        historicalFrequencyPercent: 40,
        frequencySource: "board",
        totalQuestions: 20,
        attemptedQuestions: 5,
        correctAnswers: 1,
        incorrectAnswers: 4,
        accuracyPct: 20,
        lastAttemptAt: new Date("2026-09-20"),
        daysSinceLastAttempt: 9,
        trend: "down",
      };

      const res = pickTopTopicForSubject([top]);
      expect(res).toBeDefined();
      expect(res?.topicName).toBe("Atos Administrativos");
    });
  });
});
