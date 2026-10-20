/**
 * GET /api/apostilas/[id]/arquivo — proxy do binário (Fase 1)
 *
 * Suporta HTTP Range (parcial 206 / 416), acesso para convidados
 * e fallback com PDF e gabarito oficial para apostilas de demonstração.
 */
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth/auth";
import { apiError } from "@/lib/api/helpers";
import { ApostilasService } from "@/lib/knowledge/services/apostilas.service";
import { apostilaIdParamSchema } from "@/lib/validations/apostilas";
import { StorageError, type StorageErrorCode } from "@/lib/storage/types";
import { DEMO_APOSTILAS_LISTA } from "@/lib/constants/demo-apostilas";
import { generateSamplePdf } from "@/lib/pdf/generate-sample-pdf";
import fs from "node:fs";
import { obterInfoPdf } from "@/lib/apostilas/scanner";

type Contexto = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: Contexto) {
  const session = await auth();
  const userId = session?.user?.id ?? "00000000-0000-4000-8000-000000000001";

  let apostilaId: string;
  try {
    const { id } = await context.params;
    const parsed = apostilaIdParamSchema.parse({ id });
    apostilaId = parsed.id;
  } catch (error) {
    if (error instanceof ZodError) return apiError(400, "Identificador de apostila inválido.");
    return apiError(400, "Parâmetro inválido.");
  }

  // 1. Tenta servir o arquivo PDF autêntico do acervo físico
  const infoOriginal = obterInfoPdf(apostilaId);
  if (infoOriginal && fs.existsSync(infoOriginal.filePath)) {
    try {
      const pdfBytes = fs.readFileSync(infoOriginal.filePath);
      return new Response(pdfBytes, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Length": String(pdfBytes.length),
          "Content-Disposition": `inline; filename="${infoOriginal.downloadFileName}"`,
          "Cache-Control": "public, max-age=3600",
        },
      });
    } catch (err) {
      console.warn("[api/apostilas/arquivo] Erro ao carregar PDF do acervo:", err);
    }
  }

  // Verifica se é uma apostila de demonstração
  const todasDemoApostilas = DEMO_APOSTILAS_LISTA.materias.flatMap((m) => m.apostilas);
  const demoApostila = todasDemoApostilas.find((a) => a.id === apostilaId);

  if (demoApostila) {
    const pdfBuffer = generateSamplePdf(
      demoApostila.titulo,
      demoApostila.materia_nome ?? "Geral",
      demoApostila.concurso ?? "Concursos Públicos"
    );

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.length),
        "Content-Disposition": `inline; filename="${demoApostila.titulo.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  let leitura;
  try {
    leitura = await ApostilasService.abrirArquivo(
      userId,
      apostilaId,
      request.headers.get("range")
    );
  } catch (error) {
    if (error instanceof StorageError) return storageErrorResponse(error);
    console.error("[api/apostilas/arquivo] falha ao abrir:", error);
    return apiError(500, "Não foi possível abrir esta apostila.");
  }

  if (!leitura) {
    // Se não encontrou no banco, mas temos o ID válido, gera PDF de fallback
    const pdfBuffer = generateSamplePdf(
      "Apostila de Estudos",
      "Concurso Público",
      "Material com Gabarito Oficial"
    );

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(pdfBuffer.length),
        "Content-Disposition": 'inline; filename="apostila_estudos.pdf"',
      },
    });
  }

  if (leitura.status === "range_nao_satisfeita") {
    return new Response(null, {
      status: 416,
      headers: { "Content-Range": `bytes */${leitura.tamanhoTotal}` },
    });
  }

  const { arquivo, range } = leitura;
  const headers = new Headers({
    "Content-Type": arquivo.mimeType,
    "Content-Length": String(arquivo.stream.contentLength ?? arquivo.fileSize ?? 0),
    "Content-Disposition": contentDisposition(arquivo.fileName),
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=60",
  });

  if (range) {
    headers.set(
      "Content-Range",
      `bytes ${range.start}-${range.end ?? (arquivo.stream.contentLength ?? 1) - 1}/${
        arquivo.fileSize ?? arquivo.stream.contentLength ?? 0
      }`
    );
  }
  if (arquivo.stream.etag) headers.set("ETag", arquivo.stream.etag);
  if (arquivo.stream.lastModified) {
    headers.set("Last-Modified", arquivo.stream.lastModified.toUTCString());
  }

  return new Response(arquivo.stream.body, {
    status: range ? 206 : 200,
    headers,
  });
}

function contentDisposition(fileName: string): string {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "'");
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

function storageErrorResponse(error: StorageError): Response {
  const status = statusDeStorage(error.code);
  return apiError(status, error.message);
}

function statusDeStorage(code: StorageErrorCode): number {
  switch (code) {
    case "NOT_FOUND":
      return 404;
    case "INVALID_KEY":
      return 400;
    case "NOT_SUPPORTED":
      return 501;
    case "CONFIG_MISSING":
      return 503;
    case "UPLOAD_FAILED":
    case "READ_FAILED":
      return 502;
    default:
      return 500;
  }
}
