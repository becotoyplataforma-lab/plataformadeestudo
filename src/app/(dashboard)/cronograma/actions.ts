"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import { StudyPlannerService } from "@/lib/study/services/study-planner.service";
import {
  createSubjectSchema,
  createTaskSchema,
  updateTaskSchema,
} from "@/lib/validations/cronograma";

type ActionResult = { success: boolean; message: string };

async function requireUser(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Não autenticado.");
  return session.user.id;
}

export async function actionCreateTask(
  input: unknown
): Promise<ActionResult> {
  try {
    const userId = await requireUser();
    const parsed = createTaskSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    await StudyPlannerService.createTask(userId, {
      study_subject_id: parsed.data.subject_id ?? undefined,
      title: parsed.data.title,
      description: parsed.data.description ?? undefined,
      scheduled_date: parsed.data.scheduled_date,
      duration_min: parsed.data.duration_min,
    });
    revalidatePath("/cronograma");
    revalidatePath("/dashboard");
    return { success: true, message: "Tarefa criada!" };
  } catch (error) {
    console.error("[cronograma] createTask", error);
    return { success: false, message: "Erro ao criar tarefa." };
  }
}

export async function actionToggleTask(taskId: string, currentStatus: string): Promise<ActionResult> {
  try {
    const userId = await requireUser();
    if (currentStatus === "concluida") {
      await StudyPlannerService.updateTask(userId, taskId, { status: "pendente" });
    } else {
      await StudyPlannerService.completeTask(userId, taskId);
    }
    revalidatePath("/cronograma");
    revalidatePath("/dashboard");
    return { success: true, message: "Status atualizado." };
  } catch (error) {
    console.error("[cronograma] toggleTask", error);
    return { success: false, message: "Erro ao atualizar tarefa." };
  }
}

export async function actionUpdateTask(
  taskId: string,
  input: unknown
): Promise<ActionResult> {
  try {
    const userId = await requireUser();
    const parsed = updateTaskSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    await StudyPlannerService.updateTask(userId, taskId, {
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.description !== undefined && { description: parsed.data.description ?? undefined }),
      ...(parsed.data.scheduled_date !== undefined && { scheduled_date: parsed.data.scheduled_date }),
      ...(parsed.data.duration_min !== undefined && { duration_min: parsed.data.duration_min }),
      ...(parsed.data.status !== undefined && { status: parsed.data.status }),
    });
    revalidatePath("/cronograma");
    return { success: true, message: "Tarefa atualizada." };
  } catch (error) {
    console.error("[cronograma] updateTask", error);
    return { success: false, message: "Erro ao atualizar tarefa." };
  }
}

export async function actionDeleteTask(taskId: string): Promise<ActionResult> {
  try {
    const userId = await requireUser();
    await StudyPlannerService.deleteTask(userId, taskId);
    revalidatePath("/cronograma");
    return { success: true, message: "Tarefa removida." };
  } catch (error) {
    console.error("[cronograma] deleteTask", error);
    return { success: false, message: "Erro ao remover tarefa." };
  }
}

export async function actionCreateSubject(
  input: unknown
): Promise<ActionResult> {
  try {
    const userId = await requireUser();
    const parsed = createSubjectSchema.safeParse(input);
    if (!parsed.success) {
      return { success: false, message: parsed.error.issues[0]?.message ?? "Dados inválidos" };
    }
    await StudyPlannerService.createSubject(userId, {
      name: parsed.data.name,
      color: parsed.data.color ?? undefined,
      priority: parsed.data.priority,
      carga_horaria_total: parsed.data.carga_horaria_total,
    });
    revalidatePath("/cronograma");
    return { success: true, message: "Disciplina criada!" };
  } catch (error) {
    console.error("[cronograma] createSubject", error);
    return { success: false, message: "Erro ao criar disciplina." };
  }
}

export async function actionDeleteSubject(subjectId: string): Promise<ActionResult> {
  try {
    const userId = await requireUser();
    await StudyPlannerService.deleteSubject(userId, subjectId);
    revalidatePath("/cronograma");
    return { success: true, message: "Disciplina removida." };
  } catch (error) {
    console.error("[cronograma] deleteSubject", error);
    return { success: false, message: "Erro ao remover disciplina." };
  }
}
