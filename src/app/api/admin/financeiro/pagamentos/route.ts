/**
 * Admin — Financeiro: Pagamentos
 *
 * GET /api/admin/financeiro/pagamentos?status=&from=&to=&user_id=&limit=
 * Lista pagamentos com filtros (admin). Suporta `user_id` para o link
 * "Ver transações" da tela de alunos.
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
    const rows = await AdminFinanceService.listPayments(admin, {
      status: sp.get("status") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
      userId: sp.get("user_id") ?? undefined,
      limit: sp.get("limit") ? Number(sp.get("limit")) : undefined,
    });

    return NextResponse.json({ data: rows });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/financeiro/pagamentos] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao listar pagamentos." },
      { status: 500 }
    );
  }
}
