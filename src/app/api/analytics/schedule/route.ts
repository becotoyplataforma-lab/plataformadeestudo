/**
 * GET /api/analytics/schedule?days=7
 * Progresso do cronograma (docs/16 §3.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { AggregationService } from "@/lib/analytics/services/aggregation.service";
import { ScheduleProgressDtoSchema, mapScheduleToDto } from "@/lib/dto/analytics.dto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const daysRaw = request.nextUrl.searchParams.get("days");
    const days = clampDays(daysRaw ? Number(daysRaw) : 7);

    const progress = await AggregationService.getScheduleProgress(session.user.id, days);
    const dto = strictDto(ScheduleProgressDtoSchema, mapScheduleToDto(progress));
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[analytics/schedule] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao calcular progresso do cronograma." },
      { status: 500 }
    );
  }
}

/** Limita `days` a [1, 90]. */
function clampDays(days: number): number {
  if (Number.isNaN(days)) return 7;
  return Math.min(90, Math.max(1, Math.floor(days)));
}
