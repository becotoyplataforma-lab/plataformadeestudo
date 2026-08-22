/**
 * POST /api/admin/documents/[id]/fonte — registra fonte/licença do material (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";

const FonteSchema = z.object({
  fonte: z.string().max(300).optional(),
  licenca: z.string().max(120).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const { id } = await params;
    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "DOC_NOT_FOUND", message: "Documento não encontrado." }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = FonteSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ error: "Requisição inválida", details: parsed.error.issues }, { status: 400 });
    }

    const metadata: Record<string, unknown> = {};
    if (parsed.data.fonte !== undefined) metadata.fonte = parsed.data.fonte;
    if (parsed.data.licenca !== undefined) metadata.licenca = parsed.data.licenca;

    const row = await DocumentRepository.updateMetadata(id, metadata);
    return NextResponse.json({ ok: true, document: row ? { id: row.id } : null });
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/documents/fonte] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
