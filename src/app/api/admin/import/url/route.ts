/**
 * POST /api/admin/import/url — importa conteúdo externo por URL (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import { UrlImportService, UrlImportError } from "@/lib/knowledge/services/url-import.service";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";

const ImportSchema = z.object({
  url: z.string().url().max(2000),
  title: z.string().max(300).optional(),
  subject_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const body = await request.json().catch(() => null);
    const parsed = ImportSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await UrlImportService.importFromUrl({
      userId: admin.userId,
      url: parsed.data.url,
      title: parsed.data.title,
    });

    if (parsed.data.subject_id) {
      await DocumentSubjectRepository.upsert(result.documentId, parsed.data.subject_id, 100).catch(
        () => undefined
      );
    }

    const doc = await DocumentRepository.findById(result.documentId);
    return NextResponse.json(
      { document: doc ? mapDocumentToDto(doc) : { id: result.documentId }, imported: true },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof UrlImportError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "DUPLICATE_FILE" ? 409 : 422 }
      );
    }
    console.error("[admin/import/url] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao importar a URL." },
      { status: 500 }
    );
  }
}
