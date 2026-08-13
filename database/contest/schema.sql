-- ============================================================
-- ConcursoAI — Domínio: CONTEST — Schema
-- PostgreSQL 17 · Supabase · UUID · Soft Delete · Auditoria
-- Referência: docs/19-CONTEST-INTELLIGENCE-SPEC.md (D1–D6) · DD-020→DD-025
--            docs/20-CONTEST-IMPLEMENTATION-MAP.md · docs/08-DATABASE-PHYSICAL.md
-- Ordem de aplicação: schema.sql → rls.sql
--
-- RLS: habilitado SOMENTE nas tabelas Contest (Decisão R1). As 29 tabelas
-- existentes NÃO são alteradas (RLS global = dívida/Grupo futuro).
-- Nota: o ALTER em public.profiles (domínio Identity) adiciona as colunas de
-- Contest com guards (IF NOT EXISTS) — não toca nas demais colunas.
-- ============================================================

-- ============================================================
-- ENUMS (globais — criados se não existirem)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'contest_status') THEN
    CREATE TYPE public.contest_status AS ENUM ('rascunho', 'publicado', 'encerrado', 'arquivado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'edital_status') THEN
    CREATE TYPE public.edital_status AS ENUM ('rascunho', 'publicado', 'arquivado');
  END IF;
END $$;

-- ============================================================
-- ORGANS — órgão realizador (catálogo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.organs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL,
  description text,
  status      public.lifecycle_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_organs_name ON public.organs (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_organs_slug ON public.organs (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organs_status ON public.organs (status);

-- ============================================================
-- BOARDS — banca organizadora (catálogo)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.boards (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  slug        text NOT NULL,
  description text,
  status      public.lifecycle_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_boards_name ON public.boards (name) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_boards_slug ON public.boards (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_boards_status ON public.boards (status);

-- ============================================================
-- CONTESTS — concurso público (agregado raiz)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.contests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organ_id    uuid NOT NULL REFERENCES public.organs(id) ON DELETE RESTRICT,
  board_id    uuid NOT NULL REFERENCES public.boards(id) ON DELETE RESTRICT,
  title       text NOT NULL,
  slug        text NOT NULL,
  description text,
  status      public.contest_status NOT NULL DEFAULT 'rascunho',
  start_date  timestamptz,
  end_date    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz,
  CONSTRAINT chk_contests_period
    CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_contests_slug ON public.contests (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_contests_status ON public.contests (status);
CREATE INDEX IF NOT EXISTS idx_contests_organ   ON public.contests (organ_id);
CREATE INDEX IF NOT EXISTS idx_contests_board   ON public.contests (board_id);

-- ============================================================
-- EDITAIS — edital oficial do concurso (fonte do conteúdo programático)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.editais (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id            uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  title                 text NOT NULL,
  version               text,
  published_date        timestamptz,
  content_url           text,
  programmatic_content  jsonb,
  is_current            boolean NOT NULL DEFAULT false,
  status                public.edital_status NOT NULL DEFAULT 'rascunho',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

-- No máximo 1 edital vigente por concurso (DD-023) — índice parcial único.
CREATE UNIQUE INDEX IF NOT EXISTS uq_editais_current_per_contest
  ON public.editais (contest_id) WHERE is_current;
CREATE INDEX IF NOT EXISTS idx_editais_contest ON public.editais (contest_id);
CREATE INDEX IF NOT EXISTS idx_editais_status  ON public.editais (status);

-- ============================================================
-- POSITIONS — cargo do concurso (opcional na V1; habilita FK composta)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contest_id  uuid NOT NULL REFERENCES public.contests(id) ON DELETE CASCADE,
  edital_id   uuid REFERENCES public.editais(id) ON DELETE SET NULL,
  name        text NOT NULL,
  slug        text NOT NULL,
  description text,
  status      public.lifecycle_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_positions_contest_slug ON public.positions (contest_id, slug) WHERE deleted_at IS NULL;
-- Alvo da FK composta de profiles(contest_id, position_id):
CREATE UNIQUE INDEX IF NOT EXISTS uq_positions_contest_id ON public.positions (contest_id, id);
CREATE INDEX IF NOT EXISTS idx_positions_contest ON public.positions (contest_id);

-- ============================================================
-- NOTICE_SUBJECTS — matéria do edital com peso (DD-020/DD-021)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notice_subjects (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  edital_id             uuid NOT NULL REFERENCES public.editais(id) ON DELETE CASCADE,
  position_id           uuid REFERENCES public.positions(id) ON DELETE SET NULL,
  knowledge_subject_id  uuid NOT NULL REFERENCES public.knowledge_subjects(id) ON DELETE RESTRICT,
  weight                integer NOT NULL CHECK (weight BETWEEN 0 AND 100),
  status                public.lifecycle_status NOT NULL DEFAULT 'active',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  deleted_at            timestamptz
);

-- Escopo do peso: (edital, position NULL=geral / preenchido=cargo, matéria) — DD-020
CREATE UNIQUE INDEX IF NOT EXISTS uq_notice_subjects_scope
  ON public.notice_subjects (edital_id, position_id, knowledge_subject_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notice_subjects_edital    ON public.notice_subjects (edital_id);
CREATE INDEX IF NOT EXISTS idx_notice_subjects_position  ON public.notice_subjects (position_id);
CREATE INDEX IF NOT EXISTS idx_notice_subjects_knowledge ON public.notice_subjects (knowledge_subject_id);

-- ============================================================
-- PROFILES — colunas de Contest (ALTER com guards, DD-025)
-- Tabela pertence ao domínio Identity; aqui somente as colunas novas.
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contest_id  uuid;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position_id uuid;

DO $$
BEGIN
  -- FK única de contest_id → contests
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'fk_profiles_contest' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT fk_profiles_contest
      FOREIGN KEY (contest_id) REFERENCES public.contests(id) ON DELETE SET NULL;
  END IF;

  -- FK composta garante que position_id pertence ao contest_id do usuário (DD-023 4b).
  -- ON DELETE SET NULL: ao remover o cargo, contest_id e position_id ficam NULL (neutro).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'fk_profiles_contest_position' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT fk_profiles_contest_position
      FOREIGN KEY (contest_id, position_id) REFERENCES public.positions(contest_id, id) ON DELETE SET NULL;
  END IF;
END $$;
