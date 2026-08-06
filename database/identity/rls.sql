-- ============================================================
-- ConcursoAI — Domínio: IDENTITY — RLS (Row Level Security)
-- PostgreSQL 17 · Supabase
-- Referência: ADR-001 · 08-DATABASE-PHYSICAL.md · 07-ENTITY-STANDARDS.md
-- Princípio: negação por padrão. Sem política = sem acesso.
--
-- ADR-001: auth.users é gerenciado pelo Supabase Auth (fora do escopo RLS
-- público). Apenas profiles e sessions (tabelas public) recebem políticas.
-- ============================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------

-- Usuário: lê/insere/atualiza o próprio perfil
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Administrador
DROP POLICY IF EXISTS profiles_select_admin ON public.profiles;
CREATE POLICY profiles_select_admin ON public.profiles
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS profiles_update_admin ON public.profiles;
CREATE POLICY profiles_update_admin ON public.profiles
  FOR UPDATE USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- SESSIONS
-- ------------------------------------------------------------

-- Usuário: lê/insere/atualiza/exclui as próprias sessões
DROP POLICY IF EXISTS sessions_select_own ON public.sessions;
CREATE POLICY sessions_select_own ON public.sessions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS sessions_insert_own ON public.sessions;
CREATE POLICY sessions_insert_own ON public.sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sessions_update_own ON public.sessions;
CREATE POLICY sessions_update_own ON public.sessions
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS sessions_delete_own ON public.sessions;
CREATE POLICY sessions_delete_own ON public.sessions
  FOR DELETE USING (user_id = auth.uid());

-- Administrador
DROP POLICY IF EXISTS sessions_select_admin ON public.sessions;
CREATE POLICY sessions_select_admin ON public.sessions
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS sessions_delete_admin ON public.sessions;
CREATE POLICY sessions_delete_admin ON public.sessions
  FOR DELETE USING (public.is_admin());

-- ------------------------------------------------------------
-- Auditoria: tabelas públicas sem RLS (deve retornar apenas 0 linhas)
-- auth.users NÃO está em public — não deve aparecer.
-- ------------------------------------------------------------
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'sessions')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
  );
