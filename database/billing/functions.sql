-- ============================================================
-- ConcursoAI — Domínio: Billing — Functions
-- PostgreSQL 17 · Supabase
-- Convenção: funções e tabelas qualificadas com `public.`
--
-- Os Services (Drizzle) fazem escrita direta; estas funções SECURITY DEFINER
-- são operações idempotentes de nível SQL (migração/ops/fallback) e seguem o
-- padrão do domínio AI (register_ai_usage).
-- ============================================================

-- ============================================================
-- TRIGGER: updated_at (plans e subscriptions possuem updated_at)
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_plans_updated_at') THEN
    CREATE TRIGGER trg_plans_updated_at
      BEFORE UPDATE ON public.plans
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_subscriptions_updated_at') THEN
    CREATE TRIGGER trg_subscriptions_updated_at
      BEFORE UPDATE ON public.subscriptions
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- ============================================================
-- FUNCTION: billing_register_payment
-- Registra um pagamento de forma idempotente (por provider_id).
-- ============================================================

CREATE OR REPLACE FUNCTION public.billing_register_payment(
  p_user_id UUID,
  p_provider TEXT,
  p_provider_id TEXT,
  p_amount_cents INTEGER,
  p_currency TEXT,
  p_status public.payment_status,
  p_external_reference TEXT DEFAULT NULL,
  p_paid_at timestamptz DEFAULT NULL
)
RETURNS public.payments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_payment public.payments;
BEGIN
  INSERT INTO public.payments (
    user_id, provider, provider_id, amount_cents, currency,
    status, external_reference, paid_at
  )
  VALUES (
    p_user_id, p_provider, p_provider_id, p_amount_cents, p_currency,
    p_status, p_external_reference, p_paid_at
  )
  ON CONFLICT (provider_id) WHERE provider_id IS NOT NULL
  DO NOTHING
  RETURNING * INTO v_payment;

  -- Se já existia (duplicidade), retorna o registro existente.
  IF v_payment IS NULL THEN
    SELECT * INTO v_payment
    FROM public.payments
    WHERE provider_id = p_provider_id
    LIMIT 1;
  END IF;

  RETURN v_payment;
END;
$$;

-- ============================================================
-- FUNCTION: billing_activate_subscription
-- Ativa uma assinatura (cancela as ativas anteriores — uma ativa por usuário).
-- ============================================================

CREATE OR REPLACE FUNCTION public.billing_activate_subscription(
  p_user_id UUID,
  p_plan_code TEXT,
  p_days INTEGER DEFAULT 30
)
RETURNS public.subscriptions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_plan public.plans;
  v_subscription public.subscriptions;
BEGIN
  SELECT * INTO v_plan
  FROM public.plans
  WHERE code = p_plan_code AND deleted_at IS NULL AND status = 'active'
  LIMIT 1;

  IF v_plan IS NULL THEN
    RAISE EXCEPTION 'Plano não encontrado: %', p_plan_code;
  END IF;

  -- Cancela (marca) as assinaturas ativas anteriores.
  UPDATE public.subscriptions
  SET status = 'cancelled', ends_at = now(), updated_at = now()
  WHERE user_id = p_user_id
    AND deleted_at IS NULL
    AND status = 'active';

  INSERT INTO public.subscriptions (user_id, plan_id, status, starts_at, ends_at)
  VALUES (
    p_user_id,
    v_plan.id,
    'active',
    now(),
    CASE WHEN p_days IS NULL THEN NULL ELSE now() + (p_days || ' days')::interval END
  )
  RETURNING * INTO v_subscription;

  RETURN v_subscription;
END;
$$;
