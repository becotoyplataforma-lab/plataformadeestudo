/**
 * ConcursoAI — Billing DTOs
 *
 * Data Transfer Objects do domínio Billing.
 * Segue: DD-006 (DTO obrigatório), DD-007 (Zod obrigatório),
 *        docs/08-DATABASE-PHYSICAL.md
 */
import { z } from "zod";
import { parseDto } from "@/lib/dto";
import type { OutputOf } from "@/lib/dto";
import type { plans, subscriptions, payments } from "@/db/schema/billing";
import type { CurrentEntitlement } from "@/lib/billing/services";
import type { CheckoutResult } from "@/lib/billing/services/checkout.service";
import type { WebhookResult } from "@/lib/billing/services";

// ============================================================
// PlanLimits
// ============================================================

export const PlanLimitsDtoSchema = z.object({
  max_messages: z.number().int().nonnegative(),
  max_tokens: z.number().int().nonnegative(),
  max_questions_per_day: z.number().int().nonnegative().optional(),
  max_documents: z.number().int().nonnegative().optional(),
  allow_pro: z.boolean().optional(),
});
export type PlanLimitsDto = OutputOf<typeof PlanLimitsDtoSchema>;

// ============================================================
// Plan
// ============================================================

export const PlanDtoSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  code: z.string(),
  price_cents: z.number().int().nonnegative(),
  status: z.enum(["active", "inactive", "archived"]),
});
export type PlanDto = OutputOf<typeof PlanDtoSchema>;

export const BillingPlansDtoSchema = z.object({
  plans: z.array(PlanDtoSchema),
});
export type BillingPlansDto = OutputOf<typeof BillingPlansDtoSchema>;

// ============================================================
// Subscription
// ============================================================

export const SubscriptionDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  plan_id: z.string().uuid(),
  status: z.enum(["active", "cancelled", "expired", "past_due", "suspended"]),
  starts_at: z.string(),
  ends_at: z.string().nullable(),
});
export type SubscriptionDto = OutputOf<typeof SubscriptionDtoSchema>;

// ============================================================
// Payment
// ============================================================

export const PaymentDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  subscription_id: z.string().uuid().nullable(),
  provider: z.string(),
  provider_id: z.string().nullable(),
  amount_cents: z.number().int().nonnegative(),
  currency: z.string(),
  status: z.enum(["pending", "approved", "rejected", "cancelled", "refunded"]),
  paid_at: z.string().nullable(),
  created_at: z.string(),
});
export type PaymentDto = OutputOf<typeof PaymentDtoSchema>;

// ============================================================
// Entitlement (plano + assinatura + limites)
// ============================================================

export const EntitlementDtoSchema = z.object({
  plan_id: z.string().uuid(),
  plan_code: z.string(),
  plan_name: z.string(),
  price_cents: z.number().int().nonnegative(),
  tier: z.enum(["free", "paid"]),
  subscription_id: z.string().uuid().nullable(),
  subscription_status: z
    .enum(["active", "cancelled", "expired", "past_due", "suspended"])
    .nullable(),
  ends_at: z.string().nullable(),
  limits: PlanLimitsDtoSchema,
});
export type EntitlementDto = OutputOf<typeof EntitlementDtoSchema>;

// ============================================================
// Checkout
// ============================================================

export const CheckoutDtoSchema = z.object({
  init_point: z.string(),
  sandbox_init_point: z.string(),
  external_reference: z.string(),
  plan: z.string(),
  price_cents: z.number().int().nonnegative(),
  promo_applied: z.boolean().optional(),
});
export type CheckoutDto = OutputOf<typeof CheckoutDtoSchema>;

// ============================================================
// Webhook result
// ============================================================

export const WebhookResultDtoSchema = z.object({
  received: z.boolean(),
  processed: z.boolean(),
  ignored: z.boolean(),
  duplicate: z.boolean(),
  status: z
    .enum(["pending", "approved", "rejected", "cancelled", "refunded"])
    .nullable(),
});
export type WebhookResultDto = OutputOf<typeof WebhookResultDtoSchema>;

// ============================================================
// Mappers
// ============================================================

type PlanRow = typeof plans.$inferSelect;
type SubscriptionRow = typeof subscriptions.$inferSelect;
type PaymentRow = typeof payments.$inferSelect;

export function mapPlanToDto(row: PlanRow): PlanDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    price_cents: row.priceCents,
    status: row.status,
  };
}

export function mapSubscriptionToDto(row: SubscriptionRow): SubscriptionDto {
  return {
    id: row.id,
    user_id: row.userId,
    plan_id: row.planId,
    status: row.status,
    starts_at: row.startsAt.toISOString(),
    ends_at: row.endsAt ? row.endsAt.toISOString() : null,
  };
}

export function mapPaymentToDto(row: PaymentRow): PaymentDto {
  return {
    id: row.id,
    user_id: row.userId,
    subscription_id: row.subscriptionId,
    provider: row.provider,
    provider_id: row.providerId,
    amount_cents: row.amountCents,
    currency: row.currency,
    status: row.status,
    paid_at: row.paidAt ? row.paidAt.toISOString() : null,
    created_at: row.createdAt.toISOString(),
  };
}

export function mapEntitlementToDto(e: CurrentEntitlement): EntitlementDto {
  return {
    plan_id: e.planId,
    plan_code: e.planCode,
    plan_name: e.planName,
    price_cents: e.priceCents,
    tier: e.tier,
    subscription_id: e.subscriptionId,
    subscription_status: e.subscriptionStatus,
    ends_at: e.endsAt ? e.endsAt.toISOString() : null,
    limits: {
      max_messages: e.limits.maxMessages,
      max_tokens: e.limits.maxTokens,
      max_questions_per_day: e.limits.maxQuestionsPerDay,
      max_documents: e.limits.maxDocuments,
      allow_pro: e.limits.allowPro,
    },
  };
}

export function mapCheckoutToDto(c: CheckoutResult): CheckoutDto {
  return {
    init_point: c.initPoint,
    sandbox_init_point: c.sandboxInitPoint,
    external_reference: c.externalReference,
    plan: c.plan,
    price_cents: c.priceCents,
    promo_applied: c.promoApplied,
  };
}

export function mapWebhookResultToDto(r: WebhookResult): WebhookResultDto {
  return {
    received: r.received,
    processed: r.processed,
    ignored: r.ignored,
    duplicate: r.duplicate,
    status: r.status,
  };
}

/** Valida um DTO arbitrário (null se inválido). */
export function toBillingPlansDto(input: unknown): BillingPlansDto | null {
  return parseDto(BillingPlansDtoSchema, input);
}
