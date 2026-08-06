/**
 * PATCH /api/study/tasks/[id] — atualiza tarefa
 * DELETE /api/study/tasks/[id] — remove tarefa
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { StudyPlannerService, StudyPlannerError } from "@/lib/study/services/study-planner.service";
import { StudyTaskUpdateDtoSchema } from "@/lib/dto/study.dto";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const body = await request.json();
    const parsed = StudyTaskUpdateDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const task = await StudyPlannerService.updateTask(session.user.id, id, parsed.data);
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof StudyPlannerError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/tasks] PATCH:", error);
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
    await StudyPlannerService.deleteTask(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StudyPlannerError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/tasks] DELETE:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
