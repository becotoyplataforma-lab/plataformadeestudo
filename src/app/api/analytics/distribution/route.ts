/**
 * GET /api/analytics/distribution
 * Distribuição de estudo por matéria (docs/16 §3.2).
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { AggregationService } from "@/lib/analytics/services/aggregation.service";
import {
  DistributionListDtoSchema,
  mapDistributionToDto,
} from "@/lib/dto/analytics.dto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const rows = await AggregationService.getDistribution(session.user.id);
    const dto = strictDto(
      DistributionListDtoSchema,
      { data: rows.map(mapDistributionToDto) }
    );
    return NextResponse.json(dto);
  } catch (error) {
    console.error("[analytics/distribution] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao calcular distribuição." },
      { status: 500 }
    );
  }
}
