/**
 * POST /api/lessons/[id]/progress — atualiza progresso do aluno na aula.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth/auth";
import { LessonRepository } from "@/lib/study/repositories/lesson.repository";

type Ctx = { params: Promise<{ id: string }> };

const ProgressSchema = z.object({
  progress: z.number().min(0).max(1),
  current_section: z.string().max(200).optional(),
  completed: z.boolean().optional(),
});

export async function POST(request: NextRequest, ctx: Ctx) {
  try {
    const { id } = await ctx.params;
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const lesson = await LessonRepository.findById(id);
    if (!lesson) {
      return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const parsed = ProgressSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const row = await LessonRepository.upsertProgress({
      userId: session.user.id,
      lessonId: id,
      progress: parsed.data.progress,
      currentSection: parsed.data.current_section ?? null,
      completed: parsed.data.completed ?? parsed.data.progress >= 1,
    });

    return NextResponse.json({ progress: Number(row.progress), updated: true });
  } catch (error) {
    console.error("[lessons/[id]/progress] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
