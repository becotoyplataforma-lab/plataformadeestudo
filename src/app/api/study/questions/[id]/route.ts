/**
 * GET /api/study/questions/[id] — detalhe de questão pública (com opções)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { QuestionAnsweringService, QuestionAnsweringError } from "@/lib/study/services/question-answering.service";
import { mapQuestionToDto } from "@/lib/dto/study.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const question = await QuestionAnsweringService.getQuestion(id);
    if (!question) {
      return NextResponse.json(
        { error: "QUESTION_NOT_FOUND", message: "Questão não encontrada ou não publicada" },
        { status: 404 }
      );
    }
    return NextResponse.json(mapQuestionToDto(question as never));
  } catch (error) {
    if (error instanceof QuestionAnsweringError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: 404 });
    }
    console.error("[study/questions] GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
