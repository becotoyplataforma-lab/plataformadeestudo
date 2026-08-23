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

import { POST as postWebhook } from "@/app/api/payments/webhook/route";
import { WebhookError } from "@/lib/billing/services/webhook.service";

function webhookReq(body: unknown): Request {
  return new Request("http://localhost/api/payments/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

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

  it("repassa o data_id da query string (?data_id=...) ao WebhookService", async () => {
    mockHandleWebhook.mockResolvedValue({
      received: true,
      processed: true,
      ignored: false,
      duplicate: false,
      status: "approved",
    });

    const res = await postWebhook(
      new Request("http://localhost/api/payments/webhook?data_id=999", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "payment", data: { id: 123 } }),
      })
    );

    expect(res.status).toBe(200);
    expect(mockHandleWebhook).toHaveBeenCalledWith(
      { type: "payment", data: { id: 123 } },
      expect.objectContaining({ dataId: "999" })
    );
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
