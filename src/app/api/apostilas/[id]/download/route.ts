/**
 * GET /api/apostilas/[id]/download — Download direto de apostila adaptada por ID
 */
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { converterHtmlParaPdf } from "@/lib/apostilas/pdf-conversor";
import { APOSTILAS_PDF_CATALOG } from "@/lib/apostilas/scanner";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Contexto) {
  const { id } = await context.params;

  let numAula = "01";
  const item = APOSTILAS_PDF_CATALOG.find((cat) => cat.id.toLowerCase() === id.toLowerCase());
  if (item) {
    numAula = item.aula;
  } else {
    const numInt = parseInt(id.replace(/\D/g, ""), 10);
    if (!isNaN(numInt) && numInt >= 1 && numInt <= 13) {
      numAula = String(numInt).padStart(2, "0");
    }
  }

  const dirAdaptadas = path.join(process.cwd(), "public", "apostilas-adaptadas");
  if (!fs.existsSync(dirAdaptadas)) {
    fs.mkdirSync(dirAdaptadas, { recursive: true });
  }

  const nomeArquivoDownload = `CBM-RJ_Portugues_Aula_${numAula}_Adaptada.pdf`;
  const pdfPath = path.join(dirAdaptadas, nomeArquivoDownload);
  const aliasPath = path.join(dirAdaptadas, `aula-${numAula}-adaptada.pdf`);

  if (!fs.existsSync(pdfPath) && !fs.existsSync(aliasPath)) {
    const resultado = converterHtmlParaPdf(numAula);
    if (!resultado.sucesso) {
      return NextResponse.json(
        {
          erro: "Falha na geração do PDF adaptado.",
          detalhe: resultado.erro,
          aula: numAula,
        },
        { status: 500 }
      );
    }
  }

  const targetPath = fs.existsSync(pdfPath) ? pdfPath : aliasPath;

  if (!fs.existsSync(targetPath)) {
    return NextResponse.json(
      { erro: "Apostila adaptada em PDF não encontrada.", aula: numAula },
      { status: 404 }
    );
  }

  try {
    const fileBuffer = fs.readFileSync(targetPath);
    return new Response(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivoDownload}"`,
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { erro: "Erro ao abrir PDF adaptado.", detalhe: err?.message },
      { status: 500 }
    );
  }
}
