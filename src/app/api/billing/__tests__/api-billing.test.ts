/**
 * Testes das rotas de API do Billing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const mockListActive = vi.fn();
vi.mock("@/lib/billing/repositories/plan.repository", () => ({
  PlanRepository: { listActive: (...args: unknown[]) => mockListActive(...args) },
}));

const mockGetCurrent = vi.fn();
vi.mock("@/lib/billing/services/entitlement.service", () => ({
  EntitlementService: {
    getCurrent: (...args: unknown[]) => mockGetCurrent(...args),
  },
}));

const mockCreateCheckout = vi.fn();
vi.mock("@/lib/billing/services/checkout.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/billing/services/checkout.service")>();
  return {
    ...actual,
    CheckoutService: {
      createCheckout: (...args: unknown[]) => mockCreateCheckout(...args),
    },
  };
});

const mockHandleWebhook = vi.fn();
vi.mock("@/lib/billing/services/webhook.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/billing/services/webhook.service")>();
  return {
    ...actual,
    WebhookService: {
      handleNotification: (...args: unknown[]) => mockHandleWebhook(...args),
    },
  };
});

const mockCancel = vi.fn();
vi.mock("@/lib/billing/services/subscription.service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/billing/services/subscription.service")>();
  return {
    ...actual,
    SubscriptionService: { cancel: (...args: unknown[]) => mockCancel(...args) },
  };
});

import { GET as getPlans } from "@/app/api/billing/plans/route";
import { GET as getEntitlement } from "@/app/api/billing/entitlement/route";
import { POST as postCheckout } from "@/app/api/billing/checkout/route";
import { POST as postWebhook } from "@/app/api/billing/webhook/route";
import { POST as postCancel } from "@/app/api/billing/subscriptions/cancel/route";
import { CheckoutError } from "@/lib/billing/services/checkout.service";
import { WebhookError } from "@/lib/billing/services/webhook.service";

const UUID = "00000000-0000-0000-0000-000000000001";

function jsonReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/billing/plans", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem autenticação", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await getPlans();
    expect(res.status).toBe(401);
  });

  it("retorna lista de planos autenticado", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockListActive.mockResolvedValue([
      { id: UUID, name: "Gratuito", code: "free", priceCents: 0, status: "active" },
      { id: UUID, name: "Pro", code: "pro", priceCents: 2990, status: "active" },
    ]);
    const res = await getPlans();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { plans: unknown[] };
    expect(json.plans).toHaveLength(2);
  });
});

describe("GET /api/billing/entitlement", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem autenticação", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await getEntitlement();
    expect(res.status).toBe(401);
  });

  it("retorna entitlement do usuário", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGetCurrent.mockResolvedValue({
      planId: UUID,
      planCode: "free",
      planName: "Gratuito",
      priceCents: 0,
      tier: "free",
      subscriptionId: null,
      subscriptionStatus: null,
      startsAt: null,
      endsAt: null,
      limits: { maxMessages: 50, maxTokens: 100000, allowPro: false },
    });
    const res = await getEntitlement();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { plan_code: string; tier: string };
    expect(json.plan_code).toBe("free");
    expect(json.tier).toBe("free");
  });
});

describe("POST /api/billing/checkout", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem autenticação", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await postCheckout(jsonReq({ plan: "pro" }));
    expect(res.status).toBe(401);
  });

  it("retorna 400 para corpo inválido", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    const res = await postCheckout(jsonReq({ plan: "gratis" }));
    expect(res.status).toBe(400);
  });

  it("retorna 200 com checkout válido", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1", email: "user@example.com" } });
    mockCreateCheckout.mockResolvedValue({
      initPoint: "https://init.mercadopago.com/x",
      sandboxInitPoint: "https://sandbox.mercadopago.com/x",
      externalReference: "pro:u1",
      plan: "pro",
      priceCents: 2990,
    });
    const res = await postCheckout(jsonReq({ plan: "pro" }));
    expect(res.status).toBe(200);
    const json = (await res.json()) as { plan: string; price_cents: number };
    expect(json.plan).toBe("pro");
    expect(json.price_cents).toBe(2990);
    // A rota repassa o e-mail do usuário logado como payerEmail (3º arg)
    // para o createCheckout (necessário na Preapproval do Mercado Pago).
    expect(mockCreateCheckout).toHaveBeenCalledWith("u1", "pro", "user@example.com");
  });

  it("retorna 404 quando o plano não existe", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockCreateCheckout.mockRejectedValue(
      new CheckoutError("PLAN_NOT_FOUND", "Plano não encontrado: x")
    );
    const res = await postCheckout(jsonReq({ plan: "pro" }));
    expect(res.status).toBe(404);
  });
});

describe("POST /api/billing/webhook", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 200 e resultado processado", async () => {
    mockHandleWebhook.mockResolvedValue({
      received: true,
      processed: true,
      ignored: false,
      duplicate: false,
      status: "approved",
    });
    const res = await postWebhook(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        body: JSON.stringify({ data: { id: 123 } }),
      })
    );
    expect(res.status).toBe(200);
    const json = (await res.json()) as { processed: boolean; status: string };
    expect(json.processed).toBe(true);
    expect(json.status).toBe("approved");
  });

  it("repassa o data_id da query string (?data_id=...) ao WebhookService", async () => {
    mockHandleWebhook.mockResolvedValue({
      received: true,
      processed: true,
      ignored: false,
      duplicate: false,
      status: "approved",
    });
    const res = await postWebhook(
      new Request("http://localhost/api/billing/webhook?data_id=999", {
        method: "POST",
        body: JSON.stringify({ data: { id: 123 } }),
      })
    );
    expect(res.status).toBe(200);
    // O data_id da query string deve ser usado na validação da assinatura.
    expect(mockHandleWebhook).toHaveBeenCalledWith(
      { data: { id: 123 } },
      expect.objectContaining({ dataId: "999" })
    );
  });

  it("retorna 401 quando a assinatura do webhook é inválida", async () => {
    mockHandleWebhook.mockRejectedValue(
      new WebhookError("INVALID_SIGNATURE", "Assinatura do webhook inválida.")
    );
    const res = await postWebhook(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        body: JSON.stringify({ data: { id: 123 } }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("retorna 500 quando o processamento falha", async () => {
    mockHandleWebhook.mockRejectedValue(new Error("boom"));
    const res = await postWebhook(
      new Request("http://localhost/api/billing/webhook", {
        method: "POST",
        body: JSON.stringify({ data: { id: 123 } }),
      })
    );
    expect(res.status).toBe(500);
  });
});

describe("POST /api/billing/subscriptions/cancel", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna 401 sem autenticação", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await postCancel();
    expect(res.status).toBe(401);
  });

  it("cancela assinatura ativa", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockCancel.mockResolvedValue({
      id: UUID,
      userId: UUID,
      planId: UUID,
      status: "cancelled",
      startsAt: new Date(),
      endsAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    });
    const res = await postCancel();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string };
    expect(json.status).toBe("cancelled");
  });

  it("retorna cancelled:false quando não há assinatura ativa", async () => {
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockCancel.mockResolvedValue(null);
    const res = await postCancel();
    expect(res.status).toBe(200);
    const json = (await res.json()) as { cancelled: boolean };
    expect(json.cancelled).toBe(false);
  });
});
