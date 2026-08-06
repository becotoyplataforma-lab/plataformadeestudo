/**
 * ConcursoAI — Domínio ANALYTICS — Drizzle ORM Schema
 *
 * PostgreSQL · Drizzle ORM · TypeScript Strict
 *
 * Base oficial:
 * - docs/08-DATABASE-PHYSICAL.md (event_logs, daily_summaries)
 * - docs/05-DOMAIN-MODEL.md (aggregate roots: EventLog, DailySummary)
 * - docs/16-ANALYTICS.md (dashboard e métricas)
 * - docs/07-ENTITY-STANDARDS.md (UUID, RLS, naming)
 *
 * OPEN-005 (event bus) e OPEN-006 (materialização do DailySummary) permanecem
 * abertos — este schema define apenas as tabelas físicas; o mecanismo de
 * chegada de eventos e o agendamento de materialização são decisões pós-MVP/V1.1.
 *
 * Apenas schema, enums e relações. Sem lógica de negócio.
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./identity";

// ============================================================
// EVENT_LOGS — registro imutável de eventos de negócio
// ============================================================

export const eventLogs = pgTable(
  "event_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    eventName: text("event_name").notNull(),
    payload: jsonb("payload"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_event_logs_entity").on(t.entityType, t.entityId),
    index("idx_event_logs_user_occurred").on(t.userId, t.occurredAt),
  ]
);

// ============================================================
// DAILY_SUMMARIES — resumo diário de desempenho (materialização: OPEN-006)
// ============================================================

export const dailySummaries = pgTable(
  "daily_summaries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    summaryDate: timestamp("summary_date", { withTimezone: true }).notNull(),
    totalQuestions: integer("total_questions").notNull().default(0),
    correctAnswers: integer("correct_answers").notNull().default(0),
    studyMinutes: integer("study_minutes").notNull().default(0),
    reviewsDone: integer("reviews_done").notNull().default(0),
    aiMessages: integer("ai_messages").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_daily_summaries_user_date").on(t.userId, t.summaryDate),
    check(
      "chk_daily_summaries_counts",
      sql`${t.totalQuestions} >= 0 AND ${t.correctAnswers} >= 0 AND ${t.studyMinutes} >= 0 AND ${t.reviewsDone} >= 0 AND ${t.aiMessages} >= 0`
    ),
    index("idx_daily_summaries_user_date").on(t.userId, t.summaryDate),
  ]
);

// ============================================================
// RELAÇÕES
// ============================================================

export const eventLogsRelations = relations(eventLogs, ({ one }) => ({
  user: one(authUsers, {
    fields: [eventLogs.userId],
    references: [authUsers.id],
  }),
}));

export const dailySummariesRelations = relations(dailySummaries, ({ one }) => ({
  user: one(authUsers, {
    fields: [dailySummaries.userId],
    references: [authUsers.id],
  }),
}));
