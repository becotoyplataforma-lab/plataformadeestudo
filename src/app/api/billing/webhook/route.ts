/**
 * POST /api/billing/webhook
 * Recebe notificações de pagamento do Mercado Pago.
 *
 * Fluxo: validação → confirmação no provedor → idempotência → persistência
 * do evento (payments) → atualização da assinatura.
 *
 * Toda a lógica está no WebhookService (nenhuma regra na rota).
 * Responde 401 para assinatura inválida, 500 para falha de processamento e
 * 200 para eventos processados ou duplicados.
 */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { PaymentNotification } from "@/lib/payments/mercadopago";
import {
  WebhookService,
  WebhookError,
} from "@/lib/billing/services/webhook.service";
import { mapWebhookResultToDto } from "@/lib/dto/billing.dto";
import { logger } from "@/lib/observability";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const h = await headers();
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    const xSignature = h.get("x-signature") ?? undefined;
    const xRequestId = h.get("x-request-id") ?? undefined;
    // O Mercado Pago anexa `?data_id=...` à URL do webhook. A assinatura HMAC
    // é calculada sobre esse valor (query string), NÃO sobre o `data.id` do body.
    const dataId = new URL(request.url).searchParams.get("data_id") ?? undefined;

    const notification = (await request.json()) as PaymentNotification;
    const result = await WebhookService.handleNotification(notification, {
      secret,
      xSignature,
      xRequestId,
      dataId,
    });

    logger.info("webhook", "webhook processado", {
      event: "webhook.processed",
      path: "/api/billing/webhook",
      status: result.status,
      duplicate: result.duplicate,
    });
    return NextResponse.json(mapWebhookResultToDto(result), { status: 200 });
  } catch (error) {
    if (error instanceof WebhookError && error.code === "INVALID_SIGNATURE") {
      logger.warn("webhook", "assinatura inválida", {
        event: "webhook.invalid_signature",
        path: "/api/billing/webhook",
      });
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    logger.error("webhook", "falha no processamento", {
      event:
        error instanceof WebhookError
          ? "webhook.processing_failed"
          : "webhook.unexpected_error",
      path: "/api/billing/webhook",
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Falha no processamento" },
      { status: 500 }
    );
  }
}
