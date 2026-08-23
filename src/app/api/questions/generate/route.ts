/**
 * POST /api/questions/generate
 *
 * Geração de questões do ALUNO a partir de UMA apostila própria, cruzada com
 * a matéria/peso do edital do concurso dele. Questões entram EM REVISÃO.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { getProfile } from "@/lib/db/repositories/perfil";
import { getEditalSubjectWeight } from "@/lib/db/repositories/edital";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { rateLimit } from "@/lib/security/rate-limit";
import {
  QuestionGenerationService,
  GenerationServiceError,
} from "@/lib/ai/services/question-generation.service";
import { QuestionGenerationError } from "@/lib/ai/generation/question-generation.provider";
import { ProviderError } from "@/lib/ai/services/deepseek-provider.service";

// TODO: migrar rate limiter para Redis/Upstash quando escalar para múltiplas réplicas
const GenerateSchema = z.object({
  document_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(20).default(5),
  nivel: z.enum(["facil", "medio", "dificil"]).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const userId = session.user.id;

    // Rate limit de curto prazo (anti-abuso): 10 gerações/minuto por usuário.
    const burstRl = rateLimit("questions-burst", `user:${userId}`, 10, 60 * 1000);
    if (!burstRl.allowed) {
      return NextResponse.json(
        {
          error: "RATE_LIMIT_EXCEEDED",
          message: "Muitas gerações em sequência. Aguarde alguns segundos e tente novamente.",
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    const parsed = GenerateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const doc = await DocumentRepository.findById(parsed.data.document_id);
    if (!doc) {
      return NextResponse.json(
        { error: "NOT_FOUND", message: "Apostila não encontrada." },
        { status: 404 }
      );
    }
    if (doc.userId !== userId) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }
    if (doc.status !== "chunked" && doc.status !== "indexed") {
      return NextResponse.json(
        {
          error: "DOC_NOT_READY",
          message: `Apostila em estado ${doc.status}. Aguarde o processamento terminar (ou reprocesse) antes de gerar questões.`,
        },
        { status: 422 }
      );
    }

    const profile = await getProfile(userId);
    let editalId: string | undefined;
    let editalWeight: number | undefined;
    if (profile?.contest_id) {
      const w = await getEditalSubjectWeight(
        profile.contest_id,
        profile.position_id ?? null,
        parsed.data.subject_id
      ).catch(() => null);
      if (w) {
        editalId = w.editalId;
        editalWeight = w.weight;
      }
    }

    const result = await QuestionGenerationService.generateFromDocument({
      adminUserId: userId,
      documentId: parsed.data.document_id,
      subjectId: parsed.data.subject_id,
      quantity: parsed.data.quantity,
      nivel: parsed.data.nivel,
      editalId,
      positionId: profile?.position_id ?? undefined,
      editalWeight,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof GenerationServiceError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "DOC_NOT_FOUND" ? 404 : 422 }
      );
    }
    if (error instanceof QuestionGenerationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: 502 }
      );
    }
    if (error instanceof ProviderError || (error instanceof Error && error.message.includes("DEEPSEEK_API_KEY"))) {
      return NextResponse.json(
        {
          error: "AI_NOT_CONFIGURED",
          message: "O serviço de IA não está configurado. Tente novamente em instantes.",
        },
        { status: 503 }
      );
    }
    console.error("[questions/generate] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao gerar questões." },
      { status: 500 }
    );
  }
}
