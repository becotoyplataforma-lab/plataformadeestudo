/**
 * Testes do WebhookService (Billing) — validação, idempotência, persistência
 * do evento e atualização da assinatura.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const mockGetPayment = vi.fn();
const mockGetPreapproval = vi.fn();
vi.mock("@/lib/payments/mercadopago", () => ({
  getPayment: (...args: unknown[]) => mockGetPayment(...args),
  getPreapproval: (...args: unknown[]) => mockGetPreapproval(...args),
}));

const mockFindByProviderId = vi.fn();
const mockCreatePayment = vi.fn();
vi.mock("../../repositories/payment.repository", () => ({
  PaymentRepository: {
    findByProviderId: (...args: unknown[]) => mockFindByProviderId(...args),
    create: (...args: unknown[]) => mockCreatePayment(...args),
    findByUser: vi.fn(),
  },
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

const mockCancelActive = vi.fn();
const mockCreateSub = vi.fn();
const mockFindActiveByUser = vi.fn();
const mockFindByPreapprovalId = vi.fn();
const mockUpdateSub = vi.fn();
vi.mock("../../repositories/subscription.repository", () => ({
  SubscriptionRepository: {
    findActiveByUser: (...args: unknown[]) => mockFindActiveByUser(...args),
    findById: vi.fn(),
    findByPreapprovalId: (...args: unknown[]) => mockFindByPreapprovalId(...args),
    create: (...args: unknown[]) => mockCreateSub(...args),
    update: (...args: unknown[]) => mockUpdateSub(...args),
    cancelActiveByUser: (...args: unknown[]) => mockCancelActive(...args),
  },
}));

import {
  WebhookService,
  verifyMpSignature,
  mapMpStatus,
} from "../webhook.service";

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

function sig(secret: string, dataId: string | number, requestId: string, ts: string): string {
  const v1 = createHmac("sha256", secret)
    .update(`id:${dataId};request-id:${requestId};ts:${ts};`)
    .digest("hex");
  return `ts=${ts}&v1=${v1}`;
}

const EXISTING_PAYMENT = {
  id: "pay-1",
  userId: "u1",
  subscriptionId: "s1",
  provider: "mercadopago",
  providerId: "123",
  amountCents: 2990,
  currency: "BRL",
  status: "approved",
  externalReference: "pro:u1",
  paidAt: new Date(),
  createdAt: new Date(),
};

describe("verifyMpSignature", () => {
  it("aceita assinatura válida", () => {
    const ts = "1700000000";
    const ok = verifyMpSignature({
      secret: "s3cr3t",
      signature: sig("s3cr3t", 123, "req-1", ts),
      requestId: "req-1",
      dataId: 123,
    });
    expect(ok).toBe(true);
  });

  it("rejeita assinatura inválida", () => {
    const ok = verifyMpSignature({
      secret: "s3cr3t",
      signature: "ts=1700000000&v1=0000000000000000000000000000000000000000",
      requestId: "req-1",
      dataId: 123,
    });
    expect(ok).toBe(false);
  });

  it("rejeita formato ausente (sem v1)", () => {
    const ok = verifyMpSignature({
      secret: "s3cr3t",
      signature: "ts=1700000000",
      requestId: "req-1",
      dataId: 123,
    });
    expect(ok).toBe(false);
  });
});

describe("mapMpStatus", () => {
  it("mapeia status do Mercado Pago para payment_status", () => {
    expect(mapMpStatus("approved")).toBe("approved");
    expect(mapMpStatus("pending")).toBe("pending");
    expect(mapMpStatus("rejected")).toBe("rejected");
    expect(mapMpStatus("cancelled")).toBe("cancelled");
    expect(mapMpStatus("refunded")).toBe("refunded");
    expect(mapMpStatus("desconhecido")).toBe("pending");
  });
});

describe("WebhookService.handleNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPayment.mockResolvedValue({
      id: 123,
      status: "approved",
      external_reference: "pro:u1",
      transaction_amount: 29.9,
      date_approved: "2026-08-05T00:00:00.000Z",
    });
    mockGetPreapproval.mockResolvedValue({
      id: "pre-1",
      status: "authorized",
      external_reference: "pro:u1",
      reason: "Assinatura Pro — ConcursoAI",
    });
    mockFindByProviderId.mockResolvedValue(null);
    mockFindByCode.mockResolvedValue(PRO_PLAN);
    mockCancelActive.mockResolvedValue([]);
    mockCreateSub.mockResolvedValue(ACTIVE_SUB);
    mockCreatePayment.mockResolvedValue({ id: "pay-1" });
    mockFindActiveByUser.mockResolvedValue(null);
    mockFindByPreapprovalId.mockResolvedValue(null);
    mockUpdateSub.mockResolvedValue({ ...ACTIVE_SUB, endsAt: new Date() });
  });

  it("pagamento approved ativa a assinatura e persiste o evento", async () => {
    const result = await WebhookService.handleNotification({
      action: "payment.created",
      type: "payment",
      data: { id: 123 },
    });

    expect(result).toMatchObject({ received: true, processed: true, status: "approved" });
    expect(mockCancelActive).toHaveBeenCalledWith("u1");
    expect(mockCreateSub).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", planId: "p-pro", status: "active" })
    );
    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        provider: "mercadopago",
        providerId: "123",
        amountCents: 2990,
        currency: "BRL",
        status: "approved",
        subscriptionId: "s1",
      })
    );
  });

  it("idempotência: pagamento já processado não reaplica", async () => {
    mockFindByProviderId.mockResolvedValue(EXISTING_PAYMENT);
    const result = await WebhookService.handleNotification({
      data: { id: 123 },
    });

    expect(result).toMatchObject({ duplicate: true, processed: false });
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockCreatePayment).not.toHaveBeenCalled();
  });

  it("notificação sem payment id é ignorada", async () => {
    const result = await WebhookService.handleNotification({ type: "test" });
    expect(result).toMatchObject({ ignored: true, processed: false });
    expect(mockGetPayment).not.toHaveBeenCalled();
  });

  it("external_reference inválida é ignorada", async () => {
    mockGetPayment.mockResolvedValue({
      id: 123,
      status: "approved",
      external_reference: null,
    });
    const result = await WebhookService.handleNotification({ data: { id: 123 } });
    expect(result).toMatchObject({ ignored: true, processed: false });
  });

  it("plano não encontrado é ignorado", async () => {
    mockFindByCode.mockResolvedValue(null);
    const result = await WebhookService.handleNotification({ data: { id: 123 } });
    expect(result).toMatchObject({ ignored: true, processed: false });
  });

  it("pagamento pendente não ativa assinatura (mas persiste)", async () => {
    mockGetPayment.mockResolvedValue({
      id: 123,
      status: "pending",
      external_reference: "pro:u1",
      transaction_amount: 29.9,
    });
    const result = await WebhookService.handleNotification({ data: { id: 123 } });
    expect(result.status).toBe("pending");
    expect(result.processed).toBe(true);
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", subscriptionId: null })
    );
  });

  it("lança INVALID_SIGNATURE quando a assinatura do webhook é inválida", async () => {
    const ctx = {
      secret: "s3cr3t",
      xSignature: "ts=1700000000&v1=badbadbadbadbadbadbadbadbadbadbadbadbadb",
      xRequestId: "req-1",
    };
    await expect(
      WebhookService.handleNotification({ data: { id: 123 } }, ctx)
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("aceita webhook com assinatura válida", async () => {
    const ctx = {
      secret: "s3cr3t",
      xSignature: sig("s3cr3t", 123, "req-1", "1700000000"),
      xRequestId: "req-1",
    };
    const result = await WebhookService.handleNotification(
      { data: { id: 123 } },
      ctx
    );
    expect(result.processed).toBe(true);
  });

  it("erro do provedor propaga (getPayment falha)", async () => {
    mockGetPayment.mockRejectedValue(new Error("MP offline"));
    await expect(
      WebhookService.handleNotification({ data: { id: 123 } })
    ).rejects.toThrow("MP offline");
  });

  it("subscription_preapproval authorized ativa assinatura recorrente", async () => {
    const result = await WebhookService.handleNotification({
      type: "subscription_preapproval",
      action: "subscription_preapproval.created",
      data: { id: "pre-1" },
    });

    expect(result).toMatchObject({ processed: true, status: "approved" });
    expect(mockGetPreapproval).toHaveBeenCalledWith("pre-1");
    expect(mockCreateSub).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", planId: "p-pro", preapprovalId: "pre-1" })
    );
    expect(mockGetPayment).not.toHaveBeenCalled();
  });

  it("subscription_preapproval não autorizado é ignorado", async () => {
    mockGetPreapproval.mockResolvedValue({
      id: "pre-1",
      status: "pending",
      external_reference: "pro:u1",
    });
    const result = await WebhookService.handleNotification({
      type: "subscription_preapproval",
      data: { id: "pre-1" },
    });
    expect(result).toMatchObject({ ignored: true, processed: false });
    expect(mockCreateSub).not.toHaveBeenCalled();
  });

  it("subscription_preapproval duplicado não reaplica", async () => {
    mockFindByPreapprovalId.mockResolvedValue(ACTIVE_SUB);
    const result = await WebhookService.handleNotification({
      type: "subscription_preapproval",
      data: { id: "pre-1" },
    });
    expect(result).toMatchObject({ duplicate: true, processed: false });
    expect(mockCreateSub).not.toHaveBeenCalled();
  });

  it("pagamento recorrente com assinatura ativa RENOVA (estende ciclo)", async () => {
    mockFindActiveByUser.mockResolvedValue(ACTIVE_SUB);
    mockUpdateSub.mockResolvedValue({ ...ACTIVE_SUB, endsAt: new Date("2026-09-05") });

    const result = await WebhookService.handleNotification({
      type: "payment",
      action: "payment.created",
      data: { id: 123 },
    });

    expect(result).toMatchObject({ processed: true, status: "approved" });
    // Renovação: não cria nova assinatura, apenas atualiza a existente.
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockUpdateSub).toHaveBeenCalled();
    expect(mockCreatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", subscriptionId: "s1", status: "approved" })
    );
  });

  it("pagamento recorrente sem assinatura ativa ATIVA (1º ciclo)", async () => {
    mockFindActiveByUser.mockResolvedValue(null);
    const result = await WebhookService.handleNotification({
      type: "payment",
      data: { id: 123 },
    });
    expect(result).toMatchObject({ processed: true, status: "approved" });
    expect(mockCreateSub).toHaveBeenCalled();
  });
});
