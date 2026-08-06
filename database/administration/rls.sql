-- ============================================================
-- ConcursoAI — Domínio: Administration — RLS (Row Level Security)
-- PostgreSQL 17 · Supabase
-- Princípio: negação por padrão. Sem política = sem acesso.
--
-- Ambas as tabelas são de acesso SOMENTE de administrador (docs/08):
-- - system_settings: "Somente administrador acessa".
-- - admin_action_logs: "Somente administrador acessa".
-- No MVP a autorização é por allowlist no app; a nível SQL o acesso é via
-- service_role / SECURITY DEFINER (sem políticas permissivas para clientes).
-- ============================================================

ALTER TABLE public.system_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_action_logs  ENABLE ROW LEVEL SECURITY;

-- Sem políticas permissivas para clientes (RLS deny-by-default protege).

-- ============================================================
-- Auditoria: tabelas públicas sem RLS (deve retornar apenas 0 linhas)
-- ============================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('system_settings', 'admin_action_logs')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
  );
