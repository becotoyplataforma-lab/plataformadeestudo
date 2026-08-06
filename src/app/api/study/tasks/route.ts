/**
 * GET /api/study/tasks — lista tarefas do usuário (filtros opcionais)
 * POST /api/study/tasks — cria tarefa
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { StudyPlannerService, StudyPlannerError } from "@/lib/study/services/study-planner.service";
import { StudyTaskCreateDtoSchema } from "@/lib/dto/study.dto";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
    }
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const tasks = await StudyPlannerService.listTasks(session.user.id, {
      status: status as "pendente" | "concluida" | "adiada" | undefined,
      from,
      to,
    });
    return NextResponse.json(tasks);
  } catch (error) {
    console.error("[study/tasks] GET:", error);
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
    const parsed = StudyTaskCreateDtoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Requisição inválida", details: parsed.error.issues },
        { status: 400 }
      );
    }
    const task = await StudyPlannerService.createTask(session.user.id, parsed.data);
    return NextResponse.json(task, { status: 201 });
  } catch (error) {
    if (error instanceof StudyPlannerError) {
      const status = error.code === "SUBJECT_NOT_FOUND" ? 404 : 400;
      return NextResponse.json({ error: error.code, message: error.message }, { status });
    }
    console.error("[study/tasks] POST:", error);
    return NextResponse.json({ error: "Erro interno" }, { status: 500 });
  }
}
