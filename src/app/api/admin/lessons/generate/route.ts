/**
 * POST /api/admin/lessons/generate — gera aula a partir de apostila (admin).
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession } from "@/lib/administration/session";
import {
  AdminGuardService,
  AdminError,
} from "@/lib/administration/services/admin-guard.service";
import {
  LessonGenerationService,
  LessonGenerationError,
} from "@/lib/ai/services/lesson-generation.service";

const GenerateSchema = z.object({
  document_id: z.string().uuid(),
  subject_id: z.string().uuid(),
  avatar_id: z.string().uuid().optional(),
  chapter: z.string().max(300).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const admin = await getAdminSession();
    if (!admin) return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    await AdminGuardService.requireAdmin(admin);

    const body = await request.json().catch(() => null);
    const parsed = GenerateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const lesson = await LessonGenerationService.generateFromDocument({
      userId: null,
      documentId: parsed.data.document_id,
      subjectId: parsed.data.subject_id,
      avatarId: parsed.data.avatar_id ?? null,
      chapter: parsed.data.chapter,
    });

    return NextResponse.json(
      {
        id: lesson.id,
        title: lesson.title,
        duracao_min: lesson.duracaoMin,
        roteiro: lesson.roteiro,
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof AdminError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 403 });
    }
    if (error instanceof LessonGenerationError) {
      return NextResponse.json(
        { error: error.code, message: error.message },
        { status: error.code === "DOC_NOT_FOUND" ? 404 : 502 }
      );
    }
    console.error("[admin/lessons/generate] Erro:", error);
    return NextResponse.json(
      { error: "Erro interno", message: "Falha ao gerar aula." },
      { status: 500 }
    );
  }
}
