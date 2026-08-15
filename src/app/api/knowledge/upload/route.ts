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
import { getAdminSession } from "@/lib/administration/session";
import { IngestionService, IngestionError } from "@/lib/knowledge/services/ingestion.service";
import { DocumentStorageService } from "@/lib/knowledge/storage.service";
import { DocumentPipelineService } from "@/lib/knowledge/services/document-pipeline.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
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
    const subjectId = formData.get("subject_id") as string | null;
    const editalId = formData.get("edital_id") as string | null;
    const positionId = formData.get("position_id") as string | null;

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado no corpo da requisição" },
        { status: 400 }
      );
    }

    // 3. Upload via Ingestion Service (validação + registro no banco)
    const result = await IngestionService.ingest({
      userId,
      file,
      sourceType: sourceType as "upload" | "edital" | "url",
      sourceUrl: sourceUrl ?? undefined,
      externalId: externalId ?? undefined,
    });

    // 4. Armazenamento físico (Supabase Storage, bucket privado)
    const buffer = Buffer.from(await file.arrayBuffer());
    await DocumentStorageService.upload({
      userId,
      documentId: result.documentId,
      fileName: file.name,
      buffer,
      mimeType: result.mimeType,
    });

    // 5. Pipeline real: extração → chunking → embedding (quando configurado)
    try {
      await DocumentPipelineService.processDocument(result.documentId);
    } catch (error) {
      // O pipeline já marca o documento como failed; segue para a resposta.
      console.error("[knowledge/upload] Processamento falhou:", error);
    }

    // 5b. Associação admin (matéria/edital/cargo) quando informada
    const admin = await getAdminSession().catch(() => null);
    if (admin && (subjectId || editalId || positionId)) {
      if (subjectId) {
        await DocumentSubjectRepository.upsert(result.documentId, subjectId, 100).catch(
          () => undefined
        );
      }
      if (editalId || positionId) {
        await DocumentRepository.updateAssociations(result.documentId, {
          editalId: editalId ?? null,
          positionId: positionId ?? null,
        }).catch(() => undefined);
      }
    }

    // 6. Estado final do documento
    const finalDoc = await DocumentRepository.findById(result.documentId);
    const dto = finalDoc
      ? mapDocumentToDto(finalDoc)
      : mapDocumentToDto({
          id: result.documentId,
          userId,
          type: "txt",
          title: file.name,
          storagePath: result.storagePath,
          status: "pending" as const,
          fileSize: result.fileSize,
          mimeType: result.mimeType,
          sourceType: sourceType as "upload" | "edital" | "url",
          sourceUrl: sourceUrl ?? null,
          externalId: externalId ?? null,
          metadata: {},
          pageCount: null,
          chunkCount: 0,
          embeddingCount: 0,
          processingError: null,
          editalId: null,
          positionId: null,
          processedAt: null,
          deletedAt: null,
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
