-- ============================================================
-- ConcursoAI — Domínio: Billing — Schema
-- PostgreSQL 17 · Supabase · UUID · Auditoria
-- Referência: docs/08-DATABASE-PHYSICAL.md · docs/05-DOMAIN-MODEL.md
-- Ordem de aplicação: schema.sql → functions.sql → rls.sql → seeds.sql
--
-- OPEN-004: Billing é dono dos limites (plan.limits). AI registra ai_usage.
-- ============================================================

-- ============================================================
-- ENUMS (globais — criados se não existirem)
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE public.subscription_status AS ENUM (
      'active', 'cancelled', 'expired', 'past_due', 'suspended'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
    CREATE TYPE public.payment_status AS ENUM (
      'pending', 'approved', 'rejected', 'cancelled', 'refunded'
    );
  END IF;
END $$;

-- ============================================================
-- PLANS — nível de acesso e limites (agregado raiz)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  code        text NOT NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  limits      jsonb NOT NULL DEFAULT '{}'::jsonb,
  status      public.lifecycle_status NOT NULL DEFAULT 'active',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  deleted_at  timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plans_code ON public.plans (code);
CREATE INDEX IF NOT EXISTS idx_plans_status ON public.plans (status);

-- ============================================================
-- SUBSCRIPTIONS — vínculo do usuário a um plano
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id    uuid NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status     public.subscription_status NOT NULL DEFAULT 'active',
  starts_at  timestamptz NOT NULL DEFAULT now(),
  ends_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  CONSTRAINT chk_subscriptions_dates CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- Uma assinatura ativa por usuário (parcial).
CREATE UNIQUE INDEX IF NOT EXISTS uq_subscriptions_user_active
  ON public.subscriptions (user_id)
  WHERE deleted_at IS NULL AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
  ON public.subscriptions (user_id, status);

-- ============================================================
-- PAYMENTS — transação registrada (imutável)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_id    uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  provider           text NOT NULL,
  provider_id        text,
  amount_cents       integer NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  currency           text NOT NULL DEFAULT 'BRL',
  status             public.payment_status NOT NULL DEFAULT 'pending',
  external_reference text,
  paid_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Idempotência do webhook: o mesmo pagamento no provedor é único.
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_provider_id
  ON public.payments (provider_id)
  WHERE provider_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_user_created
  ON public.payments (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_subscription
  ON public.payments (subscription_id);
