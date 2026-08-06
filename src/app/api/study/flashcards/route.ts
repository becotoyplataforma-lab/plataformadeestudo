/**
 * GET /api/study/flashcards — lista flashcards do usuário (filtros opcionais)
 * POST /api/study/flashcards — cria flashcard + schedule inicial
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { FlashcardService, FlashcardError } from "@/lib/study/services/flashcard.service";
import { FlashcardCreateDtoSchema, mapFlashcardToDto } from "@/lib/dto/study.dto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const studySubjectId = searchParams.get("study_subject_id") ?? undefined;
    const onlyDue = searchParams.get("only_due") === "true";

    const cards = await FlashcardService.list(session.user.id, {
      studySubjectId,
      onlyDue,
    });
    return NextResponse.json(
      cards.map((c) =>
        mapFlashcardToDto({
          ...c,
          subjectName: c.subjectName,
          subjectColor: c.subjectColor,
          schedule: c.scheduleId
            ? {
                id: c.scheduleId,
                intervalDays: c.intervalDays,
                easeFactor: c.easeFactor,
                repetitions: c.repetitions,
                dueDate: c.dueDate,
                lastReviewedAt: c.lastReviewedAt,
              }
            : null,
        })
      )
    );
  } catch (error) {
    console.error("[study/flashcards] GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const body = await request.json();
    const parsed = FlashcardCreateDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const flashcard = await FlashcardService.create(session.user.id, {
      studySubjectId: parsed.data.study_subject_id,
      front: parsed.data.front,
      back: parsed.data.back,
      tags: parsed.data.tags,
    });
    return NextResponse.json(mapFlashcardToDto(flashcard), { status: 201 });
  } catch (error) {
    if (error instanceof FlashcardError) {
      const status = error.code === "SUBJECT_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/flashcards] POST:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
