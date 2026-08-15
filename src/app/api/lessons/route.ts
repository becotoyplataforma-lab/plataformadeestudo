/**
 * GET /api/lessons — lista aulas visíveis ao aluno autenticado.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { LessonRepository } from "@/lib/study/repositories/lesson.repository";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const lessons = await LessonRepository.listForStudent(session.user.id);
    return NextResponse.json(
      lessons.map((l) => ({
        id: l.id,
        title: l.title,
        subject_id: l.knowledgeSubjectId,
        document_id: l.documentId,
        avatar_id: l.avatarId,
        chapter: l.chapter,
        duracao_min: l.duracaoMin,
        status: l.status,
        created_at: l.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    console.error("[lessons] Erro:", error);
    return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
  }
}
