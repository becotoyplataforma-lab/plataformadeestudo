import { NextResponse } from "next/server";
import { gerarAula04Preview } from "@/lib/apostilas/gerador-aula-04";

export async function GET() {
  try {
    const res = gerarAula04Preview();
    return NextResponse.json({
      status: "ok",
      url: "/preview/aula-04-preview.html#s01",
      ...res,
    });
  } catch (error: any) {
    console.error("[api/gerar-preview-04] Erro:", error);
    return NextResponse.json({ status: "error", error: error?.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
