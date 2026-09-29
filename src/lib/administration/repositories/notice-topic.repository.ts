/**
 * ConcursoAI — NoticeTopicRepository (Administration)
 *
 * Persistência e gerenciamento de tópicos estruturados do edital (notice_topics).
 * Suporta hierarquia pai/filho, resolução contra knowledge_topics e idempotência
 * por matéria do edital (replace atômico).
 */
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { noticeTopics } from "@/db/schema/contest";
import { normalizeTopicName } from "@/lib/knowledge/services/topic-resolver.service";

export interface NoticeTopicInput {
  name: string;
  weight?: number | null;
  parentName?: string | null;
  knowledgeTopicId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NoticeTopicRow {
  id: string;
  noticeSubjectId: string;
  knowledgeTopicId: string | null;
  name: string;
  normalizedName: string;
  weight: string | null;
  parentNoticeTopicId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export const NoticeTopicRepository = {
  /**
   * Lista tópicos de uma matéria de edital.
   */
  async listByNoticeSubjectId(noticeSubjectId: string) {
    return db
      .select()
      .from(noticeTopics)
      .where(
        and(
          eq(noticeTopics.noticeSubjectId, noticeSubjectId),
          isNull(noticeTopics.deletedAt)
        )
      )
      .orderBy(noticeTopics.createdAt);
  },

  /**
   * Substitui atomicamente todos os tópicos de uma disciplina do edital (idempotente).
   * Resolve hierarquia em cascata (pais primeiro, depois filhos referenciando o id do pai).
   * Deduplica determinísticamente por normalizedName dentro da disciplina.
   */
  async replaceTopicsForNoticeSubject(
    noticeSubjectId: string,
    inputs: NoticeTopicInput[]
  ): Promise<NoticeTopicRow[]> {
    return db.transaction(async (tx) => {
      // 1. Remove tópicos anteriores da disciplina para garantir idempotência limpa
      await tx
        .delete(noticeTopics)
        .where(eq(noticeTopics.noticeSubjectId, noticeSubjectId));

      if (!inputs || inputs.length === 0) {
        return [];
      }

      // 2. Deduplicação em memória por normalizedName dentro da disciplina
      const uniqueInputs: NoticeTopicInput[] = [];
      const seen = new Set<string>();

      for (const item of inputs) {
        const rawName = item.name?.trim();
        if (!rawName) continue;
        const norm = normalizeTopicName(rawName);
        if (!norm || seen.has(norm)) continue;
        seen.add(norm);
        uniqueInputs.push(item);
      }

      if (uniqueInputs.length === 0) {
        return [];
      }

      // 3. Inserção preservando hierarquia (pais primeiro, depois filhos)
      const insertedRows: NoticeTopicRow[] = [];
      const idByNormName = new Map<string, string>();
      const remaining = [...uniqueInputs];

      let progress = true;
      while (remaining.length > 0 && progress) {
        progress = false;
        const nextBatch: NoticeTopicInput[] = [];

        for (const item of remaining) {
          const normParent = item.parentName ? normalizeTopicName(item.parentName) : null;
          // Pode inserir se não tem pai OU o pai já foi inserido OU o pai não existe na lista
          const parentExistsInList = normParent
            ? uniqueInputs.some((u) => normalizeTopicName(u.name) === normParent)
            : false;

          if (!normParent || idByNormName.has(normParent) || !parentExistsInList) {
            const parentId =
              normParent && idByNormName.has(normParent)
                ? idByNormName.get(normParent)!
                : null;
            const normName = normalizeTopicName(item.name);
            const weightVal =
              item.weight != null && !isNaN(item.weight)
                ? Math.max(0, Math.min(100, item.weight)).toFixed(2)
                : null;

            const [inserted] = await tx
              .insert(noticeTopics)
              .values({
                noticeSubjectId,
                knowledgeTopicId: item.knowledgeTopicId ?? null,
                name: item.name.trim(),
                normalizedName: normName,
                weight: weightVal,
                parentNoticeTopicId: parentId,
                metadata: {
                  source_text: item.name.trim(),
                  ...(item.metadata ?? {}),
                },
              })
              .returning();

            idByNormName.set(normName, inserted.id);
            insertedRows.push(inserted as NoticeTopicRow);
            progress = true;
          } else {
            nextBatch.push(item);
          }
        }

        remaining.length = 0;
        remaining.push(...nextBatch);
      }

      // Se houver algum item restante (ciclo ou referência quebrada), insere sem pai
      for (const item of remaining) {
        const normName = normalizeTopicName(item.name);
        const weightVal =
          item.weight != null && !isNaN(item.weight)
            ? Math.max(0, Math.min(100, item.weight)).toFixed(2)
            : null;

        const [inserted] = await tx
          .insert(noticeTopics)
          .values({
            noticeSubjectId,
            knowledgeTopicId: item.knowledgeTopicId ?? null,
            name: item.name.trim(),
            normalizedName: normName,
            weight: weightVal,
            parentNoticeTopicId: null,
            metadata: {
              source_text: item.name.trim(),
              ...(item.metadata ?? {}),
            },
          })
          .returning();

        idByNormName.set(normName, inserted.id);
        insertedRows.push(inserted as NoticeTopicRow);
      }

      return insertedRows;
    });
  },
};
