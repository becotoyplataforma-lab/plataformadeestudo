-- ============================================================
-- ConcursoAI — Domínio: Billing — Seeds (dev/staging apenas)
--
-- Planos padrão. Limites (JSON) espelham os planos legados
-- (src/lib/payments/plans.ts) e as cotas definidas em docs/03-AIDD.
-- OPEN-004: Billing é dono dos limites.
-- ============================================================

INSERT INTO public.plans (name, code, price_cents, limits, status)
VALUES
  (
    'Gratuito',
    'free',
    0,
    '{"maxMessages": 50, "maxTokens": 100000, "maxQuestionsPerDay": 20, "maxDocuments": 3, "allowPro": false}'::jsonb,
    'active'
  ),
  (
    'Pro',
    'pro',
    2990,
    '{"maxMessages": 500, "maxTokens": 1000000, "maxQuestionsPerDay": 200, "maxDocuments": 20, "allowPro": true}'::jsonb,
    'active'
  ),
  (
    'Intensivo',
    'intensivo',
    4990,
    '{"maxMessages": 2000, "maxTokens": 5000000, "maxQuestionsPerDay": 1000, "maxDocuments": 100, "allowPro": true}'::jsonb,
    'active'
  )
ON CONFLICT (code) DO NOTHING;
