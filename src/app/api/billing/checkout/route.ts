/**
 * POST /api/billing/checkout
 * Cria preferência de checkout no Mercado Pago para o plano escolhido.
 * REUTILIZA o gateway existente (src/lib/payments/mercadopago.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import {
  CheckoutService,
  CheckoutError,
} from "@/lib/billing/services/checkout.service";
import { mapCheckoutToDto } from "@/lib/dto/billing.dto";

const schema = z.object({
  plan: z.enum(["free", "pro", "intensivo"]),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await CheckoutService.createCheckout(
      session.user.id,
      parsed.data.plan,
      session.user.email ?? undefined
    );

    return NextResponse.json(mapCheckoutToDto(result));
  } catch (error) {
    if (error instanceof CheckoutError) {
      const status = error.code === "PLAN_NOT_FOUND" ? 404 : 400;
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status }
      );
    }
    console.error("[billing/checkout] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao criar checkout." },
      { status: 500 }
    );
  }
}
