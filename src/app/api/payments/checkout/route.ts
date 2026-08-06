import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { apiError, apiOk } from "@/lib/api/helpers";
import { z } from "zod";
import { PLANS, getPlan } from "@/lib/payments/plans";
import { createCheckoutPreference } from "@/lib/payments/mercadopago";
import type { Plan } from "@/types";

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

    const plan = getPlan(parsed.data.plan as Plan);
    if (plan.amountCents <= 0) return apiError(400, "Plano gratuito não requer pagamento.");

    const db = await createClient();
    const { data: profile } = await db
      .from("profiles")
      .select("full_name, email")
      .eq("id", session.user.id)
      .single();

    // external_reference: "plano:userId" — usada no webhook para identificar
    const externalReference = `${plan.id}:${session.user.id}`;

    const preference = await createCheckoutPreference({
      externalReference,
      title: `Plano ${plan.name} — ConcursoAI`,
      description: plan.description,
      unitPriceCents: plan.amountCents,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?pagamento=sucesso&plano=${plan.id}`,
      failureUrl: `${process.env.NEXT_PUBLIC_APP_URL}/configuracoes?pagamento=falha`,
    });

    return apiOk({
      init_point: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point,
      external_reference: externalReference,
      plan: plan.id,
    });
  } catch (error) {
    console.error("[payments/checkout]", error);
    return apiError(500, "Não foi possível criar o checkout. Tente novamente.");
  }
}
