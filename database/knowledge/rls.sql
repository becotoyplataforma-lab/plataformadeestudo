-- ============================================================
-- ConcursoAI — Domínio KNOWLEDGE — RLS Policies
-- PostgreSQL 17 · Supabase
-- ============================================================

-- ============================================================
-- DOCUMENTS
-- ============================================================

ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Usuário autenticado lê apenas os próprios documentos
DROP POLICY IF EXISTS "Users can read own documents" ON documents;
CREATE POLICY "Users can read own documents" ON documents
  FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Usuário autenticado insere documentos com seu próprio user_id
DROP POLICY IF EXISTS "Users can insert own documents" ON documents;
CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Usuário autenticado atualiza apenas os próprios documentos
DROP POLICY IF EXISTS "Users can update own documents" ON documents;
CREATE POLICY "Users can update own documents" ON documents
  FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- Usuário autenticado faz soft delete dos próprios documentos
DROP POLICY IF EXISTS "Users can delete own documents" ON documents;
CREATE POLICY "Users can delete own documents" ON documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- DOCUMENT_CHUNKS — acesso herdado do documento
-- ============================================================

ALTER TABLE document_chunks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access chunks of own documents" ON document_chunks;
CREATE POLICY "Users can access chunks of own documents" ON document_chunks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
        AND documents.user_id = auth.uid()
        AND documents.deleted_at IS NULL
    )
    AND document_chunks.deleted_at IS NULL
  );

DROP POLICY IF EXISTS "Users can insert chunks of own documents" ON document_chunks;
CREATE POLICY "Users can insert chunks of own documents" ON document_chunks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
        AND documents.user_id = auth.uid()
        AND documents.deleted_at IS NULL
    )
  );

-- ============================================================
-- EMBEDDINGS — acesso herdado do chunk
-- ============================================================

ALTER TABLE embeddings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access embeddings of own chunks" ON embeddings;
CREATE POLICY "Users can access embeddings of own chunks" ON embeddings
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.id = embeddings.chunk_id
        AND d.user_id = auth.uid()
        AND d.deleted_at IS NULL
        AND dc.deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "Users can insert embeddings of own chunks" ON embeddings;
CREATE POLICY "Users can insert embeddings of own chunks" ON embeddings
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.id = embeddings.chunk_id
        AND d.user_id = auth.uid()
        AND d.deleted_at IS NULL
    )
  );

-- ============================================================
-- KNOWLEDGE_SUBJECTS — catálogo público (leitura), admin (escrita)
-- ============================================================

ALTER TABLE knowledge_subjects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read subjects" ON knowledge_subjects;
CREATE POLICY "Anyone authenticated can read subjects" ON knowledge_subjects
  FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admin can manage subjects" ON knowledge_subjects;
CREATE POLICY "Admin can manage subjects" ON knowledge_subjects
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'));

-- ============================================================
-- KNOWLEDGE_TOPICS — catálogo público (leitura), admin (escrita)
-- ============================================================

ALTER TABLE knowledge_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read topics" ON knowledge_topics;
CREATE POLICY "Anyone authenticated can read topics" ON knowledge_topics
  FOR SELECT
  USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

DROP POLICY IF EXISTS "Admin can manage topics" ON knowledge_topics;
CREATE POLICY "Admin can manage topics" ON knowledge_topics
  FOR ALL
  USING (auth.uid() IN (SELECT id FROM auth.users WHERE raw_app_meta_data->>'is_admin' = 'true'));

-- ============================================================
-- KNOWLEDGE_TAGS — catálogo público
-- ============================================================

ALTER TABLE knowledge_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read tags" ON knowledge_tags;
CREATE POLICY "Anyone authenticated can read tags" ON knowledge_tags
  FOR SELECT
  USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Authenticated users can create tags" ON knowledge_tags;
CREATE POLICY "Authenticated users can create tags" ON knowledge_tags
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- ============================================================
-- JUNCTIONS — acesso herdado do documento
-- ============================================================

ALTER TABLE document_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_tags ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public._document_owner_check(p_document_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.documents
    WHERE id = p_document_id
      AND user_id = auth.uid()
      AND deleted_at IS NULL
  );
$$;

DROP POLICY IF EXISTS "Users can access document_subjects of own docs" ON document_subjects;
CREATE POLICY "Users can access document_subjects of own docs" ON document_subjects
  FOR SELECT
  USING (_document_owner_check(document_id));

DROP POLICY IF EXISTS "Users can insert document_subjects of own docs" ON document_subjects;
CREATE POLICY "Users can insert document_subjects of own docs" ON document_subjects
  FOR INSERT
  WITH CHECK (_document_owner_check(document_id));

DROP POLICY IF EXISTS "Users can access document_topics of own docs" ON document_topics;
CREATE POLICY "Users can access document_topics of own docs" ON document_topics
  FOR SELECT
  USING (_document_owner_check(document_id));

DROP POLICY IF EXISTS "Users can insert document_topics of own docs" ON document_topics;
CREATE POLICY "Users can insert document_topics of own docs" ON document_topics
  FOR INSERT
  WITH CHECK (_document_owner_check(document_id));

DROP POLICY IF EXISTS "Users can access document_tags of own docs" ON document_tags;
CREATE POLICY "Users can access document_tags of own docs" ON document_tags
  FOR SELECT
  USING (_document_owner_check(document_id));

DROP POLICY IF EXISTS "Users can insert document_tags of own docs" ON document_tags;
CREATE POLICY "Users can insert document_tags of own docs" ON document_tags
  FOR INSERT
  WITH CHECK (_document_owner_check(document_id));

-- ============================================================
-- EMBEDDING CACHE — sistema (sem política de cliente)
-- ============================================================

ALTER TABLE embedding_cache ENABLE ROW LEVEL SECURITY;

-- Tabela de sistema: acesso SOMENTE via service_role / role com BYPASSRLS
-- (cliente autenticado/anon não acessa). NENHUMA política permissiva é criada;
-- RLS deny-by-default protege contra leitura/escrita por usuários da aplicação.
-- O acesso da aplicação (Drizzle/direct connection) ignora RLS.
