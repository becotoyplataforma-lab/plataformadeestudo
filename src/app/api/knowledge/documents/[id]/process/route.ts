/**
 * POST /api/knowledge/documents/[id]/process
 *
 * Reexecuta o pipeline de um documento (retry seguro).
 * Dono do documento ou admin.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getAdminSession } from "@/lib/administration/session";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentPipelineService, PipelineError } from "@/lib/knowledge/services/document-pipeline.service";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";
import { DEFAULT_MCP_PROVIDER_ID, McpError } from "@/lib/knowledge/mcp/contracts";
import { assertMcpCapability } from "@/lib/knowledge/mcp/registry";
import { readMcpProviderId } from "@/lib/validations/knowledge";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Documento não encontrado." }, { status: 404 });
    }

    const admin = await getAdminSession().catch(() => null);
    const isOwner = doc.userId === session.user.id;
    if (!isOwner && !admin) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    // Reprocessar admite trocar o MCP. Sem corpo, herda o provedor gravado no
    // documento. Provedor sem a capacidade reprocess devolve 422 explicito.
    const body = (await _request.json().catch(() => {})) as {
      mcp_provider_id?: unknown;
    };
    const mcpField = readMcpProviderId(
      typeof body.mcp_provider_id === "string" ? body.mcp_provider_id : null
    );
    if (!mcpField.ok) {
      return NextResponse.json(
        { error: "INVALID_MCP_PROVIDER", message: mcpField.message },
        { status: 422 }
      );
    }
    const storedMcp = (doc.metadata as { mcp?: { providerId?: string } } | null)
      ?.mcp?.providerId;
    const mcpProvider = assertMcpCapability(
      mcpField.id ?? storedMcp ?? DEFAULT_MCP_PROVIDER_ID,
      "reprocess"
    );

    // Reprocessar deixa rastro: provedor, versao do MCP e versao de processamento
    // usados nesta execucao. O bloco mcp existente e preservado para nao perder a
    // variante e a classificacao do upload original.
    const existingMcp =
      (doc.metadata as { mcp?: Record<string, unknown> } | null)?.mcp ?? {};
    const result = await DocumentPipelineService.processDocument(id);
    const finalDoc = await DocumentRepository.findById(id);

    await DocumentRepository.updateMetadata(id, {
      mcp_provider_id: mcpProvider.id,
      mcp_version: mcpProvider.version,
      processing_version: mcpProvider.processingVersion,
      mcp: {
        ...existingMcp,
        providerId: mcpProvider.id,
        providerVersion: mcpProvider.version,
        processingVersion: mcpProvider.processingVersion,
        reprocessedAt: new Date().toISOString(),
      },
    }).catch(() => undefined);

    return NextResponse.json({
      pipeline: result,
      mcp: {
        id: mcpProvider.id,
        version: mcpProvider.version,
        processingVersion: mcpProvider.processingVersion,
      },
      document: finalDoc ? mapDocumentToDto(finalDoc) : null,
    });
  } catch (error) {
    if (error instanceof McpError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.status }
      );
    }
    if (error instanceof PipelineError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "NOT_FOUND" ? 404 : 422 }
      );
    }
    console.error("[knowledge/documents/process] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao processar documento." },
      { status: 500 }
    );
  }
}
