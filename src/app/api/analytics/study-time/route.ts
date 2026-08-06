/**
 * GET /api/analytics/study-time?days=7
 * Tempo de estudo por dia (docs/16 §3.2).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { AggregationService } from "@/lib/analytics/services/aggregation.service";
import {
  StudyTimeListDtoSchema,
  mapStudyTimeToDto,
} from "@/lib/dto/analytics.dto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const daysRaw = request.nextUrl.searchParams.get("days");
    const days = clampDays(daysRaw ? Number(daysRaw) : 7);

    const points = await AggregationService.getStudyTime(session.user.id, days);
    const dto = strictDto(
      StudyTimeListDtoSchema,
      { data: points.map(mapStudyTimeToDto) }
    );
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[analytics/study-time] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao calcular tempo de estudo." },
      { status: 500 }
    );
  }
}

/** Limita `days` a [1, 90]. */
function clampDays(days: number): number {
  if (Number.isNaN(days)) return 7;
  return Math.min(90, Math.max(1, Math.floor(days)));
}
