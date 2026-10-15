/**
 * GET /api/knowledge/documents/[id]/download
 *
 * Baixa o arquivo original de uma apostila. Acesso do dono ou de admin. O backend
 * usado e o que esta gravado no documento (documents.storage_backend), porque e isso
 * que mantem o periodo hibrido da migracao Supabase -> R2 sem fallback silencioso:
 * documento antigo sai do Supabase, documento novo sai do R2, e nenhum dos dois e
 * buscado no lugar errado por conveniencia.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { getAdminSession } from "@/lib/administration/session";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import {
  DocumentStorageService,
  StorageError,
} from "@/lib/knowledge/storage.service";
import { StorageBackendError } from "@/lib/knowledge/storage/backend";
import {
  canAccessDocument,
  resolveAccessScope,
} from "@/lib/knowledge/security/document-access";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Mensagem devolvida ao cliente por status. Nunca a mensagem do driver:
 * ela pode conter bucket, caminho interno ou credencial do servico.
 */
const SAFE_MESSAGE: Record<number, string> = {
  503: "Backend de armazenamento não configurado.",
  404: "Arquivo não encontrado.",
  500: "Falha ao baixar o arquivo.",
};

/** Nome de arquivo seguro para o Content-Disposition (nunca o caminho). */
function safeName(storagePath: string): string {
  const base = storagePath.split("/").pop() ?? "documento";
  const cleaned = base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : "documento";
}

export async function GET(_request: NextRequest, ctx: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await ctx.params;
    const doc = await DocumentRepository.findById(id);
    if (!doc) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const admin = await getAdminSession().catch(() => null);
    const scope = await resolveAccessScope(session.user.id, session.user.email);
    if (!canAccessDocument(doc, { ...scope, isStaff: Boolean(admin) })) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    if (!doc.storagePath) {
      return NextResponse.json(
        { error: "STORAGE_PATH_MISSING" },
        { status: 404 }
      );
    }

    const buffer = await DocumentStorageService.download(
      doc.storagePath,
      doc.storageBackend as "r2" | "supabase" | undefined
    );

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition":
          "attachment; filename=\"" + safeName(doc.storagePath) + "\"",
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    // Documento sem storage_backend cai no backend global; se STORAGE_BACKEND
    // estiver ausente ou invalido (StorageBackendError), o cliente recebe 503
    // explicito - nunca 500 e nunca leitura em outro storage.
    if (error instanceof StorageBackendError) {
      console.error("[knowledge/download] backend indisponivel:", error.code);
      return NextResponse.json(
        { error: error.code, message: SAFE_MESSAGE[503] },
        { status: 503 }
      );
    }
    if (error instanceof StorageError) {
      // Backend ausente ou objeto inexistente nao sao erro do usuario: sao 503/404
      // explicitos, sem fallback para outro storage.
      const status =
        error.code === "R2_NOT_CONFIGURED" || error.code === "STORAGE_NOT_CONFIGURED"
          ? 503
          : error.code === "DOWNLOAD_FAILED"
            ? 404
            : 500;
      console.error("[knowledge/download] storage falhou:", error.code);
      return NextResponse.json(
        { error: error.code, message: SAFE_MESSAGE[status] ?? SAFE_MESSAGE[500] },
        { status }
      );
    }
    console.error("[knowledge/download] Erro:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
