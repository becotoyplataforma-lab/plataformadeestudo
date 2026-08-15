/**
 * GET/DELETE /api/knowledge/documents/[id]
 *
 * GET: detalhes (dono ou admin).
 * DELETE: soft delete (dono ou admin) — não remove o arquivo físico.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getAdminSession } from "@/lib/administration/session";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const admin = await getAdminSession().catch(() => null);
    if (doc.userId !== session.user.id && !admin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    return NextResponse.json(mapDocumentToDto(doc));
  } catch (error) {
    console.error("[knowledge/documents/[id]] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const admin = await getAdminSession().catch(() => null);
    if (doc.userId !== session.user.id && !admin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    await DocumentRepository.softDelete(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[knowledge/documents/[id] DELETE] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
