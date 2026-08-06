/**
 * POST /api/study/questions/[id]/answer — responde questão e registra tentativa
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import {
  QuestionAnsweringService,
  QuestionAnsweringError,
} from "@/lib/study/services/question-answering.service";
import { QuestionAnswerRequestDtoSchema } from "@/lib/dto/study.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { id } = await context.params;
    const body = await request.json();
    const parsed = QuestionAnswerRequestDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const result = await QuestionAnsweringService.answer(session.user.id, id, {
      selectedLetter: parsed.data.selected_letter,
      timeSpentSec: parsed.data.time_spent_sec,
      mode: parsed.data.mode,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof QuestionAnsweringError) {
      const status =
        error.code === "QUESTION_NOT_FOUND" ? 404 : error.code === "INVALID_LETTER" ? 400 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/questions] answer:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
