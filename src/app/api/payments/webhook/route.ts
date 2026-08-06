import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { apiOk } from "@/lib/api/helpers";
import { getPayment, type PaymentNotification } from "@/lib/payments/mercadopago";
import { getPlan } from "@/lib/payments/plans";
import type { Plan } from "@/types";

export const runtime = "nodejs";

/**
 * POST /api/payments/webhook
 * Recebe notificações do Mercado Pago (pagamentos).
 * Ao confirmar pagamento "approved", atualiza o plano do usuário.
 *
 * IMPORTANTE: configure o webhook no painel do Mercado Pago para apontar
 * para esta rota. Use MERCADO_PAGO_WEBHOOK_SECRET para validar (opcional,
 * conforme a configuração de notificações do provedor).
 */
export async function POST(req: Request) {
  try {
    // (Opcional) validação básica do secret — adaptar ao formato do webhook.
    const h = await headers();
    const secret = process.env.MERCADO_PAGO_WEBHOOK_SECRET;
    if (secret && secret !== "change-me") {
      const received = h.get("x-webhook-secret") ?? h.get("authorization")?.replace("Bearer ", "");
      if (received !== secret) {
        return new Response("Não autorizado", { status: 401 });
      }
    }

    const notification = (await req.json()) as PaymentNotification;
    const paymentId = notification.data?.id ?? notification.id;

    if (!paymentId) {
      return apiOk({ received: true, ignored: true });
    }

    // Confirma o status do pagamento na API do Mercado Pago
    const payment = await getPayment(String(paymentId));

    // external_reference: "plano:userId"
    const [planId, userId] = (payment.external_reference ?? "").split(":");
    if (!userId || !planId || !["pro", "intensivo"].includes(planId)) {
      return apiOk({ received: true, ignored: true });
    }

    const db = await createClient();
    const plan = getPlan(planId as Plan);

    // Registra o pagamento e ativa o plano (função SECURITY DEFINER,
    // pois o webhook não possui sessão de usuário autenticado).
    await db.rpc("register_payment", {
      p_user_id: userId,
      p_plan: planId as Plan,
      p_amount_cents: plan.amountCents,
      p_status: payment.status,
      p_provider_id: String(payment.id),
      p_external_reference: payment.external_reference,
    });

    if (payment.status === "approved") {
      console.log(`[webhook] Plano ativado: user=${userId} → ${planId}`);
    } else {
      console.log(`[webhook] Pagamento ${payment.status}: user=${userId} plan=${planId}`);
    }

    return apiOk({ received: true, status: payment.status });
  } catch (error) {
    // Sempre responde 200 para evitar retries infinitos do Mercado Pago
    console.error("[payments/webhook]", error);
    return apiOk({ received: true, error: "erro_interno" });
  }
}
