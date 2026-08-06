-- ============================================================
-- ConcursoAI — Domínio: Analytics — Schema
-- PostgreSQL 17 · Supabase · UUID · Auditoria
-- Referência: docs/08-DATABASE-PHYSICAL.md · docs/05-DOMAIN-MODEL.md
-- Ordem de aplicação: schema.sql → functions.sql → rls.sql → seeds.sql
--
-- OPEN-005 (event bus) e OPEN-006 (materialização do DailySummary) permanecem
-- abertos — aqui são definidas apenas as tabelas físicas.
-- ============================================================

-- ============================================================
-- EVENT_LOGS — registro imutável de eventos de negócio
-- ============================================================
CREATE TABLE IF NOT EXISTS public.event_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  event_name  text NOT NULL,
  payload     jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_logs_entity
  ON public.event_logs (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_event_logs_user_occurred
  ON public.event_logs (user_id, occurred_at);

-- ============================================================
-- DAILY_SUMMARIES — resumo diário de desempenho
-- Materialização é decisão aberta (OPEN-006: sob demanda vs job).
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_summaries (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_date    timestamptz NOT NULL,
  total_questions integer NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  correct_answers integer NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  study_minutes   integer NOT NULL DEFAULT 0 CHECK (study_minutes >= 0),
  reviews_done    integer NOT NULL DEFAULT 0 CHECK (reviews_done >= 0),
  ai_messages     integer NOT NULL DEFAULT 0 CHECK (ai_messages >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_daily_summaries_user_date
  ON public.daily_summaries (user_id, summary_date);
CREATE INDEX IF NOT EXISTS idx_daily_summaries_user_date
  ON public.daily_summaries (user_id, summary_date);
