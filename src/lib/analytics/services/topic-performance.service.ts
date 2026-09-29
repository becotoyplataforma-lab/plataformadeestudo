/**
 * ConcursoAI — TopicPerformanceService (Analytics)
 *
 * Agregação determinística do desempenho do aluno por tópico de conhecimento
 * com base no histórico real de tentativas (question_attempts × questions.knowledge_topic_id).
 *
 * Regras:
 * - Sem tentativas -> accuracyPct = null, lastAttemptAt = null, daysSinceLastAttempt = null, trend = "no_data"
 * - Nunca inventa tentativas nem divide por zero (sem NaN / sem Infinity)
 * - Filtrado estritamente por userId para isolamento de dados
 */
import "server-only";
import { and, count, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { questions, questionAttempts } from "@/db/schema/study";

export interface TopicPerformanceResult {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracyPct: number | null;
  lastAttemptAt: Date | null;
  daysSinceLastAttempt: number | null;
  trend: "up" | "down" | "stable" | "no_data";
}

export interface TopicCandidateInput {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
}

/**
 * Função pura para calcular o desempenho de um tópico a partir de suas tentativas.
 */
export function computeTopicPerformanceInMemory(input: {
  topicId: string;
  topicName: string;
  subjectId: string;
  subjectName: string;
  totalQuestions: number;
  attempts: Array<{ isCorrect: boolean; createdAt: Date }>;
  now?: Date;
}): TopicPerformanceResult {
  const { topicId, topicName, subjectId, subjectName, totalQuestions, attempts, now = new Date() } =
    input;

  const attemptedQuestions = attempts.length;

  if (attemptedQuestions === 0) {
    return {
      topicId,
      topicName,
      subjectId,
      subjectName,
      totalQuestions: Math.max(0, totalQuestions),
      attemptedQuestions: 0,
      correctAnswers: 0,
      incorrectAnswers: 0,
      accuracyPct: null,
      lastAttemptAt: null,
      daysSinceLastAttempt: null,
      trend: "no_data",
    };
  }

  // Ordena cronologicamente
  const sorted = [...attempts].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const correctAnswers = sorted.filter((a) => a.isCorrect).length;
  const incorrectAnswers = attemptedQuestions - correctAnswers;
  const rawAcc = (correctAnswers / attemptedQuestions) * 100;
  const accuracyPct = Math.round(rawAcc * 10) / 10;

  const lastAttemptAt = sorted[sorted.length - 1]!.createdAt;
  const diffMs = now.getTime() - lastAttemptAt.getTime();
  const daysSinceLastAttempt = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));

  // Tendência com dados suficientes
  let trend: "up" | "down" | "stable" | "no_data" = "stable";
  if (attemptedQuestions < 2) {
    trend = "stable";
  } else {
    const mid = Math.floor(attemptedQuestions / 2);
    const olderAttempts = sorted.slice(0, mid);
    const recentAttempts = sorted.slice(mid);

    const olderCorrect = olderAttempts.filter((a) => a.isCorrect).length;
    const recentCorrect = recentAttempts.filter((a) => a.isCorrect).length;

    const olderAcc = (olderCorrect / olderAttempts.length) * 100;
    const recentAcc = (recentCorrect / recentAttempts.length) * 100;

    if (recentAcc > olderAcc + 5) {
      trend = "up";
    } else if (recentAcc < olderAcc - 5) {
      trend = "down";
    } else {
      trend = "stable";
    }
  }

  return {
    topicId,
    topicName,
    subjectId,
    subjectName,
    totalQuestions: Math.max(0, totalQuestions),
    attemptedQuestions,
    correctAnswers,
    incorrectAnswers,
    accuracyPct,
    lastAttemptAt,
    daysSinceLastAttempt,
    trend,
  };
}

export const TopicPerformanceService = {
  /**
   * Obtém desempenho agregado do aluno em lote para uma lista de tópicos.
   * Evita consultas N+1 executando agregações em grupo.
   */
  async getStudentTopicPerformance(
    userId: string,
    topicList: TopicCandidateInput[],
    now: Date = new Date()
  ): Promise<TopicPerformanceResult[]> {
    if (!topicList || topicList.length === 0) return [];

    const topicIds = topicList.map((t) => t.topicId).filter(Boolean);
    if (topicIds.length === 0) {
      return topicList.map((t) =>
        computeTopicPerformanceInMemory({
          topicId: t.topicId,
          topicName: t.topicName,
          subjectId: t.subjectId,
          subjectName: t.subjectName,
          totalQuestions: 0,
          attempts: [],
          now,
        })
      );
    }

    // 1. Contagem de questões do catálogo por tópico (denominador do catálogo)
    const catalogCounts = await db
      .select({
        topicId: questions.knowledgeTopicId,
        count: count(questions.id),
      })
      .from(questions)
      .where(
        and(
          inArray(questions.knowledgeTopicId, topicIds),
          eq(questions.isPublic, true),
          eq(questions.status, "publicada"),
          isNull(questions.deletedAt)
        )
      )
      .groupBy(questions.knowledgeTopicId);

    const catalogMap = new Map<string, number>(
      catalogCounts.map((c) => [c.topicId!, Number(c.count)])
    );

    // 2. Tentativas do usuário nas questões vinculadas aos tópicos
    const attempts = await db
      .select({
        topicId: questions.knowledgeTopicId,
        isCorrect: questionAttempts.isCorrect,
        createdAt: questionAttempts.createdAt,
      })
      .from(questionAttempts)
      .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
      .where(
        and(
          eq(questionAttempts.userId, userId),
          inArray(questions.knowledgeTopicId, topicIds)
        )
      );

    const attemptsMap = new Map<string, Array<{ isCorrect: boolean; createdAt: Date }>>();
    for (const a of attempts) {
      if (!a.topicId) continue;
      const list = attemptsMap.get(a.topicId) ?? [];
      list.push({ isCorrect: a.isCorrect, createdAt: a.createdAt });
      attemptsMap.set(a.topicId, list);
    }

    // 3. Montagem dos resultados determinísticos
    return topicList.map((candidate) => {
      const topicAttempts = attemptsMap.get(candidate.topicId) ?? [];
      const totalQ = catalogMap.get(candidate.topicId) ?? 0;

      return computeTopicPerformanceInMemory({
        topicId: candidate.topicId,
        topicName: candidate.topicName,
        subjectId: candidate.subjectId,
        subjectName: candidate.subjectName,
        totalQuestions: totalQ,
        attempts: topicAttempts,
        now,
      });
    });
  },
};
