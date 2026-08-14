/**
 * Testes das rotas legadas de API Payments (agora delegando a Drizzle).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

const mockCreatePreference = vi.fn();
vi.mock("@/lib/payments/mercadopago", () => ({
  createCheckoutPreference: (...args: unknown[]) => mockCreatePreference(...args),
}));

const mockFindByCode = vi.fn();
vi.mock("@/lib/billing/repositories/plan.repository", () => ({
  PlanRepository: {
    findByCode: (...args: unknown[]) => mockFindByCode(...args),
  },
}));

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

import { POST as postCheckout } from "@/app/api/payments/checkout/route";
import { POST as postWebhook } from "@/app/api/payments/webhook/route";
import { WebhookError } from "@/lib/billing/services/webhook.service";

const UUID = "00000000-0000-0000-0000-000000000001";

const PRO_PLAN = {
  id: "00000000-0000-0000-0000-000000000002",
  name: "Pro",
  code: "pro",
  priceCents: 2990,
  limits: { maxMessages: 500, maxTokens: 1000000 },
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function jsonReq(body: unknown): Request {
  return new Request("http://localhost/api/payments/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function webhookReq(body: unknown): Request {
  return new Request("http://localhost/api/payments/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/payments/checkout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ user: { id: UUID } });
    mockFindByCode.mockResolvedValue(PRO_PLAN);
  });

  it("retorna 401 sem sessão", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await postCheckout(jsonReq({ plan: "pro" }));
    expect(res.status).toBe(401);
  });

  it("retorna 422 com plano inválido", async () => {
    const res = await postCheckout(jsonReq({ plan: "gratis" }));
    expect(res.status).toBe(422);
  });

  it("retorna 200 com init_point e external_reference para plano pago", async () => {
    mockCreatePreference.mockResolvedValue({
      init_point: "https://init.mercadopago.com/x",
      sandbox_init_point: "https://sandbox.mercadopago.com/x",
    });

    const res = await postCheckout(jsonReq({ plan: "pro" }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      init_point: string;
      external_reference: string;
      plan: string;
    };
    expect(body.init_point).toBe("https://init.mercadopago.com/x");
    expect(body.external_reference).toBe(`pro:${UUID}`);
    expect(body.plan).toBe("pro");
    expect(mockFindByCode).toHaveBeenCalledWith("pro");
    expect(mockCreatePreference).toHaveBeenCalledTimes(1);
  });

  it("retorna 404 quando o plano não é encontrado", async () => {
    mockFindByCode.mockResolvedValue(null);
    const res = await postCheckout(jsonReq({ plan: "pro" }));
    expect(res.status).toBe(404);
  });

  it("retorna 500 quando o provedor falha", async () => {
    mockCreatePreference.mockRejectedValue(new Error("MP indisponível"));
    const res = await postCheckout(jsonReq({ plan: "pro" }));
    expect(res.status).toBe(500);
  });
});

describe("POST /api/payments/webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retorna 200 e processa notificação válida (delega ao WebhookService)", async () => {
    mockHandleWebhook.mockResolvedValue({
      received: true,
      processed: true,
      ignored: false,
      duplicate: false,
      status: "approved",
    });

    const res = await postWebhook(
      webhookReq({ type: "payment", data: { id: 123 } })
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { received: boolean; status: string };
    expect(body.received).toBe(true);
    expect(body.status).toBe("approved");
    expect(mockHandleWebhook).toHaveBeenCalledTimes(1);
  });

  it("retorna 401 com assinatura inválida", async () => {
    mockHandleWebhook.mockRejectedValue(
      new WebhookError("INVALID_SIGNATURE", "Assinatura do webhook inválida.")
    );

    const res = await postWebhook(webhookReq({ data: { id: 1 } }));

    expect(res.status).toBe(401);
  });

  it("retorna 200 em duplicidade (idempotência)", async () => {
    mockHandleWebhook.mockResolvedValue({
      received: true,
      processed: false,
      ignored: false,
      duplicate: true,
      status: "approved",
    });

    const res = await postWebhook(webhookReq({ data: { id: 123 } }));

    expect(res.status).toBe(200);
  });
});
