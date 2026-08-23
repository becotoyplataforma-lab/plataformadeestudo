-- ============================================================
-- ConcursoAI — 2026-08-15-admin-content.sql
-- Revisão de conteúdo de documentos (Item 5 do guia admin).
-- Idempotente e NÃO destrutiva. Aplicar via:
--   node scripts/apply-migration.mjs database/migrations/2026-08-15-admin-content.sql
-- (Sem blocos DO $$ — o aplicador divide por ';'.)
-- ============================================================

ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS review_status text NOT NULL DEFAULT 'pendente';
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz;
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS review_note text;

-- Check dos estados de revisão (idempotente via DROP IF EXISTS).
ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS chk_documents_review_status;
ALTER TABLE public.documents
  ADD CONSTRAINT chk_documents_review_status
  CHECK (review_status IN ('pendente', 'aprovado', 'rejeitado'));

-- Índice para a fila de revisão (idempotente via DROP IF EXISTS).
DROP INDEX IF EXISTS idx_documents_review_status;
CREATE INDEX idx_documents_review_status ON public.documents (review_status)
  WHERE deleted_at IS NULL;
