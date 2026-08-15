/**
 * POST /api/admin/documents/[id]/review — aprova/rejeita conteúdo (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";

const ReviewSchema = z.object({
  action: z.enum(["aprovar", "rejeitar", "voltar_pendente"]),
  note: z.string().max(1000).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const { id } = await params;
    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json(
        { error: "DOC_NOT_FOUND", message: "Documento não encontrado." },
        { status: 404 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = ReviewSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const status =
      parsed.data.action === "aprovar"
        ? "aprovado"
        : parsed.data.action === "rejeitar"
          ? "rejeitado"
          : "pendente";

    const row = await DocumentRepository.updateReview(id, {
      reviewStatus: status,
      reviewedBy: admin.userId,
      reviewNote: parsed.data.note ?? null,
      reviewedAt: new Date(),
    });

    return NextResponse.json(
      { document: row ? mapDocumentToDto(row) : null, review_status: status },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    console.error("[admin/documents/review] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao revisar o documento." },
      { status: 500 }
    );
  }
}
