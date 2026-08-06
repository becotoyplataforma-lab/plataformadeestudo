/**
 * Testes dos DTOs do Billing — validação Zod e mappers.
 */
import { describe, it, expect } from "vitest";
import {
  PlanDtoSchema,
  EntitlementDtoSchema,
  CheckoutDtoSchema,
  WebhookResultDtoSchema,
  SubscriptionDtoSchema,
  PaymentDtoSchema,
  BillingPlansDtoSchema,
  mapPlanToDto,
  mapEntitlementToDto,
  mapCheckoutToDto,
  mapSubscriptionToDto,
  mapPaymentToDto,
  mapWebhookResultToDto,
} from "@/lib/dto/billing.dto";
import type { CurrentEntitlement } from "@/lib/billing/services";

const UUID = "00000000-0000-0000-0000-000000000001";
const UUID2 = "00000000-0000-0000-0000-000000000002";

const PLAN_ROW = {
  id: UUID,
  name: "Pro",
  code: "pro",
  priceCents: 2990,
  limits: { maxMessages: 500, maxTokens: 1000000, allowPro: true },
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as const;

const SUB_ROW = {
  id: UUID,
  userId: UUID,
  planId: UUID2,
  status: "active",
  startsAt: new Date(),
  endsAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
} as const;

const PAYMENT_ROW = {
  id: UUID,
  userId: UUID,
  subscriptionId: UUID2,
  provider: "mercadopago",
  providerId: "123",
  amountCents: 2990,
  currency: "BRL",
  status: "approved",
  externalReference: "pro:u1",
  paidAt: new Date(),
  createdAt: new Date(),
} as const;

describe("PlanDtoSchema", () => {
  it("aceita plano válido", () => {
    expect(PlanDtoSchema.safeParse(mapPlanToDto(PLAN_ROW)).success).toBe(true);
  });

  it("rejeita price_cents negativo", () => {
    const dto = mapPlanToDto(PLAN_ROW);
    expect(PlanDtoSchema.safeParse({ ...dto, price_cents: -1 }).success).toBe(false);
  });
});

describe("BillingPlansDtoSchema", () => {
  it("aceita lista de planos", () => {
    const dto = BillingPlansDtoSchema.safeParse({
      plans: [mapPlanToDto(PLAN_ROW)],
    });
    expect(dto.success).toBe(true);
  });
});

describe("EntitlementDtoSchema", () => {
  const entitlement: CurrentEntitlement = {
    planId: UUID2,
    planCode: "pro",
    planName: "Pro",
    priceCents: 2990,
    tier: "paid",
    subscriptionId: UUID,
    subscriptionStatus: "active",
    startsAt: new Date(),
    endsAt: null,
    limits: { maxMessages: 500, maxTokens: 1000000, allowPro: true },
  };

  it("aceita entitlement válido (pago)", () => {
    const dto = mapEntitlementToDto(entitlement);
    const parsed = EntitlementDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.tier).toBe("paid");
      expect(parsed.data.limits.max_messages).toBe(500);
      expect(parsed.data.subscription_status).toBe("active");
    }
  });

  it("rejeita tier inválido", () => {
    const dto = mapEntitlementToDto(entitlement);
    expect(
      EntitlementDtoSchema.safeParse({ ...dto, tier: "gold" }).success
    ).toBe(false);
  });
});

describe("SubscriptionDtoSchema", () => {
  it("aceita assinatura válida", () => {
    expect(
      SubscriptionDtoSchema.safeParse(mapSubscriptionToDto(SUB_ROW)).success
    ).toBe(true);
  });
});

describe("PaymentDtoSchema", () => {
  it("aceita pagamento válido", () => {
    expect(PaymentDtoSchema.safeParse(mapPaymentToDto(PAYMENT_ROW)).success).toBe(true);
  });
});

describe("CheckoutDtoSchema", () => {
  it("aceita checkout válido e mapeia", () => {
    const dto = mapCheckoutToDto({
      initPoint: "https://init.mercadopago.com/x",
      sandboxInitPoint: "https://sandbox.mercadopago.com/x",
      externalReference: "pro:u1",
      plan: "pro",
      priceCents: 2990,
    });
    const parsed = CheckoutDtoSchema.safeParse(dto);
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.plan).toBe("pro");
  });
});

describe("WebhookResultDtoSchema", () => {
  it("aceita resultado de webhook", () => {
    const dto = mapWebhookResultToDto({
      received: true,
      processed: true,
      ignored: false,
      duplicate: false,
      status: "approved",
    });
    expect(WebhookResultDtoSchema.safeParse(dto).success).toBe(true);
  });

  it("rejeita status inválido", () => {
    const dto = mapWebhookResultToDto({
      received: true,
      processed: false,
      ignored: false,
      duplicate: false,
      status: "approved",
    });
    expect(
      WebhookResultDtoSchema.safeParse({ ...dto, status: "garbage" }).success
    ).toBe(false);
  });
});
