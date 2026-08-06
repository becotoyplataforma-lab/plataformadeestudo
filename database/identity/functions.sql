-- ============================================================
-- ConcursoAI — Domínio: IDENTITY — Functions + Triggers
-- PostgreSQL 17 · Supabase
-- Referência: ADR-001 · 08-DATABASE-PHYSICAL.md · 07-ENTITY-STANDARDS.md
--
-- ADR-001: identidade em auth.users (Supabase Auth).
-- public.users NÃO existe. Criação de profile dispara via trigger em auth.users.
-- ============================================================

-- ------------------------------------------------------------
-- set_updated_at — atualiza updated_at em alterações
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- handle_new_user — cria profile ao criar um usuário no auth.users
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, split_part(COALESCE(NEW.email, ''), '@', 1))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- is_admin — identifica administrador via claim JWT (app_metadata)
-- Nota: Roles/Permissions são futuros; hoje admin via claim is_admin
-- definida pelo service role.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE((auth.jwt() -> 'app_metadata' ->> 'is_admin')::boolean, false);
$$;

-- ------------------------------------------------------------
-- TRIGGERS
-- ------------------------------------------------------------

-- updated_at (profiles)
DROP TRIGGER IF EXISTS trg_profiles_updated ON public.profiles;
CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- updated_at (sessions)
DROP TRIGGER IF EXISTS trg_sessions_updated ON public.sessions;
CREATE TRIGGER trg_sessions_updated
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- criação automática de profile quando um usuário é criado no auth.users
DROP TRIGGER IF EXISTS trg_auth_users_create_profile ON auth.users;
CREATE TRIGGER trg_auth_users_create_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
