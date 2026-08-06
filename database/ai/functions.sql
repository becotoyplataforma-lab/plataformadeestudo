-- ============================================================
-- ConcursoAI — Domínio: AI — Functions
-- PostgreSQL 17 · Supabase
-- Convenção: funções e tabelas qualificadas com `public.`
-- ============================================================

-- ============================================================
-- TRIGGER: updated_at (chat_sessions e ai_usage possuem updated_at)
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

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_chat_sessions_updated_at') THEN
    CREATE TRIGGER trg_chat_sessions_updated_at
      BEFORE UPDATE ON public.chat_sessions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_ai_usage_updated_at') THEN
    CREATE TRIGGER trg_ai_usage_updated_at
      BEFORE UPDATE ON public.ai_usage
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- FUNCTION: register_ai_usage
-- Incrementa o consumo de IA do usuário no dia (upsert).
-- ============================================================

CREATE OR REPLACE FUNCTION public.register_ai_usage(
  p_user_id UUID,
  p_tokens_in INTEGER,
  p_tokens_out INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_day timestamptz;
BEGIN
  v_day := date_trunc('day', now());

  INSERT INTO public.ai_usage (user_id, usage_date, messages_count, tokens_in, tokens_out)
  VALUES (p_user_id, v_day, 1, p_tokens_in, p_tokens_out)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    messages_count = public.ai_usage.messages_count + 1,
    tokens_in      = public.ai_usage.tokens_in + EXCLUDED.tokens_in,
    tokens_out     = public.ai_usage.tokens_out + EXCLUDED.tokens_out,
    updated_at     = now();
END;
$$;
