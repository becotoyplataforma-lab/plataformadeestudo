/**
 * POST /api/billing/subscriptions/cancel
 * Cancela a assinatura ativa do usuário.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { SubscriptionService } from "@/lib/billing/services/subscription.service";
import {
  SubscriptionDtoSchema,
  mapSubscriptionToDto,
} from "@/lib/dto/billing.dto";

export async function POST() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const sub = await SubscriptionService.cancel(session.user.id);
    if (!sub) {
      return NextResponse.json({ cancelled: false }, { status: 200 });
    }

    const dto = strictDto(SubscriptionDtoSchema, mapSubscriptionToDto(sub));
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[billing/subscriptions/cancel] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao cancelar assinatura." },
      { status: 500 }
    );
  }
}
