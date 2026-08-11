/**
 * Tipos de domínio compartilhados (espelham o schema do banco).
 */

export type Plan = "free" | "pro" | "intensivo";
export type UserLevel = "iniciante" | "intermediario" | "avancado";
export type TaskStatus = "pendente" | "concluida" | "adiada";
export type QuestionLevel = "facil" | "medio" | "dificil";
export type AttemptMode = "estudo" | "simulado" | "revisao";
export type ReviewRating = "facil" | "medio" | "dificil";
export type AIModel = "flash" | "pro";

export interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  avatar_url: string | null;
  plano: Plan;
  nivel: UserLevel;
  concurso_alvo: string | null;
  banca_preferida: string | null;
  meta_diaria_min: number;
  modelo_ia_padrao: AIModel;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subject {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  priority: number;
  carga_horaria_total: number;
  created_at: string;
}

export interface StudyTask {
  id: string;
  user_id: string;
  subject_id: string | null;
  title: string;
  description: string | null;
  scheduled_date: string;
  duration_min: number;
  status: TaskStatus;
  completed_at: string | null;
  created_at: string;
  subject?: Subject | null;
}

export interface ContentSubject {
  id: string;
  name: string;
  slug: string;
  color: string | null;
  description: string | null;
}

export interface Question {
  id: string;
  subject_id: string | null;
  banca: string | null;
  cargo: string | null;
  ano: number | null;
  nivel: QuestionLevel;
  enunciado: string;
  gabarito: string;
  explicacao: string | null;
  tipo: string;
  fonte: string | null;
  is_public: boolean;
  subject?: ContentSubject | null;
  options?: QuestionOption[];
}

export interface QuestionOption {
  id: string;
  question_id: string;
  letter: string;
  text: string;
  is_correct: boolean;
}

export interface QuestionAttempt {
  id: string;
  user_id: string;
  question_id: string;
  selected_letter: string;
  is_correct: boolean;
  time_spent_sec: number;
  mode: AttemptMode;
  created_at: string;
}

export interface Flashcard {
  id: string;
  user_id: string;
  subject_id: string | null;
  front: string;
  back: string;
  tags: string[];
  created_at: string;
  subject?: Subject | null;
}

export interface ReviewSchedule {
  id: string;
  user_id: string;
  flashcard_id: string;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  due_date: string;
  last_reviewed_at: string | null;
  updated_at: string;
}

export interface ChatSession {
  id: string;
  user_id: string;
  title: string;
  knowledge_subject_id: string | null;
  subject_id?: string | null;
  model: AIModel;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  user_id: string;
  role: "system" | "user" | "assistant";
  content: string;
  model: AIModel | null;
  tokens_in: number;
  tokens_out: number;
  created_at: string;
}

export interface DashboardSummary {
  total_questoes: number;
  acertos: number;
  taxa_acerto: number;
  streak_dias: number;
  meta_hoje_min: number;
  estudado_hoje_min: number;
  revisoes_pendentes: number;
  tarefas_hoje: number;
  tarefas_concluidas_hoje: number;
}

export interface SubjectPerformance {
  materia: string;
  total: number;
  acertos: number;
  taxa: number;
  color: string | null;
}

export interface EvolutionPoint {
  dia: string;
  total: number;
  acertos: number;
  taxa: number;
}
