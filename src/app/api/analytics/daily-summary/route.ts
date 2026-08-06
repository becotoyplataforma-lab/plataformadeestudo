/**
 * GET /api/analytics/daily-summary?date=YYYY-MM-DD
 * Resumo diário materializado do usuário (daily_summaries).
 * Retorna null se o dia ainda não foi materializado (OPEN-006).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { strictDto } from "@/lib/dto";
import { DailySummaryService } from "@/lib/analytics/services/daily-summary.service";
import {
  DailySummaryDtoSchema,
  mapDailySummaryToDto,
} from "@/lib/dto/analytics.dto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const dateRaw = request.nextUrl.searchParams.get("date");
    const date = parseDate(dateRaw);

    const row = await DailySummaryService.getForDay(session.user.id, date);
    if (!row) {
      return NextResponse.json({ data: null });
    }

    const dto = strictDto(DailySummaryDtoSchema, mapDailySummaryToDto(row));
    return NextResponse.json({ data: dto });
  } catch (error) {
    console.error("[analytics/daily-summary] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao consultar resumo diário." },
      { status: 500 }
    );
  }
}

/** Aceita YYYY-MM-DD; sem parâmetro usa hoje (local). */
function parseDate(raw: string | null): Date {
  if (!raw) return new Date();
  const [y, m, d] = raw.split("-").map(Number);
  if (!y || !m || !d) return new Date();
  return new Date(y, m - 1, d);
}
