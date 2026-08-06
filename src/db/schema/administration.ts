/**
 * ConcursoAI — Domínio ADMINISTRATION — Drizzle ORM Schema
 *
 * PostgreSQL · Drizzle ORM · TypeScript Strict
 *
 * Base oficial:
 * - docs/08-DATABASE-PHYSICAL.md (system_settings, admin_action_logs)
 * - docs/05-DOMAIN-MODEL.md (aggregate roots: SystemSetting, AdminActionLog)
 * - docs/15-ADMIN.md (design V1.1 — allowlist de e-mails como camada MVP)
 * - docs/07-ENTITY-STANDARDS.md (UUID, RLS, naming)
 *
 * NOTA (docs/15 vs docs/08): o design doc usa "admin_audit_log"; o modelo
 * físico oficial (docs/08) define "admin_action_logs" — seguido aqui.
 *
 * Apenas schema, enums e relações. Sem lógica de negócio.
 */
import { relations } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./identity";

// ============================================================
// SYSTEM_SETTINGS — configuração global da plataforma (sem ownership)
// ============================================================

export const systemSettings = pgTable(
  "system_settings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(),
    value: jsonb("value").notNull().default({}),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [uniqueIndex("uq_system_settings_key").on(t.key)]
);

// ============================================================
// ADMIN_ACTION_LOGS — auditoria de ações administrativas (imutável)
// ============================================================

export const adminActionLogs = pgTable(
  "admin_action_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    adminId: uuid("admin_id").references(() => authUsers.id, {
      onDelete: "set null",
    }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    details: jsonb("details"),
    ip: text("ip"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("idx_admin_action_logs_admin_created").on(t.adminId, t.createdAt)]
);

// ============================================================
// RELAÇÕES
// ============================================================

export const adminActionLogsRelations = relations(adminActionLogs, ({ one }) => ({
  admin: one(authUsers, {
    fields: [adminActionLogs.adminId],
    references: [authUsers.id],
  }),
}));
