CREATE TYPE "public"."attempt_mode" AS ENUM('estudo', 'simulado', 'revisao');--> statement-breakpoint
CREATE TYPE "public"."question_level" AS ENUM('facil', 'medio', 'dificil');--> statement-breakpoint
CREATE TYPE "public"."question_status" AS ENUM('rascunho', 'publicada', 'bloqueada');--> statement-breakpoint
CREATE TYPE "public"."review_rating" AS ENUM('facil', 'medio', 'dificil');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('pendente', 'concluida', 'adiada');--> statement-breakpoint
CREATE TYPE "public"."chat_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'approved', 'rejected', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'cancelled', 'expired', 'past_due', 'suspended');--> statement-breakpoint
CREATE TABLE "flashcards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"study_subject_id" uuid,
	"front" text NOT NULL,
	"back" text NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "question_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_letter" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"time_spent_sec" integer DEFAULT 0 NOT NULL,
	"mode" "attempt_mode" DEFAULT 'estudo' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_attempts_letter" CHECK ("question_attempts"."selected_letter" ~ '^[A-E]$'),
	CONSTRAINT "chk_attempts_time" CHECK ("question_attempts"."time_spent_sec" >= 0)
);
--> statement-breakpoint
CREATE TABLE "question_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"question_id" uuid NOT NULL,
	"letter" text NOT NULL,
	"text" text NOT NULL,
	"is_correct" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_question_options_letter" CHECK ("question_options"."letter" ~ '^[A-E]$')
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"knowledge_subject_id" uuid NOT NULL,
	"banca" text,
	"cargo" text,
	"ano" integer,
	"nivel" "question_level" NOT NULL,
	"enunciado" text NOT NULL,
	"gabarito" text NOT NULL,
	"explicacao" text,
	"tipo" text DEFAULT 'multipla_escolha' NOT NULL,
	"fonte" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"content_hash" text,
	"status" "question_status" DEFAULT 'rascunho' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_questions_gabarito" CHECK ("questions"."gabarito" ~ '^[A-E]$')
);
--> statement-breakpoint
CREATE TABLE "review_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"flashcard_id" uuid NOT NULL,
	"interval_days" integer DEFAULT 0 NOT NULL,
	"ease_factor" numeric(4, 2) DEFAULT '2.50' NOT NULL,
	"repetitions" integer DEFAULT 0 NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"last_reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_review_interval" CHECK ("review_schedules"."interval_days" >= 0),
	CONSTRAINT "chk_review_ease" CHECK ("review_schedules"."ease_factor" > 0)
);
--> statement-breakpoint
CREATE TABLE "study_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"priority" integer DEFAULT 3 NOT NULL,
	"carga_horaria_total" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_study_subjects_priority" CHECK ("study_subjects"."priority" between 1 and 5)
);
--> statement-breakpoint
CREATE TABLE "study_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"study_subject_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"scheduled_date" timestamp with time zone NOT NULL,
	"duration_min" integer NOT NULL,
	"status" "task_status" DEFAULT 'pendente' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_study_tasks_duration" CHECK ("study_tasks"."duration_min" between 5 and 600)
);
--> statement-breakpoint
CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"usage_date" timestamp with time zone NOT NULL,
	"messages_count" integer DEFAULT 0 NOT NULL,
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_ai_usage_counts" CHECK ("ai_usage"."messages_count" >= 0 AND "ai_usage"."tokens_in" >= 0 AND "ai_usage"."tokens_out" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "chat_role" NOT NULL,
	"content" text NOT NULL,
	"model" "ai_model",
	"tokens_in" integer DEFAULT 0 NOT NULL,
	"tokens_out" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_chat_messages_tokens_in" CHECK ("chat_messages"."tokens_in" >= 0),
	CONSTRAINT "chk_chat_messages_tokens_out" CHECK ("chat_messages"."tokens_out" >= 0)
);
--> statement-breakpoint
CREATE TABLE "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"knowledge_subject_id" uuid,
	"model" "ai_model" DEFAULT 'flash' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"subscription_id" uuid,
	"provider" text NOT NULL,
	"provider_id" text,
	"amount_cents" integer DEFAULT 0 NOT NULL,
	"currency" text DEFAULT 'BRL' NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"external_reference" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_payments_amount" CHECK ("payments"."amount_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"price_cents" integer DEFAULT 0 NOT NULL,
	"limits" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "lifecycle_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_plans_price" CHECK ("plans"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_subscriptions_dates" CHECK ("subscriptions"."ends_at" is null OR "subscriptions"."ends_at" > "subscriptions"."starts_at")
);
--> statement-breakpoint
CREATE TABLE "daily_summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"summary_date" timestamp with time zone NOT NULL,
	"total_questions" integer DEFAULT 0 NOT NULL,
	"correct_answers" integer DEFAULT 0 NOT NULL,
	"study_minutes" integer DEFAULT 0 NOT NULL,
	"reviews_done" integer DEFAULT 0 NOT NULL,
	"ai_messages" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_daily_summaries_counts" CHECK ("daily_summaries"."total_questions" >= 0 AND "daily_summaries"."correct_answers" >= 0 AND "daily_summaries"."study_minutes" >= 0 AND "daily_summaries"."reviews_done" >= 0 AND "daily_summaries"."ai_messages" >= 0)
);
--> statement-breakpoint
CREATE TABLE "event_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"event_name" text NOT NULL,
	"payload" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_action_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"details" jsonb,
	"ip" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_study_subject_id_study_subjects_id_fk" FOREIGN KEY ("study_subject_id") REFERENCES "public"."study_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_attempts" ADD CONSTRAINT "question_attempts_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_knowledge_subject_id_knowledge_subjects_id_fk" FOREIGN KEY ("knowledge_subject_id") REFERENCES "public"."knowledge_subjects"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_schedules" ADD CONSTRAINT "review_schedules_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_schedules" ADD CONSTRAINT "review_schedules_flashcard_id_flashcards_id_fk" FOREIGN KEY ("flashcard_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_subjects" ADD CONSTRAINT "study_subjects_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_tasks" ADD CONSTRAINT "study_tasks_study_subject_id_study_subjects_id_fk" FOREIGN KEY ("study_subject_id") REFERENCES "public"."study_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage" ADD CONSTRAINT "ai_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_knowledge_subject_id_knowledge_subjects_id_fk" FOREIGN KEY ("knowledge_subject_id") REFERENCES "public"."knowledge_subjects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."plans"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_logs" ADD CONSTRAINT "event_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_action_logs" ADD CONSTRAINT "admin_action_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "auth"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_flashcards_user" ON "flashcards" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_flashcards_tags" ON "flashcards" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_attempts_user_created" ON "question_attempts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_attempts_question" ON "question_attempts" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_question_options_letter" ON "question_options" USING btree ("question_id","letter") WHERE "question_options"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_question_options_question" ON "question_options" USING btree ("question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_questions_content_hash" ON "questions" USING btree ("content_hash") WHERE "questions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_questions_subject" ON "questions" USING btree ("knowledge_subject_id");--> statement-breakpoint
CREATE INDEX "idx_questions_banca" ON "questions" USING btree ("banca");--> statement-breakpoint
CREATE INDEX "idx_questions_nivel" ON "questions" USING btree ("nivel");--> statement-breakpoint
CREATE INDEX "idx_questions_status" ON "questions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_review_schedules_user_flashcard" ON "review_schedules" USING btree ("user_id","flashcard_id") WHERE "review_schedules"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_review_schedules_user_due" ON "review_schedules" USING btree ("user_id","due_date");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_study_subjects_user_name" ON "study_subjects" USING btree ("user_id","name") WHERE "study_subjects"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_study_subjects_user" ON "study_subjects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_study_tasks_user_date" ON "study_tasks" USING btree ("user_id","scheduled_date");--> statement-breakpoint
CREATE INDEX "idx_study_tasks_user_status" ON "study_tasks" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_usage_user_date" ON "ai_usage" USING btree ("user_id","usage_date");--> statement-breakpoint
CREATE INDEX "idx_ai_usage_user_date" ON "ai_usage" USING btree ("user_id","usage_date");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_session_created" ON "chat_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_chat_messages_user" ON "chat_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_chat_sessions_user_updated" ON "chat_sessions" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_payments_provider_id" ON "payments" USING btree ("provider_id") WHERE "payments"."provider_id" is not null;--> statement-breakpoint
CREATE INDEX "idx_payments_user_created" ON "payments" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_payments_subscription" ON "payments" USING btree ("subscription_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_plans_code" ON "plans" USING btree ("code");--> statement-breakpoint
CREATE INDEX "idx_plans_status" ON "plans" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_subscriptions_user_active" ON "subscriptions" USING btree ("user_id") WHERE "subscriptions"."deleted_at" is null AND "subscriptions"."status" = 'active';--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user_status" ON "subscriptions" USING btree ("user_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_daily_summaries_user_date" ON "daily_summaries" USING btree ("user_id","summary_date");--> statement-breakpoint
CREATE INDEX "idx_daily_summaries_user_date" ON "daily_summaries" USING btree ("user_id","summary_date");--> statement-breakpoint
CREATE INDEX "idx_event_logs_entity" ON "event_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "idx_event_logs_user_occurred" ON "event_logs" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "idx_admin_action_logs_admin_created" ON "admin_action_logs" USING btree ("admin_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_system_settings_key" ON "system_settings" USING btree ("key");