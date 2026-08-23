/**
 * ConcursoAI — CheckoutService (Billing)
 *
 * Cria a preferência de checkout no Mercado Pago para o plano escolhido.
 * REUTILIZA a integração existente (src/lib/payments/mercadopago.ts) —
 * não cria outro gateway.
 *
 * Secrets nunca entram no código: o access token é lido de env no cliente MP.
 */
import "server-only";
import { PlanRepository } from "../repositories/plan.repository";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import { createPreapproval } from "@/lib/payments/mercadopago";

export class CheckoutError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "CheckoutError";
    this.code = code;
  }
}

export interface CheckoutResult {
  initPoint: string;
  sandboxInitPoint: string;
  externalReference: string;
  plan: string;
  priceCents: number;
  promoApplied: boolean;
  /** true quando a assinatura é recorrente (Preapproval) — renovação automática. */
  recurring: boolean;
}

export const CheckoutService = {
  /** Cria a assinatura recorrente (Preapproval) para planos pagos.
   *  Preço promocional (1º ciclo) quando o usuário nunca teve assinatura.
   *  A renovação é automática (cobrança mensal recorrente no Mercado Pago). */
  async createCheckout(
    userId: string,
    planCode: string,
    payerEmail?: string
  ): Promise<CheckoutResult> {
    const plan = await PlanRepository.findByCode(planCode);
    if (!plan) {
      throw new CheckoutError("PLAN_NOT_FOUND", `Plano não encontrado: ${planCode}`);
    }
    if (plan.priceCents <= 0) {
      throw new CheckoutError("FREE_PLAN", "Plano gratuito não requer pagamento.");
    }

    // 1º ciclo usa o preço promocional (se o plano tiver), senão o preço cheio.
    const firstCycle = !(await SubscriptionRepository.hasAnyByUser(userId));
    const promoApplied = firstCycle && plan.promoPriceCents !== null && plan.promoPriceCents !== undefined;
    const priceCents = promoApplied ? plan.promoPriceCents! : plan.priceCents;

    // external_reference: "plano:userId" — usada no webhook para identificar.
    const externalReference = `${plan.code}:${userId}`;

    // Assinatura recorrente (Preapproval) → renovação automática mensal.
    const preapproval = await createPreapproval({
      externalReference,
      reason: `Assinatura ${plan.name} — ConcursoAI`,
      unitPriceCents: priceCents,
      payerEmail,
    });

    return {
      initPoint: preapproval.init_point ?? "",
      sandboxInitPoint: preapproval.sandbox_init_point ?? "",
      externalReference,
      plan: plan.code,
      priceCents,
      promoApplied,
      recurring: true,
    };
  },
};
