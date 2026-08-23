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
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { getProfile } from "@/lib/db/repositories/perfil";
import { getCurrentEditalByContest } from "@/lib/db/repositories/edital";
import { IngestionService, IngestionError } from "@/lib/knowledge/services/ingestion.service";
import { DocumentStorageService } from "@/lib/knowledge/storage.service";
import { DocumentPipelineService } from "@/lib/knowledge/services/document-pipeline.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";
import { rateLimit } from "@/lib/security/rate-limit";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";

// Rate limit por plano (uploads/hora): Free 10/h, Pro 50/h, Intensivo 100/h.
const UPLOAD_WINDOW_MS = 60 * 60 * 1000;
const UPLOAD_LIMITS: Record<string, number> = {
  free: 10,
  pro: 50,
  intensivo: 100,
};

export async function POST(request: NextRequest) {
  try {
    // 1. Autenticação
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const userId = session.user.id;

    // 1a. REGRA DE NEGÓCIO: upload de apostilas é EXCLUSIVO de admin.
    // Alunos NUNCA enviam apostilas — apenas visualizam e estudam.
    const isAdmin = await AdminGuardService.isAdminEmail(session.user.email).catch(
      () => false
    );
    if (!isAdmin) {
      return NextResponse.json(
        { error: "FORBIDDEN", message: "Apenas administradores podem enviar apostilas." },
        { status: 403 }
      );
    }

    // 1b. Rate limit por plano (uploads/hora).
    const entitlement = await EntitlementService.getCurrent(userId).catch(() => null);
    const planCode = entitlement?.planCode ?? "free";
    const uploadLimit = UPLOAD_LIMITS[planCode] ?? UPLOAD_LIMITS.free;
    const rl = rateLimit("knowledge-upload", `user:${userId}`, uploadLimit, UPLOAD_WINDOW_MS);
    if (!rl.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: `Você atingiu o limite de uploads do seu plano (${uploadLimit}/hora). Tente novamente em 1 hora.`,
        },
        { status: 429 }
      );
    }

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
    // Usa o nome sanitizado do storagePath (gerado pelo IngestionService)
    // para evitar path traversal e inconsistência com o registro no banco.
    const buffer = Buffer.from(await file.arrayBuffer());
    const safeFileName = result.storagePath.split("/").pop() ?? file.name;
    await DocumentStorageService.upload({
      userId,
      documentId: result.documentId,
      fileName: safeFileName,
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

    // 5b. Associação (matéria/edital/cargo)
    const admin = await getAdminSession().catch(() => null);

    // Matéria: qualquer usuário autenticado pode vincular sua própria apostila.
    if (subjectId) {
      await DocumentSubjectRepository.upsert(result.documentId, subjectId, 100).catch(
        () => undefined
      );
    }

    // Edital/cargo: admin informa explicitamente; aluno herda do perfil (best-effort).
    let effectiveEditalId = admin ? editalId : null;
    let effectivePositionId = admin ? positionId : null;
    if (!admin) {
      const profile = await getProfile(userId).catch(() => null);
      if (profile?.contest_id) {
        const current = await getCurrentEditalByContest(profile.contest_id).catch(
          () => null
        );
        if (current) effectiveEditalId = current.id;
        effectivePositionId = profile.position_id ?? null;
      }
    }
    if (effectiveEditalId || effectivePositionId) {
      await DocumentRepository.updateAssociations(result.documentId, {
        editalId: effectiveEditalId ?? null,
        positionId: effectivePositionId ?? null,
      }).catch(() => undefined);
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
        INVALID_CONTENT: 400,
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
