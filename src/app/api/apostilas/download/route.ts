/**
 * GET /api/apostilas/download — Download oficial da APOSTILA ADAPTADA em PDF
 *
 * Converte/serve a versão adaptada (DeepSeek, questões comentadas, teoria completa)
 * em formato PDF com cabeçalho attachment para download direto no navegador.
 */
import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { converterHtmlParaPdf } from "@/lib/apostilas/pdf-conversor";
import { APOSTILAS_PDF_CATALOG } from "@/lib/apostilas/scanner";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const aulaParam = searchParams.get("aula");
  const idParam = searchParams.get("id");
  const fileParam = searchParams.get("file") || searchParams.get("arquivo");
  const urlParam = searchParams.get("url");

  // Identificador prioritário
  let ident = aulaParam || idParam || fileParam || "01";

  if (urlParam && !aulaParam && !idParam && !fileParam) {
    const match = urlParam.match(/aula-(\d{1,2})/i);
    if (match) {
      ident = match[1];
    }
  }

  // Normaliza número da aula (01 .. 13)
  let numAula = "01";
  const numInt = parseInt(ident.replace(/\D/g, ""), 10);
  if (!isNaN(numInt) && numInt >= 1 && numInt <= 13) {
    numAula = String(numInt).padStart(2, "0");
  } else {
    // Tenta encontrar por ID no catálogo
    const encontradoPorId = APOSTILAS_PDF_CATALOG.find(
      (item) => item.id.toLowerCase() === ident.toLowerCase()
    );
    if (encontradoPorId) {
      numAula = encontradoPorId.aula;
    }
  }

  const dirAdaptadas = path.join(process.cwd(), "public", "apostilas-adaptadas");
  if (!fs.existsSync(dirAdaptadas)) {
    fs.mkdirSync(dirAdaptadas, { recursive: true });
  }

  const nomeArquivoDownload = `CBM-RJ_Portugues_Aula_${numAula}_Adaptada.pdf`;
  const pdfPath = path.join(dirAdaptadas, nomeArquivoDownload);
  const aliasPath = path.join(dirAdaptadas, `aula-${numAula}-adaptada.pdf`);

  // 1. Se o PDF da apostila adaptada ainda não existe, converte a partir do HTML adaptado
  if (!fs.existsSync(pdfPath) && !fs.existsSync(aliasPath)) {
    console.log(`[download] Gerando PDF da Apostila Adaptada Aula ${numAula}...`);
    const resultado = converterHtmlParaPdf(numAula);
    if (!resultado.sucesso) {
      console.error(`[download] Erro na conversão da Aula ${numAula}:`, resultado.erro);
      return NextResponse.json(
        {
          erro: "Não foi possível gerar o PDF da apostila adaptada.",
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
      {
        erro: "Arquivo PDF adaptado não encontrado após processamento.",
        aula: numAula,
      },
      { status: 404 }
    );
  }

  try {
    const pdfBuffer = fs.readFileSync(targetPath);

    return new Response(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nomeArquivoDownload}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (err: any) {
    console.error("[download] Erro ao ler PDF gerado:", err);
    return NextResponse.json(
      { erro: "Erro ao ler o arquivo PDF adaptado.", detalhe: err?.message },
      { status: 500 }
    );
  }
}
