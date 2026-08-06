/**
 * GET /api/billing/plans
 * Catálogo de planos ativos (leitura para autenticados).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { PlanRepository } from "@/lib/billing/repositories/plan.repository";
import {
  BillingPlansDtoSchema,
  mapPlanToDto,
} from "@/lib/dto/billing.dto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rows = await PlanRepository.listActive();
    const dto = strictDto(
      BillingPlansDtoSchema,
      { plans: rows.map(mapPlanToDto) }
    );
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[billing/plans] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao listar planos." },
      { status: 500 }
    );
  }
}
