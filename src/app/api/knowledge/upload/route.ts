/**
 * POST /api/knowledge/upload
 *
 * Upload de documento para o Knowledge Core.
 * Autenticação obrigatória. Rate limit por plano.
 *
 * Segue: .ai/blueprints/01-ingestion.blueprint.md
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { IngestionService, IngestionError } from "@/lib/knowledge/services/ingestion.service";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    // 2. Parse do form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sourceType = (formData.get("source_type") as string) || "upload";
    const sourceUrl = formData.get("source_url") as string | null;
    const externalId = formData.get("external_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado no corpo da requisição" },
        { status: 400 }
      );
    }

    // 3. Upload via Ingestion Service
    const result = await IngestionService.ingest({
      userId,
      file,
      sourceType: sourceType as "upload" | "edital" | "url",
      sourceUrl: sourceUrl ?? undefined,
      externalId: externalId ?? undefined,
    });

    // 4. Retornar DTO
    const dto = mapDocumentToDto({
      id: result.documentId,
      userId,
      type: "txt", // fallback; o tipo real é mapeado no service
      title: file.name,
      storagePath: result.storagePath,
      status: "pending" as const,
      fileSize: result.fileSize,
      mimeType: result.mimeType,
      sourceType: sourceType as "upload" | "edital" | "url",
      sourceUrl: sourceUrl ?? null,
      externalId: externalId ?? null,
      metadata: {},
      createdAt: result.createdAt,
      updatedAt: result.createdAt,
    } as Parameters<typeof mapDocumentToDto>[0]);

    return NextResponse.json({ document: dto }, { status: 201 });
  } catch (error) {
    if (error instanceof IngestionError) {
      const statusMap: Record<string, number> = {
        DUPLICATE_FILE: 409,
        QUOTA_EXCEEDED: 413,
        INVALID_TYPE: 400,
        FILE_TOO_LARGE: 413,
        UPLOAD_FAILED: 500,
      };
      return NextResponse.json(
        {
          error: error.code,
          message: error.message,
          ...(error.details ?? {}),
        },
        { status: statusMap[error.code] ?? 500 }
      );
    }

    console.error("[knowledge/upload] Erro inesperado:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
