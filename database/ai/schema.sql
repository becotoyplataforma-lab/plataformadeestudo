-- ============================================================
-- ConcursoAI — Domínio: AI — Schema
-- PostgreSQL 17 · Supabase · UUID · Auditoria
-- Referência: docs/08-DATABASE-PHYSICAL.md · docs/05-DOMAIN-MODEL.md
-- Ordem de aplicação: schema.sql → functions.sql → rls.sql → seeds.sql
-- ============================================================

-- ============================================================
-- ENUMS (globais — criados se não existirem)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_role') THEN
    CREATE TYPE public.chat_role AS ENUM ('system', 'user', 'assistant');
  END IF;
END $$;

-- ============================================================
-- CHAT_SESSIONS — conversa com o Professor IA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title                text NOT NULL,
  knowledge_subject_id uuid REFERENCES public.knowledge_subjects(id) ON DELETE SET NULL,
  model                public.ai_model NOT NULL DEFAULT 'flash',
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
  ON public.chat_sessions (user_id, updated_at);

-- ============================================================
-- CHAT_MESSAGES — mensagem de uma conversa (imutável)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       public.chat_role NOT NULL,
  content    text NOT NULL,
  model      public.ai_model,
  tokens_in  integer NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out integer NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
  ON public.chat_messages (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user ON public.chat_messages (user_id);

-- ============================================================
-- AI_USAGE — consumo de IA por usuário e dia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date     timestamptz NOT NULL,
  messages_count integer NOT NULL DEFAULT 0 CHECK (messages_count >= 0),
  tokens_in      integer NOT NULL DEFAULT 0 CHECK (tokens_in >= 0),
  tokens_out     integer NOT NULL DEFAULT 0 CHECK (tokens_out >= 0),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_usage_user_date
  ON public.ai_usage (user_id, usage_date);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage (user_id, usage_date);
