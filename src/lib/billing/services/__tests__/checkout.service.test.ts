/**
 * Testes do CheckoutService (Billing) — reutiliza o gateway Mercado Pago.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreatePreference = vi.fn();
vi.mock("@/lib/payments/mercadopago", () => ({
  createCheckoutPreference: (...args: unknown[]) => mockCreatePreference(...args),
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
    mockCreatePreference.mockResolvedValue({
      id: "pref-1",
      init_point: "https://init.mercadopago.com/x",
      sandbox_init_point: "https://sandbox.init.mercadopago.com/x",
    });
  });

  it("cria preferência de checkout para plano pago (reutiliza o gateway)", async () => {
    mockFindByCode.mockResolvedValue(PRO_PLAN);
    mockHasAnyByUser.mockResolvedValue(true); // já assinou antes → preço cheio
    const result = await CheckoutService.createCheckout("u1", "pro");

    expect(result.plan).toBe("pro");
    expect(result.externalReference).toBe("pro:u1");
    expect(result.initPoint).toBe("https://init.mercadopago.com/x");
    expect(result.priceCents).toBe(1990);
    expect(result.promoApplied).toBe(false);
    expect(mockCreatePreference).toHaveBeenCalledWith(
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
    expect(mockCreatePreference).toHaveBeenCalledWith(
      expect.objectContaining({ unitPriceCents: 990 })
    );
  });

  it("lança FREE_PLAN para plano gratuito", async () => {
    mockFindByCode.mockResolvedValue(FREE_PLAN);
    await expect(
      CheckoutService.createCheckout("u1", "free")
    ).rejects.toMatchObject({ code: "FREE_PLAN" });
    expect(mockCreatePreference).not.toHaveBeenCalled();
  });

  it("lança PLAN_NOT_FOUND quando o plano não existe", async () => {
    mockFindByCode.mockResolvedValue(null);
    await expect(
      CheckoutService.createCheckout("u1", "inexistente")
    ).rejects.toBeInstanceOf(CheckoutError);
  });

  it("propaga erro do gateway", async () => {
    mockFindByCode.mockResolvedValue(PRO_PLAN);
    mockCreatePreference.mockRejectedValue(new Error("MP offline"));
    await expect(
      CheckoutService.createCheckout("u1", "pro")
    ).rejects.toThrow("MP offline");
  });
});
