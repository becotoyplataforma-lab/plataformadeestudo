/**
 * ConcursoAI — Domínio KNOWLEDGE — Drizzle ORM Schema
 *
 * PostgreSQL · Drizzle ORM · TypeScript Strict · pgvector
 *
 * Base oficial:
 * - docs/08-DATABASE-PHYSICAL.md (entidades: documents, document_chunks, embeddings)
 * - docs/13-KNOWLEDGE-CORE-ARCHITECTURE.md (MVP: + knowledge_topics, knowledge_tags, junctions)
 * - docs/10-EMBEDDING-STANDARD.md (BAAI/bge-m3, 1024d, pgvector/HNSW, Hybrid Search)
 * - docs/07-ENTITY-STANDARDS.md (UUID, soft delete, auditoria, RLS, naming)
 * - .ai/blueprints/01-ingestion.blueprint.md a 07-ai-professor.blueprint.md
 *
 * Apenas schema, enums e relações. Sem lógica de negócio.
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  foreignKey,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";
import { authUsers } from "./identity";

// ============================================================
// CUSTOM TYPES
// ============================================================

/** Tipo tsvector do PostgreSQL (Full Text Search). */
export const tsvectorType = customType<{ data: string; driverData: string }>({
  dataType() {
    return "tsvector";
  },
});

// ============================================================
// ENUMS
// ============================================================

/** Tipo de documento baseado no formato do arquivo. */
export const documentTypeEnum = pgEnum("document_type", [
  "pdf",
  "docx",
  "txt",
  "markdown",
  "html",
  "edital",
  "apostila",
]);

/** Estado de processamento do documento no pipeline. */
export const documentStatusEnum = pgEnum("document_status", [
  "pending",
  "processing",
  "processed",
  "chunked",
  "indexing",
  "indexed",
  "failed",
]);

/** Origem do documento (como foi parar na plataforma). */
export const sourceTypeEnum = pgEnum("source_type", [
  "upload",
  "edital",
  "url",
]);

// ============================================================
// DOCUMENTS — agregado raiz do domínio Knowledge
// ============================================================

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    type: documentTypeEnum("type").notNull(),
    title: text("title").notNull(),
    storagePath: text("storage_path").notNull(),
    status: documentStatusEnum("status").notNull().default("pending"),
    fileSize: integer("file_size"),
    mimeType: text("mime_type"),
    sourceType: sourceTypeEnum("source_type").notNull().default("upload"),
    sourceUrl: text("source_url"),
    externalId: uuid("external_id"),
    fileHash: text("file_hash"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_documents_storage_path")
      .on(t.storagePath)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("uq_documents_file_hash")
      .on(t.userId, t.fileHash)
      .where(sql`${t.deletedAt} is null`),
    check("chk_documents_file_size", sql`${t.fileSize} >= 0`),
    index("idx_documents_user_status").on(t.userId, t.status),
    index("idx_documents_user_hash").on(t.userId, t.fileHash),
    index("idx_documents_status")
      .on(t.status)
      .where(sql`${t.deletedAt} is null`),
  ]
);

// ============================================================
// DOCUMENT_CHUNKS — trecho extraído do documento
// ============================================================

const chunkContentColumn = text("content").notNull();

export const documentChunks = pgTable(
  "document_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    content: chunkContentColumn,
    contentHash: text("content_hash"),
    metadata: jsonb("metadata").default({}),
    ftsVector: tsvectorType("fts_vector")
      .generatedAlwaysAs(
        sql`to_tsvector('portuguese', ${chunkContentColumn})`
      )
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_chunks_doc_seq")
      .on(t.documentId, t.seq)
      .where(sql`${t.deletedAt} is null`),
    check("chk_chunks_seq", sql`${t.seq} >= 0`),
    index("idx_chunks_document").on(t.documentId),
    index("idx_chunks_content_hash").on(t.contentHash),
    index("idx_chunks_fts")
      .using("gin", sql`${t.ftsVector}`),
  ]
);

// ============================================================
// EMBEDDINGS — vetor de representação do chunk
// ============================================================

export const embeddings = pgTable(
  "embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chunkId: uuid("chunk_id")
      .notNull()
      .references(() => documentChunks.id, { onDelete: "cascade" }),
    model: varchar("model", { length: 100 }).notNull().default("BAAI/bge-m3"),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_embeddings_chunk").on(t.chunkId),
    index("idx_embeddings_hnsw")
      .using("hnsw", sql`${t.embedding} vector_cosine_ops`)
      .with({ m: 16, ef_construction: 200 }),
  ]
);

// ============================================================
// KNOWLEDGE_SUBJECTS — catálogo de matérias (compartilhado)
// ============================================================

export const knowledgeSubjects = pgTable(
  "knowledge_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    color: text("color"),
    keywords: jsonb("keywords").default([]),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_knowledge_subjects_name")
      .on(t.name)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("uq_knowledge_subjects_slug")
      .on(t.slug)
      .where(sql`${t.deletedAt} is null`),
    index("idx_knowledge_subjects_status").on(t.status),
  ]
);

// ============================================================
// KNOWLEDGE_TOPICS — árvore de tópicos dentro de cada matéria
// ============================================================

export const knowledgeTopics = pgTable(
  "knowledge_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => knowledgeSubjects.id, { onDelete: "cascade" }),
    parentTopicId: uuid("parent_topic_id"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      columns: [t.parentTopicId],
      foreignColumns: [t.id],
    }).onDelete("set null"),
    uniqueIndex("uq_knowledge_topics_slug_subject")
      .on(t.subjectId, t.slug)
      .where(sql`${t.deletedAt} is null`),
    index("idx_knowledge_topics_subject").on(t.subjectId),
    index("idx_knowledge_topics_parent").on(t.parentTopicId),
    index("idx_knowledge_topics_status").on(t.status),
  ]
);

// ============================================================
// KNOWLEDGE_TAGS — etiquetas transversais
// ============================================================

export const knowledgeTags = pgTable(
  "knowledge_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_knowledge_tags_slug").on(t.slug),
    index("idx_knowledge_tags_name").on(t.name),
  ]
);

// ============================================================
// JUNCTIONS — associações N:M
// ============================================================

/** Documento × Matéria (N:M). */
export const documentSubjects = pgTable(
  "document_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    subjectId: uuid("subject_id")
      .notNull()
      .references(() => knowledgeSubjects.id, { onDelete: "cascade" }),
    confidence: integer("confidence").default(100), // 0-100
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_document_subjects").on(t.documentId, t.subjectId),
    check("chk_document_subjects_confidence", sql`${t.confidence} between 0 and 100`),
    index("idx_document_subjects_doc").on(t.documentId),
    index("idx_document_subjects_subject").on(t.subjectId),
  ]
);

/** Documento × Tópico (N:M). */
export const documentTopics = pgTable(
  "document_topics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => knowledgeTopics.id, { onDelete: "cascade" }),
    confidence: integer("confidence").default(100),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_document_topics").on(t.documentId, t.topicId),
    check("chk_document_topics_confidence", sql`${t.confidence} between 0 and 100`),
    index("idx_document_topics_doc").on(t.documentId),
    index("idx_document_topics_topic").on(t.topicId),
  ]
);

/** Documento × Tag (N:M). */
export const documentTags = pgTable(
  "document_tags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    tagId: uuid("tag_id")
      .notNull()
      .references(() => knowledgeTags.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_document_tags").on(t.documentId, t.tagId),
    index("idx_document_tags_doc").on(t.documentId),
    index("idx_document_tags_tag").on(t.tagId),
  ]
);

// ============================================================
// EMBEDDING CACHE — cache de embeddings por hash de conteúdo
// ============================================================

export const embeddingCache = pgTable(
  "embedding_cache",
  {
    contentHash: text("content_hash").notNull(),
    model: varchar("model", { length: 100 }).notNull(),
    embedding: vector("embedding", { dimensions: 1024 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    // PK composta (content_hash, model) — espelha o SQL manual
    primaryKey({ columns: [t.contentHash, t.model] }),
  ]
);

// ============================================================
// RELAÇÕES
// ============================================================

export const documentsRelations = relations(documents, ({ one, many }) => ({
  user: one(authUsers, {
    fields: [documents.userId],
    references: [authUsers.id],
  }),
  chunks: many(documentChunks),
  subjects: many(documentSubjects),
  topics: many(documentTopics),
  tags: many(documentTags),
}));

export const documentChunksRelations = relations(documentChunks, ({ one, many }) => ({
  document: one(documents, {
    fields: [documentChunks.documentId],
    references: [documents.id],
  }),
  embeddings: many(embeddings),
}));

export const embeddingsRelations = relations(embeddings, ({ one }) => ({
  chunk: one(documentChunks, {
    fields: [embeddings.chunkId],
    references: [documentChunks.id],
  }),
}));

export const knowledgeSubjectsRelations = relations(knowledgeSubjects, ({ many }) => ({
  topics: many(knowledgeTopics),
  documents: many(documentSubjects),
}));

export const knowledgeTopicsRelations = relations(knowledgeTopics, ({ one, many }) => ({
  subject: one(knowledgeSubjects, {
    fields: [knowledgeTopics.subjectId],
    references: [knowledgeSubjects.id],
  }),
  parent: one(knowledgeTopics, {
    fields: [knowledgeTopics.parentTopicId],
    references: [knowledgeTopics.id],
  }),
  children: many(knowledgeTopics),
  documents: many(documentTopics),
}));

export const knowledgeTagsRelations = relations(knowledgeTags, ({ many }) => ({
  documents: many(documentTags),
}));

export const documentSubjectsRelations = relations(documentSubjects, ({ one }) => ({
  document: one(documents, {
    fields: [documentSubjects.documentId],
    references: [documents.id],
  }),
  subject: one(knowledgeSubjects, {
    fields: [documentSubjects.subjectId],
    references: [knowledgeSubjects.id],
  }),
}));

export const documentTopicsRelations = relations(documentTopics, ({ one }) => ({
  document: one(documents, {
    fields: [documentTopics.documentId],
    references: [documents.id],
  }),
  topic: one(knowledgeTopics, {
    fields: [documentTopics.topicId],
    references: [knowledgeTopics.id],
  }),
}));

export const documentTagsRelations = relations(documentTags, ({ one }) => ({
  document: one(documents, {
    fields: [documentTags.documentId],
    references: [documents.id],
  }),
  tag: one(knowledgeTags, {
    fields: [documentTags.tagId],
    references: [knowledgeTags.id],
  }),
}));

