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
import { ApostilaTransformService } from "@/lib/knowledge/services/apostila-transform.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";
import { rateLimit } from "@/lib/security/rate-limit";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";
import { createHash } from "node:crypto";
import { McpError } from "@/lib/knowledge/mcp/contracts";
import { assertMcpCapability, resolveMcpProvider } from "@/lib/knowledge/mcp/registry";
import { readMcpProviderId } from "@/lib/validations/knowledge";
import {
  ScopeError,
  validateDocumentScope,
  type ResolvedDocumentScope,
} from "@/lib/knowledge/security/document-scope";

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

    // 1a. REGRA DE NEGÓCIO: upload de apostilas é EXCLUSIVO de admin e
    // professor (allowlist PROFESSOR_EMAILS). Alunos NUNCA enviam apostilas
    // — apenas visualizam e estudam.
    const canUpload = await AdminGuardService.isProfessorOrAdmin(
      session.user.email
    ).catch(() => false);
    if (!canUpload) {
      return NextResponse.json(
        {
          error: "FORBIDDEN",
          message: "Apenas administradores e professores podem enviar apostilas.",
        },
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
    // Flag opcional: transformar a apostila no layout em fases com a marca
    // DeepSeek (padrão: false). A IA reconstrói o conteúdo preservando tudo.
    const transformar = formData.get("transformar") === "true";
    // MCP de processamento: campo ausente significa provedor padrao; valor
    // malformado vira 422 sanitizado, nunca mensagem crua do zod.
    const mcpField = readMcpProviderId(formData.get("mcp_provider_id"));
    if (!mcpField.ok) {
      return NextResponse.json(
        { error: "INVALID_MCP_PROVIDER", message: mcpField.message },
        { status: 422 }
      );
    }
    // A capacidade ingest e checada no backend, nao na UI: provedor sem ela
    // responde 422 MCP_CAPABILITY_UNAVAILABLE antes de qualquer escrita.
    const mcpProvider = assertMcpCapability(resolveMcpProvider(mcpField.id).id, "ingest");

    if (!file) {
      return NextResponse.json(
        { error: "Arquivo não encontrado no corpo da requisição" },
        { status: 400 }
      );
    }

    // Escopo de compartilhamento validado ANTES de qualquer escrita: cargo e
    // edital precisam existir, seguir vivos e pertencer ao mesmo concurso.
    // Id inventado nao deixa documento orphan nem vira material aberto.
    let requestedScope: ResolvedDocumentScope = { positionId: null, editalId: null };
    if (positionId || editalId) {
      requestedScope = await validateDocumentScope({ positionId, editalId });
    }

    // 3. Upload via Ingestion Service (validação + registro no banco)
    const buffer = Buffer.from(await file.arrayBuffer());
    const mcpPlan = await mcpProvider.plan({
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      sha256: createHash("sha256").update(buffer).digest("hex"),
    });
    if (mcpPlan.classification !== "supported") {
      return NextResponse.json(
        {
          error: "MCP_REJECTED",
          message:
            mcpPlan.reason ?? "Documento fora do escopo do MCP selecionado.",
        },
        { status: 422 }
      );
    }

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
    // O buffer e lido antes da ingestao: o plano MCP precisa dele.
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

    // 5a. Transformação automática (layout em fases + marca DeepSeek).
    // Admin/professor pode optar por não transformar; alunos nunca passam
    // por aqui (403 acima). A transformação NUNCA quebra o upload: se a IA
    // falhar, o documento continua processado normalmente.
    if (transformar) {
      try {
        await ApostilaTransformService.transformDocument({
          documentId: result.documentId,
          saveHtml: true,
        });
      } catch (error) {
        console.error("[knowledge/upload] Transformação IA falhou:", error);
      }
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
    let effectiveEditalId: string | null = requestedScope.editalId;
    let effectivePositionId: string | null = requestedScope.positionId;
    if (!effectiveEditalId && !effectivePositionId && !admin) {
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

    // Metadados do MCP vao para documents.metadata (merge JSONB), sem migracao.
    await DocumentRepository.updateMetadata(result.documentId, {
      mcp_provider_id: mcpPlan.providerId,
      mcp_version: mcpPlan.providerVersion,
      processing_version: mcpPlan.processingVersion,
      lesson_order: mcpPlan.lessonOrder ?? null,
      variant: mcpPlan.variant ?? null,
      indexed_by_default: mcpPlan.indexedByDefault,
      mcp: {
        providerId: mcpPlan.providerId,
        providerVersion: mcpPlan.providerVersion,
        processingVersion: mcpPlan.processingVersion,
        classification: mcpPlan.classification,
        variant: mcpPlan.variant ?? null,
        indexedByDefault: mcpPlan.indexedByDefault,
      },
    }).catch((error) => {
      // O documento ja foi ingerido e indexado: a ausencia do carimbo MCP nao
      // pode transformar um upload bem-sucedido em 500, mas fica registrada.
      console.error("[knowledge/upload] Metadados MCP nao persistidos:", error);
    });

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
    if (error instanceof ScopeError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof McpError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    if (error instanceof IngestionError) {
      // Quota maxDocuments (FASE 3C-5C): 429 com resource/limit/current/resetAt.
      // Quota de bytes existente (validateQuota) continua 413 — não misturar.
      if (
        error.code === "QUOTA_EXCEEDED" &&
        (error.details as { resource?: unknown } | undefined)?.resource ===
          "documents"
      ) {
        const details = error.details as {
          limit?: unknown;
          current?: unknown;
        };
        return NextResponse.json(
          {
            error: "QUOTA_EXCEEDED",
            message: error.message,
            resource: "documents",
            limit: details.limit,
            current: details.current,
            resetAt: null,
          },
          { status: 429 }
        );
      }
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
