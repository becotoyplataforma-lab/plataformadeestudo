/**
 * ConcursoAI — WebhookService (Billing)
 *
 * Processa notificações de pagamento do Mercado Pago com:
 * - validação (assinatura HMAC SHA-256 quando MERCADO_PAGO_WEBHOOK_SECRET setado;
 *   o `data_id` da assinatura vem da query string `?data_id=...`, não do body)
 * - confirmação do status via API do provedor (nunca confia no payload)
 * - idempotência (provider_id único — evita duplicidade)
 * - persistência do evento (payments) e atualização da assinatura
 *
 * REUTILIZA a integração existente (getPayment de src/lib/payments/mercadopago.ts).
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  getPayment,
  getPreapproval,
  type PaymentNotification,
} from "@/lib/payments/mercadopago";
import { PaymentRepository } from "../repositories/payment.repository";
import { PlanRepository } from "../repositories/plan.repository";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { SubscriptionService } from "./subscription.service";
import type { PaymentStatus, WebhookResult } from "../types";

export class WebhookError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WebhookError";
    this.code = code;
  }
}

/** Mapeia o status do Mercado Pago para o enum payment_status. */
export function mapMpStatus(status: string): PaymentStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "pending":
      return "pending";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "cancelled";
    case "refunded":
      return "refunded";
    default:
      return "pending";
  }
}

/**
 * Valida a assinatura do webhook do Mercado Pago.
 * x-signature: "ts=<ts>&v1=<hmac>" (HMAC-SHA256 do template oficial).
 */
export function verifyMpSignature(params: {
  secret: string;
  signature: string;
  requestId: string;
  dataId: string | number;
}): boolean {
  const parts = params.signature.split(/[&,]/);
  const ts = parts.find((p) => p.startsWith("ts="))?.slice(3) ?? "";
  const v1 = parts.find((p) => p.startsWith("v1="))?.slice(3) ?? "";
  if (!ts || !v1) return false;

  const template = `id:${params.dataId};request-id:${params.requestId};ts:${ts};`;
  const expected = createHmac("sha256", params.secret)
    .update(template)
    .digest("hex");
  if (!/^[0-9a-f]+$/i.test(v1) || v1.length !== expected.length) return false;
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(v1, "hex");
  return timingSafeEqual(expectedBuffer, actualBuffer);
}

export interface WebhookContext {
  /** MERCADO_PAGO_WEBHOOK_SECRET — se vazio/ausente, validação é pulada (dev). */
  secret?: string;
  xSignature?: string;
  xRequestId?: string;
  /**
   * `data_id` da query string (?data_id=...) enviada pelo Mercado Pago.
   * Fonte oficial do valor usado na assinatura HMAC — NÃO o `data.id` do body.
   */
  dataId?: string | number;
}

interface ConfirmedPayment {
  id: number;
  status: string;
  external_reference?: string | null;
  transaction_amount?: number;
  date_approved?: string | null;
}

export const WebhookService = {
  /**
   * Processa a notificação do Mercado Pago.
   * Suporta dois fluxos:
   *  - `subscription_preapproval`: aprovação da assinatura recorrente → ativa.
   *  - `payment` (one-time ou cobrança recorrente): pagamento aprovado →
   *    ativa (1º ciclo) ou renova (ciclos seguintes).
   * Sempre resolve com 200-friendly (WebhookResult); lança apenas em falha
   * de validação de assinatura (rota responde 401 nesse caso).
   */
  async handleNotification(
    notification: PaymentNotification,
    ctx: WebhookContext = {}
  ): Promise<WebhookResult> {
    const eventId = notification.data?.id ?? notification.id;
    if (!eventId) {
      return { received: true, processed: false, ignored: true, duplicate: false, status: null };
    }

    // 1. Validação de assinatura.
    // Em produção a validação é SEMPRE obrigatória: sem secret (ou com o
    // placeholder "change-me") o webhook é rejeitado. Em dev, "change-me" pula
    // a validação para facilitar testes locais.
    const isProd = process.env.NODE_ENV === "production";
    const skipValidation = !isProd && ctx.secret === "change-me";

    if (ctx.secret && !skipValidation) {
      // O data_id da assinatura vem da query string (?data_id=...) enviada pelo
      // Mercado Pago — NÃO do body. Sem data_id na query, a validação falha.
      if (ctx.dataId === undefined) {
        throw new WebhookError("INVALID_SIGNATURE", "data_id ausente na query string.");
      }
      const valid = verifyMpSignature({
        secret: ctx.secret,
        signature: ctx.xSignature ?? "",
        requestId: ctx.xRequestId ?? "",
        dataId: ctx.dataId,
      });
      if (!valid) {
        throw new WebhookError("INVALID_SIGNATURE", "Assinatura do webhook inválida.");
      }
    } else if (isProd && !ctx.secret) {
      // Produção sem secret: nunca aceita webhook sem validação.
      throw new WebhookError(
        "INVALID_SIGNATURE",
        "MERCADO_PAGO_WEBHOOK_SECRET não configurado."
      );
    }

    // 2. Roteia por tipo de evento.
    const type = notification.type ?? notification.action;
    if (type === "subscription_preapproval") {
      return this.handlePreapproval(String(eventId));
    }
    return this.handlePayment(String(eventId));
  },

  /** Processa aprovação/cancelamento de uma Preapproval (assinatura recorrente). */
  async handlePreapproval(preapprovalId: string): Promise<WebhookResult> {
    // Confirma o status no provedor (nunca confiar no payload).
    const preapproval = await getPreapproval(preapprovalId);
    const status = preapproval.status; // pending, authorized, paused, cancelled, finished

    // Idempotência: já existe assinatura com este preapproval_id?
    const existing = await SubscriptionRepository.findByPreapprovalId(preapprovalId);
    if (existing) {
      return { received: true, processed: false, ignored: false, duplicate: true, status: null };
    }

    // Identifica usuário e plano pela external_reference "plano:userId".
    const [planCode, userId] = (preapproval.external_reference ?? "").split(":");
    if (!userId || !planCode) {
      return { received: true, processed: false, ignored: true, duplicate: false, status: null };
    }

    const plan = await PlanRepository.findByCode(planCode);
    if (!plan) {
      return { received: true, processed: false, ignored: true, duplicate: false, status: null };
    }

    // Apenas "authorized" ativa a assinatura recorrente.
    if (status !== "authorized") {
      return { received: true, processed: false, ignored: true, duplicate: false, status: null };
    }

    await SubscriptionService.activate(userId, planCode, {
      preapprovalId,
    });

    return {
      received: true,
      processed: true,
      ignored: false,
      duplicate: false,
      status: "approved",
    };
  },

  /** Processa um pagamento (one-time ou cobrança recorrente). */
  async handlePayment(paymentId: string): Promise<WebhookResult> {
    // Confirma o status no provedor (nunca confiar no payload).
    const payment = (await getPayment(paymentId)) as ConfirmedPayment;
    const status = mapMpStatus(payment.status);
    const providerId = String(payment.id);

    // Idempotência: já processado? Não reaplica.
    const existing = await PaymentRepository.findByProviderId(providerId);
    if (existing) {
      return { received: true, processed: false, ignored: false, duplicate: true, status: existing.status };
    }

    // Identifica usuário e plano pela external_reference "plano:userId".
    const [planCode, userId] = (payment.external_reference ?? "").split(":");
    if (!userId || !planCode) {
      return { received: true, processed: false, ignored: true, duplicate: false, status };
    }

    const plan = await PlanRepository.findByCode(planCode);
    if (!plan) {
      return { received: true, processed: false, ignored: true, duplicate: false, status };
    }

    // Atualiza a assinatura:
    //  - approved + já tem assinatura ativa → renova (estende ciclo).
    //  - approved + sem assinatura ativa → ativa (1º ciclo).
    let subscriptionId: string | null = null;
    if (status === "approved") {
      const active = await SubscriptionRepository.findActiveByUser(userId);
      if (active) {
        const renewed = await SubscriptionService.renew(userId, planCode);
        subscriptionId = renewed?.id ?? active.id;
      } else {
        const sub = await SubscriptionService.activate(userId, planCode);
        subscriptionId = sub?.id ?? null;
      }
    }

    // Persiste o evento (pagamento) — imutável.
    const amountCents =
      payment.transaction_amount !== undefined
        ? Math.round(payment.transaction_amount * 100)
        : plan.priceCents;
    await PaymentRepository.create({
      userId,
      subscriptionId,
      provider: "mercadopago",
      providerId,
      amountCents,
      currency: "BRL",
      status,
      externalReference: payment.external_reference ?? null,
      paidAt: payment.date_approved ? new Date(payment.date_approved) : null,
    });

    return { received: true, processed: true, ignored: false, duplicate: false, status };
  },
};
