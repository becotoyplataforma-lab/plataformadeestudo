/**
 * Testes do AdminFinanceService — autorização, listagem e mutações de assinatura.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireAdmin = vi.fn();
vi.mock("../admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../admin-guard.service")>();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
    },
  };
});

const mockAuditRecord = vi.fn();
vi.mock("../audit.service", () => ({
  AuditService: {
    record: (...a: unknown[]) => mockAuditRecord(...a),
  },
}));

const mockSummary = vi.fn();
const mockListSubs = vi.fn();
const mockListPayments = vi.fn();
vi.mock("../../repositories/admin-finance.repository", () => ({
  AdminFinanceRepository: {
    summary: (...a: unknown[]) => mockSummary(...a),
    listSubscriptions: (...a: unknown[]) => mockListSubs(...a),
    listPayments: (...a: unknown[]) => mockListPayments(...a),
  },
}));

const mockFindById = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/billing/repositories/subscription.repository", () => ({
  SubscriptionRepository: {
    findById: (...a: unknown[]) => mockFindById(...a),
    update: (...a: unknown[]) => mockUpdate(...a),
  },
}));

import { AdminFinanceService, AdminFinanceError } from "../admin-finance.service";

const admin = { userId: "admin-1", email: "admin@x.com" };

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireAdmin.mockResolvedValue(undefined);
});

describe("AdminFinanceService — leitura", () => {
  it("summary exige admin e delega ao repositório", async () => {
    mockSummary.mockResolvedValue({ mrrCents: 4990 });
    const result = await AdminFinanceService.summary(admin);
    expect(mockRequireAdmin).toHaveBeenCalledWith(admin);
    expect(result).toEqual({ mrrCents: 4990 });
  });

  it("listSubscriptions normaliza filtros e delega", async () => {
    mockListSubs.mockResolvedValue([]);
    await AdminFinanceService.listSubscriptions(admin, { status: "active", planId: "p1" });
    expect(mockListSubs).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", planId: "p1" })
    );
  });

  it("listPayments rejeita status inválido (ignora)", async () => {
    mockListPayments.mockResolvedValue([]);
    await AdminFinanceService.listPayments(admin, { status: "bogus" });
    expect(mockListPayments).toHaveBeenCalledWith(
      expect.objectContaining({ status: undefined })
    );
  });
});

describe("AdminFinanceService — mutações", () => {
  it("cancela assinatura ativa e audita", async () => {
    mockFindById.mockResolvedValue({
      id: "sub-1",
      userId: "u-1",
      status: "active",
      endsAt: new Date("2026-09-01"),
    });
    mockUpdate.mockResolvedValue({ id: "sub-1", status: "cancelled" });

    const row = await AdminFinanceService.cancelSubscription(admin, "sub-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ status: "cancelled" })
    );
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "finance.subscription.cancel",
        entityType: "subscription",
        entityId: "sub-1",
        adminId: "admin-1",
      })
    );
    expect(row.status).toBe("cancelled");
  });

  it("suspende assinatura ativa e audita", async () => {
    mockFindById.mockResolvedValue({ id: "sub-1", userId: "u-1", status: "active" });
    mockUpdate.mockResolvedValue({ id: "sub-1", status: "suspended" });

    const row = await AdminFinanceService.suspendSubscription(admin, "sub-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ status: "suspended" })
    );
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "finance.subscription.suspend" })
    );
    expect(row.status).toBe("suspended");
  });

  it("reativa assinatura suspensa e audita", async () => {
    mockFindById.mockResolvedValue({
      id: "sub-1",
      userId: "u-1",
      status: "suspended",
      endsAt: new Date("2026-09-01"),
    });
    mockUpdate.mockResolvedValue({ id: "sub-1", status: "active" });

    const row = await AdminFinanceService.reactivateSubscription(admin, "sub-1");

    expect(mockUpdate).toHaveBeenCalledWith(
      "sub-1",
      expect.objectContaining({ status: "active" })
    );
    expect(mockAuditRecord).toHaveBeenCalledWith(
      expect.objectContaining({ action: "finance.subscription.reactivate" })
    );
    expect(row.status).toBe("active");
  });

  it("lança INVALID_STATUS ao cancelar assinatura já cancelada", async () => {
    mockFindById.mockResolvedValue({ id: "sub-1", userId: "u-1", status: "cancelled" });
    await expect(AdminFinanceService.cancelSubscription(admin, "sub-1")).rejects.toThrow(
      AdminFinanceError
    );
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("lança NOT_FOUND quando a assinatura não existe", async () => {
    mockFindById.mockResolvedValue(null);
    await expect(AdminFinanceService.suspendSubscription(admin, "nope")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});
