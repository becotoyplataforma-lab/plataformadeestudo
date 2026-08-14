/**
 * ConcursoAI — Domínio STUDY — Drizzle ORM Schema
 *
 * PostgreSQL · Drizzle ORM · TypeScript Strict
 *
 * Base oficial:
 * - docs/05-DOMAIN-MODEL.md (aggregate roots: Question, QuestionAttempt,
 *   Flashcard, KnowledgeSubject, StudySubject, StudyTask)
 * - docs/08-DATABASE-PHYSICAL.md (entidades study_subjects, study_tasks,
 *   questions, question_options, question_attempts, flashcards, review_schedules)
 * - docs/07-ENTITY-STANDARDS.md (UUID, soft delete, auditoria, RLS, naming)
 * - docs/14-ARCHITECTURE-BASELINE.md
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
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./identity";
import { knowledgeSubjects } from "./knowledge";

// ============================================================
// ENUMS
// ============================================================

/** Estado de uma tarefa de estudo (task_status). */
export const taskStatus = pgEnum("task_status", [
  "pendente",
  "concluida",
  "adiada",
]);

/** Dificuldade de uma questão (question_level). */
export const questionLevel = pgEnum("question_level", [
  "facil",
  "medio",
  "dificil",
]);

/** Estado de curadoria de uma questão (question_status). */
export const questionStatus = pgEnum("question_status", [
  "rascunho",
  "publicada",
  "bloqueada",
]);

/** Modo de resolução de questão (attempt_mode). */
export const attemptMode = pgEnum("attempt_mode", [
  "estudo",
  "simulado",
  "revisao",
]);

/** Autoavaliação de revisão (review_rating). */
export const reviewRating = pgEnum("review_rating", [
  "facil",
  "medio",
  "dificil",
]);

// ============================================================
// STUDY_SUBJECTS — disciplina do aluno
// ============================================================

export const studySubjects = pgTable(
  "study_subjects",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color"),
    priority: integer("priority").notNull().default(3),
    cargaHorariaTotal: integer("carga_horaria_total").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_study_subjects_user_name")
      .on(t.userId, t.name)
      .where(sql`${t.deletedAt} is null`),
    check("chk_study_subjects_priority", sql`${t.priority} between 1 and 5`),
    index("idx_study_subjects_user").on(t.userId),
  ]
);

// ============================================================
// STUDY_TASKS — tarefa de estudo agendada
// ============================================================

export const studyTasks = pgTable(
  "study_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    studySubjectId: uuid("study_subject_id").references(
      () => studySubjects.id,
      { onDelete: "set null" }
    ),
    title: text("title").notNull(),
    description: text("description"),
    scheduledDate: timestamp("scheduled_date", { withTimezone: true }).notNull(),
    durationMin: integer("duration_min").notNull(),
    status: taskStatus("status").notNull().default("pendente"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    check("chk_study_tasks_duration", sql`${t.durationMin} between 5 and 600`),
    index("idx_study_tasks_user_date").on(t.userId, t.scheduledDate),
    index("idx_study_tasks_user_status").on(t.userId, t.status),
  ]
);

// ============================================================
// QUESTIONS — questão de prova com gabarito
// ============================================================

export const questions = pgTable(
  "questions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    knowledgeSubjectId: uuid("knowledge_subject_id")
      .notNull()
      .references(() => knowledgeSubjects.id, { onDelete: "restrict" }),
    banca: text("banca"),
    cargo: text("cargo"),
    ano: integer("ano"),
    nivel: questionLevel("nivel").notNull(),
    enunciado: text("enunciado").notNull(),
    gabarito: text("gabarito").notNull(),
    explicacao: text("explicacao"),
    tipo: text("tipo").notNull().default("multipla_escolha"),
    fonte: text("fonte"),
    isPublic: boolean("is_public").notNull().default(false),
    contentHash: text("content_hash"),
    status: questionStatus("status").notNull().default("rascunho"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_questions_content_hash")
      .on(t.contentHash)
      .where(sql`${t.deletedAt} is null`),
    check("chk_questions_gabarito", sql`${t.gabarito} ~ '^[A-E]$'`),
    index("idx_questions_subject").on(t.knowledgeSubjectId),
    index("idx_questions_banca").on(t.banca),
    index("idx_questions_nivel").on(t.nivel),
    index("idx_questions_status").on(t.status),
  ]
);

// ============================================================
// QUESTION_OPTIONS — alternativa de uma questão
// ============================================================

export const questionOptions = pgTable(
  "question_options",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    letter: text("letter").notNull(),
    text: text("text").notNull(),
    isCorrect: boolean("is_correct").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_question_options_letter")
      .on(t.questionId, t.letter)
      .where(sql`${t.deletedAt} is null`),
    check("chk_question_options_letter", sql`${t.letter} ~ '^[A-E]$'`),
    index("idx_question_options_question").on(t.questionId),
  ]
);

// ============================================================
// QUESTION_ATTEMPTS — tentativa de resposta
// ============================================================

export const questionAttempts = pgTable(
  "question_attempts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    selectedLetter: text("selected_letter").notNull(),
    isCorrect: boolean("is_correct").notNull(),
    timeSpentSec: integer("time_spent_sec").notNull().default(0),
    mode: attemptMode("mode").notNull().default("estudo"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check("chk_attempts_letter", sql`${t.selectedLetter} ~ '^[A-E]$'`),
    check("chk_attempts_time", sql`${t.timeSpentSec} >= 0`),
    index("idx_attempts_user_created").on(t.userId, t.createdAt),
    index("idx_attempts_question").on(t.questionId),
  ]
);

// ============================================================
// FLASHCARDS — cartão de memorização
// ============================================================

export const flashcards = pgTable(
  "flashcards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    studySubjectId: uuid("study_subject_id").references(
      () => studySubjects.id,
      { onDelete: "set null" }
    ),
    front: text("front").notNull(),
    back: text("back").notNull(),
    tags: jsonb("tags").notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    index("idx_flashcards_user").on(t.userId),
    index("idx_flashcards_tags").using("gin", sql`${t.tags}`),
  ]
);

// ============================================================
// REVIEW_SCHEDULES — agendamento de revisão espaçada
// ============================================================

export const reviewSchedules = pgTable(
  "review_schedules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    flashcardId: uuid("flashcard_id")
      .notNull()
      .references(() => flashcards.id, { onDelete: "cascade" }),
    intervalDays: integer("interval_days").notNull().default(0),
    easeFactor: numeric("ease_factor", { precision: 4, scale: 2 })
      .notNull()
      .default("2.50"),
    repetitions: integer("repetitions").notNull().default(0),
    dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
    lastReviewedAt: timestamp("last_reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("uq_review_schedules_user_flashcard")
      .on(t.userId, t.flashcardId)
      .where(sql`${t.deletedAt} is null`),
    check("chk_review_interval", sql`${t.intervalDays} >= 0`),
    check("chk_review_ease", sql`${t.easeFactor} > 0`),
    index("idx_review_schedules_user_due").on(t.userId, t.dueDate),
  ]
);

// ============================================================
// RELAÇÕES
// ============================================================

export const studySubjectsRelations = relations(studySubjects, ({ one, many }) => ({
  user: one(authUsers, {
    fields: [studySubjects.userId],
    references: [authUsers.id],
  }),
  tasks: many(studyTasks),
  flashcards: many(flashcards),
}));

export const studyTasksRelations = relations(studyTasks, ({ one }) => ({
  user: one(authUsers, {
    fields: [studyTasks.userId],
    references: [authUsers.id],
  }),
  subject: one(studySubjects, {
    fields: [studyTasks.studySubjectId],
    references: [studySubjects.id],
  }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  subject: one(knowledgeSubjects, {
    fields: [questions.knowledgeSubjectId],
    references: [knowledgeSubjects.id],
  }),
  options: many(questionOptions),
  attempts: many(questionAttempts),
}));

export const questionOptionsRelations = relations(questionOptions, ({ one }) => ({
  question: one(questions, {
    fields: [questionOptions.questionId],
    references: [questions.id],
  }),
}));

export const questionAttemptsRelations = relations(questionAttempts, ({ one }) => ({
  user: one(authUsers, {
    fields: [questionAttempts.userId],
    references: [authUsers.id],
  }),
  question: one(questions, {
    fields: [questionAttempts.questionId],
    references: [questions.id],
  }),
}));

export const flashcardsRelations = relations(flashcards, ({ one }) => ({
  user: one(authUsers, {
    fields: [flashcards.userId],
    references: [authUsers.id],
  }),
  subject: one(studySubjects, {
    fields: [flashcards.studySubjectId],
    references: [studySubjects.id],
  }),
  schedule: one(reviewSchedules),
}));

export const reviewSchedulesRelations = relations(reviewSchedules, ({ one }) => ({
  user: one(authUsers, {
    fields: [reviewSchedules.userId],
    references: [authUsers.id],
  }),
  flashcard: one(flashcards, {
    fields: [reviewSchedules.flashcardId],
    references: [flashcards.id],
  }),
}));

