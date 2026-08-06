/**
 * GET /api/analytics/summary
 * KPIs do dashboard do usuário (docs/16 §3.1) — agregação sob demanda.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { AggregationService } from "@/lib/analytics/services/aggregation.service";
import { SummaryDtoSchema, mapSummaryToDto } from "@/lib/dto/analytics.dto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const summary = await AggregationService.getSummary(session.user.id);
    const dto = strictDto(SummaryDtoSchema, mapSummaryToDto(summary));
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[analytics/summary] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao calcular resumo." },
      { status: 500 }
    );
  }
}
