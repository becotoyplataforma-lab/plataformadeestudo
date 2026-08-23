/**
 * ConcursoAI — Domínio IDENTITY — Drizzle ORM Schema
 *
 * PostgreSQL · Drizzle ORM · TypeScript Strict
 *
 * Base oficial:
 * - ADR-001 (auth.users como única fonte de identidade; public.users não existe)
 * - docs/08-DATABASE-PHYSICAL.md
 *
 * ADR-001 resolvido (FASE 10): database/identity/*.sql foram alinhados —
 * public.users removido; profiles e sessions referenciam auth.users.
 *
 * Apenas schema, enums e relações. Sem lógica de negócio, services, repository ou API.
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { contests, positions } from "./contest";

// Enum compartilhado de ciclo de vida — definido em ./enums.ts e reexportado
// aqui para manter compatibilidade (evita import circular identity ⇄ contest).
export { lifecycleStatus } from "./enums";

// ============================================================
// ENUMS
// ============================================================

// lifecycleStatus (lifecycle_status) agora vive em ./enums.ts e é
// reexportado no topo deste arquivo (evita import circular com Contest).

/** Nível de conhecimento do aluno (user_level). */
export const userLevel = pgEnum("user_level", [
  "iniciante",
  "intermediario",
  "avancado",
]);

/** Modelo de IA utilizado (ai_model). */
export const aiModel = pgEnum("ai_model", ["flash", "pro", "kimi"]);

// ============================================================
// AUTH.USERS — referência externa (Supabase Auth)
// ============================================================

/** Schema `auth` do Supabase. */
const authSchema = pgSchema("auth");

/**
 * auth.users — fonte oficial de identidade (ADR-001).
 * Não é criada pela aplicação; é gerenciada pelo Supabase Auth.
 * Apenas a coluna `id` é referenciada por este schema.
 */
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  // Demais colunas (senha, MFA, recovery...) gerenciadas pelo Supabase Auth.
});

// ============================================================
// PROFILES — dados complementares à identidade (1:1 com auth.users)
// ============================================================

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    fullName: text("full_name"),
    avatarUrl: text("avatar_url"),
    level: userLevel("level").notNull().default("iniciante"),
    concursoAlvo: text("concurso_alvo"),
    bancaPreferida: text("banca_preferida"),
    contestId: uuid("contest_id"),
    positionId: uuid("position_id"),
    metaDiariaMin: integer("meta_diaria_min").notNull().default(120),
    modeloIaPadrao: aiModel("modelo_ia_padrao").notNull().default("flash"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("chk_profiles_meta_diaria", sql`${t.metaDiariaMin} between 15 and 720`),
    // FKs do domínio Contest (espelho de database/contest/schema.sql):
    foreignKey({
      columns: [t.contestId],
      foreignColumns: [contests.id],
      name: "fk_profiles_contest",
    }).onDelete("set null"),
    // FK composta garante que position pertence ao contest (DD-023 4b).
    foreignKey({
      columns: [t.contestId, t.positionId],
      foreignColumns: [positions.contestId, positions.id],
      name: "fk_profiles_contest_position",
    }).onDelete("set null"),
  ]
);

// ============================================================
// SESSIONS — sessão interna (apenas se houver necessidade além do Supabase Auth)
// ============================================================

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_sessions_token_active")
      .on(t.token)
      .where(sql`${t.deletedAt} is null`),
    index("idx_sessions_user_id").on(t.userId),
    index("idx_sessions_expires_at").on(t.expiresAt),
  ]
);

// ============================================================
// RELAÇÕES
// ============================================================

/** Relação 1:1 entre profile e auth.users. */
export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(authUsers, {
    fields: [profiles.id],
    references: [authUsers.id],
  }),
  /** Concurso alvo (domínio Contest). */
  contest: one(contests, {
    fields: [profiles.contestId],
    references: [contests.id],
  }),
  /** Cargo do concurso (composta — pertence ao contest). */
  position: one(positions, {
    fields: [profiles.contestId, profiles.positionId],
    references: [positions.contestId, positions.id],
  }),
}));

/** Relação N:1 entre sessions e auth.users. */
export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(authUsers, {
    fields: [sessions.userId],
    references: [authUsers.id],
  }),
}));

/** Relações reversas a partir de auth.users. */
export const authUsersRelations = relations(authUsers, ({ many }) => ({
  profiles: many(profiles),
  sessions: many(sessions),
}));
