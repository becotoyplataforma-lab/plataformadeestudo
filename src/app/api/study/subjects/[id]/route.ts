/**
 * GET /api/study/subjects/[id] — detalhe de disciplina
 * PATCH /api/study/subjects/[id] — atualiza disciplina
 * DELETE /api/study/subjects/[id] — remove disciplina
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { StudyPlannerService, StudyPlannerError } from "@/lib/study/services/study-planner.service";
import { StudySubjectUpdateDtoSchema } from "@/lib/dto/study.dto";
import { mapStudySubjectToDto } from "@/lib/dto/study.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const subject = await StudyPlannerService.listSubjects(session.user.id).then(
      (list) => list.find((s) => s.id === id) ?? null
    );
    if (!subject) {
      return NextResponse.json({ error: "NOT_FOUND", message: "Disciplina não encontrada" }, { status: 404 });
    }
    return NextResponse.json(mapStudySubjectToDto(subject));
  } catch (error) {
    console.error("[study/subjects] GET:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const parsed = StudySubjectUpdateDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const subject = await StudyPlannerService.updateSubject(session.user.id, id, parsed.data);
    return NextResponse.json(mapStudySubjectToDto(subject));
  } catch (error) {
    if (error instanceof StudyPlannerError) {
      const status = error.code === "NOT_FOUND" ? 404 : error.code === "DUPLICATE_SUBJECT" ? 409 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/subjects] PATCH:", error);
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
    await StudyPlannerService.deleteSubject(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StudyPlannerError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/subjects] DELETE:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
