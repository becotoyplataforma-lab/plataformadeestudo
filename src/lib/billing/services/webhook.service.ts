/**
 * ConcursoAI — WebhookService (Billing)
 *
 * Processa notificações de pagamento do Mercado Pago com:
 * - validação (assinatura HMAC SHA-256 quando MERCADO_PAGO_WEBHOOK_SECRET setado)
 * - confirmação do status via API do provedor (nunca confia no payload)
 * - idempotência (provider_id único — evita duplicidade)
 * - persistência do evento (payments) e atualização da assinatura
 *
 * REUTILIZA a integração existente (getPayment de src/lib/payments/mercadopago.ts).
 */
import "server-only";
import { createHmac } from "node:crypto";
import { getPayment, type PaymentNotification } from "@/lib/payments/mercadopago";
import { PaymentRepository } from "../repositories/payment.repository";
import { PlanRepository } from "../repositories/plan.repository";
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
  return v1 === expected;
}

export interface WebhookContext {
  /** MERCADO_PAGO_WEBHOOK_SECRET — se vazio/ausente, validação é pulada (dev). */
  secret?: string;
  xSignature?: string;
  xRequestId?: string;
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
   * Processa a notificação de pagamento.
   * Sempre resolve com 200-friendly (WebhookResult); lança apenas em falha
   * de validação de assinatura (rota responde 401 nesse caso).
   */
  async handleNotification(
    notification: PaymentNotification,
    ctx: WebhookContext = {}
  ): Promise<WebhookResult> {
    const paymentId = notification.data?.id ?? notification.id;
    if (!paymentId) {
      return { received: true, processed: false, ignored: true, duplicate: false, status: null };
    }

    // 1. Validação de assinatura (quando secret configurado).
    if (ctx.secret && ctx.secret !== "change-me") {
      const valid = verifyMpSignature({
        secret: ctx.secret,
        signature: ctx.xSignature ?? "",
        requestId: ctx.xRequestId ?? "",
        dataId: paymentId,
      });
      if (!valid) {
        throw new WebhookError("INVALID_SIGNATURE", "Assinatura do webhook inválida.");
      }
    }

    // 2. Confirma o status no provedor (nunca confiar no payload).
    const payment = (await getPayment(String(paymentId))) as ConfirmedPayment;
    const status = mapMpStatus(payment.status);
    const providerId = String(payment.id);

    // 3. Idempotência: já processado? Não reaplica.
    const existing = await PaymentRepository.findByProviderId(providerId);
    if (existing) {
      return { received: true, processed: false, ignored: false, duplicate: true, status: existing.status };
    }

    // 4. Identifica usuário e plano pela external_reference "plano:userId".
    const [planCode, userId] = (payment.external_reference ?? "").split(":");
    if (!userId || !planCode) {
      return { received: true, processed: false, ignored: true, duplicate: false, status };
    }

    // 5. Plano válido?
    const plan = await PlanRepository.findByCode(planCode);
    if (!plan) {
      return { received: true, processed: false, ignored: true, duplicate: false, status };
    }

    // 6. Atualiza a assinatura (approved → ativa; cancela ativas anteriores).
    let subscriptionId: string | null = null;
    if (status === "approved") {
      const sub = await SubscriptionService.activate(userId, planCode);
      subscriptionId = sub?.id ?? null;
    }

    // 7. Persiste o evento (pagamento) — imutável.
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
