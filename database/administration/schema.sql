-- ============================================================
-- ConcursoAI — Domínio: Administration — Schema
-- PostgreSQL 17 · Supabase · UUID · Auditoria
-- Referência: docs/08-DATABASE-PHYSICAL.md · docs/05-DOMAIN-MODEL.md
-- Ordem de aplicação: schema.sql → functions.sql → rls.sql → seeds.sql
--
-- NOTA (docs/15 vs docs/08): docs/15 usa "admin_audit_log"; o modelo físico
-- oficial (docs/08) define "admin_action_logs" — seguido aqui.
-- ============================================================

-- ============================================================
-- SYSTEM_SETTINGS — configuração global da plataforma
-- ============================================================
CREATE TABLE IF NOT EXISTS public.system_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_system_settings_key ON public.system_settings (key);

-- ============================================================
-- ADMIN_ACTION_LOGS — auditoria de ações administrativas (imutável)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_action_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  entity_type text NOT NULL,
  entity_id   uuid,
  details     jsonb,
  ip          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_action_logs_admin_created
  ON public.admin_action_logs (admin_id, created_at);
