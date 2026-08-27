/**
 * Admin — Financeiro: Resumo (KPIs)
 *
 * GET /api/admin/financeiro/summary — cards financeiros (admin)
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { AdminFinanceService } from "@/lib/administration/services/admin-finance.service";

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    const summary = await AdminFinanceService.summary(admin);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/financeiro/summary] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao obter resumo financeiro." },
      { status: 500 }
    );
  }
}
