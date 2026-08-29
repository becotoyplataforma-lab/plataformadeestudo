/**
 * GET /api/knowledge/documents/[id]/transformado
 *
 * Serve o HTML transformado da apostila (layout em fases + marca DeepSeek).
 * Acesso autenticado e restrito ao dono do documento.
 * Suporta `?download=1` para baixar o arquivo .html.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { ApostilaTransformService } from "@/lib/knowledge/services/apostila-transform.service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const doc = await DocumentRepository.findById(id);
    if (!doc || doc.userId !== session.user.id) {
      return NextResponse.json({ error: "Documento não encontrado" }, { status: 404 });
    }

    const html = await ApostilaTransformService.downloadTransformed(id);
    if (!html) {
      return NextResponse.json(
        { error: "NOT_TRANSFORMED", message: "Apostila ainda não transformada." },
        { status: 404 }
      );
    }

    const url = new URL(_request.url);
    const download = url.searchParams.get("download") === "1";
    const safeTitle = (doc.title || "apostila").replace(/[^\w\d-]+/g, "_");

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": download
          ? `attachment; filename="${safeTitle}-em-fases.html"`
          : "inline",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("[knowledge/transformado] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
