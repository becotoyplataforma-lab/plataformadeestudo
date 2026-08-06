/**
 * ConcursoAI — QuestionRepository
 *
 * Camada de persistência do aggregate Question (inclui options).
 * Questões públicas: leitura para autenticados; escrita para admin.
 */
import { eq, and, isNull, sql, inArray } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  questions,
  questionOptions,
  knowledgeSubjects,
} from "@/db/schema";
import type { questionLevel } from "@/db/schema/study";

export type QuestionLevel = (typeof questionLevel.enumValues)[number];

export interface QuestionFilters {
  subjectId?: string;
  banca?: string;
  nivel?: QuestionLevel;
  page?: number;
  pageSize?: number;
}

export const QuestionRepository = {
  /** Buscar questão pública por ID (com options). */
  async findPublicById(id: string) {
    const [q] = await db
      .select({
        id: questions.id,
        knowledgeSubjectId: questions.knowledgeSubjectId,
        subjectName: knowledgeSubjects.name,
        subjectSlug: knowledgeSubjects.slug,
        subjectColor: knowledgeSubjects.color,
        banca: questions.banca,
        cargo: questions.cargo,
        ano: questions.ano,
        nivel: questions.nivel,
        enunciado: questions.enunciado,
        gabarito: questions.gabarito,
        explicacao: questions.explicacao,
        tipo: questions.tipo,
        fonte: questions.fonte,
        isPublic: questions.isPublic,
      })
      .from(questions)
      .leftJoin(
        knowledgeSubjects,
        eq(questions.knowledgeSubjectId, knowledgeSubjects.id)
      )
      .where(
        and(
          eq(questions.id, id),
          eq(questions.isPublic, true),
          eq(questions.status, "publicada"),
          isNull(questions.deletedAt)
        )
      )
      .limit(1);

    if (!q) return null;

    const options = await this.listOptions(id);
    return { ...q, options };
  },

  /** Listar questões públicas. */
  async listPublic(filters: QuestionFilters = {}) {
    const { subjectId, banca, nivel, page = 1, pageSize = 20 } = filters;

    const conditions = [
      eq(questions.isPublic, true),
      eq(questions.status, "publicada"),
      isNull(questions.deletedAt),
    ];
    if (subjectId) conditions.push(eq(questions.knowledgeSubjectId, subjectId));
    if (banca) conditions.push(eq(questions.banca, banca));
    if (nivel) conditions.push(eq(questions.nivel, nivel));

    const rows = await db
      .select({
        id: questions.id,
        knowledgeSubjectId: questions.knowledgeSubjectId,
        subjectName: knowledgeSubjects.name,
        subjectSlug: knowledgeSubjects.slug,
        subjectColor: knowledgeSubjects.color,
        banca: questions.banca,
        cargo: questions.cargo,
        ano: questions.ano,
        nivel: questions.nivel,
        enunciado: questions.enunciado,
        gabarito: questions.gabarito,
        explicacao: questions.explicacao,
        tipo: questions.tipo,
        fonte: questions.fonte,
        isPublic: questions.isPublic,
      })
      .from(questions)
      .leftJoin(
        knowledgeSubjects,
        eq(questions.knowledgeSubjectId, knowledgeSubjects.id)
      )
      .where(and(...conditions))
      .orderBy(sql`${questions.createdAt} DESC`)
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(questions)
      .where(and(...conditions));

    return { data: rows, total: count };
  },

  /** Listar options de uma questão (sem expor is_correct publicamente). */
  async listOptions(questionId: string) {
    return db
      .select({ id: questionOptions.id, letter: questionOptions.letter, text: questionOptions.text })
      .from(questionOptions)
      .where(
        and(
          eq(questionOptions.questionId, questionId),
          isNull(questionOptions.deletedAt)
        )
      )
      .orderBy(questionOptions.letter);
  },

  /** Obter gabarito (com options completas — para correção). */
  async getGabarito(questionId: string) {
    const [q] = await db
      .select({ gabarito: questions.gabarito, explicacao: questions.explicacao })
      .from(questions)
      .where(
        and(
          eq(questions.id, questionId),
          isNull(questions.deletedAt)
        )
      )
      .limit(1);
    if (!q) return null;

    const options = await db
      .select({ letter: questionOptions.letter, isCorrect: questionOptions.isCorrect })
      .from(questionOptions)
      .where(
        and(
          eq(questionOptions.questionId, questionId),
          isNull(questionOptions.deletedAt)
        )
      );
    return { gabarito: q.gabarito, explicacao: q.explicacao, options };
  },

  /** Buscar questões por IDs (admin / curadoria). */
  async findByIds(ids: string[]) {
    if (ids.length === 0) return [];
    return db
      .select()
      .from(questions)
      .where(and(inArray(questions.id, ids), isNull(questions.deletedAt)));
  },
};
