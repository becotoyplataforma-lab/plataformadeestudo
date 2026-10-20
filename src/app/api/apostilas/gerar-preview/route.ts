import { NextResponse } from "next/server";
import { gerarAula02Preview } from "@/lib/apostilas/gerador-aula-02";

export async function GET() {
  try {
    const res = gerarAula02Preview();
    return NextResponse.json({
      status: "ok",
      url: "/preview/aula-02-preview.html#s01",
      ...res,
    });
  } catch (error: any) {
    console.error("[api/gerar-preview] Erro:", error);
    return NextResponse.json({ status: "error", error: error?.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
