/**
 * Testes do SubscriptionService (Billing) — ativar, cancelar, consultar.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFindByCode = vi.fn();
const mockCancelActive = vi.fn();
const mockCreate = vi.fn();
const mockFindActive = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../repositories/plan.repository", () => ({
  PlanRepository: {
    findByCode: (...args: unknown[]) => mockFindByCode(...args),
    findById: vi.fn(),
    listActive: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("../../repositories/subscription.repository", () => ({
  SubscriptionRepository: {
    findActiveByUser: (...args: unknown[]) => mockFindActive(...args),
    findById: vi.fn(),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    cancelActiveByUser: (...args: unknown[]) => mockCancelActive(...args),
  },
}));

import { SubscriptionService, SubscriptionError } from "../subscription.service";

const PRO_PLAN = {
  id: "p-pro",
  name: "Pro",
  code: "pro",
  priceCents: 2990,
  limits: { maxMessages: 500, maxTokens: 1000000, allowPro: true },
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

describe("SubscriptionService", () => {
  beforeEach(() => vi.clearAllMocks());

  it("ativa uma assinatura para o plano informado", async () => {
    mockFindByCode.mockResolvedValue(PRO_PLAN);
    mockCancelActive.mockResolvedValue([]);
    mockCreate.mockResolvedValue(ACTIVE_SUB);

    const sub = await SubscriptionService.activate("u1", "pro");

    expect(sub.status).toBe("active");
    expect(sub.planId).toBe("p-pro");
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", planId: "p-pro", status: "active" })
    );
  });

  it("ativa cancela as assinaturas ativas anteriores (uma ativa por usuário)", async () => {
    mockFindByCode.mockResolvedValue(PRO_PLAN);
    mockCancelActive.mockResolvedValue([{ id: "s-antiga" }]);
    mockCreate.mockResolvedValue(ACTIVE_SUB);

    await SubscriptionService.activate("u1", "pro");

    expect(mockCancelActive).toHaveBeenCalledWith("u1");
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("ativa lança PLAN_NOT_FOUND quando o plano não existe", async () => {
    mockFindByCode.mockResolvedValue(null);
    await expect(
      SubscriptionService.activate("u1", "inexistente")
    ).rejects.toBeInstanceOf(SubscriptionError);
  });

  it("cancela a assinatura ativa", async () => {
    mockFindActive.mockResolvedValue(ACTIVE_SUB);
    mockUpdate.mockResolvedValue({ ...ACTIVE_SUB, status: "cancelled" });

    const sub = await SubscriptionService.cancel("u1");

    expect(sub?.status).toBe("cancelled");
    expect(mockUpdate).toHaveBeenCalledWith(
      "s1",
      expect.objectContaining({ status: "cancelled" })
    );
  });

  it("cancelar sem assinatura ativa retorna null", async () => {
    mockFindActive.mockResolvedValue(null);
    await expect(SubscriptionService.cancel("u1")).resolves.toBeNull();
  });

  it("getCurrent retorna a assinatura ativa", async () => {
    mockFindActive.mockResolvedValue(ACTIVE_SUB);
    await expect(SubscriptionService.getCurrent("u1")).resolves.toEqual(ACTIVE_SUB);
  });
});
