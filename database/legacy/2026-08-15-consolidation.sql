-- ============================================================
-- ConcursoAI — 2026-08-15-consolidation.sql
-- Consolidação de apostilas (Fase 3 do PLANO-MESTRE-TESTE).
-- Idempotente e NÃO destrutiva. Aplicar via:
--   node scripts/apply-migration.mjs database/migrations/2026-08-15-consolidation.sql
-- ============================================================

-- Novo valor no enum source_type (documents consolidados por IA).
ALTER TYPE public.source_type ADD VALUE IF NOT EXISTS 'consolidated';

-- Rastreabilidade dos documentos-fonte da consolidação.
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS source_document_ids jsonb;
