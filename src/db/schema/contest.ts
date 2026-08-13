/**
 * ConcursoAI — Domínio CONTEST — Drizzle ORM Schema
 *
 * PostgreSQL · Drizzle ORM · TypeScript Strict
 *
 * Base oficial (espelho exato do banco):
 * - database/contest/schema.sql + rls.sql (já aplicados no banco)
 * - docs/19-CONTEST-INTELLIGENCE-SPEC.md (D1–D6, DD-020→DD-025)
 * - docs/20-CONTEST-IMPLEMENTATION-MAP.md
 *
 * Apenas schema, enums e relações. Sem lógica de negócio.
 * Nota: as FKs de public.profiles → contests/positions são declaradas em
 * identity.ts (onde a tabela profiles vive), não aqui.
 */
import { sql } from "drizzle-orm";
import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { lifecycleStatus } from "./enums";
import { knowledgeSubjects } from "./knowledge";

// ============================================================
// ENUMS
// ============================================================

/** Estado de um concurso (contest_status). */
export const contestStatus = pgEnum("contest_status", [
  "rascunho",
  "publicado",
  "encerrado",
  "arquivado",
]);

/** Estado de um edital (edital_status). */
export const editalStatus = pgEnum("edital_status", [
  "rascunho",
  "publicado",
  "arquivado",
]);

// ============================================================
// ORGANS — órgão realizador (catálogo)
// ============================================================

export const organs = pgTable(
  "organs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: lifecycleStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_organs_name")
      .on(t.name)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("uq_organs_slug")
      .on(t.slug)
      .where(sql`${t.deletedAt} is null`),
    index("idx_organs_status").on(t.status),
  ]
);

// ============================================================
// BOARDS — banca organizadora (catálogo)
// ============================================================

export const boards = pgTable(
  "boards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: lifecycleStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_boards_name")
      .on(t.name)
      .where(sql`${t.deletedAt} is null`),
    uniqueIndex("uq_boards_slug")
      .on(t.slug)
      .where(sql`${t.deletedAt} is null`),
    index("idx_boards_status").on(t.status),
  ]
);

// ============================================================
// CONTESTS — concurso público (agregado raiz)
// ============================================================

export const contests = pgTable(
  "contests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organId: uuid("organ_id")
      .notNull()
      .references(() => organs.id, { onDelete: "restrict" }),
    boardId: uuid("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: contestStatus("status").notNull().default("rascunho"),
    startDate: timestamp("start_date", { withTimezone: true }),
    endDate: timestamp("end_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check(
      "chk_contests_period",
      sql`${t.endDate} is null or ${t.startDate} is null or ${t.endDate} >= ${t.startDate}`
    ),
    uniqueIndex("uq_contests_slug")
      .on(t.slug)
      .where(sql`${t.deletedAt} is null`),
    index("idx_contests_status").on(t.status),
    index("idx_contests_organ").on(t.organId),
    index("idx_contests_board").on(t.boardId),
  ]
);

// ============================================================
// EDITAIS — edital oficial do concurso (fonte do conteúdo programático)
// ============================================================

export const editais = pgTable(
  "editais",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    version: text("version"),
    publishedDate: timestamp("published_date", { withTimezone: true }),
    contentUrl: text("content_url"),
    programmaticContent: jsonb("programmatic_content"),
    isCurrent: boolean("is_current").notNull().default(false),
    status: editalStatus("status").notNull().default("rascunho"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // No máximo 1 edital vigente por concurso (DD-023).
    uniqueIndex("uq_editais_current_per_contest")
      .on(t.contestId)
      .where(sql`${t.isCurrent}`),
    index("idx_editais_contest").on(t.contestId),
    index("idx_editais_status").on(t.status),
  ]
);

// ============================================================
// POSITIONS — cargo do concurso (habilita a FK composta de profiles)
// ============================================================

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contestId: uuid("contest_id")
      .notNull()
      .references(() => contests.id, { onDelete: "cascade" }),
    editalId: uuid("edital_id").references(() => editais.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    status: lifecycleStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_positions_contest_slug")
      .on(t.contestId, t.slug)
      .where(sql`${t.deletedAt} is null`),
    // Alvo da FK composta de profiles(contest_id, position_id):
    uniqueIndex("uq_positions_contest_id").on(t.contestId, t.id),
    index("idx_positions_contest").on(t.contestId),
  ]
);

// ============================================================
// NOTICE_SUBJECTS — matéria do edital com peso (DD-020/DD-021)
// ============================================================

export const noticeSubjects = pgTable(
  "notice_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editalId: uuid("edital_id")
      .notNull()
      .references(() => editais.id, { onDelete: "cascade" }),
    positionId: uuid("position_id").references(() => positions.id, {
      onDelete: "set null",
    }),
    knowledgeSubjectId: uuid("knowledge_subject_id")
      .notNull()
      .references(() => knowledgeSubjects.id, { onDelete: "restrict" }),
    weight: integer("weight").notNull(),
    status: lifecycleStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // DD-021: weight 0–100 (0 ≠ ausência).
    check("notice_subjects_weight_check", sql`${t.weight} between 0 and 100`),
    // DD-020: escopo (edital, position NULL=geral / preenchido=cargo, matéria).
    uniqueIndex("uq_notice_subjects_scope")
      .on(t.editalId, t.positionId, t.knowledgeSubjectId)
      .where(sql`${t.deletedAt} is null`),
    index("idx_notice_subjects_edital").on(t.editalId),
    index("idx_notice_subjects_position").on(t.positionId),
    index("idx_notice_subjects_knowledge").on(t.knowledgeSubjectId),
  ]
);

// ============================================================
// RELAÇÕES
// ============================================================

export const organsRelations = relations(organs, ({ many }) => ({
  contests: many(contests),
}));

export const boardsRelations = relations(boards, ({ many }) => ({
  contests: many(contests),
}));

export const contestsRelations = relations(contests, ({ one, many }) => ({
  organ: one(organs, {
    fields: [contests.organId],
    references: [organs.id],
  }),
  board: one(boards, {
    fields: [contests.boardId],
    references: [boards.id],
  }),
  editais: many(editais),
  positions: many(positions),
}));

export const editaisRelations = relations(editais, ({ one, many }) => ({
  contest: one(contests, {
    fields: [editais.contestId],
    references: [contests.id],
  }),
  positions: many(positions),
  noticeSubjects: many(noticeSubjects),
}));

export const positionsRelations = relations(positions, ({ one, many }) => ({
  contest: one(contests, {
    fields: [positions.contestId],
    references: [contests.id],
  }),
  edital: one(editais, {
    fields: [positions.editalId],
    references: [editais.id],
  }),
  noticeSubjects: many(noticeSubjects),
}));

export const noticeSubjectsRelations = relations(noticeSubjects, ({ one }) => ({
  edital: one(editais, {
    fields: [noticeSubjects.editalId],
    references: [editais.id],
  }),
  position: one(positions, {
    fields: [noticeSubjects.positionId],
    references: [positions.id],
  }),
  knowledgeSubject: one(knowledgeSubjects, {
    fields: [noticeSubjects.knowledgeSubjectId],
    references: [knowledgeSubjects.id],
  }),
}));
