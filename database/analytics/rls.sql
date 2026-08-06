-- ============================================================
-- ConcursoAI — Domínio: Analytics — RLS (Row Level Security)
-- PostgreSQL 17 · Supabase
-- Princípio: negação por padrão. Sem política = sem acesso.
--
-- - event_logs: sistema/admin — somente administração acessa (docs/08).
-- - daily_summaries: usuário lê o próprio resumo; escrita via definer (docs/08).
-- ============================================================

ALTER TABLE public.event_logs      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_summaries ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EVENT_LOGS — sistema/admin (sem política de cliente)
-- ============================================================

-- Sem políticas permissivas: acesso exclusivo via service_role / SECURITY DEFINER.

-- ============================================================
-- DAILY_SUMMARIES — usuário lê o próprio resumo
-- ============================================================

DROP POLICY IF EXISTS daily_summaries_select_own ON public.daily_summaries;
CREATE POLICY daily_summaries_select_own ON public.daily_summaries
  FOR SELECT USING (user_id = auth.uid());

-- Escrita (insert/update/delete) somente via service_role / SECURITY DEFINER.

-- ============================================================
-- Auditoria: tabelas públicas sem RLS (deve retornar apenas 0 linhas)
-- ============================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('event_logs', 'daily_summaries')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
  );
