import { NextResponse } from "next/server";
import { gerarAula05Preview } from "@/lib/apostilas/gerador-aula-05";

export async function GET() {
  try {
    const res = gerarAula05Preview();
    return NextResponse.json({
      status: "ok",
      url: "/preview/aula-05-preview.html#s01",
      ...res,
    });
  } catch (error: any) {
    console.error("[api/gerar-preview-05] Erro:", error);
    return NextResponse.json({ status: "error", error: error?.message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
