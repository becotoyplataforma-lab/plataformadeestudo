-- ============================================================
-- ConcursoAI — Domínio KNOWLEDGE — Functions
-- PostgreSQL 17 · Supabase
-- Convenção: funções e tabelas qualificadas com `public.`
-- (SECURITY DEFINER com search_path = '' exige nomes totalmente qualificados)
-- ============================================================

-- ============================================================
-- TRIGGER: updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Aplica trigger em tabelas que possuem updated_at
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_documents_updated_at') THEN
    CREATE TRIGGER trg_documents_updated_at
      BEFORE UPDATE ON public.documents
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_knowledge_subjects_updated_at') THEN
    CREATE TRIGGER trg_knowledge_subjects_updated_at
      BEFORE UPDATE ON public.knowledge_subjects
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_knowledge_topics_updated_at') THEN
    CREATE TRIGGER trg_knowledge_topics_updated_at
      BEFORE UPDATE ON public.knowledge_topics
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- FUNCTION: get_user_storage_usage
-- Retorna o total de bytes armazenados pelo usuário.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_storage_usage(p_user_id UUID)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(SUM(file_size), 0)::BIGINT
  FROM public.documents
  WHERE user_id = p_user_id
    AND deleted_at IS NULL;
$$;

-- ============================================================
-- FUNCTION: get_user_document_ids
-- Retorna os IDs de documentos ativos e indexados do usuário.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_user_document_ids(p_user_id UUID)
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT id FROM public.documents
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND status = 'indexed';
$$;

-- ============================================================
-- FUNCTION: find_or_create_tag
-- Busca tag por slug ou cria nova.
-- ============================================================

CREATE OR REPLACE FUNCTION public.find_or_create_tag(p_name TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slug TEXT;
  v_id UUID;
BEGIN
  v_slug := lower(regexp_replace(p_name, '[^a-zA-Z0-9]+', '-', 'g'));

  SELECT id INTO v_id FROM public.knowledge_tags WHERE slug = v_slug;
  IF FOUND THEN
    RETURN v_id;
  END IF;

  INSERT INTO public.knowledge_tags (name, slug) VALUES (p_name, v_slug)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ============================================================
-- FUNCTION: classify_document_subject
-- Classifica documento em uma matéria usando keyword matching.
-- ============================================================

CREATE OR REPLACE FUNCTION public.classify_document_subject(
  p_document_id UUID,
  p_subject_id UUID,
  p_confidence INTEGER DEFAULT 100
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.document_subjects (document_id, subject_id, confidence)
  VALUES (p_document_id, p_subject_id, p_confidence)
  ON CONFLICT (document_id, subject_id)
  DO UPDATE SET confidence = EXCLUDED.confidence, created_at = now();
END;
$$;

-- ============================================================
-- FUNCTION: soft_delete_document_chunks
-- Marca chunks de um documento como removidos.
-- ============================================================

CREATE OR REPLACE FUNCTION public.soft_delete_document_chunks(p_document_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.document_chunks
  SET deleted_at = now()
  WHERE document_id = p_document_id
    AND deleted_at IS NULL;
$$;
