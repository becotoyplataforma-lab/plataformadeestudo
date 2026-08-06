-- ============================================================
-- ConcursoAI — Domínio: Analytics — Functions
-- PostgreSQL 17 · Supabase
-- Convenção: funções e tabelas qualificadas com `public.`
--
-- OPEN-006: materialização do DailySummary. A função abaixo define COMO
-- computar um resumo diário (agregação idempotente); QUANDO executar
-- (sob demanda vs job noturno) é decisão aberta — os Services usam
-- agregação sob demanda em TS, sem chamar esta função no MVP.
-- ============================================================

-- ============================================================
-- TRIGGER: updated_at (daily_summaries possui updated_at)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_daily_summaries_updated_at') THEN
    CREATE TRIGGER trg_daily_summaries_updated_at
      BEFORE UPDATE ON public.daily_summaries
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- FUNCTION: analytics_compute_daily_summary
-- Calcula e persiste (upsert) o resumo diário de um usuário a partir das
-- tabelas de origem (Study, AI). Idempotente por (user_id, summary_date).
-- ============================================================

CREATE OR REPLACE FUNCTION public.analytics_compute_daily_summary(
  p_user_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS public.daily_summaries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_from timestamptz;
  v_to   timestamptz;
  v_summary public.daily_summaries;
BEGIN
  v_from := p_date::timestamptz;
  v_to   := (p_date + 1)::timestamptz;

  INSERT INTO public.daily_summaries (
    user_id, summary_date, total_questions, correct_answers,
    study_minutes, reviews_done, ai_messages
  )
  SELECT
    p_user_id,
    p_date::timestamptz,
    (SELECT COUNT(*) FROM public.question_attempts
      WHERE user_id = p_user_id AND created_at >= v_from AND created_at < v_to),
    (SELECT COUNT(*) FROM public.question_attempts
      WHERE user_id = p_user_id AND created_at >= v_from AND created_at < v_to AND is_correct),
    COALESCE((SELECT SUM(duration_min) FROM public.study_tasks
      WHERE user_id = p_user_id AND status = 'concluida'
        AND completed_at >= v_from AND completed_at < v_to), 0),
    (SELECT COUNT(*) FROM public.review_schedules
      WHERE user_id = p_user_id AND last_reviewed_at >= v_from AND last_reviewed_at < v_to),
    COALESCE((SELECT messages_count FROM public.ai_usage
      WHERE user_id = p_user_id AND usage_date >= v_from AND usage_date < v_to
      ORDER BY usage_date DESC LIMIT 1), 0)
  ON CONFLICT (user_id, summary_date)
  DO UPDATE SET
    total_questions = EXCLUDED.total_questions,
    correct_answers = EXCLUDED.correct_answers,
    study_minutes   = EXCLUDED.study_minutes,
    reviews_done    = EXCLUDED.reviews_done,
    ai_messages     = EXCLUDED.ai_messages,
    updated_at      = now()
  RETURNING * INTO v_summary;

  RETURN v_summary;
END;
$$;
