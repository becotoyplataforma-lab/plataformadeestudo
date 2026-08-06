-- ============================================================
-- ConcursoAI — Domínio: STUDY — RLS (Row Level Security)
-- PostgreSQL 17 · Supabase
-- Referência: docs/08-DATABASE-PHYSICAL.md · docs/07-ENTITY-STANDARDS.md
-- Princípio: negação por padrão. Sem política = sem acesso.
-- ============================================================

ALTER TABLE public.study_subjects   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_schedules ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- STUDY_SUBJECTS — usuário acessa somente os próprios
-- ============================================================

DROP POLICY IF EXISTS study_subjects_select_own ON public.study_subjects;
CREATE POLICY study_subjects_select_own ON public.study_subjects
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS study_subjects_insert_own ON public.study_subjects;
CREATE POLICY study_subjects_insert_own ON public.study_subjects
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_subjects_update_own ON public.study_subjects;
CREATE POLICY study_subjects_update_own ON public.study_subjects
  FOR UPDATE USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_subjects_delete_own ON public.study_subjects;
CREATE POLICY study_subjects_delete_own ON public.study_subjects
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- STUDY_TASKS — usuário acessa somente as próprias
-- ============================================================

DROP POLICY IF EXISTS study_tasks_select_own ON public.study_tasks;
CREATE POLICY study_tasks_select_own ON public.study_tasks
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS study_tasks_insert_own ON public.study_tasks;
CREATE POLICY study_tasks_insert_own ON public.study_tasks
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_tasks_update_own ON public.study_tasks;
CREATE POLICY study_tasks_update_own ON public.study_tasks
  FOR UPDATE USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS study_tasks_delete_own ON public.study_tasks;
CREATE POLICY study_tasks_delete_own ON public.study_tasks
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- QUESTIONS — catálogo público (leitura), admin (escrita)
-- ============================================================

DROP POLICY IF EXISTS questions_select_public ON public.questions;
CREATE POLICY questions_select_public ON public.questions
  FOR SELECT USING (is_public = true AND status = 'publicada' AND deleted_at IS NULL);

DROP POLICY IF EXISTS questions_select_admin ON public.questions;
CREATE POLICY questions_select_admin ON public.questions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS questions_manage_admin ON public.questions;
CREATE POLICY questions_manage_admin ON public.questions
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- QUESTION_OPTIONS — acesso herdado da questão
-- ============================================================

DROP POLICY IF EXISTS question_options_select_public ON public.question_options;
CREATE POLICY question_options_select_public ON public.question_options
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      WHERE q.id = question_options.question_id
        AND q.is_public = true AND q.status = 'publicada' AND q.deleted_at IS NULL
    )
    AND question_options.deleted_at IS NULL
  );

DROP POLICY IF EXISTS question_options_manage_admin ON public.question_options;
CREATE POLICY question_options_manage_admin ON public.question_options
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ============================================================
-- QUESTION_ATTEMPTS — usuário acessa somente as próprias
-- ============================================================

DROP POLICY IF EXISTS question_attempts_select_own ON public.question_attempts;
CREATE POLICY question_attempts_select_own ON public.question_attempts
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS question_attempts_insert_own ON public.question_attempts;
CREATE POLICY question_attempts_insert_own ON public.question_attempts
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ============================================================
-- FLASHCARDS — usuário acessa somente os próprios
-- ============================================================

DROP POLICY IF EXISTS flashcards_select_own ON public.flashcards;
CREATE POLICY flashcards_select_own ON public.flashcards
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS flashcards_insert_own ON public.flashcards;
CREATE POLICY flashcards_insert_own ON public.flashcards
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flashcards_update_own ON public.flashcards;
CREATE POLICY flashcards_update_own ON public.flashcards
  FOR UPDATE USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS flashcards_delete_own ON public.flashcards;
CREATE POLICY flashcards_delete_own ON public.flashcards
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- REVIEW_SCHEDULES — usuário acessa somente os próprios
-- ============================================================

DROP POLICY IF EXISTS review_schedules_select_own ON public.review_schedules;
CREATE POLICY review_schedules_select_own ON public.review_schedules
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS review_schedules_insert_own ON public.review_schedules;
CREATE POLICY review_schedules_insert_own ON public.review_schedules
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS review_schedules_update_own ON public.review_schedules;
CREATE POLICY review_schedules_update_own ON public.review_schedules
  FOR UPDATE USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- Auditoria: tabelas públicas sem RLS (deve retornar apenas 0 linhas)
-- ============================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'study_subjects', 'study_tasks', 'questions', 'question_options',
    'question_attempts', 'flashcards', 'review_schedules'
  )
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
  );
