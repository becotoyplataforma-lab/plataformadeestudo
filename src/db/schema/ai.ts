/**
 * ConcursoAI — Domínio AI — Drizzle ORM Schema
 *
 * PostgreSQL · Drizzle ORM · TypeScript Strict
 *
 * Base oficial:
 * - docs/05-DOMAIN-MODEL.md (aggregate roots: ChatSession, AiUsage)
 * - docs/08-DATABASE-PHYSICAL.md (chat_sessions, chat_messages, ai_usage)
 * - docs/07-ENTITY-STANDARDS.md (UUID, soft delete, auditoria, RLS, naming)
 *
 * Apenas schema, enums e relações. Sem lógica de negócio.
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers, aiModel } from "./identity";
import { knowledgeSubjects, documents } from "./knowledge";

// ============================================================
// ENUMS
// ============================================================

/** Papel da mensagem no chat (chat_role). */
export const chatRole = pgEnum("chat_role", ["system", "user", "assistant"]);

// ============================================================
// CHAT_SESSIONS — conversa com o Professor IA
// ============================================================

export const chatSessions = pgTable(
  "chat_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    knowledgeSubjectId: uuid("knowledge_subject_id").references(
      () => knowledgeSubjects.id,
      { onDelete: "set null" }
    ),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    chapter: text("chapter"),
    model: aiModel("model").notNull().default("flash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_chat_sessions_user_updated").on(t.userId, t.updatedAt),
  ]
);

// ============================================================
// CHAT_MESSAGES — mensagem de uma conversa (imutável)
// ============================================================

export const chatMessages = pgTable(
  "chat_messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => chatSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    role: chatRole("role").notNull(),
    content: text("content").notNull(),
    model: aiModel("model"),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("chk_chat_messages_tokens_in", sql`${t.tokensIn} >= 0`),
    check("chk_chat_messages_tokens_out", sql`${t.tokensOut} >= 0`),
    index("idx_chat_messages_session_created").on(t.sessionId, t.createdAt),
    index("idx_chat_messages_user").on(t.userId),
  ]
);

// ============================================================
// AI_USAGE — consumo de IA por usuário e dia
// ============================================================

export const aiUsage = pgTable(
  "ai_usage",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    usageDate: timestamp("usage_date", { withTimezone: true }).notNull(),
    messagesCount: integer("messages_count").notNull().default(0),
    tokensIn: integer("tokens_in").notNull().default(0),
    tokensOut: integer("tokens_out").notNull().default(0),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_ai_usage_user_date").on(t.userId, t.usageDate),
    check("chk_ai_usage_counts", sql`${t.messagesCount} >= 0 AND ${t.tokensIn} >= 0 AND ${t.tokensOut} >= 0`),
    index("idx_ai_usage_user_date").on(t.userId, t.usageDate),
  ]
);

// ============================================================
// AVATARS — professor virtual (personagem ORIGINAL, sem copyright)
// ============================================================

export const avatars = pgTable(
  "avatars",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    nome: text("nome").notNull(),
    slug: text("slug").notNull(),
    descricao: text("descricao"),
    personalidade: text("personalidade"),
    aparencia: text("aparencia"),
    voz: text("voz"),
    ativo: boolean("ativo").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_avatars_slug").on(t.slug),
  ]
);

// ============================================================
// RELAÇÕES
// ============================================================

export const chatSessionsRelations = relations(chatSessions, ({ one, many }) => ({
  user: one(authUsers, {
    fields: [chatSessions.userId],
    references: [authUsers.id],
  }),
  subject: one(knowledgeSubjects, {
    fields: [chatSessions.knowledgeSubjectId],
    references: [knowledgeSubjects.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  session: one(chatSessions, {
    fields: [chatMessages.sessionId],
    references: [chatSessions.id],
  }),
  user: one(authUsers, {
    fields: [chatMessages.userId],
    references: [authUsers.id],
  }),
}));

export const aiUsageRelations = relations(aiUsage, ({ one }) => ({
  user: one(authUsers, {
    fields: [aiUsage.userId],
    references: [authUsers.id],
  }),
}));

