-- ============================================================
-- ConcursoAI — Domínio: Administration — Functions
-- PostgreSQL 17 · Supabase
-- Convenção: funções e tabelas qualificadas com `public.`
--
-- A autorização de administrador é feita no app (allowlist de e-mails —
-- docs/15 §2, camada MVP). A nível SQL, o acesso é via service_role
-- (RLS deny-by-default); não há coluna is_admin no MVP (V1.1).
-- ============================================================

-- ============================================================
-- TRIGGER: updated_at (system_settings possui updated_at)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_system_settings_updated_at') THEN
    CREATE TRIGGER trg_system_settings_updated_at
      BEFORE UPDATE ON public.system_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
