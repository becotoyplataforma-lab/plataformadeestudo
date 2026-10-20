/**
<<<<<<< HEAD
 * DELETE /api/knowledge/documents/[id]
 *
 * Remove um documento do Knowledge Core: soft delete da linha, vínculos, chunks
 * e os bytes no storage (getStorage().delete). A posse é verificada no servidor;
 * documento de outro usuário devolve 404 sem revelar existência (.ai/08).
 *
 * Segue: specs/knowledge-apostilas.md, ADR-011
 */
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { auth } from "@/lib/auth/auth";
import { apiError, apiOk } from "@/lib/api/helpers";
import { DocumentService } from "@/lib/knowledge/services/document.service";
import { documentIdParamSchema } from "@/lib/validations/documents";

type Contexto = { params: Promise<{ id: string }> };

export async function DELETE(_request: NextRequest, context: Contexto) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return apiError(401, "Você precisa estar autenticado.");

  try {
    const { id } = await context.params;
    const { id: documentId } = documentIdParamSchema.parse({ id });

    const resultado = await DocumentService.remover({ userId, documentId });
    if (resultado.status === "nao_encontrado") {
      return apiError(404, "Documento não encontrado.");
    }

    return apiOk({
      id: documentId,
      removido: true,
      bytes_removidos: resultado.bytesRemovidos,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return apiError(400, "Identificador de documento inválido.");
    }
    console.error("[api/knowledge/documents] falha ao remover:", error);
    return apiError(500, "Não foi possível remover este documento.");
=======
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
import {
  canAccessDocument,
  resolveAccessScope,
} from "@/lib/knowledge/security/document-access";

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
    const scope = await resolveAccessScope(session.user.id, session.user.email);
    if (!canAccessDocument(doc, { ...scope, isStaff: Boolean(admin) })) {
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
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
  }
}
