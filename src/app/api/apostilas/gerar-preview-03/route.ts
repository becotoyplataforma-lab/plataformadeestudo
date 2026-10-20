import { NextResponse } from "next/server";
import { gerarAula03Preview } from "@/lib/apostilas/gerador-aula-03";

export async function GET() {
  try {
    const res = gerarAula03Preview();
    return NextResponse.json({
      status: "ok",
      url: "/preview/aula-03-preview.html#s01",
      ...res,
    });
  } catch (error: any) {
    console.error("[api/gerar-preview-03] Erro:", error);
    return NextResponse.json({ status: "error", error: error?.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
