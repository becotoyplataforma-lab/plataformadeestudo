"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import {
  createSubject,
  createTask,
  deleteSubject,
  deleteTask,
  toggleTask,
  updateTask,
} from "@/lib/db/repositories/cronograma";
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
    const db = await createClient();
    await createTask(db, userId, parsed.data);
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
    const db = await createClient();
    await toggleTask(db, userId, taskId, currentStatus);
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
    const db = await createClient();
    await updateTask(db, userId, taskId, {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      subject_id: parsed.data.subject_id ?? null,
      scheduled_date: parsed.data.scheduled_date,
      duration_min: parsed.data.duration_min,
      status: parsed.data.status,
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
    const db = await createClient();
    await deleteTask(db, userId, taskId);
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
    const db = await createClient();
    await createSubject(db, userId, parsed.data);
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
    const db = await createClient();
    await deleteSubject(db, userId, subjectId);
    revalidatePath("/cronograma");
    return { success: true, message: "Disciplina removida." };
  } catch (error) {
    console.error("[cronograma] deleteSubject", error);
    return { success: false, message: "Erro ao remover disciplina." };
  }
}
