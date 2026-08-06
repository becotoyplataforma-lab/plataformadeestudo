import type { SupabaseClient } from "@supabase/supabase-js";
import type { StudyTask, Subject } from "@/types";
import type { CreateSubjectInput, CreateTaskInput } from "@/lib/validations/cronograma";

type DB = SupabaseClient;

/** Lista disciplinas do usuário */
export async function listSubjects(db: DB, userId: string): Promise<Subject[]> {
  const { data, error } = await db
    .from("subjects")
    .select("*")
    .eq("user_id", userId)
    .order("priority", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as Subject[]) ?? [];
}

export async function createSubject(
  db: DB,
  userId: string,
  input: CreateSubjectInput
): Promise<Subject> {
  const { data, error } = await db
    .from("subjects")
    .insert({ ...input, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Subject;
}

export async function deleteSubject(db: DB, userId: string, subjectId: string): Promise<void> {
  const { error } = await db
    .from("subjects")
    .delete()
    .eq("id", subjectId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

/** Lista tarefas do usuário em um intervalo de datas */
export async function listTasks(
  db: DB,
  userId: string,
  from?: string,
  to?: string
): Promise<StudyTask[]> {
  let query = db
    .from("study_tasks")
    .select("*, subject:subjects(*)")
    .eq("user_id", userId)
    .order("scheduled_date", { ascending: true });

  if (from) query = query.gte("scheduled_date", from);
  if (to) query = query.lte("scheduled_date", to);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data as StudyTask[]) ?? [];
}

export async function createTask(
  db: DB,
  userId: string,
  input: CreateTaskInput
): Promise<StudyTask> {
  const { data, error } = await db
    .from("study_tasks")
    .insert({
      user_id: userId,
      title: input.title,
      description: input.description ?? null,
      subject_id: input.subject_id ?? null,
      scheduled_date: input.scheduled_date,
      duration_min: input.duration_min,
    })
    .select("*, subject:subjects(*)")
    .single();
  if (error) throw new Error(error.message);
  return data as StudyTask;
}

export async function updateTask(
  db: DB,
  userId: string,
  taskId: string,
  patch: {
    title?: string;
    description?: string | null;
    subject_id?: string | null;
    scheduled_date?: string;
    duration_min?: number;
    status?: "pendente" | "concluida" | "adiada";
    completed_at?: string | null;
  }
): Promise<void> {
  const { error } = await db
    .from("study_tasks")
    .update(patch)
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}

export async function toggleTask(
  db: DB,
  userId: string,
  taskId: string,
  currentStatus: string
): Promise<void> {
  const now = new Date().toISOString();
  const next =
    currentStatus === "concluida"
      ? { status: "pendente" as const, completed_at: null }
      : { status: "concluida" as const, completed_at: now };
  await updateTask(db, userId, taskId, next);
}

export async function deleteTask(db: DB, userId: string, taskId: string): Promise<void> {
  const { error } = await db
    .from("study_tasks")
    .delete()
    .eq("id", taskId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
}
