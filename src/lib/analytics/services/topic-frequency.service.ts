/**
 * ConcursoAI — TopicFrequencyService
 *
 * Cálculo de frequência histórica de questões por tópico dentro de um
 * recorte específico (banca, disciplina, concurso e/ou cargo).
 *
 * Fórmula:
 *   frequencyPercent = (topicQuestions / totalQuestionsDoRecorte) * 100
 *
 * Tratamento seguro:
 *   - Denominador zero -> frequencyPercent = 0 (nunca NaN ou Infinity)
 *   - Tópico sem questões -> topicQuestions = 0, frequencyPercent = 0
 */
import "server-only";
import { and, count, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { questions } from "@/db/schema/study";
import { knowledgeTopics } from "@/db/schema/knowledge";
import { editais } from "@/db/schema/contest";
import type { SQL } from "drizzle-orm";

export interface TopicFrequencyQuery {
  board?: string | null;
  subjectId: string;
  topicId: string;
  contestId?: string | null;
  cargo?: string | null;
}

export interface TopicFrequencyResult {
  topicId: string | null;
  topicName: string | null;
  totalQuestions: number;
  topicQuestions: number;
  frequencyPercent: number;
}

/**
 * Função pura e segura para cálculo do percentual de frequência.
 * Garante que nunca retorna NaN ou Infinity.
 */
export function computeFrequency(
  totalQuestions: number,
  topicQuestions: number
): number {
  if (!totalQuestions || totalQuestions <= 0 || !topicQuestions || topicQuestions <= 0) {
    return 0;
  }
  const pct = (topicQuestions / totalQuestions) * 100;
  if (!Number.isFinite(pct) || Number.isNaN(pct)) {
    return 0;
  }
  // Arredonda para 2 casas decimais
  return Math.round(pct * 100) / 100;
}

export const TopicFrequencyService = {
  /**
   * Calcula a frequência histórica de um tópico específico dentro de um recorte.
   */
  async getTopicFrequency(
    query: TopicFrequencyQuery
  ): Promise<TopicFrequencyResult> {
    const { board, subjectId, topicId, contestId, cargo } = query;

    // 1. Buscar nome do tópico
    let topicName: string | null = null;
    if (topicId) {
      const [t] = await db
        .select({ name: knowledgeTopics.name })
        .from(knowledgeTopics)
        .where(eq(knowledgeTopics.id, topicId))
        .limit(1);
      topicName = t?.name ?? null;
    }

    // 2. Construir condições do recorte (denominador)
    const baseConditions: SQL[] = [
      eq(questions.knowledgeSubjectId, subjectId),
      eq(questions.isPublic, true),
      eq(questions.status, "publicada"),
      isNull(questions.deletedAt),
    ];

    if (board && board.trim().length > 0) {
      baseConditions.push(eq(questions.banca, board.trim()));
    }

    if (cargo && cargo.trim().length > 0) {
      baseConditions.push(eq(questions.cargo, cargo.trim()));
    }

    if (contestId) {
      // Filtra questões originadas de editais deste concurso
      baseConditions.push(
        inArray(
          questions.sourceEditalId,
          db
            .select({ id: editais.id })
            .from(editais)
            .where(eq(editais.contestId, contestId))
        )
      );
    }

    // 3. Contagem total do recorte (denominador)
    const [totalRow] = await db
      .select({ total: count(questions.id) })
      .from(questions)
      .where(and(...baseConditions));
    const totalQuestions = Number(totalRow?.total ?? 0);

    if (totalQuestions === 0 || !topicId) {
      return {
        topicId: topicId ?? null,
        topicName,
        totalQuestions,
        topicQuestions: 0,
        frequencyPercent: 0,
      };
    }

    // 4. Contagem de questões do tópico no recorte (numerador)
    const [topicRow] = await db
      .select({ total: count(questions.id) })
      .from(questions)
      .where(and(...baseConditions, eq(questions.knowledgeTopicId, topicId)));
    const topicQuestions = Number(topicRow?.total ?? 0);

    const frequencyPercent = computeFrequency(totalQuestions, topicQuestions);

    return {
      topicId,
      topicName,
      totalQuestions,
      topicQuestions,
      frequencyPercent,
    };
  },

  /**
   * Lista frequências de todos os tópicos de uma disciplina para o recorte indicado.
   */
  async listTopicFrequencies(query: {
    board?: string | null;
    subjectId: string;
    contestId?: string | null;
    cargo?: string | null;
  }): Promise<TopicFrequencyResult[]> {
    const { board, subjectId, contestId, cargo } = query;

    // Buscar todos os tópicos ativos da disciplina
    const topics = await db
      .select({
        id: knowledgeTopics.id,
        name: knowledgeTopics.name,
      })
      .from(knowledgeTopics)
      .where(
        and(
          eq(knowledgeTopics.subjectId, subjectId),
          eq(knowledgeTopics.status, "active"),
          isNull(knowledgeTopics.deletedAt)
        )
      )
      .orderBy(knowledgeTopics.name);

    if (topics.length === 0) return [];

    // Condições do recorte
    const baseConditions: SQL[] = [
      eq(questions.knowledgeSubjectId, subjectId),
      eq(questions.isPublic, true),
      eq(questions.status, "publicada"),
      isNull(questions.deletedAt),
    ];

    if (board && board.trim().length > 0) {
      baseConditions.push(eq(questions.banca, board.trim()));
    }
    if (cargo && cargo.trim().length > 0) {
      baseConditions.push(eq(questions.cargo, cargo.trim()));
    }
    if (contestId) {
      baseConditions.push(
        inArray(
          questions.sourceEditalId,
          db
            .select({ id: editais.id })
            .from(editais)
            .where(eq(editais.contestId, contestId))
        )
      );
    }

    // Denominador geral do recorte
    const [totalRow] = await db
      .select({ total: count(questions.id) })
      .from(questions)
      .where(and(...baseConditions));
    const totalQuestions = Number(totalRow?.total ?? 0);

    // Contagem agrupada por knowledge_topic_id
    const grouped = await db
      .select({
        topicId: questions.knowledgeTopicId,
        count: count(questions.id),
      })
      .from(questions)
      .where(and(...baseConditions, isNotNull(questions.knowledgeTopicId)))
      .groupBy(questions.knowledgeTopicId);

    const countByTopic = new Map<string, number>(
      grouped.map((g) => [g.topicId!, Number(g.count)])
    );

    return topics.map((t) => {
      const topicCount = countByTopic.get(t.id) ?? 0;
      return {
        topicId: t.id,
        topicName: t.name,
        totalQuestions,
        topicQuestions: topicCount,
        frequencyPercent: computeFrequency(totalQuestions, topicCount),
      };
    });
  },
};
