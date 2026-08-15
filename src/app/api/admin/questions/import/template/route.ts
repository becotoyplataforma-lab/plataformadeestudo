/**
 * GET /api/admin/questions/import/template — modelo CSV para importação.
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";

const HEADERS = [
  "enunciado",
  "a",
  "b",
  "c",
  "d",
  "e",
  "gabarito",
  "explicacao",
  "nivel",
  "ano",
  "banca",
  "cargo",
  "fonte",
  "tema",
];

const SAMPLE = [
  "Qual é a capital do Brasil?",
  "Rio de Janeiro",
  "São Paulo",
  "Brasília",
  "Salvador",
  "Belo Horizonte",
  "C",
  "Brasília é a capital federal desde 1960.",
  "facil",
  "2024",
  "Cebraspe",
  "Analista",
  "prova anterior",
  "Geografia",
];

export async function GET() {
  try {
    const admin = await getAdminSession();
    if (!admin) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const csv = [
      HEADERS.join(";"),
      SAMPLE.join(";"),
      ";".repeat(HEADERS.length - 1), // linha em branco (exemplo 2)
    ].join("\n");

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="modelo-questoes.csv"',
      },
    });
  } catch {
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
