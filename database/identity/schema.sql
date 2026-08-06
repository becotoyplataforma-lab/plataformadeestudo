-- ============================================================
-- ConcursoAI — Domínio: IDENTITY — Schema
-- PostgreSQL 17 · Supabase
-- Entidades: auth.users (Supabase Auth), profiles, sessions
-- Referência: ADR-001 · 08-DATABASE-PHYSICAL.md · 07-ENTITY-STANDARDS.md
-- Ordem de aplicação: schema.sql → functions.sql → rls.sql → seeds.sql
--
-- ADR-001: auth.users é a ÚNICA fonte oficial de identidade.
-- public.users NÃO existe. profiles e sessions referenciam auth.users(id).
-- Autenticação é responsabilidade exclusiva do Supabase Auth.
-- ============================================================

-- Extensões
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- busca textual (híbrida, futuro)

-- ------------------------------------------------------------
-- ENUMS (globais — criados aqui, reutilizados por outros domínios)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lifecycle_status') THEN
    CREATE TYPE public.lifecycle_status AS ENUM ('active', 'inactive', 'archived');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_level') THEN
    CREATE TYPE public.user_level AS ENUM ('iniciante', 'intermediario', 'avancado');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ai_model') THEN
    CREATE TYPE public.ai_model AS ENUM ('flash', 'pro');
  END IF;
END $$;

-- ============================================================
-- PROFILES — perfil e preferências (1:1 com auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id                uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name         text,
  avatar_url        text,
  level             public.user_level NOT NULL DEFAULT 'iniciante',
  concurso_alvo     text,
  banca_preferida   text,
  meta_diaria_min   integer NOT NULL DEFAULT 120,
  modelo_ia_padrao  public.ai_model NOT NULL DEFAULT 'flash',
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- Faixa da meta diária
ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_meta_diaria
  CHECK (meta_diaria_min BETWEEN 15 AND 720);

-- ============================================================
-- SESSIONS — sessão autenticada (apenas se houver necessidade além do Supabase Auth)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       text NOT NULL,
  expires_at  timestamptz NOT NULL,
  ip          text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

-- Token único entre sessões ativas
CREATE UNIQUE INDEX IF NOT EXISTS uq_sessions_token_active
  ON public.sessions (token) WHERE deleted_at IS NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON public.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON public.sessions (expires_at);
