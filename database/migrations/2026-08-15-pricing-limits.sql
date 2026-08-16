-- ============================================================
-- ConcursoAI — 2026-08-15-pricing-limits.sql
-- FASE 1 (noturno): preços promocionais e limites de IA.
-- Idempotente e NÃO destrutiva. Aplicar via:
--   node scripts/apply-migration.mjs database/migrations/2026-08-15-pricing-limits.sql
-- ============================================================

-- Coluna de preço promocional (1º ciclo) nos planos.
ALTER TABLE public.plans
  ADD COLUMN IF NOT EXISTS promo_price_cents integer;

-- Gratuito: 5 mensagens de IA/dia (era 50).
UPDATE public.plans
   SET limits = jsonb_set(COALESCE(limits, '{}'::jsonb), '{maxMessages}', '5'::jsonb),
       updated_at = now()
 WHERE code = 'free';

-- Pro: R$ 19,90/mês regular, R$ 9,90 no 1º mês (promocional).
UPDATE public.plans
   SET price_cents = 1990,
       promo_price_cents = 990,
       updated_at = now()
 WHERE code = 'pro';

-- Intensivo: mantém R$ 49,90/mês, sem preço promocional.
UPDATE public.plans
   SET promo_price_cents = NULL,
       updated_at = now()
 WHERE code = 'intensivo';
