-- ============================================================
-- ConcursoAI — Domínio: STUDY — Functions
-- PostgreSQL 17 · Supabase
-- Convenção: funções e tabelas qualificadas com `public.`
-- (SECURITY DEFINER com search_path = '' exige nomes totalmente qualificados)
-- ============================================================

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Aplica trigger em tabelas que possuem updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_study_subjects_updated_at') THEN
    CREATE TRIGGER trg_study_subjects_updated_at
      BEFORE UPDATE ON public.study_subjects
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_study_tasks_updated_at') THEN
    CREATE TRIGGER trg_study_tasks_updated_at
      BEFORE UPDATE ON public.study_tasks
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_questions_updated_at') THEN
    CREATE TRIGGER trg_questions_updated_at
      BEFORE UPDATE ON public.questions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_flashcards_updated_at') THEN
    CREATE TRIGGER trg_flashcards_updated_at
      BEFORE UPDATE ON public.flashcards
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_review_schedules_updated_at') THEN
    CREATE TRIGGER trg_review_schedules_updated_at
      BEFORE UPDATE ON public.review_schedules
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- FUNCTION: register_question_attempt
-- Registra tentativa e retorna acerto (wrapper transacional).
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_question_attempt(
  p_user_id UUID,
  p_question_id UUID,
  p_selected_letter TEXT,
  p_is_correct BOOLEAN,
  p_time_spent_sec INTEGER DEFAULT 0,
  p_mode public.attempt_mode DEFAULT 'estudo'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.question_attempts (
    user_id, question_id, selected_letter, is_correct, time_spent_sec, mode
  ) VALUES (
    p_user_id, p_question_id, p_selected_letter, p_is_correct, p_time_spent_sec, p_mode
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================
-- FUNCTION: complete_study_task
-- Marca tarefa como concluída e define completed_at.
-- ============================================================

CREATE OR REPLACE FUNCTION public.complete_study_task(p_task_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.study_tasks
  SET status = 'concluida', completed_at = now(), updated_at = now()
  WHERE id = p_task_id
    AND user_id = p_user_id
    AND deleted_at IS NULL;
$$;
