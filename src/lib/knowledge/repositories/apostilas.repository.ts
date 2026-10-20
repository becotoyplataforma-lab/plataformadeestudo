/**
 * ConcursoAI — ApostilasRepository
 *
 * Consultas de listagem do módulo "Minhas Apostilas" sobre o agregado Document
 * do Knowledge Core (sem novas tabelas — specs/knowledge-apostilas.md).
 *
 * Hierarquia: Concurso/Trilha (documents.metadata) → Matéria (document_subjects
 * × knowledge_subjects) → Apostila (documents).
 *
 * Nota de domínio: a ingestion mapeia PDFs para type="pdf" e nunca grava
 * "apostila" (ingestion.service.ts:69-75), por isso Fase 1 considera os dois
 * tipos como "material de estudo".
 *
 * Toda consulta filtra por userId: a posse nunca vem do cliente (.ai/04 §4).
 */
import { and, desc, eq, ilike, inArray, isNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  documentSubjects,
  documents,
  knowledgeSubjects,
} from "@/db/schema/knowledge";

const APOSTILA_TIPOS = ["apostila", "pdf"] as const;

export interface ApostilaFilter {
  materiaId?: string;
  busca?: string;
}

/** Escuta metacaracteres do LIKE/ILIKE para que a busca seja literal. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (char) => `\\${char}`);
}

export const ApostilasRepository = {
  /**
   * Linhas de apostilas do usuário com a matéria associada (uma linha por
   * associação N:M; o Service deduplica e agrupa).
   */
  async listByUser(userId: string, filter: ApostilaFilter = {}) {
    const conditions = [
      eq(documents.userId, userId),
      isNull(documents.deletedAt),
      inArray(documents.type, [...APOSTILA_TIPOS]),
    ];

    if (filter.materiaId) {
      conditions.push(eq(documentSubjects.subjectId, filter.materiaId));
    }
    if (filter.busca) {
      conditions.push(ilike(documents.title, `%${escapeLike(filter.busca)}%`));
    }

    return db
      .select({
        id: documents.id,
        userId: documents.userId,
        type: documents.type,
        title: documents.title,
        storagePath: documents.storagePath,
        status: documents.status,
        fileSize: documents.fileSize,
        mimeType: documents.mimeType,
        metadata: documents.metadata,
        createdAt: documents.createdAt,
        subjectId: knowledgeSubjects.id,
        subjectName: knowledgeSubjects.name,
        subjectColor: knowledgeSubjects.color,
      })
      .from(documents)
      .leftJoin(documentSubjects, eq(documentSubjects.documentId, documents.id))
      .leftJoin(knowledgeSubjects, eq(knowledgeSubjects.id, documentSubjects.subjectId))
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt));
  },

  /** Uma apostila do usuário (inclui storagePath para o proxy de leitura). */
  async findOwnedById(userId: string, id: string) {
    const [row] = await db
      .select({
        id: documents.id,
        userId: documents.userId,
        type: documents.type,
        title: documents.title,
        storagePath: documents.storagePath,
        status: documents.status,
        fileSize: documents.fileSize,
        mimeType: documents.mimeType,
        metadata: documents.metadata,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(
        and(
          eq(documents.id, id),
          eq(documents.userId, userId),
          isNull(documents.deletedAt),
          inArray(documents.type, [...APOSTILA_TIPOS])
        )
      )
      .limit(1);

    return row ?? null;
  },

};
