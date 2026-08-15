/**
 * ConcursoAI — WeaknessAnalysisService
 *
 * Analisa o desempenho do aluno por matéria/tópico a partir de
 * question_attempts e identifica pontos fracos ("você precisa reforçar").
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { questionAttempts, questions } from "@/db/schema/study";
import { knowledgeSubjects } from "@/db/schema/knowledge";

export interface WeakTopic {
  topic: string;
  total: number;
  correct: number;
  accuracy: number; // 0..1
}

export interface WeakSubject {
  subjectId: string;
  subjectName: string;
  total: number;
  correct: number;
  accuracy: number;
  avgTimeSec: number;
  topics: WeakTopic[];
}

export const WeaknessAnalysisService = {
  /**
   * Retorna matérias fracas (acerto abaixo do limiar) ordenadas da pior
   * para a melhor, com abertura por tópico quando disponível.
   */
  async analyze(
    userId: string,
    opts: { minAttempts?: number; maxAccuracy?: number } = {}
  ): Promise<WeakSubject[]> {
    const minAttempts = opts.minAttempts ?? 3;
    const maxAccuracy = opts.maxAccuracy ?? 0.7;

    const rows = await db
      .select({
        subjectId: questions.knowledgeSubjectId,
        subjectName: knowledgeSubjects.name,
        topic: questions.topic,
        isCorrect: questionAttempts.isCorrect,
        timeSpentSec: questionAttempts.timeSpentSec,
      })
      .from(questionAttempts)
      .innerJoin(questions, eq(questionAttempts.questionId, questions.id))
      .leftJoin(knowledgeSubjects, eq(questions.knowledgeSubjectId, knowledgeSubjects.id))
      .where(eq(questionAttempts.userId, userId));

    const bySubject = new Map<
      string,
      {
        subjectId: string;
        subjectName: string | null;
        total: number;
        correct: number;
        timeSum: number;
        topics: Map<string, { total: number; correct: number }>;
      }
    >();

    for (const row of rows) {
      const key = row.subjectId;
      if (!bySubject.has(key)) {
        bySubject.set(key, {
          subjectId: row.subjectId,
          subjectName: row.subjectName,
          total: 0,
          correct: 0,
          timeSum: 0,
          topics: new Map(),
        });
      }
      const entry = bySubject.get(key)!;
      entry.total++;
      if (row.isCorrect) entry.correct++;
      entry.timeSum += row.timeSpentSec;

      if (row.topic) {
        const t = entry.topics.get(row.topic) ?? { total: 0, correct: 0 };
        t.total++;
        if (row.isCorrect) t.correct++;
        entry.topics.set(row.topic, t);
      }
    }

    const result: WeakSubject[] = [];
    for (const entry of bySubject.values()) {
      if (entry.total < minAttempts) continue;
      const accuracy = entry.total > 0 ? entry.correct / entry.total : 0;
      if (accuracy >= maxAccuracy) continue;

      result.push({
        subjectId: entry.subjectId,
        subjectName: entry.subjectName ?? "Matéria",
        total: entry.total,
        correct: entry.correct,
        accuracy: Math.round(accuracy * 100) / 100,
        avgTimeSec: Math.round(entry.timeSum / entry.total),
        topics: [...entry.topics.entries()]
          .map(([topic, t]) => ({
            topic,
            total: t.total,
            correct: t.correct,
            accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) / 100 : 0,
          }))
          .sort((a, b) => a.accuracy - b.accuracy),
      });
    }

    return result.sort((a, b) => a.accuracy - b.accuracy);
  },
};
