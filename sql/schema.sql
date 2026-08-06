-- ============================================================
-- ConcursoAI Platform — Schema do Banco de Dados
-- PostgreSQL 15+ (Supabase)
-- Aplicar em ordem: schema.sql → indexes.sql → policies.sql → seed.sql
-- ============================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";        -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";          -- pgvector (RAG futuro)
CREATE EXTENSION IF NOT EXISTS "pg_trgm";         -- busca textual (futuro)
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements"; -- observabilidade

-- ============================================================
-- Tipos enumerados
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_plan') THEN
    CREATE TYPE user_plan AS ENUM ('free', 'pro', 'intensivo');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_level') THEN
    CREATE TYPE user_level AS ENUM ('iniciante', 'intermediario', 'avancado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE task_status AS ENUM ('pendente', 'concluida', 'adiada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_level') THEN
    CREATE TYPE question_level AS ENUM ('facil', 'medio', 'dificil');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_mode') THEN
    CREATE TYPE attempt_mode AS ENUM ('estudo', 'simulado', 'revisao');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_rating') THEN
    CREATE TYPE review_rating AS ENUM ('facil', 'medio', 'dificil');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'chat_role') THEN
    CREATE TYPE chat_role AS ENUM ('system', 'user', 'assistant');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_model') THEN
    CREATE TYPE ai_model AS ENUM ('flash', 'pro');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_type') THEN
    CREATE TYPE doc_type AS ENUM ('pdf', 'audio', 'video', 'law', 'edital', 'apostila');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'doc_status') THEN
    CREATE TYPE doc_status AS ENUM ('pending', 'processing', 'done', 'error');
  END IF;
END $$;

-- ============================================================
-- PROFILES — perfil estendido do usuário (1:1 com auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id              uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name       text,
  email           text,
  avatar_url      text,
  plano           user_plan NOT NULL DEFAULT 'free',
  nivel           user_level NOT NULL DEFAULT 'iniciante',
  concurso_alvo   text,
  banca_preferida text,
  meta_diaria_min integer NOT NULL DEFAULT 120,
  modelo_ia_padrao ai_model NOT NULL DEFAULT 'flash',
  is_admin        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CONTENT_SUBJECTS — catálogo global de disciplinas (conteúdo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.content_subjects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE,
  slug        text NOT NULL UNIQUE,
  color       text,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- SUBJECTS — disciplinas do cronograma do usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subjects (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name                text NOT NULL,
  color               text,
  priority            smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  carga_horaria_total integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- ============================================================
-- STUDY_TASKS — tarefas do cronograma
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_tasks (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id     uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  title          text NOT NULL,
  description    text,
  scheduled_date date NOT NULL,
  duration_min   integer NOT NULL DEFAULT 60,
  status         task_status NOT NULL DEFAULT 'pendente',
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- QUESTIONS — banco de questões (conteúdo global + curadoria)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id  uuid REFERENCES public.content_subjects(id) ON DELETE SET NULL,
  banca       text,
  cargo       text,
  ano         integer,
  nivel       question_level NOT NULL DEFAULT 'medio',
  enunciado   text NOT NULL,
  gabarito    char(1) NOT NULL CHECK (gabarito IN ('A','B','C','D','E')),
  explicacao  text,
  tipo        text NOT NULL DEFAULT 'multipla_escolha',
  fonte       text,
  is_public   boolean NOT NULL DEFAULT true,
  content_hash text,           -- hash md5 do enunciado normalizado (dedupe)
  status      text NOT NULL DEFAULT 'publicada' CHECK (status IN ('rascunho','publicada','bloqueada')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (content_hash)
);

-- ============================================================
-- QUESTION_OPTIONS — alternativas das questões
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_options (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  letter      char(1) NOT NULL CHECK (letter IN ('A','B','C','D','E')),
  text        text NOT NULL,
  is_correct  boolean NOT NULL DEFAULT false,
  UNIQUE (question_id, letter)
);

-- ============================================================
-- QUESTION_ATTEMPTS — histórico de tentativas do usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  question_id     uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_letter char(1) NOT NULL CHECK (selected_letter IN ('A','B','C','D','E')),
  is_correct      boolean NOT NULL,
  time_spent_sec  integer NOT NULL DEFAULT 0,
  mode            attempt_mode NOT NULL DEFAULT 'estudo',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- FLASHCARDS — cartões de estudo do usuário
-- ============================================================
CREATE TABLE IF NOT EXISTS public.flashcards (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  subject_id uuid REFERENCES public.subjects(id) ON DELETE SET NULL,
  front      text NOT NULL,
  back       text NOT NULL,
  tags       text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- REVIEW_SCHEDULES — agendamento SRS (repetição espaçada)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_schedules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  flashcard_id     uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  interval_days    integer NOT NULL DEFAULT 0,
  ease_factor      real NOT NULL DEFAULT 2.5,
  repetitions      integer NOT NULL DEFAULT 0,
  due_date         date NOT NULL DEFAULT CURRENT_DATE,
  last_reviewed_at timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, flashcard_id)
);

-- ============================================================
-- CHAT_SESSIONS — conversas com o Professor IA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title      text NOT NULL DEFAULT 'Nova conversa',
  subject_id uuid REFERENCES public.content_subjects(id) ON DELETE SET NULL,
  model      ai_model NOT NULL DEFAULT 'flash',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- CHAT_MESSAGES — mensagens das conversas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.chat_sessions(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role       chat_role NOT NULL,
  content    text NOT NULL,
  model      ai_model,
  tokens_in  integer NOT NULL DEFAULT 0,
  tokens_out integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- AI_USAGE — cotas de uso de IA por usuário/dia
-- ============================================================
CREATE TABLE IF NOT EXISTS public.ai_usage (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  usage_date    date NOT NULL DEFAULT CURRENT_DATE,
  messages_count integer NOT NULL DEFAULT 0,
  tokens_in     bigint NOT NULL DEFAULT 0,
  tokens_out    bigint NOT NULL DEFAULT 0,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, usage_date)
);

-- ============================================================
-- PAYMENTS — histórico de pagamentos (Mercado Pago)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider            text NOT NULL DEFAULT 'mercadopago',
  provider_id         text,                    -- id do pagamento no Mercado Pago
  plan                user_plan NOT NULL,
  amount_cents        integer NOT NULL,
  status              text NOT NULL,           -- approved, pending, rejected, cancelled
  external_reference  text,
  paid_at             timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DOCUMENTS — Knowledge Engine (futuro)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.documents (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         doc_type NOT NULL DEFAULT 'pdf',
  title        text NOT NULL,
  storage_path text,
  status       doc_status NOT NULL DEFAULT 'pending',
  file_size    bigint,
  mime_type    text,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DOCUMENT_CHUNKS — trechos extraídos (OCR/Whisper)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.document_chunks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  seq         integer NOT NULL,
  content     text NOT NULL,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, seq)
);

-- ============================================================
-- EMBEDDINGS — vetores pgvector por chunk
-- ============================================================
CREATE TABLE IF NOT EXISTS public.embeddings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id   uuid NOT NULL REFERENCES public.document_chunks(id) ON DELETE CASCADE,
  model      text NOT NULL DEFAULT 'text-embedding-3-small',
  embedding  vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- ADMIN_AUDIT_LOG — auditoria de ações administrativas
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  details     jsonb,
  ip          inet,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- TRIGGER — atualizar updated_at automaticamente
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_sessions_updated ON public.chat_sessions;
CREATE TRIGGER trg_chat_sessions_updated
  BEFORE UPDATE ON public.chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============================================================
-- TRIGGER — criar perfil automaticamente após novo auth.users
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- FUNÇÃO — limites de IA por plano (usada no servidor)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_plan_limits(p_plan user_plan)
RETURNS jsonb AS $$
BEGIN
  RETURN CASE p_plan
    WHEN 'free'      THEN jsonb_build_object('max_messages', 50,   'max_tokens', 100000)
    WHEN 'pro'       THEN jsonb_build_object('max_messages', 500,  'max_tokens', 1000000)
    WHEN 'intensivo' THEN jsonb_build_object('max_messages', 2000, 'max_tokens', 5000000)
    ELSE jsonb_build_object('max_messages', 50, 'max_tokens', 100000)
  END;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ============================================================
-- FUNÇÃO — registrar uso de IA (incrementa contadores)
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_ai_usage(
  p_user_id uuid,
  p_tokens_in integer,
  p_tokens_out integer
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.ai_usage (user_id, usage_date, messages_count, tokens_in, tokens_out)
  VALUES (p_user_id, CURRENT_DATE, 1, p_tokens_in, p_tokens_out)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET
    messages_count = ai_usage.messages_count + 1,
    tokens_in      = ai_usage.tokens_in + p_tokens_in,
    tokens_out     = ai_usage.tokens_out + p_tokens_out,
    updated_at     = now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- FUNÇÃO — registrar pagamento e ativar plano (Mercado Pago)
-- Usada pelo webhook (sem sessão de usuário). SECURITY DEFINER
-- permite atualizar profiles/payments sem expor service role.
-- ============================================================
CREATE OR REPLACE FUNCTION public.register_payment(
  p_user_id uuid,
  p_plan user_plan,
  p_amount_cents integer,
  p_status text,
  p_provider_id text DEFAULT NULL,
  p_external_reference text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  INSERT INTO public.payments (user_id, provider, provider_id, plan, amount_cents, status, external_reference, paid_at)
  VALUES (
    p_user_id,
    'mercadopago',
    p_provider_id,
    p_plan,
    p_amount_cents,
    p_status,
    p_external_reference,
    CASE WHEN p_status = 'approved' THEN now() ELSE NULL END
  );

  IF p_status = 'approved' THEN
    UPDATE public.profiles
    SET plano = p_plan, updated_at = now()
    WHERE id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
