/**
 * GET /api/study/attempts — lista tentativas do usuário
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { QuestionAttemptService } from "@/lib/study/services/question-attempt.service";
import { mapAttemptToDto } from "@/lib/dto/study.dto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const page = Number(searchParams.get("page") ?? "1");
    const pageSize = Number(searchParams.get("page_size") ?? "50");

    const attempts = await QuestionAttemptService.list(session.user.id, { page, pageSize });
    return NextResponse.json(attempts.map(mapAttemptToDto));
  } catch (error) {
    console.error("[study/attempts] GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
