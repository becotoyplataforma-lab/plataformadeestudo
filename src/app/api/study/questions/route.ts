/**
 * GET /api/study/questions — lista questões públicas (filtros + paginação)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { QuestionAnsweringService } from "@/lib/study/services/question-answering.service";
import { QuestionListQueryDtoSchema } from "@/lib/dto/study.dto";
import { mapQuestionToDto } from "@/lib/dto/study.dto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const parsed = QuestionListQueryDtoSchema.safeParse({
      subject_id: searchParams.get("subject_id") ?? undefined,
      banca: searchParams.get("banca") ?? undefined,
      nivel: searchParams.get("nivel") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      page_size: searchParams.get("page_size") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Parâmetros inválidos", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { data, total } = await QuestionAnsweringService.listQuestions({
      subjectId: parsed.data.subject_id,
      banca: parsed.data.banca,
      nivel: parsed.data.nivel,
      page: parsed.data.page,
      pageSize: parsed.data.page_size,
    });

    return NextResponse.json({ data: data.map(mapQuestionToDto), total });
  } catch (error) {
    console.error("[study/questions] GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
