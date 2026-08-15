/**
 * Admin — Questões (Curadoria)
 *
 * GET /api/admin/questions?status=&subject_id=&banca=&page=&page_size=
 *     — lista questões para curadoria (admin)
 */
import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/administration/session";
import { strictDto } from "@/lib/dto";
import { AdminError } from "@/lib/administration/services/admin-guard.service";
import {
  ModerationService,
  ModerationError,
} from "@/lib/administration/services/moderation.service";
import {
  ModerationListDtoSchema,
  mapModerationQuestionToDto,
} from "@/lib/dto/administration.dto";

export async function GET(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const status = sp.get("status") as
      | "rascunho"
      | "publicada"
      | "bloqueada"
      | "em_revisao"
      | "rejeitada"
      | null;
    const subjectId = sp.get("subject_id") ?? undefined;
    const banca = sp.get("banca") ?? undefined;
    const origin = sp.get("origin") ?? undefined;
    const sourceDocumentId = sp.get("source_document_id") ?? undefined;
    const difficultyRaw = sp.get("dificuldade");
    const difficulty =
      difficultyRaw === "facil" || difficultyRaw === "medio" || difficultyRaw === "dificil"
        ? difficultyRaw
        : undefined;
    const needsReviewParam = sp.get("needs_review");
    const page = Number(sp.get("page") ?? 1);
    const pageSize = Number(sp.get("page_size") ?? 20);

    const result = await ModerationService.listQuestions(admin, {
      status: status ?? undefined,
      subjectId,
      banca,
      origin,
      sourceDocumentId,
      difficulty,
      needsReview: needsReviewParam === null ? undefined : needsReviewParam === "true",
      page: Number.isNaN(page) ? 1 : Math.max(1, Math.floor(page)),
      pageSize: Number.isNaN(pageSize) ? 20 : Math.min(100, Math.max(1, Math.floor(pageSize))),
    });

    const dto = strictDto(
      ModerationListDtoSchema,
      {
        data: result.data.map((r) =>
          mapModerationQuestionToDto({
            id: r.id,
            subjectId: r.subjectId,
            subjectName: r.subjectName,
            banca: r.banca,
            ano: r.ano,
            nivel: r.nivel,
            enunciado: r.enunciado,
            status: r.status,
            isPublic: r.isPublic,
            origin: r.origin,
            fonte: r.fonte,
            confidence: r.confidence ? Number(r.confidence) : null,
            aiGenerated: r.aiGenerated,
            needsReview: r.needsReview,
            sourceDocumentId: r.sourceDocumentId,
            sourceChunkId: r.sourceChunkId,
            sourceEditalId: r.sourceEditalId,
            sourcePositionId: r.sourcePositionId,
            createdAt: r.createdAt,
          })
        ),
        total: result.total,
      }
    );
    return NextResponse.json(dto);
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof ModerationError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 400 });
    }
    console.error("[admin/questions] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao listar questões." },
      { status: 500 }
    );
  }
}
