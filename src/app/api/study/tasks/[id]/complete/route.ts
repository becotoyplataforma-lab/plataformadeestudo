/**
 * POST /api/study/tasks/[id]/complete — marca tarefa como concluída
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { StudyPlannerService, StudyPlannerError } from "@/lib/study/services/study-planner.service";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, context: Ctx) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { id } = await context.params;
    const task = await StudyPlannerService.completeTask(session.user.id, id);
    return NextResponse.json(task);
  } catch (error) {
    if (error instanceof StudyPlannerError) {
      const status = error.code === "NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/tasks] complete:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
