/**
 * PATCH /api/study/flashcards/[id] — atualiza flashcard
 * DELETE /api/study/flashcards/[id] — remove flashcard
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { FlashcardService, FlashcardError } from "@/lib/study/services/flashcard.service";
import { FlashcardUpdateDtoSchema, mapFlashcardToDto } from "@/lib/dto/study.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const parsed = FlashcardUpdateDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const flashcard = await FlashcardService.update(session.user.id, id, {
      front: parsed.data.front,
      back: parsed.data.back,
      tags: parsed.data.tags,
      studySubjectId: parsed.data.study_subject_id,
    });
    return NextResponse.json(mapFlashcardToDto(flashcard));
  } catch (error) {
    if (error instanceof FlashcardError) {
      const status = error.code === "NOT_FOUND" || error.code === "SUBJECT_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/flashcards] PATCH:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    await FlashcardService.delete(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof FlashcardError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/flashcards] DELETE:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
