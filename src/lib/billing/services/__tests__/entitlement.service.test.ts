/**
 * Testes do EntitlementService (Billing) — plano gratuito, assinatura ativa,
 * cancelada, expirada, entitlement, quota e permissão de modelo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindActive = vi.fn();
const mockFindByCode = vi.fn();
const mockFindById = vi.fn();

vi.mock("../../repositories/subscription.repository", () => ({
  SubscriptionRepository: {
    findActiveByUser: (...args: unknown[]) => mockFindActive(...args),
  },
}));

vi.mock("../../repositories/plan.repository", () => ({
  PlanRepository: {
    findByCode: (...args: unknown[]) => mockFindByCode(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    listActive: vi.fn(),
    create: vi.fn(),
  },
}));

import { EntitlementService } from "../entitlement.service";

const FREE_PLAN = {
  id: "p-free",
  name: "Gratuito",
  code: "free",
  priceCents: 0,
  limits: { maxMessages: 50, maxTokens: 100000, maxQuestionsPerDay: 20, maxDocuments: 3, allowPro: false },
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const PRO_PLAN = {
  id: "p-pro",
  name: "Pro",
  code: "pro",
  priceCents: 2990,
  limits: { maxMessages: 500, maxTokens: 1000000, maxQuestionsPerDay: 200, maxDocuments: 20, allowPro: true },
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const ACTIVE_SUB = {
  id: "s1",
  userId: "u1",
  planId: "p-pro",
  status: "active",
  startsAt: new Date(),
  endsAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("EntitlementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindByCode.mockResolvedValue(FREE_PLAN);
    mockFindById.mockResolvedValue(PRO_PLAN);
  });

  it("plano gratuito quando não há assinatura", async () => {
    mockFindActive.mockResolvedValue(null);
    const ent = await EntitlementService.getCurrent("u1");
    expect(ent.tier).toBe("free");
    expect(ent.planCode).toBe("free");
    expect(ent.subscriptionId).toBeNull();
    expect(ent.limits.maxMessages).toBe(50);
  });

  it("assinatura ativa resolve o plano Pro (entitlement pago)", async () => {
    mockFindActive.mockResolvedValue(ACTIVE_SUB);
    const ent = await EntitlementService.getCurrent("u1");
    expect(ent.tier).toBe("paid");
    expect(ent.planCode).toBe("pro");
    expect(ent.subscriptionId).toBe("s1");
    expect(ent.subscriptionStatus).toBe("active");
  });

  it("assinatura cancelada (sem ativa) → gratuito", async () => {
    mockFindActive.mockResolvedValue(null);
    const ent = await EntitlementService.getCurrent("u1");
    expect(ent.tier).toBe("free");
    expect(ent.planCode).toBe("free");
  });

  it("assinatura expirada (ends_at passado) → gratuito", async () => {
    mockFindActive.mockResolvedValue({
      ...ACTIVE_SUB,
      endsAt: new Date(Date.now() - 60_000),
    });
    const ent = await EntitlementService.getCurrent("u1");
    expect(ent.tier).toBe("free");
    expect(ent.planCode).toBe("free");
  });

  it("getLimits retorna a quota do plano gratuito", async () => {
    mockFindActive.mockResolvedValue(null);
    const limits = await EntitlementService.getLimits("u1");
    expect(limits.maxMessages).toBe(50);
    expect(limits.maxTokens).toBe(100000);
    expect(limits.allowPro).toBe(false);
  });

  it("getLimits retorna a quota do plano Pro (assinatura ativa)", async () => {
    mockFindActive.mockResolvedValue(ACTIVE_SUB);
    const limits = await EntitlementService.getLimits("u1");
    expect(limits.maxMessages).toBe(500);
    expect(limits.maxTokens).toBe(1000000);
  });

  it("canUseModel: flash sempre permitido", async () => {
    mockFindActive.mockResolvedValue(null);
    await expect(EntitlementService.canUseModel("u1", "flash")).resolves.toBe(true);
  });

  it("canUseModel: pro negado sem allowPro", async () => {
    mockFindActive.mockResolvedValue(null); // gratuito → allowPro false
    await expect(EntitlementService.canUseModel("u1", "pro")).resolves.toBe(false);
  });

  it("canUseModel: pro liberado no plano Pro", async () => {
    mockFindActive.mockResolvedValue(ACTIVE_SUB);
    await expect(EntitlementService.canUseModel("u1", "pro")).resolves.toBe(true);
  });

  it("fallback para limites padrão quando o plano free não existe no banco", async () => {
    mockFindActive.mockResolvedValue(null);
    mockFindByCode.mockResolvedValue(null);
    const ent = await EntitlementService.getCurrent("u1");
    expect(ent.planCode).toBe("free");
    expect(ent.limits.maxMessages).toBe(50);
  });
});
