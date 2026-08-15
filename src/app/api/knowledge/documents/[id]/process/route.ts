/**
 * POST /api/knowledge/documents/[id]/process
 *
 * Reexecuta o pipeline de um documento (retry seguro).
 * Dono do documento ou admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getAdminSession } from "@/lib/administration/session";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentPipelineService, PipelineError } from "@/lib/knowledge/services/document-pipeline.service";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Documento não encontrado." }, { status: 404 });
    }

    const admin = await getAdminSession().catch(() => null);
    const isOwner = doc.userId === session.user.id;
    if (!isOwner && !admin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const result = await DocumentPipelineService.processDocument(id);
    const finalDoc = await DocumentRepository.findById(id);

    return NextResponse.json({
      pipeline: result,
      document: finalDoc ? mapDocumentToDto(finalDoc) : null,
    });
  } catch (error) {
    if (error instanceof PipelineError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 422 }
      );
    }
    console.error("[knowledge/documents/process] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao processar documento." },
      { status: 500 }
    );
  }
}
