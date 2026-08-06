/**
 * GET /api/study/subjects — lista disciplinas do usuário
 * POST /api/study/subjects — cria disciplina
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { StudyPlannerService, StudyPlannerError } from "@/lib/study/services/study-planner.service";
import { StudySubjectCreateDtoSchema } from "@/lib/dto/study.dto";
import { mapStudySubjectToDto } from "@/lib/dto/study.dto";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const subjects = await StudyPlannerService.listSubjects(session.user.id);
    return NextResponse.json(subjects.map(mapStudySubjectToDto));
  } catch (error) {
    console.error("[study/subjects] GET:", error);
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
    const parsed = StudySubjectCreateDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }

    const subject = await StudyPlannerService.createSubject(session.user.id, parsed.data);
    return NextResponse.json(mapStudySubjectToDto(subject), { status: 201 });
  } catch (error) {
    if (error instanceof StudyPlannerError) {
      const status = error.code === "DUPLICATE_SUBJECT" ? 409 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/subjects] POST:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
