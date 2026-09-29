CREATE TABLE IF NOT EXISTS "notice_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"notice_subject_id" uuid NOT NULL,
	"knowledge_topic_id" uuid,
	"name" text NOT NULL,
	"normalized_name" text NOT NULL,
	"weight" numeric(5, 2),
	"parent_notice_topic_id" uuid,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "chk_notice_topics_weight" CHECK ("notice_topics"."weight" is null or ("notice_topics"."weight" >= 0 and "notice_topics"."weight" <= 100))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notice_topics" ADD CONSTRAINT "notice_topics_notice_subject_id_notice_subjects_id_fk" FOREIGN KEY ("notice_subject_id") REFERENCES "public"."notice_subjects"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notice_topics" ADD CONSTRAINT "notice_topics_knowledge_topic_id_knowledge_topics_id_fk" FOREIGN KEY ("knowledge_topic_id") REFERENCES "public"."knowledge_topics"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "notice_topics" ADD CONSTRAINT "notice_topics_parent_notice_topic_id_notice_topics_id_fk" FOREIGN KEY ("parent_notice_topic_id") REFERENCES "public"."notice_topics"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_notice_topics_subject_norm" ON "notice_topics" USING btree ("notice_subject_id","normalized_name") WHERE "notice_topics"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notice_topics_subject" ON "notice_topics" USING btree ("notice_subject_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notice_topics_knowledge" ON "notice_topics" USING btree ("knowledge_topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notice_topics_parent" ON "notice_topics" USING btree ("parent_notice_topic_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_notice_topics_norm" ON "notice_topics" USING btree ("normalized_name");
