/**
 * GET /api/analytics/subjects
 * Acerto por matéria (piores primeiro — docs/16 §4.2).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { AggregationService } from "@/lib/analytics/services/aggregation.service";
import {
  SubjectPerformanceListDtoSchema,
  mapSubjectPerfToDto,
} from "@/lib/dto/analytics.dto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rows = await AggregationService.getPerformanceBySubject(session.user.id);
    const dto = strictDto(
      SubjectPerformanceListDtoSchema,
      { data: rows.map(mapSubjectPerfToDto) }
    );
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[analytics/subjects] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao calcular desempenho por matéria." },
      { status: 500 }
    );
  }
}
