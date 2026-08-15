/**
 * GET /api/lessons/[id] — detalhe da aula + progresso do aluno.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { LessonRepository } from "@/lib/study/repositories/lesson.repository";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, ctx: Ctx) {
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
    if (lesson.userId !== null && lesson.userId !== session.user.id) {
      return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
    }

    const progress = await LessonRepository.getProgress(session.user.id, id);
    return NextResponse.json({
      id: lesson.id,
      title: lesson.title,
      subject_id: lesson.knowledgeSubjectId,
      document_id: lesson.documentId,
      avatar_id: lesson.avatarId,
      chapter: lesson.chapter,
      duracao_min: lesson.duracaoMin,
      status: lesson.status,
      roteiro: lesson.roteiro,
      conteudo: lesson.conteudo,
      progress: progress ? Number(progress.progress) : 0,
      current_section: progress?.currentSection ?? null,
      completed_at: progress?.completedAt?.toISOString() ?? null,
      created_at: lesson.createdAt.toISOString(),
    });
  } catch (error) {
    console.error("[lessons/[id]] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
