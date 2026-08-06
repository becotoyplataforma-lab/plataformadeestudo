/**
 * FASE 18 — Integração real: Billing (PlanRepository, SubscriptionService,
 * EntitlementService no Postgres real).
 */
import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { plans } from "@/db/schema/billing";
import { PlanRepository } from "@/lib/billing/repositories/plan.repository";
import { SubscriptionService } from "@/lib/billing/services/subscription.service";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";
import { hasDb, createTestUser, deleteTestUser } from "./helpers";

describe.skipIf(!hasDb)("Billing — integração real", () => {
  const users: string[] = [];
  const planIds: string[] = [];

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
    await Promise.all(planIds.map((id) => db.delete(plans).where(eq(plans.id, id))));
  });

  it("ativa assinatura e resolve entitlement pago", async () => {
    const userId = await createTestUser();
    users.push(userId);

    const plan = await PlanRepository.create({
      name: "Pro Test",
      code: `pro-test-${userId.slice(0, 8)}`,
      priceCents: 2990,
      limits: { maxMessages: 500, maxTokens: 1_000_000, allowPro: true },
      status: "active",
    });
    planIds.push(plan.id);

    const sub = await SubscriptionService.activate(userId, plan.code);
    expect(sub.status).toBe("active");
    expect(sub.planId).toBe(plan.id);

    const ent = await EntitlementService.getCurrent(userId);
    expect(ent.tier).toBe("paid");
    expect(ent.planCode).toBe(plan.code);
    expect(ent.limits.maxMessages).toBe(500);
    expect(ent.limits.allowPro).toBe(true);
  });

  it("sem assinatura → entitlement gratuito", async () => {
    const userId = await createTestUser();
    users.push(userId);

    const ent = await EntitlementService.getCurrent(userId);
    expect(ent.tier).toBe("free");
    expect(ent.planCode).toBe("free");
  });

  it("cancela assinatura ativa", async () => {
    const userId = await createTestUser();
    users.push(userId);
    const plan = await PlanRepository.create({
      name: "Pro Test 2",
      code: `pro-test2-${userId.slice(0, 8)}`,
      priceCents: 2990,
      limits: { maxMessages: 500, maxTokens: 1_000_000, allowPro: true },
      status: "active",
    });
    planIds.push(plan.id);

    await SubscriptionService.activate(userId, plan.code);
    const cancelled = await SubscriptionService.cancel(userId);
    expect(cancelled?.status).toBe("cancelled");

    const ent = await EntitlementService.getCurrent(userId);
    expect(ent.tier).toBe("free");
  });
});
