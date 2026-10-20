import { NextResponse } from "next/server";
import { executarGeracaoAulas06a13 } from "@/lib/apostilas/executar-geracao-completa";

export async function GET() {
  try {
    const res = executarGeracaoAulas06a13();
    return NextResponse.json({
      status: "ok",
      totalAulas: res.length,
      aulas: res,
    });
  } catch (error: any) {
    console.error("[api/gerar-lote] Erro:", error);
    return NextResponse.json({ status: "error", error: error?.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
