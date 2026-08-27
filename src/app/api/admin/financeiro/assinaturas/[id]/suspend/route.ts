/**
 * Admin — Financeiro: Suspender assinatura
 *
 * POST /api/admin/financeiro/assinaturas/[id]/suspend (admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  AdminFinanceService,
  AdminFinanceError,
} from "@/lib/administration/services/admin-finance.service";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const { id } = await params;
    const row = await AdminFinanceService.suspendSubscription(admin, id);
    return NextResponse.json({ ok: true, subscription: row });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof AdminFinanceError) {
      const status = error.code === "NOT_FOUND" ? 404 : 422;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[admin/financeiro] Erro ao suspender:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao suspender assinatura." },
      { status: 500 }
    );
  }
}
