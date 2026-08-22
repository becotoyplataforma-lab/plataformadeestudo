/**
 * Testes do CheckoutService (Billing) — reutiliza o gateway Mercado Pago.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreatePreapproval = vi.fn();
vi.mock("@/lib/payments/mercadopago", () => ({
  createPreapproval: (...args: unknown[]) => mockCreatePreapproval(...args),
}));

const mockFindByCode = vi.fn();
vi.mock("../../repositories/plan.repository", () => ({
  PlanRepository: {
    findByCode: (...args: unknown[]) => mockFindByCode(...args),
    findById: vi.fn(),
    listActive: vi.fn(),
    create: vi.fn(),
  },
}));

const mockHasAnyByUser = vi.fn();
vi.mock("../../repositories/subscription.repository", () => ({
  SubscriptionRepository: {
    hasAnyByUser: (...args: unknown[]) => mockHasAnyByUser(...args),
  },
}));

import { CheckoutService, CheckoutError } from "../checkout.service";

const PRO_PLAN = {
  id: "p-pro",
  name: "Pro",
  code: "pro",
  priceCents: 1990,
  promoPriceCents: 990,
  limits: { maxMessages: 500, maxTokens: 1000000, allowPro: true },
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const FREE_PLAN = {
  id: "p-free",
  name: "Gratuito",
  code: "free",
  priceCents: 0,
  limits: { maxMessages: 50, maxTokens: 100000 },
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

describe("CheckoutService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePreapproval.mockResolvedValue({
      id: "pre-1",
      status: "pending",
      init_point: "https://init.mercadopago.com/x",
      sandbox_init_point: "https://sandbox.init.mercadopago.com/x",
      external_reference: "pro:u1",
      reason: "Assinatura Pro — ConcursoAI",
    });
  });

  it("cria assinatura recorrente (Preapproval) para plano pago", async () => {
    mockFindByCode.mockResolvedValue(PRO_PLAN);
    mockHasAnyByUser.mockResolvedValue(true); // já assinou antes → preço cheio
    const result = await CheckoutService.createCheckout("u1", "pro");

    expect(result.plan).toBe("pro");
    expect(result.externalReference).toBe("pro:u1");
    expect(result.initPoint).toBe("https://init.mercadopago.com/x");
    expect(result.priceCents).toBe(1990);
    expect(result.promoApplied).toBe(false);
    expect(result.recurring).toBe(true);
    expect(mockCreatePreapproval).toHaveBeenCalledWith(
      expect.objectContaining({
        externalReference: "pro:u1",
        unitPriceCents: 1990,
      })
    );
  });

  it("aplica preço promocional no primeiro ciclo", async () => {
    mockFindByCode.mockResolvedValue(PRO_PLAN);
    mockHasAnyByUser.mockResolvedValue(false); // 1ª assinatura → R$ 9,90
    const result = await CheckoutService.createCheckout("u1", "pro");

    expect(result.priceCents).toBe(990);
    expect(result.promoApplied).toBe(true);
    expect(mockCreatePreapproval).toHaveBeenCalledWith(
      expect.objectContaining({ unitPriceCents: 990 })
    );
  });

  it("lança FREE_PLAN para plano gratuito", async () => {
    mockFindByCode.mockResolvedValue(FREE_PLAN);
    await expect(
      CheckoutService.createCheckout("u1", "free")
    ).rejects.toMatchObject({ code: "FREE_PLAN" });
    expect(mockCreatePreapproval).not.toHaveBeenCalled();
  });

  it("lança PLAN_NOT_FOUND quando o plano não existe", async () => {
    mockFindByCode.mockResolvedValue(null);
    await expect(
      CheckoutService.createCheckout("u1", "inexistente")
    ).rejects.toBeInstanceOf(CheckoutError);
  });

  it("propaga erro do gateway", async () => {
    mockFindByCode.mockResolvedValue(PRO_PLAN);
    mockCreatePreapproval.mockRejectedValue(new Error("MP offline"));
    await expect(
      CheckoutService.createCheckout("u1", "pro")
    ).rejects.toThrow("MP offline");
  });
});
