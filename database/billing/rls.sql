-- ============================================================
-- ConcursoAI — Domínio: Billing — RLS (Row Level Security)
-- PostgreSQL 17 · Supabase
-- Princípio: negação por padrão. Sem política = sem acesso.
--
-- - plans: catálogo — leitura para autenticados; escrita exclusiva do admin.
-- - subscriptions: usuário lê as próprias; escrita via service_role/definer.
-- - payments: sistema — sem política de cliente; acesso via service_role.
-- ============================================================

ALTER TABLE public.plans         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments      ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- PLANS — catálogo (leitura para autenticados)
-- ============================================================

DROP POLICY IF EXISTS plans_select_authenticated ON public.plans;
CREATE POLICY plans_select_authenticated ON public.plans
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

-- Sem política de escrita para clientes (admin via service_role).

-- ============================================================
-- SUBSCRIPTIONS — usuário lê somente as próprias
-- ============================================================

DROP POLICY IF EXISTS subscriptions_select_own ON public.subscriptions;
CREATE POLICY subscriptions_select_own ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);

-- Escrita (insert/update/delete) somente via service_role / SECURITY DEFINER.

-- ============================================================
-- PAYMENTS — sistema (sem política de cliente)
-- ============================================================

-- Sem políticas permissivas: RLS deny-by-default protege.
-- Acesso exclusivo via service_role / SECURITY DEFINER.

-- ============================================================
-- Auditoria: tabelas públicas sem RLS (deve retornar apenas 0 linhas)
-- ============================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('plans', 'subscriptions', 'payments')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
  );
