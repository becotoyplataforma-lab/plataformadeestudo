-- ============================================================
-- ConcursoAI — Domínio: IDENTITY — Seeds mínimos
-- PostgreSQL 17 · Supabase
-- Referência: ADR-001 · 08-DATABASE-PHYSICAL.md
-- Aplicar APENAS em dev/staging.
--
-- ADR-001: identidade vive em auth.users (Supabase Auth). Este script NÃO
-- cria usuários em auth.users — eles são criados via Supabase Auth / Admin.
-- Aqui apenas criamos os PROFILES correspondentes aos IDs de seed.
-- ============================================================

-- Perfil do administrador (id deve existir em auth.users criado via Supabase)
INSERT INTO public.profiles (id, full_name, level)
VALUES ('00000000-0000-0000-0000-000000000001', 'Administrador', 'avancado')
ON CONFLICT (id) DO NOTHING;

-- Perfil do usuário de demonstração
INSERT INTO public.profiles (id, full_name, level)
VALUES ('00000000-0000-0000-0000-000000000002', 'Aluno Demo', 'iniciante')
ON CONFLICT (id) DO NOTHING;
