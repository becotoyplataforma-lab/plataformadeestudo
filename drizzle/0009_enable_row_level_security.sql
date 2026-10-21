-- ============================================================
-- ConcursoAI — Ativação de Row Level Security (RLS) em 100% das tabelas
-- ============================================================

ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

ALTER TABLE IF EXISTS public.study_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tasks_all_own" ON public.study_tasks;
CREATE POLICY "tasks_all_own" ON public.study_tasks FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.question_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "attempts_all_own" ON public.question_attempts;
CREATE POLICY "attempts_all_own" ON public.question_attempts FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.flashcards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "flashcards_all_own" ON public.flashcards;
CREATE POLICY "flashcards_all_own" ON public.flashcards FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.review_schedules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_all_own" ON public.review_schedules;
CREATE POLICY "reviews_all_own" ON public.review_schedules FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.chat_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sessions_all_own" ON public.chat_sessions;
CREATE POLICY "sessions_all_own" ON public.chat_sessions FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "messages_all_own" ON public.chat_messages;
CREATE POLICY "messages_all_own" ON public.chat_messages FOR ALL USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.chat_sessions s WHERE s.id = session_id AND s.user_id = auth.uid()));

ALTER TABLE IF EXISTS public.documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents_own_or_public" ON public.documents;
CREATE POLICY "documents_own_or_public" ON public.documents FOR SELECT USING (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "documents_write_own" ON public.documents;
CREATE POLICY "documents_write_own" ON public.documents FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "documents_modify_own" ON public.documents;
CREATE POLICY "documents_modify_own" ON public.documents FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "documents_delete_own" ON public.documents;
CREATE POLICY "documents_delete_own" ON public.documents FOR DELETE USING (auth.uid() = user_id);

ALTER TABLE IF EXISTS public.questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "questions_select_all" ON public.questions;
CREATE POLICY "questions_select_all" ON public.questions FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.question_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "options_select_all" ON public.question_options;
CREATE POLICY "options_select_all" ON public.question_options FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.ai_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.admin_action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.system_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE IF EXISTS public.knowledge_subjects ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_subjects_select" ON public.knowledge_subjects;
CREATE POLICY "knowledge_subjects_select" ON public.knowledge_subjects FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.knowledge_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_topics_select" ON public.knowledge_topics;
CREATE POLICY "knowledge_topics_select" ON public.knowledge_topics FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.notice_topics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "notice_topics_select" ON public.notice_topics;
CREATE POLICY "notice_topics_select" ON public.notice_topics FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.contests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contests_select" ON public.contests;
CREATE POLICY "contests_select" ON public.contests FOR SELECT USING (true);

ALTER TABLE IF EXISTS public.positions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "positions_select" ON public.positions;
CREATE POLICY "positions_select" ON public.positions FOR SELECT USING (true);
