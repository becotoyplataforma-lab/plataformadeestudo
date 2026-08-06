-- ============================================================
-- ConcursoAI — Domínio: AI — RLS (Row Level Security)
-- PostgreSQL 17 · Supabase
-- Princípio: negação por padrão. Sem política = sem acesso.
-- ============================================================

ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_usage    ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CHAT_SESSIONS — usuário acessa somente as próprias conversas
-- ============================================================

DROP POLICY IF EXISTS chat_sessions_select_own ON public.chat_sessions;
CREATE POLICY chat_sessions_select_own ON public.chat_sessions
  FOR SELECT USING (user_id = auth.uid() AND deleted_at IS NULL);

DROP POLICY IF EXISTS chat_sessions_insert_own ON public.chat_sessions;
CREATE POLICY chat_sessions_insert_own ON public.chat_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_sessions_update_own ON public.chat_sessions;
CREATE POLICY chat_sessions_update_own ON public.chat_sessions
  FOR UPDATE USING (user_id = auth.uid() AND deleted_at IS NULL)
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS chat_sessions_delete_own ON public.chat_sessions;
CREATE POLICY chat_sessions_delete_own ON public.chat_sessions
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- CHAT_MESSAGES — usuário acessa somente mensagens das próprias conversas
-- ============================================================

DROP POLICY IF EXISTS chat_messages_select_own ON public.chat_messages;
CREATE POLICY chat_messages_select_own ON public.chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chat_sessions cs
      WHERE cs.id = chat_messages.session_id
        AND cs.user_id = auth.uid()
        AND cs.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS chat_messages_insert_own ON public.chat_messages;
CREATE POLICY chat_messages_insert_own ON public.chat_messages
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.chat_sessions cs
      WHERE cs.id = chat_messages.session_id
        AND cs.user_id = auth.uid()
        AND cs.deleted_at IS NULL
    )
  );

-- ============================================================
-- AI_USAGE — sistema (sem política de cliente)
-- Acesso SOMENTE via service_role / função SECURITY DEFINER.
-- Nenhuma política permissiva é criada; RLS deny-by-default protege.
-- ============================================================

-- ============================================================
-- Auditoria: tabelas públicas sem RLS (deve retornar apenas 0 linhas)
-- ============================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('chat_sessions', 'chat_messages', 'ai_usage')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p
    WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
  );
