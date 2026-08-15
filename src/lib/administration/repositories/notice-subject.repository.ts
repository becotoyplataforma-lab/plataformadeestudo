/**
 * ConcursoAI — NoticeSubjectRepository (Administration)
 *
 * Escrita de matérias do edital (notice_subjects) e apoio para cadastro de
 * matéria por nome (find-or-create). Alimenta o vínculo apostila↔matéria↔peso.
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { noticeSubjects } from "@/db/schema/contest";
import { knowledgeSubjects } from "@/db/schema/knowledge";
import { slugify } from "@/lib/utils/slug";

export const NoticeSubjectRepository = {
  /** Encontra uma matéria pelo nome; cria se não existir (idempotente). */
  async findOrCreateSubject(name: string): Promise<{ id: string; name: string }> {
    const slug = slugify(name);
    const [existing] = await db
      .select({ id: knowledgeSubjects.id, name: knowledgeSubjects.name })
      .from(knowledgeSubjects)
      .where(
        and(
          eq(knowledgeSubjects.slug, slug),
          isNull(knowledgeSubjects.deletedAt)
        )
      )
      .limit(1);
    if (existing) return existing;

    const [created] = await db
      .insert(knowledgeSubjects)
      .values({ name, slug, status: "active", keywords: [] })
      .returning({ id: knowledgeSubjects.id, name: knowledgeSubjects.name });
    return created;
  },

  /** Upsert da matéria do edital (edital, cargo opcional, matéria, peso). */
  async upsertNoticeSubject(input: {
    editalId: string;
    positionId: string | null;
    subjectId: string;
    weight: number;
  }) {
    const [row] = await db
      .insert(noticeSubjects)
      .values({
        editalId: input.editalId,
        positionId: input.positionId,
        knowledgeSubjectId: input.subjectId,
        weight: input.weight,
        status: "active",
      })
      .onConflictDoUpdate({
        target: [
          noticeSubjects.editalId,
          noticeSubjects.positionId,
          noticeSubjects.knowledgeSubjectId,
        ],
        set: { weight: input.weight, status: "active", updatedAt: new Date() },
      })
      .returning({ id: noticeSubjects.id, weight: noticeSubjects.weight });
    return row;
  },
};
