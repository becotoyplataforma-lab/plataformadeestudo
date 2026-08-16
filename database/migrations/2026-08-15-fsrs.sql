-- ============================================================
-- ConcursoAI — 2026-08-15-fsrs.sql
-- FASE 3 (noturno): estado FSRS para flashcards.
-- Idempotente e NÃO destrutiva. Aplicar via:
--   node scripts/apply-migration.mjs database/migrations/2026-08-15-fsrs.sql
-- ============================================================

ALTER TABLE public.review_schedules
  ADD COLUMN IF NOT EXISTS stability numeric(10,4) NOT NULL DEFAULT 0;

ALTER TABLE public.review_schedules
  ADD COLUMN IF NOT EXISTS difficulty numeric(6,4) NOT NULL DEFAULT 5;

ALTER TABLE public.review_schedules
  ADD COLUMN IF NOT EXISTS last_rating text;
