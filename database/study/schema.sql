-- ============================================================
-- ConcursoAI — Domínio: STUDY — Schema
-- PostgreSQL 17 · Supabase · UUID · Soft Delete · Auditoria
-- Referência: docs/08-DATABASE-PHYSICAL.md · docs/05-DOMAIN-MODEL.md · docs/07-ENTITY-STANDARDS.md
-- Ordem de aplicação: schema.sql → functions.sql → rls.sql → seeds.sql
-- ============================================================

-- ============================================================
-- ENUMS (globais — criados se não existirem)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE public.task_status AS ENUM ('pendente', 'concluida', 'adiada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_level') THEN
    CREATE TYPE public.question_level AS ENUM ('facil', 'medio', 'dificil');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'question_status') THEN
    CREATE TYPE public.question_status AS ENUM ('rascunho', 'publicada', 'bloqueada');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'attempt_mode') THEN
    CREATE TYPE public.attempt_mode AS ENUM ('estudo', 'simulado', 'revisao');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'review_rating') THEN
    CREATE TYPE public.review_rating AS ENUM ('facil', 'medio', 'dificil');
  END IF;
END $$;

-- ============================================================
-- STUDY_SUBJECTS — disciplina do aluno
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_subjects (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  color                text,
  priority             integer NOT NULL DEFAULT 3 CHECK (priority BETWEEN 1 AND 5),
  carga_horaria_total  integer NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  deleted_at           timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_study_subjects_user_name
  ON public.study_subjects (user_id, name) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_study_subjects_user ON public.study_subjects (user_id);

-- ============================================================
-- STUDY_TASKS — tarefa de estudo agendada
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_tasks (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_subject_id  uuid REFERENCES public.study_subjects(id) ON DELETE SET NULL,
  title             text NOT NULL,
  description       text,
  scheduled_date    timestamptz NOT NULL,
  duration_min      integer NOT NULL CHECK (duration_min BETWEEN 5 AND 600),
  status            public.task_status NOT NULL DEFAULT 'pendente',
  completed_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_study_tasks_user_date ON public.study_tasks (user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_status ON public.study_tasks (user_id, status);

-- ============================================================
-- QUESTIONS — questão de prova com gabarito
-- ============================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  knowledge_subject_id  uuid NOT NULL REFERENCES public.knowledge_subjects(id) ON DELETE RESTRICT,
  banca                 text,
  cargo                 text,
  ano                   integer,
  nivel                 public.question_level NOT NULL,
  enunciado             text NOT NULL,
  gabarito              text NOT NULL CHECK (gabarito ~ '^[A-E]$'),
  explicacao            text,
  tipo                  text NOT NULL DEFAULT 'multipla_escolha',
  fonte                 text,
  is_public             boolean NOT NULL DEFAULT false,
  content_hash          text,
  status                public.question_status NOT NULL DEFAULT 'rascunho',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_questions_content_hash
  ON public.questions (content_hash) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions (knowledge_subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_banca ON public.questions (banca);
CREATE INDEX IF NOT EXISTS idx_questions_nivel ON public.questions (nivel);
CREATE INDEX IF NOT EXISTS idx_questions_status ON public.questions (status);

-- ============================================================
-- QUESTION_OPTIONS — alternativa de uma questão
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_options (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  letter       text NOT NULL CHECK (letter ~ '^[A-E]$'),
  text         text NOT NULL,
  is_correct   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_question_options_letter
  ON public.question_options (question_id, letter) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_question_options_question ON public.question_options (question_id);

-- ============================================================
-- QUESTION_ATTEMPTS — tentativa de resposta (imutável)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question_id     uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  selected_letter text NOT NULL CHECK (selected_letter ~ '^[A-E]$'),
  is_correct      boolean NOT NULL,
  time_spent_sec  integer NOT NULL DEFAULT 0 CHECK (time_spent_sec >= 0),
  mode            public.attempt_mode NOT NULL DEFAULT 'estudo',
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user_created ON public.question_attempts (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON public.question_attempts (question_id);

-- ============================================================
-- FLASHCARDS — cartão de memorização
-- ============================================================
CREATE TABLE IF NOT EXISTS public.flashcards (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  study_subject_id  uuid REFERENCES public.study_subjects(id) ON DELETE SET NULL,
  front             text NOT NULL,
  back              text NOT NULL,
  tags              jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_flashcards_user ON public.flashcards (user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_tags ON public.flashcards USING GIN (tags);

-- ============================================================
-- REVIEW_SCHEDULES — agendamento de revisão espaçada
-- ============================================================
CREATE TABLE IF NOT EXISTS public.review_schedules (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  flashcard_id     uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  interval_days    integer NOT NULL DEFAULT 0 CHECK (interval_days >= 0),
  ease_factor      numeric(4,2) NOT NULL DEFAULT 2.50 CHECK (ease_factor > 0),
  repetitions      integer NOT NULL DEFAULT 0,
  due_date         timestamptz NOT NULL,
  last_reviewed_at timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  deleted_at       timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_review_schedules_user_flashcard
  ON public.review_schedules (user_id, flashcard_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_review_schedules_user_due ON public.review_schedules (user_id, due_date);
