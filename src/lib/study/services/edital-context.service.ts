/**
 * ConcursoAI — EditalContextService (Study)
 *
 * Constrói o contexto enriquecido do edital para o aluno (disciplinas e tópicos),
 * integrando pesos oficiais, frequência histórica e desempenho real.
 *
 * Regras:
 * - Respeita profiles.contest_id e profiles.position_id
 * - Utiliza edital vigente do concurso
 * - Tópicos enriquecidos com TopicFrequencyService e TopicPerformanceService
 * - Limite coerente e determinístico de tópicos por disciplina (evita N+1 e context overflow)
 * - Compatível com ausência de edital, disciplinas sem tópicos e tópicos sem tentativas
 */
import "server-only";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { profiles } from "@/db/schema/identity";
import { editais, noticeSubjects, noticeTopics } from "@/db/schema/contest";
import { knowledgeSubjects } from "@/db/schema/knowledge";
import { TopicFrequencyService } from "@/lib/analytics/services/topic-frequency.service";
import {
  TopicPerformanceService,
  type TopicPerformanceResult,
} from "@/lib/analytics/services/topic-performance.service";

export interface EnrichedTopicContext {
  topicId: string;
  knowledgeTopicId: string | null;
  noticeTopicId: string;
  topicName: string;
  editalTopicWeight: number | null;
  historicalFrequencyPercent: number;
  frequencySource: "board" | "catalog" | "none";
  totalQuestions: number;
  attemptedQuestions: number;
  correctAnswers: number;
  incorrectAnswers: number;
  accuracyPct: number | null;
  lastAttemptAt: Date | null;
  daysSinceLastAttempt: number | null;
  trend: "up" | "down" | "stable" | "no_data";
}

export interface EnrichedSubjectContext {
  subjectId: string; // knowledgeSubjectId
  noticeSubjectId: string;
  subjectName: string;
  editalWeight: number;
  topics: EnrichedTopicContext[];
}

export interface EnrichedEditalContext {
  contestId: string | null;
  positionId: string | null;
  editalId: string | null;
  bancaTarget: string | null;
  subjects: EnrichedSubjectContext[];
}

export const MAX_TOPICS_PER_SUBJECT = 8;

/**
 * Ordenação determinística de relevância pedagógica dos tópicos:
 * 1. Menor accuracyPct (pontos fracos do aluno primeiro: ex. 30% antes de 80%)
 * 2. Tópicos sem tentativas com relevância histórica/peso
 * 3. Maior frequência histórica (recorrência em provas)
 * 4. Maior peso explícito do edital
 * 5. Maior tempo desde a última tentativa (revisão espaçada)
 * 6. Desempate estável por nome e ID
 */
export function rankTopicsForContext(
  topics: EnrichedTopicContext[]
): EnrichedTopicContext[] {
  return [...topics].sort((a, b) => {
    // 1. Menor acerto entre os tópicos já tentados
    const aHasAttempts = a.attemptedQuestions > 0 && a.accuracyPct !== null;
    const bHasAttempts = b.attemptedQuestions > 0 && b.accuracyPct !== null;

    if (aHasAttempts && bHasAttempts) {
      if (Math.abs(a.accuracyPct! - b.accuracyPct!) >= 1) {
        return a.accuracyPct! - b.accuracyPct!; // Menor acerto primeiro
      }
    }

    // Se um tem tentativas e outro não:
    // Se o tentado tem acerto baixo (< 60%), ele é prioridade máxima
    if (aHasAttempts && !bHasAttempts && a.accuracyPct! < 60) return -1;
    if (!aHasAttempts && bHasAttempts && b.accuracyPct! < 60) return 1;

    // 2. Maior frequência histórica
    if (Math.abs(b.historicalFrequencyPercent - a.historicalFrequencyPercent) >= 0.5) {
      return b.historicalFrequencyPercent - a.historicalFrequencyPercent;
    }

    // 3. Maior peso explícito do edital
    const aWeight = a.editalTopicWeight ?? 0;
    const bWeight = b.editalTopicWeight ?? 0;
    if (Math.abs(bWeight - aWeight) >= 0.1) {
      return bWeight - aWeight;
    }

    // 4. Maior tempo desde a última tentativa
    const aDays = a.daysSinceLastAttempt ?? 999;
    const bDays = b.daysSinceLastAttempt ?? 999;
    if (bDays !== aDays) {
      return bDays - aDays;
    }

    // 5. Desempate estável
    const nameCmp = a.topicName.localeCompare(b.topicName);
    if (nameCmp !== 0) return nameCmp;
    return a.topicId.localeCompare(b.topicId);
  });
}

/**
 * Seleciona determinísticamente o tópico principal para a matéria no fallback
 * seguindo os 5 critérios oficiais da FASE 6D.
 */
export function pickTopTopicForSubject(
  topics: EnrichedTopicContext[]
): EnrichedTopicContext | null {
  if (!topics || topics.length === 0) return null;
  const ranked = rankTopicsForContext(topics);
  return ranked[0] ?? null;
}

export const EditalContextService = {
  /**
   * Obtém o contexto enriquecido do edital vigente para o usuário.
   */
  async getEnrichedEditalContext(userId: string): Promise<EnrichedEditalContext> {
    const emptyContext: EnrichedEditalContext = {
      contestId: null,
      positionId: null,
      editalId: null,
      bancaTarget: null,
      subjects: [],
    };

    if (!process.env.DATABASE_URL) {
      return emptyContext;
    }

    try {
      // 1. Busca perfil do usuário
      const [profile] = await db
        .select({
          contestId: profiles.contestId,
          positionId: profiles.positionId,
          bancaPreferida: profiles.bancaPreferida,
        })
        .from(profiles)
        .where(eq(profiles.id, userId))
        .limit(1);

      if (!profile?.contestId) {
        return emptyContext;
      }

    const contestId = profile.contestId;
    const positionId = profile.positionId ?? null;
    const bancaTarget = profile.bancaPreferida ?? null;

    // 2. Busca edital vigente
    const [edital] = await db
      .select({ id: editais.id })
      .from(editais)
      .where(
        and(
          eq(editais.contestId, contestId),
          eq(editais.isCurrent, true),
          isNull(editais.deletedAt)
        )
      )
      .limit(1);

    if (!edital) {
      return {
        contestId,
        positionId,
        editalId: null,
        bancaTarget,
        subjects: [],
      };
    }

    // 3. Busca matérias do edital no escopo do aluno (cargo se houver, senão geral)
    const baseConditions = [
      eq(noticeSubjects.editalId, edital.id),
      eq(noticeSubjects.status, "active"),
      isNull(noticeSubjects.deletedAt),
    ];

    let subjectRows = await db
      .select({
        id: noticeSubjects.id,
        knowledgeSubjectId: noticeSubjects.knowledgeSubjectId,
        subjectName: knowledgeSubjects.name,
        weight: noticeSubjects.weight,
        positionId: noticeSubjects.positionId,
      })
      .from(noticeSubjects)
      .innerJoin(
        knowledgeSubjects,
        eq(noticeSubjects.knowledgeSubjectId, knowledgeSubjects.id)
      )
      .where(
        and(
          ...baseConditions,
          positionId ? eq(noticeSubjects.positionId, positionId) : isNull(noticeSubjects.positionId)
        )
      );

    // Fallback: se cargo específico não possui matérias cadastradas, usa escopo geral
    if (positionId && subjectRows.length === 0) {
      subjectRows = await db
        .select({
          id: noticeSubjects.id,
          knowledgeSubjectId: noticeSubjects.knowledgeSubjectId,
          subjectName: knowledgeSubjects.name,
          weight: noticeSubjects.weight,
          positionId: noticeSubjects.positionId,
        })
        .from(noticeSubjects)
        .innerJoin(
          knowledgeSubjects,
          eq(noticeSubjects.knowledgeSubjectId, knowledgeSubjects.id)
        )
        .where(and(...baseConditions, isNull(noticeSubjects.positionId)));
    }

    if (subjectRows.length === 0) {
      return {
        contestId,
        positionId,
        editalId: edital.id,
        bancaTarget,
        subjects: [],
      };
    }

    const noticeSubjectIds = subjectRows.map((s) => s.id);

    // 4. Busca todos os tópicos das matérias do edital em uma única consulta (sem N+1)
    const topicRows = await db
      .select({
        id: noticeTopics.id,
        noticeSubjectId: noticeTopics.noticeSubjectId,
        knowledgeTopicId: noticeTopics.knowledgeTopicId,
        name: noticeTopics.name,
        normalizedName: noticeTopics.normalizedName,
        weight: noticeTopics.weight,
        parentNoticeTopicId: noticeTopics.parentNoticeTopicId,
      })
      .from(noticeTopics)
      .where(
        and(
          inArray(noticeTopics.noticeSubjectId, noticeSubjectIds),
          isNull(noticeTopics.deletedAt)
        )
      );

    // Mapeia tópicos por noticeSubjectId
    const topicsByNoticeSubject = new Map<string, typeof topicRows>();
    for (const t of topicRows) {
      const list = topicsByNoticeSubject.get(t.noticeSubjectId) ?? [];
      list.push(t);
      topicsByNoticeSubject.set(t.noticeSubjectId, list);
    }

    // 5. Agrega desempenho e frequências dos tópicos
    const candidatesForPerf: Array<{
      topicId: string;
      topicName: string;
      subjectId: string;
      subjectName: string;
    }> = [];

    for (const s of subjectRows) {
      const nTopics = topicsByNoticeSubject.get(s.id) ?? [];
      for (const t of nTopics) {
        if (t.knowledgeTopicId) {
          candidatesForPerf.push({
            topicId: t.knowledgeTopicId,
            topicName: t.name,
            subjectId: s.knowledgeSubjectId,
            subjectName: s.subjectName,
          });
        }
      }
    }

    // Busca desempenho em lote para o usuário (zero N+1)
    const perfResults = await TopicPerformanceService.getStudentTopicPerformance(
      userId,
      candidatesForPerf
    );
    const perfMap = new Map<string, TopicPerformanceResult>(
      perfResults.map((p) => [p.topicId, p])
    );

    // 6. Monta o contexto final por disciplina
    const enrichedSubjects: EnrichedSubjectContext[] = [];

    for (const s of subjectRows) {
      const rawTopics = topicsByNoticeSubject.get(s.id) ?? [];

      // Frequências da disciplina (com fallback seguro: banca -> catálogo -> none)
      let freqList = bancaTarget
        ? await TopicFrequencyService.listTopicFrequencies({
            board: bancaTarget,
            subjectId: s.knowledgeSubjectId,
          })
        : [];

      let freqSource: "board" | "catalog" | "none" = "none";
      const hasBoardQuestions = freqList.some((f) => f.totalQuestions > 0);

      if (bancaTarget && hasBoardQuestions) {
        freqSource = "board";
      } else {
        // Fallback para catálogo geral da disciplina
        freqList = await TopicFrequencyService.listTopicFrequencies({
          subjectId: s.knowledgeSubjectId,
        });
        const hasCatalogQuestions = freqList.some((f) => f.totalQuestions > 0);
        freqSource = hasCatalogQuestions ? "catalog" : "none";
      }

      const freqMap = new Map(freqList.map((f) => [f.topicId, f.frequencyPercent]));

      const enrichedTopicsList: EnrichedTopicContext[] = rawTopics.map((t) => {
        const perf = t.knowledgeTopicId ? perfMap.get(t.knowledgeTopicId) : undefined;
        const freqPct = t.knowledgeTopicId ? (freqMap.get(t.knowledgeTopicId) ?? 0) : 0;
        const topicWeight = t.weight ? Number(t.weight) : null;

        return {
          topicId: t.knowledgeTopicId ?? t.id,
          knowledgeTopicId: t.knowledgeTopicId,
          noticeTopicId: t.id,
          topicName: t.name,
          editalTopicWeight: topicWeight,
          historicalFrequencyPercent: freqPct,
          frequencySource: t.knowledgeTopicId ? freqSource : "none",
          totalQuestions: perf?.totalQuestions ?? 0,
          attemptedQuestions: perf?.attemptedQuestions ?? 0,
          correctAnswers: perf?.correctAnswers ?? 0,
          incorrectAnswers: perf?.incorrectAnswers ?? 0,
          accuracyPct: perf?.accuracyPct ?? null,
          lastAttemptAt: perf?.lastAttemptAt ?? null,
          daysSinceLastAttempt: perf?.daysSinceLastAttempt ?? null,
          trend: perf?.trend ?? "no_data",
        };
      });

      // Ordena e aplica limite máximo de tópicos por disciplina para o contexto
      const rankedTopics = rankTopicsForContext(enrichedTopicsList).slice(
        0,
        MAX_TOPICS_PER_SUBJECT
      );

      enrichedSubjects.push({
        subjectId: s.knowledgeSubjectId,
        noticeSubjectId: s.id,
        subjectName: s.subjectName,
        editalWeight: s.weight,
        topics: rankedTopics,
      });
    }

      return {
        contestId,
        positionId,
        editalId: edital.id,
        bancaTarget,
        subjects: enrichedSubjects,
      };
    } catch {
      return emptyContext;
    }
  },
};
