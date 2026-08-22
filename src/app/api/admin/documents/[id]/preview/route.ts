/**
 * GET /api/admin/documents/[id]/preview — preview do texto extraído (chunks).
 */
import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentChunkRepository } from "@/lib/knowledge/repositories/chunk.repository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const { id } = await params;
    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json(
        { error: "DOC_NOT_FOUND", message: "Documento não encontrado." },
        { status: 404 }
      );
    }

    const chunks = await DocumentChunkRepository.listByDocument(id);
    const preview = chunks.slice(0, 8).map((c) => ({
      seq: c.seq,
      content: c.content.slice(0, 1200),
      characters: c.content.length,
    }));

    return NextResponse.json({
      document_id: id,
      title: doc.title,
      status: doc.status,
      review_status: doc.reviewStatus,
      chunk_count: doc.chunkCount,
      total_preview_chars: preview.reduce((acc, p) => acc + p.characters, 0),
      preview,
    });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/documents/preview] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao carregar o preview." },
      { status: 500 }
    );
  }
}
