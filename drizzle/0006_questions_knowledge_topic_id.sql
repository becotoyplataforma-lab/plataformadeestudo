ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "knowledge_topic_id" uuid REFERENCES "knowledge_topics"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_questions_topic_id" ON "questions" ("knowledge_topic_id");
