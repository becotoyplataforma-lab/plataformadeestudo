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
import { createCheckoutPreference } from "@/lib/payments/mercadopago";

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
}

export const CheckoutService = {
  /** Cria preferência de checkout (apenas planos pagos). */
  async createCheckout(userId: string, planCode: string): Promise<CheckoutResult> {
    const plan = await PlanRepository.findByCode(planCode);
    if (!plan) {
      throw new CheckoutError("PLAN_NOT_FOUND", `Plano não encontrado: ${planCode}`);
    }
    if (plan.priceCents <= 0) {
      throw new CheckoutError("FREE_PLAN", "Plano gratuito não requer pagamento.");
    }

    // external_reference: "plano:userId" — usada no webhook para identificar.
    const externalReference = `${plan.code}:${userId}`;

    const preference = await createCheckoutPreference({
      externalReference,
      title: `Plano ${plan.name} — ConcursoAI`,
      description: `Assinatura ${plan.name} — ConcursoAI`,
      unitPriceCents: plan.priceCents,
    });

    return {
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      externalReference,
      plan: plan.code,
      priceCents: plan.priceCents,
    };
  },
};
