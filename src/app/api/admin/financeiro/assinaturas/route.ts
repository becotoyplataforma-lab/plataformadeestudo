/**
 * Admin — Financeiro: Assinaturas
 *
 * GET /api/admin/financeiro/assinaturas?status=&plan_id=&limit=
 * Lista assinaturas com filtros (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { AdminFinanceService } from "@/lib/administration/services/admin-finance.service";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const rows = await AdminFinanceService.listSubscriptions(admin, {
      status: sp.get("status") ?? undefined,
      planId: sp.get("plan_id") ?? undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });

    return NextResponse.json({ data: rows });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/financeiro/assinaturas] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao listar assinaturas." },
      { status: 500 }
    );
  }
}
