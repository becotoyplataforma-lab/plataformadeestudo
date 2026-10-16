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
const mockClaimPayment = vi.fn();
const mockAttachSubscription = vi.fn();

/**
 * Trava de esqueleto de mock (FASE C).
 *
 * Em producao PaymentRepository.claim() devolve "rows[0] ?? null": nunca
 * undefined. O servico, porem, le qualquer valor falsy como "perdi a corrida"
 * e responde duplicate=true. Um claim() NAO SEMEADO no teste nao falhava como
 * erro de mock -- virava decisao de negocio legitima, e a entrega era registrada
 * como duplicada sem nenhum banco ter decidido isso. Foi a regressao da FASE B
 * (6 testes vermelhos por motivo alheio ao contrato). O wrapper abaixo recusa o
 * silencio: sem implementacao ele explode apontando o mock, em vez de deixar
 * undefined virar duplicate=true.
 */
function claimWithSeedGuard(...args: unknown[]) {
  if (!mockClaimPayment.getMockImplementation()) {
    throw new Error(
      "MOCK_CLAIM_NOT_SEEDED: PaymentRepository.claim sem implementacao no teste - " +
        'semeie mockClaimPayment.mockResolvedValue({ id: "pay-new" }) para reivindicacao ' +
        'vitoriosa ou mockResolvedValue(null) para perda de corrida'
    );
  }
  return mockClaimPayment(...args);
}

vi.mock("../../repositories/payment.repository", () => ({
  PaymentRepository: {
    findByProviderId: (...args: unknown[]) => mockFindByProviderId(...args),
    create: (...args: unknown[]) => mockCreatePayment(...args),
    claim: (...args: unknown[]) => claimWithSeedGuard(...args),
    attachSubscription: (...args: unknown[]) => mockAttachSubscription(...args),
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
  priceCents: 1990,
  promoPriceCents: 990,
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
  amountCents: 1990,
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
    expect(mapMpStatus("charged_back")).toBe("refunded");
    expect(mapMpStatus("in_mediation")).toBe("pending");
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
      transaction_amount: 19.9,
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
    // claim() e a trava de idempotencia do webhook. Por default ele CONSEGUE
    // reivindicar o evento e devolve a linha nova do ledger (id "pay-new").
    // Sem este default o mock devolvia undefined, o !claimed derrubava o fluxo
    // e a ativacao/renovacao nunca era exercitada de verdade (FASE B4).
    mockClaimPayment.mockResolvedValue({ id: "pay-new" });
  });

  it("trava de esqueleto: claim sem seed explode, nao vira duplicate", async () => {
    // A regressao da FASE B: sem seed, claim() devolvia undefined, o !claimed do
    // servico respondia duplicate=true e a suite provava o contrario do que
    // pretendia. Aqui a falha e explicita e aponta o mock (claimWithSeedGuard).
    mockClaimPayment.mockReset();

    await expect(
      WebhookService.handleNotification({ data: { id: 123 } })
    ).rejects.toThrow(/MOCK_CLAIM_NOT_SEEDED/);

    expect(mockClaimPayment).not.toHaveBeenCalled();
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockCancelActive).not.toHaveBeenCalled();
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
    expect(mockClaimPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        provider: "mercadopago",
        providerId: "123",
        amountCents: 1990,
        currency: "BRL",
        status: "approved",
        subscriptionId: null,
      })
    );
    expect(mockAttachSubscription).toHaveBeenCalledWith("pay-new", "s1");
  });

  it("idempotência: pagamento já processado não reaplica", async () => {
    mockFindByProviderId.mockResolvedValue(EXISTING_PAYMENT);
    const result = await WebhookService.handleNotification({
      data: { id: 123 },
    });

    expect(result).toMatchObject({ duplicate: true, processed: false });
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockClaimPayment).not.toHaveBeenCalled();
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
      transaction_amount: 19.9,
    });
    const result = await WebhookService.handleNotification({ data: { id: 123 } });
    expect(result.status).toBe("pending");
    expect(result.processed).toBe(true);
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockClaimPayment).toHaveBeenCalledWith(
      expect.objectContaining({ status: "pending", subscriptionId: null })
    );
    // Sem assinatura aprovada, nada e vinculado ao ledger.
    expect(mockAttachSubscription).not.toHaveBeenCalled();
  });

  it("lança INVALID_SIGNATURE quando a assinatura do webhook é inválida", async () => {
    const ctx = {
      secret: "s3cr3t",
      xSignature: "ts=1700000000&v1=badbadbadbadbadbadbadbadbadbadbadbadbadb",
      xRequestId: "req-1",
      dataId: 123,
    };
    await expect(
      WebhookService.handleNotification({ data: { id: 123 } }, ctx)
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("aceita webhook com assinatura válida (Caso A)", async () => {
    const ctx = {
      secret: "s3cr3t",
      xSignature: sig("s3cr3t", 123, "req-1", "1700000000"),
      xRequestId: "req-1",
      dataId: 123,
    };
    const result = await WebhookService.handleNotification(
      { data: { id: 123 } },
      ctx
    );
    expect(result.processed).toBe(true);
  });

  it("usa o data_id da query string (ctx.dataId), não o do body (Caso B)", async () => {
    // O MP assina sobre o data_id da query string (?data_id=999), que difere do
    // data.id do body (123). A validação deve usar o valor da query string.
    const ctx = {
      secret: "s3cr3t",
      xSignature: sig("s3cr3t", 999, "req-1", "1700000000"),
      xRequestId: "req-1",
      dataId: 999,
    };
    const result = await WebhookService.handleNotification(
      { data: { id: 123 } },
      ctx
    );
    expect(result.processed).toBe(true);
  });

  it("rejeita assinatura calculada com o body data.id quando difere do query data_id (Caso C)", async () => {
    // A assinatura foi calculada sobre o body data.id (123), mas o data_id da
    // query é 999. Como a validação usa o data_id da query, deve falhar.
    const ctx = {
      secret: "s3cr3t",
      xSignature: sig("s3cr3t", 123, "req-1", "1700000000"),
      xRequestId: "req-1",
      dataId: 999,
    };
    await expect(
      WebhookService.handleNotification({ data: { id: 123 } }, ctx)
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("rejeita quando data_id da query string está ausente (Caso D)", async () => {
    // Sem ctx.dataId, não há fallback para o body: a validação deve falhar.
    const ctx = {
      secret: "s3cr3t",
      xSignature: sig("s3cr3t", 123, "req-1", "1700000000"),
      xRequestId: "req-1",
    };
    await expect(
      WebhookService.handleNotification({ data: { id: 123 } }, ctx)
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("rejeita assinatura inválida (Caso E)", async () => {
    const ctx = {
      secret: "s3cr3t",
      xSignature: "ts=1700000000&v1=badbadbadbadbadbadbadbadbadbadbadbadbadb",
      xRequestId: "req-1",
      dataId: 123,
    };
    await expect(
      WebhookService.handleNotification({ data: { id: 123 } }, ctx)
    ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
  });

  it("em produção, rejeita webhook com secret 'change-me' (não pula validação)", async () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      const ctx = {
        secret: "change-me",
        // O MP assina com o secret REAL (s3cr3t). Como o servidor está com
        // "change-me", a validação roda e o HMAC não confere → rejeita.
        xSignature: sig("s3cr3t", 123, "req-1", "1700000000"),
        xRequestId: "req-1",
        dataId: 123,
      };
      await expect(
        WebhookService.handleNotification({ data: { id: 123 } }, ctx)
      ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prev;
    }
  });

  it("em produção, rejeita webhook sem secret configurado", async () => {
    const prev = process.env.NODE_ENV;
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    try {
      await expect(
        WebhookService.handleNotification({ data: { id: 123 } }, {})
      ).rejects.toMatchObject({ code: "INVALID_SIGNATURE" });
    } finally {
      (process.env as Record<string, string | undefined>).NODE_ENV = prev;
    }
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
    expect(mockClaimPayment).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "u1", subscriptionId: null, status: "approved" })
    );
    expect(mockAttachSubscription).toHaveBeenCalledWith("pay-new", "s1");
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

  it("corrida de entrega duplicada: claim perdido não ativa, renova nem vincula", async () => {
    mockFindByProviderId.mockReset();
    mockClaimPayment.mockReset();
    mockFindByProviderId
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(EXISTING_PAYMENT);
    mockClaimPayment.mockResolvedValue(null);

    const result = await WebhookService.handleNotification({ data: { id: 123 } });

    expect(result).toMatchObject({ duplicate: true, processed: false, status: "approved" });
    expect(mockClaimPayment).toHaveBeenCalledTimes(1);
    expect(mockCancelActive).not.toHaveBeenCalled();
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockUpdateSub).not.toHaveBeenCalled();
    expect(mockAttachSubscription).not.toHaveBeenCalled();
  });

  it("ordem: reivindica o evento no ledger antes de qualquer efeito de negócio", async () => {
    const order: string[] = [];
    mockClaimPayment.mockImplementation(async () => {
      order.push("claim");
      return { id: "pay-new" };
    });
    mockCancelActive.mockImplementation(async () => {
      order.push("cancelActive");
      return [];
    });
    mockCreateSub.mockImplementation(async () => {
      order.push("activate");
      return ACTIVE_SUB;
    });
    mockAttachSubscription.mockImplementation(async () => {
      order.push("attach");
      return { ...EXISTING_PAYMENT, subscriptionId: "s1" };
    });

    await WebhookService.handleNotification({ data: { id: 123 } });

    expect(order).toEqual(["claim", "cancelActive", "activate", "attach"]);
  });

  it("estorno (charged_back) entra como refunded e não ativa assinatura", async () => {
    mockGetPayment.mockResolvedValue({
      id: 123,
      status: "charged_back",
      external_reference: "pro:u1",
      transaction_amount: 19.9,
    });

    const result = await WebhookService.handleNotification({ data: { id: 123 } });

    expect(result).toMatchObject({ processed: true, duplicate: false, status: "refunded" });
    expect(mockClaimPayment).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "123", status: "refunded", subscriptionId: null })
    );
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockUpdateSub).not.toHaveBeenCalled();
    expect(mockAttachSubscription).not.toHaveBeenCalled();
  });

  it("valor efetivo: tem precedência o transaction_amount confirmado pelo provedor", async () => {
    mockGetPayment.mockResolvedValue({
      id: 123,
      status: "approved",
      external_reference: "pro:u1",
      transaction_amount: 25,
    });

    await WebhookService.handleNotification({ data: { id: 123 } });

    expect(mockClaimPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 2500 })
    );
  });

  it("sem transaction_amount usa o preço oficial do plano; a promoção é ignorada", async () => {
    mockGetPayment.mockResolvedValue({
      id: 123,
      status: "approved",
      external_reference: "pro:u1",
    });

    await WebhookService.handleNotification({ data: { id: 123 } });

    const claim = mockClaimPayment.mock.calls[0][0];
    expect(claim.amountCents).toBe(PRO_PLAN.priceCents);
    expect(claim.amountCents).not.toBe(PRO_PLAN.promoPriceCents);
  });

  it("paidAt vem de date_approved do provedor, não do instante do webhook", async () => {
    mockGetPayment.mockResolvedValue({
      id: 123,
      status: "approved",
      external_reference: "pro:u1",
      transaction_amount: 19.9,
      date_approved: "2026-10-01T12:00:00.000Z",
    });

    await WebhookService.handleNotification({ data: { id: 123 } });

    const claim = mockClaimPayment.mock.calls[0][0];
    expect(claim.paidAt).toEqual(new Date("2026-10-01T12:00:00.000Z"));
  });

  it("providerId do ledger é o id confirmado pelo provedor, não o id do body", async () => {
    await WebhookService.handleNotification({ data: { id: 555 } });

    expect(mockGetPayment).toHaveBeenCalledWith("555");
    expect(mockClaimPayment).toHaveBeenCalledWith(
      expect.objectContaining({ providerId: "123" })
    );
  });

  it("external_reference sem usuário é ignorada antes de reivindicar o evento", async () => {
    mockGetPayment.mockResolvedValue({
      id: 123,
      status: "approved",
      external_reference: "pro",
      transaction_amount: 19.9,
    });

    const result = await WebhookService.handleNotification({ data: { id: 123 } });

    expect(result).toMatchObject({ ignored: true, processed: false });
    expect(mockClaimPayment).not.toHaveBeenCalled();
    expect(mockCreateSub).not.toHaveBeenCalled();
  });

  it("subscription_preapproval com external_reference inválida não ativa assinatura", async () => {
    mockGetPreapproval.mockResolvedValue({
      id: "pre-1",
      status: "authorized",
      external_reference: null,
    });

    const result = await WebhookService.handleNotification({
      type: "subscription_preapproval",
      data: { id: "pre-1" },
    });

    expect(result).toMatchObject({ ignored: true, processed: false });
    expect(mockCreateSub).not.toHaveBeenCalled();
    expect(mockClaimPayment).not.toHaveBeenCalled();
  });

  it("não vincula o ledger quando a assinatura não nasce (activate devolve null)", async () => {
    mockCreateSub.mockResolvedValue(null);

    const result = await WebhookService.handleNotification({ data: { id: 123 } });

    expect(result).toMatchObject({ processed: true, status: "approved" });
    expect(mockClaimPayment).toHaveBeenCalledTimes(1);
    expect(mockAttachSubscription).not.toHaveBeenCalled();
  });
});
