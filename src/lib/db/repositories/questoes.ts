import type { SupabaseClient } from "@supabase/supabase-js";
import type { QuestionFilters } from "@/lib/validations/questoes";
import type { Question, QuestionOption } from "@/types";

type DB = SupabaseClient;

/**
 * Repository de questões — acesso a questões públicas e registro de tentativas.
 */
export async function listQuestions(
  db: DB,
  filters: QuestionFilters
): Promise<{ data: Question[]; total: number }> {
  const { subject_id, banca, nivel, page, pageSize } = filters;

  let query = db
    .from("questions")
    .select("*, subject:knowledge_subjects(*)", { count: "exact" })
    .eq("is_public", true)
    .eq("status", "publicada")
    .order("created_at", { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  if (subject_id) query = query.eq("knowledge_subject_id", subject_id);
  if (banca) query = query.eq("banca", banca);
  if (nivel) query = query.eq("nivel", nivel);

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);
  return { data: (data as Question[]) ?? [], total: count ?? 0 };
}

export async function getQuestionWithOptions(
  db: DB,
  questionId: string
): Promise<Question | null> {
  const { data, error } = await db
    .from("questions")
    .select("*, subject:knowledge_subjects(*), options:question_options(*)")
    .eq("id", questionId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(error.message);
  }
  return data as Question;
}

export async function getGabarito(
  db: DB,
  questionId: string
): Promise<{ gabarito: string; explicacao: string | null } | null> {
  const { data, error } = await db
    .from("questions")
    .select("gabarito, explicacao")
    .eq("id", questionId)
    .single();

  if (error) return null;
  return { gabarito: data.gabarito, explicacao: data.explicacao };
}

export async function createAttempt(
  db: DB,
  attempt: {
    user_id: string;
    question_id: string;
    selected_letter: string;
    is_correct: boolean;
    time_spent_sec: number;
    mode: string;
  }
): Promise<void> {
  const { error } = await db.from("question_attempts").insert(attempt);
  if (error) throw new Error(error.message);
}

export async function listOptions(
  db: DB,
  questionId: string
): Promise<QuestionOption[]> {
  const { data, error } = await db
    .from("question_options")
    .select("*")
    .eq("question_id", questionId)
    .order("letter");
  if (error) throw new Error(error.message);
  return (data as QuestionOption[]) ?? [];
}

/** Lista de bancas disponíveis para filtros */
export async function listBancas(db: DB): Promise<string[]> {
  const { data, error } = await db
    .from("questions")
    .select("banca")
    .eq("is_public", true)
    .eq("status", "publicada")
    .not("banca", "is", null);
  if (error) throw new Error(error.message);
  return [...new Set((data ?? []).map((q) => q.banca).filter(Boolean))] as string[];
}
