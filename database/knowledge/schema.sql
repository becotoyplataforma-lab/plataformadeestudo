-- ============================================================
-- ConcursoAI — Domínio KNOWLEDGE — Schema SQL
-- PostgreSQL 17 · pgvector · UUID · Soft Delete · Auditoria
--
-- Ordem de aplicação: schema → functions → rls → seeds
-- ============================================================

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE document_type AS ENUM (
    'pdf', 'docx', 'txt', 'markdown', 'html', 'edital', 'apostila'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE document_status AS ENUM (
    'pending', 'processing', 'processed', 'chunked', 'indexing', 'indexed', 'failed'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE source_type AS ENUM (
    'upload', 'edital', 'url'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- DOCUMENTS — agregado raiz do domínio Knowledge
-- ============================================================

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type document_type NOT NULL,
  title TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  status document_status NOT NULL DEFAULT 'pending',
  file_size INTEGER CHECK (file_size >= 0),
  mime_type TEXT,
  source_type source_type NOT NULL DEFAULT 'upload',
  source_url TEXT,
  external_id UUID,
  file_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Unique constraints (parciais — apenas ativos)
CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_storage_path
  ON documents(storage_path) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_documents_file_hash
  ON documents(user_id, file_hash) WHERE deleted_at IS NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_documents_user_status ON documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_documents_user_hash ON documents(user_id, file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status) WHERE deleted_at IS NULL;

-- ============================================================
-- DOCUMENT_CHUNKS — trecho extraído do documento
-- ============================================================

CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL CHECK (seq >= 0),
  content TEXT NOT NULL,
  content_hash TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  fts_vector tsvector GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Unique constraint
CREATE UNIQUE INDEX IF NOT EXISTS uq_chunks_doc_seq
  ON document_chunks(document_id, seq) WHERE deleted_at IS NULL;

-- Índices
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_chunks_content_hash ON document_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_chunks_fts ON document_chunks USING GIN (fts_vector);

-- ============================================================
-- EMBEDDINGS — vetor de representação do chunk
-- ============================================================

CREATE TABLE IF NOT EXISTS embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  model VARCHAR(100) NOT NULL DEFAULT 'BAAI/bge-m3',
  embedding VECTOR(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(chunk_id)
);

-- Índice vetorial HNSW (criado apenas se pgvector suportar)
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
  ON embeddings USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);

-- ============================================================
-- KNOWLEDGE_SUBJECTS — catálogo de matérias (compartilhado)
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  color TEXT,
  keywords JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_subjects_name
  ON knowledge_subjects(name) WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_subjects_slug
  ON knowledge_subjects(slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_subjects_status ON knowledge_subjects(status);

-- ============================================================
-- KNOWLEDGE_TOPICS — árvore de tópicos
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES knowledge_subjects(id) ON DELETE CASCADE,
  parent_topic_id UUID,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Self-reference FK
ALTER TABLE knowledge_topics
  ADD CONSTRAINT fk_knowledge_topics_parent
  FOREIGN KEY (parent_topic_id) REFERENCES knowledge_topics(id)
  ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_topics_slug_subject
  ON knowledge_topics(subject_id, slug) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_knowledge_topics_subject ON knowledge_topics(subject_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_topics_parent ON knowledge_topics(parent_topic_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_topics_status ON knowledge_topics(status);

-- ============================================================
-- KNOWLEDGE_TAGS — etiquetas transversais
-- ============================================================

CREATE TABLE IF NOT EXISTS knowledge_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_knowledge_tags_slug ON knowledge_tags(slug);
CREATE INDEX IF NOT EXISTS idx_knowledge_tags_name ON knowledge_tags(name);

-- ============================================================
-- JUNCTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS document_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES knowledge_subjects(id) ON DELETE CASCADE,
  confidence INTEGER DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_document_subjects_doc ON document_subjects(document_id);
CREATE INDEX IF NOT EXISTS idx_document_subjects_subject ON document_subjects(subject_id);

CREATE TABLE IF NOT EXISTS document_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  topic_id UUID NOT NULL REFERENCES knowledge_topics(id) ON DELETE CASCADE,
  confidence INTEGER DEFAULT 100 CHECK (confidence BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_document_topics_doc ON document_topics(document_id);
CREATE INDEX IF NOT EXISTS idx_document_topics_topic ON document_topics(topic_id);

CREATE TABLE IF NOT EXISTS document_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES knowledge_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(document_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_document_tags_doc ON document_tags(document_id);
CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id);

-- ============================================================
-- EMBEDDING CACHE
-- ============================================================

CREATE TABLE IF NOT EXISTS embedding_cache (
  content_hash TEXT NOT NULL,
  model VARCHAR(100) NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (content_hash, model)
);
