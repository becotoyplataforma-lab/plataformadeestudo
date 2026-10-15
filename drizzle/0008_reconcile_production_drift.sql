-- 0008_reconcile_production_drift.sql
--
-- FASE 6E-R3: catch-up forward-only do banco de teste isolado para o drift
-- estrutural que existe apenas na producao (31 colunas, 3 rotulos de enum, 11 FKs
-- legados, 8 indices legados, 2 predicados parciais e 1 CHECK).
--
-- Regras deste arquivo:
--   * Nao duplica nada de 0000-0007 (nenhum objeto knowledge_topic_id/notice_topics aqui).
--   * Nao semeia dados, nao toca RLS/grants/funcoes/triggers, nao renomeia objetos.
--   * Nao apaga nada, exceto os 2 indices do bloco D2 (reparo de predicado parcial,
--     autorizado explicitamente e so quando o indice atual NAO e parcial).
--   * Idempotente: pode ser reexecutado sem erro.
--
-- Aplicacao: psql em autocommit (sem --single-transaction), porque o bloco B usa
-- ALTER TYPE ... ADD VALUE. Alvo autorizado: banco de teste isolado.

-- ============================================================
-- 0008-A: colunas de producao ausentes (31)
-- ============================================================

ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS chunk_count integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS embedding_count integer NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS page_count integer;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processing_error text;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processed_at timestamptz;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS edital_id uuid;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS position_id uuid;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS source_document_ids jsonb;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pendente';
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reviewed_by uuid;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS review_note text;
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_document_id uuid;
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_chunk_id uuid;
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_edital_id uuid;
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_position_id uuid;
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS confidence numeric(3, 2);
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic text;
--> statement-breakpoint
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS document_id uuid;
--> statement-breakpoint
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS chapter text;
--> statement-breakpoint
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS source_document_id uuid;
--> statement-breakpoint
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS source_chunk_id uuid;
--> statement-breakpoint
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS contest_id uuid;
--> statement-breakpoint
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS position_id uuid;
--> statement-breakpoint
ALTER TABLE public.plans ADD COLUMN IF NOT EXISTS promo_price_cents integer;
--> statement-breakpoint
ALTER TABLE public.review_schedules ADD COLUMN IF NOT EXISTS stability numeric(10, 4) NOT NULL DEFAULT 0;
--> statement-breakpoint
ALTER TABLE public.review_schedules ADD COLUMN IF NOT EXISTS difficulty numeric(6, 4) NOT NULL DEFAULT 5;
--> statement-breakpoint
ALTER TABLE public.review_schedules ADD COLUMN IF NOT EXISTS last_rating text;


-- ============================================================
-- 0008-B: rotulos de enum ausentes (3) -- ordem de append igual a producao
-- ============================================================
ALTER TYPE public.question_status ADD VALUE IF NOT EXISTS 'em_revisao';
--> statement-breakpoint
ALTER TYPE public.question_status ADD VALUE IF NOT EXISTS 'rejeitada';
--> statement-breakpoint
ALTER TYPE public.source_type ADD VALUE IF NOT EXISTS 'consolidated';

--> statement-breakpoint

-- ============================================================
-- 0008-C: FKs legadas de producao (11) -- nomes originais preservados
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_edital_id_fkey' AND conrelid = 'public.documents'::regclass) THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_edital_id_fkey
      FOREIGN KEY (edital_id) REFERENCES public.editais(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_position_id_fkey' AND conrelid = 'public.documents'::regclass) THEN
    ALTER TABLE public.documents ADD CONSTRAINT documents_position_id_fkey
      FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_sessions_document_id_fkey' AND conrelid = 'public.chat_sessions'::regclass) THEN
    ALTER TABLE public.chat_sessions ADD CONSTRAINT chat_sessions_document_id_fkey
      FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_source_document_id_fkey' AND conrelid = 'public.questions'::regclass) THEN
    ALTER TABLE public.questions ADD CONSTRAINT questions_source_document_id_fkey
      FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_source_chunk_id_fkey' AND conrelid = 'public.questions'::regclass) THEN
    ALTER TABLE public.questions ADD CONSTRAINT questions_source_chunk_id_fkey
      FOREIGN KEY (source_chunk_id) REFERENCES public.document_chunks(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_source_edital_id_fkey' AND conrelid = 'public.questions'::regclass) THEN
    ALTER TABLE public.questions ADD CONSTRAINT questions_source_edital_id_fkey
      FOREIGN KEY (source_edital_id) REFERENCES public.editais(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'questions_source_position_id_fkey' AND conrelid = 'public.questions'::regclass) THEN
    ALTER TABLE public.questions ADD CONSTRAINT questions_source_position_id_fkey
      FOREIGN KEY (source_position_id) REFERENCES public.positions(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flashcards_source_document_id_fkey' AND conrelid = 'public.flashcards'::regclass) THEN
    ALTER TABLE public.flashcards ADD CONSTRAINT flashcards_source_document_id_fkey
      FOREIGN KEY (source_document_id) REFERENCES public.documents(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'flashcards_source_chunk_id_fkey' AND conrelid = 'public.flashcards'::regclass) THEN
    ALTER TABLE public.flashcards ADD CONSTRAINT flashcards_source_chunk_id_fkey
      FOREIGN KEY (source_chunk_id) REFERENCES public.document_chunks(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_contest' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_contest
      FOREIGN KEY (contest_id) REFERENCES public.contests(id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  -- FK composta: garante que o cargo pertence ao concurso (DD-023 4b).
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_contest_position' AND conrelid = 'public.profiles'::regclass) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_contest_position
      FOREIGN KEY (contest_id, position_id) REFERENCES public.positions(contest_id, id) ON DELETE SET NULL;
  END IF;
END $$;
--> statement-breakpoint


-- ============================================================
-- 0008-D: indices legados de producao ausentes (8)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_documents_edital ON public.documents (edital_id) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_documents_position ON public.documents (position_id) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_documents_review_status ON public.documents (review_status) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_chat_sessions_document ON public.chat_sessions (document_id) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_questions_source_document ON public.questions (source_document_id) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_questions_origin ON public.questions (origin) WHERE deleted_at IS NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_question_moderation_events_question ON public.question_moderation_events (question_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_question_moderation_events_admin ON public.question_moderation_events (admin_user_id);
--> statement-breakpoint


-- ============================================================
-- 0008-D2: reparo condicional de predicado parcial (AUTORIZADO, so no TESTDB)
-- So age quando o indice existe sem predicado parcial (indpred IS NULL).
-- O indice novo e estritamente menos restritivo que o atual, portanto a
-- recriacao nao pode falhar por violacao de unicidade.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
             WHERE c.relname = 'uq_avatars_slug'
               AND c.relnamespace = 'public'::regnamespace
               AND i.indpred IS NULL) THEN
    DROP INDEX public.uq_avatars_slug;
    CREATE UNIQUE INDEX uq_avatars_slug ON public.avatars USING btree (slug)
      WHERE deleted_at IS NULL;
  END IF;
END $$;
--> statement-breakpoint

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_index i ON i.indexrelid = c.oid
             WHERE c.relname = 'idx_lessons_user'
               AND c.relnamespace = 'public'::regnamespace
               AND i.indpred IS NULL) THEN
    DROP INDEX public.idx_lessons_user;
    CREATE INDEX idx_lessons_user ON public.lessons USING btree (user_id)
      WHERE deleted_at IS NULL;
  END IF;
END $$;

--> statement-breakpoint

-- ============================================================
-- 0008-E: CHECK de revisao de documentos (producao)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_documents_review_status' AND conrelid = 'public.documents'::regclass) THEN
    ALTER TABLE public.documents ADD CONSTRAINT chk_documents_review_status
      CHECK (review_status IN ('pendente', 'aprovado', 'rejeitado'));
  END IF;
END $$;
--> statement-breakpoint

-- Fim de 0008. Nenhum objeto de 0006/0007 (knowledge_topic_id, notice_topics)
-- foi recriado aqui; nada foi renomeado, apagado nem dados foram semeados.
