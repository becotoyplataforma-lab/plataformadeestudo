/**
 * GET /api/admin/contest-intelligence?edital_id=... — análise de banca/edital (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import {
  ContestIntelligenceService,
  ContestIntelligenceError,
} from "@/lib/contest/services/contest-intelligence.service";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const editalId = request.nextUrl.searchParams.get("edital_id");
    const parsed = z.string().uuid().safeParse(editalId ?? "");
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", message: "edital_id (UUID) é obrigatório." },
        { status: 400 }
      );
    }

    const result = await ContestIntelligenceService.analyze(parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof ContestIntelligenceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "EDITAL_NOT_FOUND" ? 404 : 422 }
      );
    }
    console.error("[admin/contest-intelligence] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
