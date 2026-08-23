/**
 * POST /api/documents/consolidate — consolida N apostilas da mesma matéria.
 * Funciona para aluno (próprias apostilas) e admin (qualquer apostila).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getAdminSession } from "@/lib/administration/session";
import {
  ConsolidationService,
  ConsolidationError,
} from "@/lib/knowledge/services/consolidation.service";
import { ProviderError } from "@/lib/ai/services/deepseek-provider.service";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { mapDocumentToDto } from "@/lib/dto/knowledge.dto";
import { rateLimit } from "@/lib/security/rate-limit";

// TODO: migrar rate limiter para Redis/Upstash quando escalar para múltiplas réplicas
const ConsolidateSchema = z.object({
  document_ids: z.array(z.string().uuid()).min(2).max(10),
  subject_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const admin = await getAdminSession().catch(() => null);

    // Rate limit de curto prazo (anti-abuso): 10 consolidações/minuto por usuário.
    const burstRl = rateLimit("consolidate-burst", `user:${session.user.id}`, 10, 60 * 1000);
    if (!burstRl.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "Muitas consolidações em sequência. Aguarde alguns segundos e tente novamente.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = ConsolidateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await ConsolidationService.consolidate({
      userId: session.user.id,
      isAdmin: Boolean(admin),
      documentIds: parsed.data.document_ids,
      subjectId: parsed.data.subject_id,
    });

    const finalDoc = await DocumentRepository.findById(result.documentId);
    return NextResponse.json(
      {
        document: finalDoc ? mapDocumentToDto(finalDoc) : null,
        ...result,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ConsolidationError) {
      const status =
        error.code === "DOC_NOT_FOUND"
          ? 404
          : error.code === "FORBIDDEN"
            ? 403
            : error.code === "AI_NOT_CONFIGURED"
              ? 503
              : 422;
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status }
      );
    }
    if (error instanceof ProviderError) {
      return NextResponse.json(
        { error: "PROVIDER_FAILED", message: error.message },
        { status: 502 }
      );
    }
    console.error("[documents/consolidate] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao consolidar as apostilas." },
      { status: 500 }
    );
  }
}
