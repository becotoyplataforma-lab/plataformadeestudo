/**
 * POST /api/knowledge/documents/[id]/transformar
 *
 * Transforma uma apostila existente no layout em fases com a marca DeepSeek.
 * Acesso: admin ou professor (allowlist). O dono do documento pode transformar
 * suas próprias apostilas.
 *
 * Body: { } — sem parâmetros.
 * Resposta: { document, transformed: true, htmlPreview? }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { ApostilaTransformService, ApostilaTransformError } from "@/lib/knowledge/services/apostila-transform.service";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";

export const dynamic = "force-dynamic";

export async function POST(
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
    if (!doc) {
      return NextResponse.json(
        { error: "DOC_NOT_FOUND", message: "Documento não encontrado." },
        { status: 404 }
      );
    }

    // Permissão: admin/superadmin OU professor OU dono do documento.
    const isStaff = await AdminGuardService.isProfessorOrAdmin(session.user.email).catch(
      () => false
    );
    if (!isStaff && doc.userId !== session.user.id) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Sem permissão para transformar esta apostila." },
        { status: 403 }
      );
    }

    const result = await ApostilaTransformService.transformDocument({
      documentId: id,
      saveHtml: true,
    });

    const finalDoc = await DocumentRepository.findById(id);
    return NextResponse.json(
      {
        transformed: true,
        title: result.title,
        document: finalDoc ? mapDocumentToDto(finalDoc) : null,
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof ApostilaTransformError) {
      const statusMap: Record<string, number> = {
        DOC_NOT_FOUND: 404,
        EXTRACTION_FAILED: 422,
        EMPTY_TEXT: 422,
        INVALID_RESPONSE: 502,
      };
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: statusMap[error.code] ?? 500 }
      );
    }
    console.error("[knowledge/transformar] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
