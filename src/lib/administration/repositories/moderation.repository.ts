/**
 * ConcursoAI — ModerationRepository (Administration)
 *
 * Camada de dados de moderação de conteúdo (Administration → Study).
 * Lê/atualiza `questions` (docs/15 §3.2 — curadoria) com visibilidade de
 * administrador (todas as questões, não apenas publicadas).
 *
 * Não altera o schema/domínio Study — apenas acesso a dados de moderação.
 */
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { questions, questionStatus } from "@/db/schema/study";
import { knowledgeSubjects } from "@/db/schema/knowledge";

export type QuestionStatus = (typeof questionStatus.enumValues)[number];

export interface ModerationFilters {
  status?: QuestionStatus;
  subjectId?: string;
  banca?: string;
  page?: number;
  pageSize?: number;
}

export const ModerationRepository = {
  /** Listar questões para curadoria (todas, com filtros opcionais). */
  async listQuestions(filters: ModerationFilters = {}) {
    const { status, subjectId, banca, page = 1, pageSize = 20 } = filters;

    const conditions = [isNull(questions.deletedAt)];
    if (status) conditions.push(eq(questions.status, status));
    if (subjectId) conditions.push(eq(questions.knowledgeSubjectId, subjectId));
    if (banca) conditions.push(eq(questions.banca, banca));

    const rows = await db
      .select({
        id: questions.id,
        subjectId: questions.knowledgeSubjectId,
        subjectName: knowledgeSubjects.name,
        banca: questions.banca,
        ano: questions.ano,
        nivel: questions.nivel,
        enunciado: questions.enunciado,
        status: questions.status,
        isPublic: questions.isPublic,
        createdAt: questions.createdAt,
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

  /** Buscar questão por ID (para moderação). */
  async findById(id: string) {
    const [row] = await db
      .select()
      .from(questions)
      .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
      .limit(1);
    return row ?? null;
  },

  /** Atualizar status de curadoria (rascunho/publicada/bloqueada). */
  async setQuestionStatus(id: string, status: QuestionStatus) {
    const [row] = await db
      .update(questions)
      .set({ status, updatedAt: new Date() })
      .where(and(eq(questions.id, id), isNull(questions.deletedAt)))
      .returning({ id: questions.id, status: questions.status });
    return row ?? null;
  },
};
