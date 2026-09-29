/**
 * ConcursoAI — Testes Unitários de Desempenho por Tópico (FASE 6D)
 *
 * Cobertura:
 * A. Desempenho por tópico:
 *    - sem tentativas (null accuracy, no_data, null dates)
 *    - somente corretas (100% acerto)
 *    - somente incorretas (0% acerto)
 *    - mistura de corretas e incorretas
 *    - cálculo de tendência (up, down, stable, no_data)
 *    - última tentativa e daysSinceLastAttempt
 * B. Isolamento por usuário e tratamento de denominador zero
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeTopicPerformanceInMemory,
  TopicPerformanceService,
} from "../topic-performance.service";

describe("TopicPerformanceService — Desempenho por Tópico", () => {
  const NOW = new Date("2026-09-29T12:00:00Z");

  describe("A. Cálculo em Memória (computeTopicPerformanceInMemory)", () => {
    it("retorna estado seguro quando não há tentativas (sem inventar dados)", () => {
      const result = computeTopicPerformanceInMemory({
        topicId: "topic-1",
        topicName: "Crase",
        subjectId: "subj-1",
        subjectName: "Português",
        totalQuestions: 15,
        attempts: [],
        now: NOW,
      });

      expect(result.attemptedQuestions).toBe(0);
      expect(result.correctAnswers).toBe(0);
      expect(result.incorrectAnswers).toBe(0);
      expect(result.accuracyPct).toBeNull();
      expect(result.lastAttemptAt).toBeNull();
      expect(result.daysSinceLastAttempt).toBeNull();
      expect(result.trend).toBe("no_data");
      expect(result.totalQuestions).toBe(15);
    });

    it("calcula 100% de acerto quando todas as tentativas forem corretas", () => {
      const attempts = [
        { isCorrect: true, createdAt: new Date("2026-09-27T10:00:00Z") },
        { isCorrect: true, createdAt: new Date("2026-09-28T10:00:00Z") },
      ];

      const result = computeTopicPerformanceInMemory({
        topicId: "topic-1",
        topicName: "Crase",
        subjectId: "subj-1",
        subjectName: "Português",
        totalQuestions: 10,
        attempts,
        now: NOW,
      });

      expect(result.attemptedQuestions).toBe(2);
      expect(result.correctAnswers).toBe(2);
      expect(result.incorrectAnswers).toBe(0);
      expect(result.accuracyPct).toBe(100);
      expect(result.daysSinceLastAttempt).toBe(1); // de 28 para 29 = 1 dia
      expect(result.trend).toBe("stable");
    });

    it("calcula 0% de acerto quando todas as tentativas forem incorretas", () => {
      const attempts = [
        { isCorrect: false, createdAt: new Date("2026-09-25T12:00:00Z") },
        { isCorrect: false, createdAt: new Date("2026-09-26T12:00:00Z") },
      ];

      const result = computeTopicPerformanceInMemory({
        topicId: "topic-2",
        topicName: "Pontuação",
        subjectId: "subj-1",
        subjectName: "Português",
        totalQuestions: 8,
        attempts,
        now: NOW,
      });

      expect(result.attemptedQuestions).toBe(2);
      expect(result.correctAnswers).toBe(0);
      expect(result.incorrectAnswers).toBe(2);
      expect(result.accuracyPct).toBe(0);
      expect(result.daysSinceLastAttempt).toBe(3); // 26 para 29 = 3 dias
      expect(result.trend).toBe("stable");
    });

    it("calcula percentual com precisão para misturas de acertos e erros", () => {
      const attempts = [
        { isCorrect: true, createdAt: new Date("2026-09-20T10:00:00Z") },
        { isCorrect: false, createdAt: new Date("2026-09-21T10:00:00Z") },
        { isCorrect: true, createdAt: new Date("2026-09-22T10:00:00Z") },
      ];

      const result = computeTopicPerformanceInMemory({
        topicId: "topic-3",
        topicName: "Concordância",
        subjectId: "subj-1",
        subjectName: "Português",
        totalQuestions: 20,
        attempts,
        now: NOW,
      });

      expect(result.attemptedQuestions).toBe(3);
      expect(result.correctAnswers).toBe(2);
      expect(result.incorrectAnswers).toBe(1);
      // 2 / 3 = 66.666...% -> arredondado para 66.7%
      expect(result.accuracyPct).toBe(66.7);
    });

    it("detecta tendência 'up' quando tentativas recentes superam as antigas em > 5%", () => {
      // 4 tentativas: 2 antigas (0% acerto), 2 recentes (100% acerto)
      const attempts = [
        { isCorrect: false, createdAt: new Date("2026-09-10T10:00:00Z") },
        { isCorrect: false, createdAt: new Date("2026-09-11T10:00:00Z") },
        { isCorrect: true, createdAt: new Date("2026-09-25T10:00:00Z") },
        { isCorrect: true, createdAt: new Date("2026-09-26T10:00:00Z") },
      ];

      const result = computeTopicPerformanceInMemory({
        topicId: "topic-4",
        topicName: "Atos",
        subjectId: "subj-2",
        subjectName: "Direito",
        totalQuestions: 30,
        attempts,
        now: NOW,
      });

      expect(result.trend).toBe("up");
    });

    it("detecta tendência 'down' quando desempenho recente cai em > 5%", () => {
      // 4 tentativas: 2 antigas (100% acerto), 2 recentes (0% acerto)
      const attempts = [
        { isCorrect: true, createdAt: new Date("2026-09-10T10:00:00Z") },
        { isCorrect: true, createdAt: new Date("2026-09-11T10:00:00Z") },
        { isCorrect: false, createdAt: new Date("2026-09-25T10:00:00Z") },
        { isCorrect: false, createdAt: new Date("2026-09-26T10:00:00Z") },
      ];

      const result = computeTopicPerformanceInMemory({
        topicId: "topic-4",
        topicName: "Atos",
        subjectId: "subj-2",
        subjectName: "Direito",
        totalQuestions: 30,
        attempts,
        now: NOW,
      });

      expect(result.trend).toBe("down");
    });

    it("retorna 'stable' para menos de 2 tentativas ou variação inferior a 5%", () => {
      const attemptsSingle = [
        { isCorrect: true, createdAt: new Date("2026-09-28T10:00:00Z") },
      ];
      const resSingle = computeTopicPerformanceInMemory({
        topicId: "topic-5",
        topicName: "Controle",
        subjectId: "subj-2",
        subjectName: "Direito",
        totalQuestions: 5,
        attempts: attemptsSingle,
        now: NOW,
      });
      expect(resSingle.trend).toBe("stable");

      const attemptsSmallDiff = [
        { isCorrect: true, createdAt: new Date("2026-09-10T10:00:00Z") },
        { isCorrect: true, createdAt: new Date("2026-09-25T10:00:00Z") },
      ];
      const resSmall = computeTopicPerformanceInMemory({
        topicId: "topic-5",
        topicName: "Controle",
        subjectId: "subj-2",
        subjectName: "Direito",
        totalQuestions: 5,
        attempts: attemptsSmallDiff,
        now: NOW,
      });
      expect(resSmall.trend).toBe("stable");
    });
  });

  describe("B. Consulta em Lote (TopicPerformanceService)", () => {
    it("retorna lista vazia imediatamente quando a lista de tópicos for vazia", async () => {
      const res = await TopicPerformanceService.getStudentTopicPerformance("user-1", []);
      expect(res).toEqual([]);
    });
  });
});
