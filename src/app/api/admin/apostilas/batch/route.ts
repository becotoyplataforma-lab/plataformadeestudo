/**
 * POST /api/admin/apostilas/batch — upload em lote de apostilas (admin).
 * Exige vínculo a uma matéria (obrigatório) e aceita edital/cargo opcionais.
 * Processa cada arquivo com a mesma pipeline do upload individual e retorna
 * resultado por arquivo (fila visível na UI), sem falhar o lote inteiro.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import { IngestionService, IngestionError } from "@/lib/knowledge/services/ingestion.service";
import { DocumentStorageService } from "@/lib/knowledge/storage.service";
import { DocumentPipelineService } from "@/lib/knowledge/services/document-pipeline.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
import { createHash } from "node:crypto";
import { McpError } from "@/lib/knowledge/mcp/contracts";
import { assertMcpCapability, resolveMcpProvider } from "@/lib/knowledge/mcp/registry";
import { readMcpProviderId } from "@/lib/validations/knowledge";
import { ScopeError, validateDocumentScope } from "@/lib/knowledge/security/document-scope";

const MAX_FILES = 20;

/**
 * Mensagem fixa por codigo de dominio. O texto cru de PROCESSING_FAILED vem do
 * driver de storage ou do extrator e pode conter bucket, caminho absoluto ou
 * credencial de servico terceiro: fica no log do servidor, nunca na resposta.
 */
const PROCESSING_MESSAGES: Record<string, string> = {
  NO_STORAGE: "Documento sem arquivo fisico para processar.",
  EMPTY_TEXT: "Nenhum texto extraido. Provavel PDF escaneado: OCR ainda nao esta habilitado.",
  TRANSCRIPTION_NOT_CONFIGURED: "Audio ou video detectado: transcricao ainda nao esta configurada.",
  UNSUPPORTED_FORMAT: "Formato sem extrator de texto.",
  PROCESSING_FAILED: "Falha ao processar o arquivo.",
  NOT_FOUND: "Documento nao encontrado.",
};

export function safeProcessingMessage(code: string): string {
  return PROCESSING_MESSAGES[code] ?? "Falha ao processar o arquivo.";
}

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const formData = await request.formData();
    const subjectId = (formData.get("subject_id") as string) || "";
    const editalId = (formData.get("edital_id") as string) || null;
    const positionId = (formData.get("position_id") as string) || null;
    // O lote usa o mesmo MCP do upload individual. O backend valida sempre: o
    // seletor da UI e conveniencia, nao autorizacao.
    const mcpField = readMcpProviderId(
      formData.get("mcp_provider_id") as string | null
    );
    if (!mcpField.ok) {
      return NextResponse.json(
        { error: "INVALID_MCP_PROVIDER", message: mcpField.message },
        { status: 422 }
      );
    }
    // A capacidade ingest e checada no backend, nao na UI: provedor sem ela
    // responde 422 MCP_CAPABILITY_UNAVAILABLE antes de qualquer escrita.
    const mcpProvider = assertMcpCapability(resolveMcpProvider(mcpField.id).id, "ingest");

    // O escopo e validado uma vez por requisicao (nao por arquivo), depois do
    // admin confirmado: ids arbitrarios sao recusados antes de qualquer escrita.
    const scope = await validateDocumentScope({ positionId, editalId });

    const fileEntries = Array.from(formData.entries()).filter(
      ([key]) => key === "files"
    );
    const files = fileEntries
      .map(([, v]) => v)
      .filter((v): v is File => v instanceof File && v.size > 0);

    if (!subjectId) {
      return NextResponse.json(
        { error: "SUBJECT_REQUIRED", message: "Vincule os arquivos a uma matéria." },
        { status: 400 }
      );
    }
    const parsed = z.string().uuid().safeParse(subjectId);
    if (!parsed.success) {
      return NextResponse.json({ error: "SUBJECT_INVALID", message: "Matéria inválida." }, { status: 400 });
    }
    if (files.length === 0) {
      return NextResponse.json(
        { error: "NO_FILES", message: "Nenhum arquivo enviado." },
        { status: 400 }
      );
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json(
        { error: "TOO_MANY_FILES", message: `Máximo de ${MAX_FILES} arquivos por lote.` },
        { status: 400 }
      );
    }

    const results: Array<{
      fileName: string;
      documentId?: string;
      status: string;
      error?: string;
      code?: string;
      /**
       * Estagio da conversao depois que o arquivo ja foi gravado. Separado do
       * status da linha porque criar o documento e processar o conteudo sao
       * duas coisas diferentes: o operador precisa ver o material que entrou e
       * ficou pendente sem que isso apareca como upload perdido.
       */
      processing?: {
        status: string;
        code?: string;
        error?: string;
      };
    }> = [];

    for (const file of files) {
      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        const plan = await mcpProvider.plan({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          sha256: createHash("sha256").update(buffer).digest("hex"),
        });
        if (plan.classification !== "supported") {
          results.push({
            fileName: file.name,
            status: "failed",
            code: "MCP_REJECTED",
            error: plan.reason ?? "Fora do escopo do MCP selecionado.",
          });
          continue;
        }

        const result = await IngestionService.ingest({
          userId: admin.userId,
          file,
          sourceType: "upload",
        });

        const safeFileName = result.storagePath.split("/").pop() ?? file.name;
        await DocumentStorageService.upload({
          documentId: result.documentId,
          userId: admin.userId,
          fileName: safeFileName,
          buffer,
          mimeType: result.mimeType,
        });

        let processing: (typeof results)[number]["processing"] = {
          status: "pending",
        };
        try {
          const pipe = await DocumentPipelineService.processDocument(
            result.documentId
          );
          processing = { status: pipe?.status ?? "processing" };
        } catch (error) {
          // O codigo vem da propriedade do erro, nao de instanceof: o teste de
          // rota mocka o servico e uma comparacao de classe quebraria justamente
          // o caminho que se quer observar. A tabela de mensagens e o que garante
          // que o texto cru do driver nao vaze.
          const raw =
            error && typeof error === "object"
              ? (error as { code?: unknown }).code
              : undefined;
          const code =
            typeof raw === "string" && PROCESSING_MESSAGES[raw]
              ? raw
              : "PROCESSING_FAILED";
          console.error(
            "[admin/apostilas/batch] Conversao falhou em " + file.name + ": ",
            error
          );
          processing = {
            status: "failed",
            code,
            error: safeProcessingMessage(code),
          };
        }

        // Carimbo do MCP no documento, igual ao upload individual.
        await DocumentRepository.updateMetadata(result.documentId, {
          mcp_provider_id: plan.providerId,
          mcp_version: plan.providerVersion,
          processing_version: plan.processingVersion,
          lesson_order: plan.lessonOrder ?? null,
          variant: plan.variant ?? null,
          mcp: {
            providerId: plan.providerId,
            providerVersion: plan.providerVersion,
            processingVersion: plan.processingVersion,
            classification: plan.classification,
            variant: plan.variant ?? null,
            indexedByDefault: plan.indexedByDefault,
          },
        }).catch(() => undefined);

        await DocumentSubjectRepository.upsert(result.documentId, subjectId, 100).catch(
          () => undefined
        );
        if (scope.editalId || scope.positionId) {
          await DocumentRepository.updateAssociations(result.documentId, {
            editalId: scope.editalId,
            positionId: scope.positionId,
          }).catch(() => undefined);
        }

        const doc = await DocumentRepository.findById(result.documentId);
        results.push({
          fileName: file.name,
          documentId: result.documentId,
          status: doc?.status ?? result.status,
          processing: {
            ...processing,
            status: doc?.status ?? processing.status,
          },
        });
      } catch (error) {
        if (error instanceof McpError) {
          results.push({
            fileName: file.name,
            status: "failed",
            code: error.code,
            error: error.message,
          });
        } else if (error instanceof IngestionError) {
          results.push({
            fileName: file.name,
            status: "failed",
            code: error.code,
            error: error.message,
          });
        } else {
          // Erro nao-dominiado: a mensagem crua pode expor host, caminho ou
          // credencial de servico terceiro. O log guarda o original; a
          // resposta leva apenas codigo de dominio e mensagem fixa.
          console.error("[admin/apostilas/batch] Falha no arquivo " + file.name + ":", error);
          results.push({
            fileName: file.name,
            status: "failed",
            code: "PROCESSING_FAILED",
            error: "Falha ao processar o arquivo.",
          });
        }
      }
    }

    const okCount = results.filter((r) => r.status !== "failed").length;
    const failCount = results.length - okCount;
    const processingFailedCount = results.filter(
      (r) => r.processing?.status === "failed"
    ).length;
    const awaitingIndexingCount = results.filter(
      (r) => r.processing?.status === "chunked"
    ).length;

    return NextResponse.json(
      {
        results,
        okCount,
        failCount,
        processingFailedCount,
        awaitingIndexingCount,
      },
      { status: failCount > 0 ? 207 : 201 }
    );
  } catch (error) {
    if (error instanceof ScopeError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 400 }
      );
    }
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    // Provedor MCP inexistente ou fora do contrato responde como no upload
    // individual: o status vem do proprio erro de dominio, nunca 500.
    if (error instanceof McpError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    console.error("[admin/apostilas/batch] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha no upload em lote." },
      { status: 500 }
    );
  }
}
