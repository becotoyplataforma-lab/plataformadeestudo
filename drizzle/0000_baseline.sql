CREATE TYPE "public"."ai_model" AS ENUM('flash', 'pro', 'kimi');--> statement-breakpoint
CREATE TYPE "public"."lifecycle_status" AS ENUM('active', 'inactive', 'archived');--> statement-breakpoint
CREATE TYPE "public"."user_level" AS ENUM('iniciante', 'intermediario', 'avancado');--> statement-breakpoint
CREATE TYPE "public"."document_status" AS ENUM('pending', 'processing', 'processed', 'chunked', 'indexing', 'indexed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('pdf', 'docx', 'txt', 'markdown', 'html', 'edital', 'apostila');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('upload', 'edital', 'url');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"full_name" text,
	"avatar_url" text,
	"level" "user_level" DEFAULT 'iniciante' NOT NULL,
	"concurso_alvo" text,
	"banca_preferida" text,
	"meta_diaria_min" integer DEFAULT 120 NOT NULL,
	"modelo_ia_padrao" "ai_model" DEFAULT 'flash' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_profiles_meta_diaria" CHECK ("profiles"."meta_diaria_min" between 15 and 720)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"seq" integer NOT NULL,
	"content" text NOT NULL,
	"content_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"fts_vector" "tsvector" GENERATED ALWAYS AS (to_tsvector('portuguese', "content")) STORED NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_chunks_seq" CHECK ("document_chunks"."seq" >= 0)
);
--> statement-breakpoint
CREATE TABLE "document_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"confidence" integer DEFAULT 100,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_document_subjects_confidence" CHECK ("document_subjects"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "document_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "document_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"confidence" integer DEFAULT 100,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_document_topics_confidence" CHECK ("document_topics"."confidence" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"title" text NOT NULL,
	"storage_path" text NOT NULL,
	"status" "document_status" DEFAULT 'pending' NOT NULL,
	"file_size" integer,
	"mime_type" text,
	"source_type" "source_type" DEFAULT 'upload' NOT NULL,
	"source_url" text,
	"external_id" uuid,
	"file_hash" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_documents_file_size" CHECK ("documents"."file_size" >= 0)
);
--> statement-breakpoint
CREATE TABLE "embedding_cache" (
	"content_hash" text NOT NULL,
	"model" varchar(100) NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "embedding_cache_content_hash_model_pk" PRIMARY KEY("content_hash","model")
);
--> statement-breakpoint
CREATE TABLE "embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chunk_id" uuid NOT NULL,
	"model" varchar(100) DEFAULT 'BAAI/bge-m3' NOT NULL,
	"embedding" vector(1024) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"color" text,
	"keywords" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "knowledge_tags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"parent_topic_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_subjects" ADD CONSTRAINT "document_subjects_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_subjects" ADD CONSTRAINT "document_subjects_subject_id_knowledge_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."knowledge_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_tags" ADD CONSTRAINT "document_tags_tag_id_knowledge_tags_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."knowledge_tags"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_topics" ADD CONSTRAINT "document_topics_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_topics" ADD CONSTRAINT "document_topics_topic_id_knowledge_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."knowledge_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_chunk_id_document_chunks_id_fk" FOREIGN KEY ("chunk_id") REFERENCES "public"."document_chunks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_topics" ADD CONSTRAINT "knowledge_topics_subject_id_knowledge_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."knowledge_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "knowledge_topics" ADD CONSTRAINT "knowledge_topics_parent_topic_id_knowledge_topics_id_fk" FOREIGN KEY ("parent_topic_id") REFERENCES "public"."knowledge_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_sessions_token_active" ON "sessions" USING btree ("token") WHERE "sessions"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_sessions_user_id" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires_at" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_chunks_doc_seq" ON "document_chunks" USING btree ("document_id","seq") WHERE "document_chunks"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_chunks_document" ON "document_chunks" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_chunks_content_hash" ON "document_chunks" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "idx_chunks_fts" ON "document_chunks" USING gin ("fts_vector");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_subjects" ON "document_subjects" USING btree ("document_id","subject_id");--> statement-breakpoint
CREATE INDEX "idx_document_subjects_doc" ON "document_subjects" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_subjects_subject" ON "document_subjects" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_tags" ON "document_tags" USING btree ("document_id","tag_id");--> statement-breakpoint
CREATE INDEX "idx_document_tags_doc" ON "document_tags" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_tags_tag" ON "document_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_document_topics" ON "document_topics" USING btree ("document_id","topic_id");--> statement-breakpoint
CREATE INDEX "idx_document_topics_doc" ON "document_topics" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "idx_document_topics_topic" ON "document_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_documents_storage_path" ON "documents" USING btree ("storage_path") WHERE "documents"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_documents_file_hash" ON "documents" USING btree ("user_id","file_hash") WHERE "documents"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_documents_user_status" ON "documents" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_documents_user_hash" ON "documents" USING btree ("user_id","file_hash");--> statement-breakpoint
CREATE INDEX "idx_documents_status" ON "documents" USING btree ("status") WHERE "documents"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_embeddings_chunk" ON "embeddings" USING btree ("chunk_id");--> statement-breakpoint
CREATE INDEX "idx_embeddings_hnsw" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops) WITH (m=16,ef_construction=200);--> statement-breakpoint
CREATE UNIQUE INDEX "uq_knowledge_subjects_name" ON "knowledge_subjects" USING btree ("name") WHERE "knowledge_subjects"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_knowledge_subjects_slug" ON "knowledge_subjects" USING btree ("slug") WHERE "knowledge_subjects"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_knowledge_subjects_status" ON "knowledge_subjects" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_knowledge_tags_slug" ON "knowledge_tags" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_knowledge_tags_name" ON "knowledge_tags" USING btree ("name");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_knowledge_topics_slug_subject" ON "knowledge_topics" USING btree ("subject_id","slug") WHERE "knowledge_topics"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "idx_knowledge_topics_subject" ON "knowledge_topics" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_topics_parent" ON "knowledge_topics" USING btree ("parent_topic_id");--> statement-breakpoint
CREATE INDEX "idx_knowledge_topics_status" ON "knowledge_topics" USING btree ("status");