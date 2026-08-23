import { headers } from "next/headers";
import { apiOk } from "@/lib/api/helpers";
import type { PaymentNotification } from "@/lib/payments/mercadopago";
import {
  WebhookService,
  WebhookError,
} from "@/lib/billing/services/webhook.service";

export const runtime = "nodejs";

/**
 * POST /api/payments/webhook
 * Recebe notificações do Mercado Pago (pagamentos).
 *
 * Delega ao WebhookService (Drizzle): validação HMAC → confirmação do status no
 * provedor → idempotência (provider_id) → persistência do pagamento → ativação
 * da assinatura. Remove a dependência de RPC/REST anon (register_payment).
 *
 * IMPORTANTE: configure o webhook no painel do Mercado Pago para apontar para
 * esta rota. Use MERCADO_PAGO_WEBHOOK_SECRET para validar a assinatura.
 */
export async function POST(req: Request) {
  try {
    const h = await headers();
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    const xSignature = h.get("x-signature") ?? undefined;
    const xRequestId = h.get("x-request-id") ?? undefined;
    // O Mercado Pago anexa `?data_id=...` à URL do webhook. A assinatura HMAC
    // é calculada sobre esse valor (query string), NÃO sobre o `data.id` do body.
    const dataId = new URL(req.url).searchParams.get("data_id") ?? undefined;

    const notification = (await req.json()) as PaymentNotification;
    const result = await WebhookService.handleNotification(notification, {
      secret,
      xSignature,
      xRequestId,
      dataId,
    });

    return apiOk({
      received: true,
      status: result.status,
      ignored: result.ignored,
    });
  } catch (error) {
    if (error instanceof WebhookError && error.code === "INVALID_SIGNATURE") {
      return new Response("Não autorizado", { status: 401 });
    }
    // Sempre responde 200 para evitar retries infinitos do Mercado Pago.
    console.error("[payments/webhook]", error);
    return apiOk({ received: true, error: "erro_interno" });
  }
}
