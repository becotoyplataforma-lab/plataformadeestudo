/**
 * POST /api/billing/webhook
 * Recebe notificações de pagamento do Mercado Pago.
 *
 * Fluxo: validação → confirmação no provedor → idempotência → persistência
 * do evento (payments) → atualização da assinatura.
 *
 * Toda a lógica está no WebhookService (nenhuma regra na rota).
 * Sempre responde 200 para evitar retries infinitos (exceto assinatura inválida).
 */
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { PaymentNotification } from "@/lib/payments/mercadopago";
import {
  WebhookService,
  WebhookError,
} from "@/lib/billing/services/webhook.service";
import { mapWebhookResultToDto } from "@/lib/dto/billing.dto";

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

    return NextResponse.json(mapWebhookResultToDto(result), { status: 200 });
  } catch (error) {
    if (error instanceof WebhookError && error.code === "INVALID_SIGNATURE") {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    console.error("[billing/webhook] Erro:", error);
    // Sempre 200 para evitar retries infinitos do Mercado Pago.
    return NextResponse.json(
      { received: true, processed: false, ignored: true, duplicate: false, status: null },
      { status: 200 }
    );
  }
}
