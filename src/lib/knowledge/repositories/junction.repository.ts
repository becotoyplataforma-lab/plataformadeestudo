/**
 * ConcursoAI — Junction Repositories (document_subjects, document_topics, document_tags)
 */
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import {
  documentSubjects,
  documentTopics,
  documentTags,
} from "@/db/schema/knowledge";

// ============================================================
// DocumentSubjectRepository
// ============================================================

export const DocumentSubjectRepository = {
  async upsert(documentId: string, subjectId: string, confidence = 100) {
    return db
      .insert(documentSubjects)
      .values({ documentId, subjectId, confidence })
      .onConflictDoUpdate({
        target: [documentSubjects.documentId, documentSubjects.subjectId],
        set: { confidence },
      })
      .returning();
  },

  async listByDocument(documentId: string) {
    const { knowledgeSubjects } = await import("@/db/schema/knowledge");
    return db
      .select({
        id: documentSubjects.id,
        documentId: documentSubjects.documentId,
        subjectId: documentSubjects.subjectId,
        confidence: documentSubjects.confidence,
        subjectName: knowledgeSubjects.name,
        subjectSlug: knowledgeSubjects.slug,
      })
      .from(documentSubjects)
      .innerJoin(
        knowledgeSubjects,
        eq(documentSubjects.subjectId, knowledgeSubjects.id)
      )
      .where(eq(documentSubjects.documentId, documentId));
  },

  async deleteByDocument(documentId: string) {
    return db
      .delete(documentSubjects)
      .where(eq(documentSubjects.documentId, documentId));
  },
};

// ============================================================
// DocumentTopicRepository
// ============================================================

export const DocumentTopicRepository = {
  async upsert(documentId: string, topicId: string, confidence = 100) {
    return db
      .insert(documentTopics)
      .values({ documentId, topicId, confidence })
      .onConflictDoUpdate({
        target: [documentTopics.documentId, documentTopics.topicId],
        set: { confidence },
      })
      .returning();
  },

  async listByDocument(documentId: string) {
    const { knowledgeTopics } = await import("@/db/schema/knowledge");
    return db
      .select({
        id: documentTopics.id,
        documentId: documentTopics.documentId,
        topicId: documentTopics.topicId,
        confidence: documentTopics.confidence,
        topicName: knowledgeTopics.name,
        topicSlug: knowledgeTopics.slug,
      })
      .from(documentTopics)
      .innerJoin(
        knowledgeTopics,
        eq(documentTopics.topicId, knowledgeTopics.id)
      )
      .where(eq(documentTopics.documentId, documentId));
  },

  async deleteByDocument(documentId: string) {
    return db
      .delete(documentTopics)
      .where(eq(documentTopics.documentId, documentId));
  },
};

// ============================================================
// DocumentTagRepository
// ============================================================

export const DocumentTagRepository = {
  async upsert(documentId: string, tagId: string) {
    return db
      .insert(documentTags)
      .values({ documentId, tagId })
      .onConflictDoNothing()
      .returning();
  },

  async listByDocument(documentId: string) {
    const { knowledgeTags } = await import("@/db/schema/knowledge");
    return db
      .select({
        id: documentTags.id,
        documentId: documentTags.documentId,
        tagId: documentTags.tagId,
        tagName: knowledgeTags.name,
        tagSlug: knowledgeTags.slug,
      })
      .from(documentTags)
      .innerJoin(
        knowledgeTags,
        eq(documentTags.tagId, knowledgeTags.id)
      )
      .where(eq(documentTags.documentId, documentId));
  },

  async deleteByDocument(documentId: string) {
    return db
      .delete(documentTags)
      .where(eq(documentTags.documentId, documentId));
  },
};
