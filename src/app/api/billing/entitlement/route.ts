/**
 * GET /api/billing/entitlement
 * Entitlement atual do usuário (plano + assinatura + limites).
 * OPEN-004: Billing é dono dos limites — o Professor IA consulta este endpoint.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";
import {
  EntitlementDtoSchema,
  mapEntitlementToDto,
} from "@/lib/dto/billing.dto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const entitlement = await EntitlementService.getCurrent(session.user.id);
    const dto = strictDto(EntitlementDtoSchema, mapEntitlementToDto(entitlement));
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[billing/entitlement] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao resolver entitlement." },
      { status: 500 }
    );
  }
}
