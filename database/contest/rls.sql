-- ============================================================
-- ConcursoAI — Domínio: CONTEST — RLS (Row Level Security)
-- PostgreSQL 17 · Supabase
-- Referência: Decisão R1 (RLS obrigatório no Contest) · DD-023/DD-024
--            docs/19-CONTEST-INTELLIGENCE-SPEC.md §4 · docs/20-CONTEST-IMPLEMENTATION-MAP.md §4
-- Princípio: negação por padrão. Sem política = sem acesso.
--
-- Dependência: NENHUMA — admin identificado via claim raw_app_meta_data->>'is_admin'
-- (mesmo padrão de database/knowledge/rls.sql; autocontido, sem is_admin()).
-- Escopo (R1): SOMENTE tabelas Contest. As 29 tabelas existentes NÃO são tocadas
-- (RLS global das antigas = dívida/Grupo futuro).
-- ============================================================

ALTER TABLE public.organs           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contests         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.editais          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.positions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notice_subjects  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORGANS / BOARDS — catálogo: autenticado lê (active), admin gerencia
-- ============================================================
DROP POLICY IF EXISTS organs_select_public ON public.organs;
CREATE POLICY organs_select_public ON public.organs
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

DROP POLICY IF EXISTS organs_manage_admin ON public.organs;
CREATE POLICY organs_manage_admin ON public.organs
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'))
  WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'));

DROP POLICY IF EXISTS boards_select_public ON public.boards;
CREATE POLICY boards_select_public ON public.boards
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

DROP POLICY IF EXISTS boards_manage_admin ON public.boards;
CREATE POLICY boards_manage_admin ON public.boards
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'))
  WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'));

-- ============================================================
-- CONTESTS — leitura pública só de publicado (rascunho protegido)
-- ============================================================
DROP POLICY IF EXISTS contests_select_public ON public.contests;
CREATE POLICY contests_select_public ON public.contests
  FOR SELECT USING (status = 'publicado' AND deleted_at IS NULL);

DROP POLICY IF EXISTS contests_manage_admin ON public.contests;
CREATE POLICY contests_manage_admin ON public.contests
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'))
  WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'));

-- ============================================================
-- EDITAIS — leitura pública só de publicado (rascunho protegido, DD-024)
-- ============================================================
DROP POLICY IF EXISTS editais_select_public ON public.editais;
CREATE POLICY editais_select_public ON public.editais
  FOR SELECT USING (status = 'publicado' AND deleted_at IS NULL);

DROP POLICY IF EXISTS editais_manage_admin ON public.editais;
CREATE POLICY editais_manage_admin ON public.editais
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'))
  WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'));

-- ============================================================
-- POSITIONS — catálogo: autenticado lê (active), admin gerencia
-- ============================================================
DROP POLICY IF EXISTS positions_select_public ON public.positions;
CREATE POLICY positions_select_public ON public.positions
  FOR SELECT USING (status = 'active' AND deleted_at IS NULL);

DROP POLICY IF EXISTS positions_manage_admin ON public.positions;
CREATE POLICY positions_manage_admin ON public.positions
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'))
  WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'));

-- ============================================================
-- NOTICE_SUBJECTS — leitura pública vinculada a edital publicado
-- ============================================================
DROP POLICY IF EXISTS notice_subjects_select_public ON public.notice_subjects;
CREATE POLICY notice_subjects_select_public ON public.notice_subjects
  FOR SELECT USING (
    status = 'active' AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.editais e
      WHERE e.id = notice_subjects.edital_id
        AND e.status = 'publicado'
        AND e.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS notice_subjects_manage_admin ON public.notice_subjects;
CREATE POLICY notice_subjects_manage_admin ON public.notice_subjects
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'))
  WITH CHECK (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'));
