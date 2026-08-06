/**
 * GET /api/analytics/evolution?days=30
 * Evolução diária de acertos (docs/16 §4.3).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { AggregationService } from "@/lib/analytics/services/aggregation.service";
import {
  EvolutionListDtoSchema,
  mapEvolutionToDto,
} from "@/lib/dto/analytics.dto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const daysRaw = request.nextUrl.searchParams.get("days");
    const days = clampDays(daysRaw ? Number(daysRaw) : 30);

    const points = await AggregationService.getEvolution(session.user.id, days);
    const dto = strictDto(
      EvolutionListDtoSchema,
      { data: points.map(mapEvolutionToDto) }
    );
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[analytics/evolution] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao calcular evolução." },
      { status: 500 }
    );
  }
}

/** Limita `days` a [1, 90]. */
function clampDays(days: number): number {
  if (Number.isNaN(days)) return 30;
  return Math.min(90, Math.max(1, Math.floor(days)));
}
