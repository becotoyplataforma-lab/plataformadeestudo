import { auth } from "@/lib/auth/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { z } from "zod";
import { createCheckoutPreference } from "@/lib/payments/mercadopago";
import { PlanRepository } from "@/lib/billing/repositories/plan.repository";

const schema = z.object({
  plan: z.enum(["pro", "intensivo"]),
});

/**
 * POST /api/payments/checkout
 * Cria uma preferência de checkout no Mercado Pago para o plano escolhido.
 */
export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return apiError(401, "Não autenticado.");

    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError(422, "Plano inválido.");

    const plan = await PlanRepository.findByCode(parsed.data.plan);
    if (!plan) return apiError(404, "Plano não encontrado.");
    if (plan.priceCents <= 0) return apiError(400, "Plano gratuito não requer pagamento.");

    // external_reference: "code:userId" — usada no webhook para identificar
    const externalReference = `${plan.code}:${session.user.id}`;

    const preference = await createCheckoutPreference({
      externalReference,
      title: `Plano ${plan.name} — ConcursoAI`,
      description: `Assinatura ${plan.name} — ConcursoAI`,
      unitPriceCents: plan.priceCents,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?pagamento=sucesso&plano=${plan.code}`,
      failureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?pagamento=falha`,
    });

    return apiOk({
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      external_reference: externalReference,
      plan: plan.code,
    });
  } catch (error) {
    console.error("[payments/checkout]", error);
    return apiError(500, "Não foi possível criar o checkout. Tente novamente.");
  }
}
