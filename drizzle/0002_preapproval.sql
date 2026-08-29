ALTER TABLE "subscriptions" ADD COLUMN "preapproval_id" text;--> statement-breakpoint
-- Baseline das tabelas de domínio criadas por SQL legado (organs, boards, contests,
-- editais, positions, notice_subjects, avatars, lessons, lesson_progress,
-- question_moderation_events) + enums contest_status/edital_status.
-- Idempotente (IF NOT EXISTS): seguro aplicar em banco que já possui as tabelas.
DO $$ BEGIN
  CREATE TYPE "public"."contest_status" AS ENUM('rascunho', 'publicado', 'encerrado', 'arquivado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  CREATE TYPE "public"."edital_status" AS ENUM('rascunho', 'publicado', 'arquivado');
EXCEPTION WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "avatars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"slug" text NOT NULL,
	"descricao" text,
	"personalidade" text,
	"aparencia" text,
	"voz" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_avatars_slug" ON "avatars" USING btree ("slug");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "boards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_boards_name" ON "boards" USING btree ("name") WHERE "boards"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_boards_slug" ON "boards" USING btree ("slug") WHERE "boards"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_boards_status" ON "boards" USING btree ("status");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "contests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organ_id" uuid NOT NULL,
	"board_id" uuid NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "contest_status" DEFAULT 'rascunho' NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_contests_period" CHECK ("contests"."end_date" is null or "contests"."start_date" is null or "contests"."end_date" >= "contests"."start_date")
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_contests_slug" ON "contests" USING btree ("slug") WHERE "contests"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contests_status" ON "contests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contests_organ" ON "contests" USING btree ("organ_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_contests_board" ON "contests" USING btree ("board_id");--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_organ_id_organs_id_fk" FOREIGN KEY ("organ_id") REFERENCES "public"."organs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contests" ADD CONSTRAINT "contests_board_id_boards_id_fk" FOREIGN KEY ("board_id") REFERENCES "public"."boards"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "editais" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"title" text NOT NULL,
	"version" text,
	"published_date" timestamp with time zone,
	"content_url" text,
	"programmatic_content" jsonb,
	"is_current" boolean DEFAULT false NOT NULL,
	"status" "edital_status" DEFAULT 'rascunho' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_editais_current_per_contest" ON "editais" USING btree ("contest_id") WHERE "editais"."is_current";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_editais_contest" ON "editais" USING btree ("contest_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_editais_status" ON "editais" USING btree ("status");--> statement-breakpoint
ALTER TABLE "editais" ADD CONSTRAINT "editais_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lesson_progress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" uuid NOT NULL,
	"progress" numeric(3, 2) DEFAULT '0' NOT NULL,
	"current_section" text,
	"completed_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_lesson_progress_user_lesson" ON "lesson_progress" USING btree ("user_id", "lesson_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lesson_progress_user" ON "lesson_progress" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lesson_id_lessons_id_fk" FOREIGN KEY ("lesson_id") REFERENCES "public"."lessons"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lessons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"knowledge_subject_id" uuid NOT NULL,
	"document_id" uuid,
	"avatar_id" uuid,
	"chapter" text,
	"title" text NOT NULL,
	"roteiro" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"conteudo" text,
	"duracao_min" integer,
	"status" text DEFAULT 'publicada' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lessons_user" ON "lessons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lessons_subject" ON "lessons" USING btree ("knowledge_subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lessons_document" ON "lessons" USING btree ("document_id");--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_knowledge_subject_id_knowledge_subjects_id_fk" FOREIGN KEY ("knowledge_subject_id") REFERENCES "public"."knowledge_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_avatar_id_avatars_id_fk" FOREIGN KEY ("avatar_id") REFERENCES "public"."avatars"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notice_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"edital_id" uuid NOT NULL,
	"position_id" uuid,
	"knowledge_subject_id" uuid NOT NULL,
	"weight" integer NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "notice_subjects_weight_check" CHECK ("notice_subjects"."weight" between 0 and 100)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_notice_subjects_scope" ON "notice_subjects" USING btree ("edital_id", "position_id", "knowledge_subject_id") WHERE "notice_subjects"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notice_subjects_edital" ON "notice_subjects" USING btree ("edital_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notice_subjects_position" ON "notice_subjects" USING btree ("position_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notice_subjects_knowledge" ON "notice_subjects" USING btree ("knowledge_subject_id");--> statement-breakpoint
ALTER TABLE "notice_subjects" ADD CONSTRAINT "notice_subjects_edital_id_editais_id_fk" FOREIGN KEY ("edital_id") REFERENCES "public"."editais"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_subjects" ADD CONSTRAINT "notice_subjects_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notice_subjects" ADD CONSTRAINT "notice_subjects_knowledge_subject_id_knowledge_subjects_id_fk" FOREIGN KEY ("knowledge_subject_id") REFERENCES "public"."knowledge_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "organs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organs_name" ON "organs" USING btree ("name") WHERE "organs"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_organs_slug" ON "organs" USING btree ("slug") WHERE "organs"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_organs_status" ON "organs" USING btree ("status");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"contest_id" uuid NOT NULL,
	"edital_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_positions_contest_slug" ON "positions" USING btree ("contest_id", "slug") WHERE "positions"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_positions_contest_id" ON "positions" USING btree ("contest_id", "id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_positions_contest" ON "positions" USING btree ("contest_id");--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_contest_id_contests_id_fk" FOREIGN KEY ("contest_id") REFERENCES "public"."contests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_edital_id_editais_id_fk" FOREIGN KEY ("edital_id") REFERENCES "public"."editais"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "question_moderation_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"action" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_moderation_events_question" ON "question_moderation_events" USING btree ("question_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_moderation_events_admin" ON "question_moderation_events" USING btree ("admin_user_id");--> statement-breakpoint
ALTER TABLE "question_moderation_events" ADD CONSTRAINT "question_moderation_events_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_moderation_events" ADD CONSTRAINT "question_moderation_events_admin_user_id_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
