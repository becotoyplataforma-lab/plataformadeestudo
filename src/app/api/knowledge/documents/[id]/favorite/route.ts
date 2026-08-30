/**
 * PATCH /api/knowledge/documents/[id]/favorite
 *
 * Marca/desmarca uma apostila como favorita (apenas o dono ou admin).
 *
 * Body: { favorite: boolean }
 * Resposta: { ok: true, document: DocumentDto }
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getAdminSession } from "@/lib/administration/session";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await params;

    let favorite: boolean;
    try {
      const body = (await request.json()) as { favorite?: unknown };
      favorite = Boolean(body?.favorite);
    } catch {
      return NextResponse.json(
        { error: "BODY_INVALID", message: "Corpo JSON inválido." },
        { status: 400 }
      );
    }

    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json(
        { error: "DOC_NOT_FOUND", message: "Documento não encontrado." },
        { status: 404 }
      );
    }

    const admin = await getAdminSession().catch(() => null);
    if (doc.userId !== session.user.id && !admin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Sem permissão para favoritar esta apostila." },
        { status: 403 }
      );
    }

    const updated = await DocumentRepository.updateFavorite(
      id,
      session.user.id,
      favorite
    );
    if (!updated) {
      return NextResponse.json(
        { error: "DOC_NOT_FOUND", message: "Documento não encontrado." },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true, document: mapDocumentToDto(updated) });
  } catch (error) {
    console.error("[knowledge/documents/[id]/favorite] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
