/**
 * Testes das API routes /api/admin/financeiro/* (módulo financeiro).
 *
 * Cobre por rota:
 *   1. sem sessão → 401;
 *   2. não-admin → 403;
 *   3. admin → 200 (com dados mockados).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetSession = vi.fn();
vi.mock("@/lib/administration/session", () => ({
  getAdminSession: (...args: unknown[]) => mockGetSession(...args),
}));

const mockRequireAdmin = vi.fn();
vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/lib/administration/services/admin-guard.service")
  >();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      requireAdmin: (...a: unknown[]) => mockRequireAdmin(...a),
    },
  };
});

const mockSummary = vi.fn();
const mockListSubs = vi.fn();
const mockListPayments = vi.fn();
const mockCancel = vi.fn();
const mockSuspend = vi.fn();
const mockReactivate = vi.fn();
vi.mock("@/lib/administration/services/admin-finance.service", () => ({
  AdminFinanceService: {
    summary: (...a: unknown[]) => mockSummary(...a),
    listSubscriptions: (...a: unknown[]) => mockListSubs(...a),
    listPayments: (...a: unknown[]) => mockListPayments(...a),
    cancelSubscription: (...a: unknown[]) => mockCancel(...a),
    suspendSubscription: (...a: unknown[]) => mockSuspend(...a),
    reactivateSubscription: (...a: unknown[]) => mockReactivate(...a),
  },
  AdminFinanceError: class AdminFinanceError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

import { GET as getSummary } from "@/app/api/admin/financeiro/summary/route";
import { GET as getAssinaturas } from "@/app/api/admin/financeiro/assinaturas/route";
import { GET as getPagamentos } from "@/app/api/admin/financeiro/pagamentos/route";
import { POST as postCancel } from "@/app/api/admin/financeiro/assinaturas/[id]/cancel/route";
import { POST as postSuspend } from "@/app/api/admin/financeiro/assinaturas/[id]/suspend/route";
import { POST as postReactivate } from "@/app/api/admin/financeiro/assinaturas/[id]/reactivate/route";
import { AdminError } from "@/lib/administration/services/admin-guard.service";

const ADMIN = { userId: "a1", email: "admin@x.com" };
const ID = "00000000-0000-0000-0000-000000000001";

const params = (id: string) => ({ params: Promise.resolve({ id }) });

function getReq(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: "GET" });
}

function postReq(url: string): NextRequest {
  return new NextRequest(`http://localhost${url}`, { method: "POST" });
}

describe("APIs do módulo financeiro", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue(ADMIN);
    mockRequireAdmin.mockResolvedValue(undefined);
    mockSummary.mockResolvedValue({
      mrrCents: 4990,
      monthRevenueCents: 12990,
      activeSubscriptions: 5,
      pastDueSubscriptions: 0,
      pendingPaymentsMonth: 0,
      churnMonth: 0,
      newPaymentsMonth: 2,
    });
    mockListSubs.mockResolvedValue([]);
    mockListPayments.mockResolvedValue([]);
    mockCancel.mockResolvedValue({ id: ID, status: "cancelled" });
    mockSuspend.mockResolvedValue({ id: ID, status: "suspended" });
    mockReactivate.mockResolvedValue({ id: ID, status: "active" });
  });

  async function expectUnauthorized(handler: () => Promise<Response>) {
    mockGetSession.mockResolvedValue(null);
    const res = await handler();
    expect(res.status).toBe(401);
  }

  async function expectForbidden(handler: () => Promise<Response>) {
    mockRequireAdmin.mockRejectedValue(
      new AdminError("FORBIDDEN", "Acesso restrito a administradores.")
    );
    // Nas rotas GET o guard roda dentro do service (mockado): ele deve rejeitar.
    const forbiddenErr = new AdminError("FORBIDDEN", "Acesso restrito a administradores.");
    mockSummary.mockRejectedValue(forbiddenErr);
    mockListSubs.mockRejectedValue(forbiddenErr);
    mockListPayments.mockRejectedValue(forbiddenErr);
    const res = await handler();
    expect(res.status).toBe(403);
  }

  describe("summary", () => {
    it("sem sessão → 401", () => expectUnauthorized(() => getSummary()));
    it("não-admin → 403", () => expectForbidden(() => getSummary()));
    it("admin → 200 com KPIs", async () => {
      const res = await getSummary();
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.mrrCents).toBe(4990);
    });
  });

  describe("assinaturas", () => {
    it("sem sessão → 401", () =>
      expectUnauthorized(() => getAssinaturas(getReq("/api/admin/financeiro/assinaturas"))));
    it("não-admin → 403", () =>
      expectForbidden(() => getAssinaturas(getReq("/api/admin/financeiro/assinaturas"))));
    it("admin → 200 com lista", async () => {
      const res = await getAssinaturas(getReq("/api/admin/financeiro/assinaturas?status=active"));
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe("pagamentos", () => {
    it("sem sessão → 401", () =>
      expectUnauthorized(() => getPagamentos(getReq("/api/admin/financeiro/pagamentos"))));
    it("não-admin → 403", () =>
      expectForbidden(() => getPagamentos(getReq("/api/admin/financeiro/pagamentos"))));
    it("admin → 200 com lista", async () => {
      const res = await getPagamentos(
        getReq("/api/admin/financeiro/pagamentos?user_id=u1&status=approved")
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.data)).toBe(true);
    });
  });

  describe("cancel", () => {
    it("sem sessão → 401", () =>
      expectUnauthorized(() => postCancel(postReq("/api/admin/financeiro/assinaturas/1/cancel"), params(ID))));
    it("não-admin → 403", () =>
      expectForbidden(() => postCancel(postReq("/api/admin/financeiro/assinaturas/1/cancel"), params(ID))));
    it("admin → 200", async () => {
      const res = await postCancel(postReq("/api/admin/financeiro/assinaturas/1/cancel"), params(ID));
      expect(res.status).toBe(200);
      expect(mockCancel).toHaveBeenCalledWith(ADMIN, ID);
    });
  });

  describe("suspend", () => {
    it("sem sessão → 401", () =>
      expectUnauthorized(() => postSuspend(postReq("/api/admin/financeiro/assinaturas/1/suspend"), params(ID))));
    it("não-admin → 403", () =>
      expectForbidden(() => postSuspend(postReq("/api/admin/financeiro/assinaturas/1/suspend"), params(ID))));
    it("admin → 200", async () => {
      const res = await postSuspend(postReq("/api/admin/financeiro/assinaturas/1/suspend"), params(ID));
      expect(res.status).toBe(200);
      expect(mockSuspend).toHaveBeenCalledWith(ADMIN, ID);
    });
  });

  describe("reactivate", () => {
    it("sem sessão → 401", () =>
      expectUnauthorized(() => postReactivate(postReq("/api/admin/financeiro/assinaturas/1/reactivate"), params(ID))));
    it("não-admin → 403", () =>
      expectForbidden(() => postReactivate(postReq("/api/admin/financeiro/assinaturas/1/reactivate"), params(ID))));
    it("admin → 200", async () => {
      const res = await postReactivate(postReq("/api/admin/financeiro/assinaturas/1/reactivate"), params(ID));
      expect(res.status).toBe(200);
      expect(mockReactivate).toHaveBeenCalledWith(ADMIN, ID);
    });
  });
});
