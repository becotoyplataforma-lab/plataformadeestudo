-- ============================================================
-- CONCURSOAI — MIGRATION NÃO DESTRUTIVA (2026-08-15)
-- Pipeline apostila → conteúdo → IA → aulas → questões → reforço
-- Idempotente (pode reexecutar sem efeito colateral).
-- ============================================================

-- 1. DOCUMENTS — metadados de processamento
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS page_count integer;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processing_error text;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS chunk_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS embedding_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS processed_at timestamptz;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS edital_id uuid REFERENCES public.editais(id) ON DELETE SET NULL;
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_documents_edital ON public.documents(edital_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_documents_position ON public.documents(position_id) WHERE deleted_at IS NULL;

-- 2. QUESTION_STATUS — estados de curadoria/validação
ALTER TYPE public.question_status ADD VALUE IF NOT EXISTS 'em_revisao';
ALTER TYPE public.question_status ADD VALUE IF NOT EXISTS 'rejeitada';

-- 3. QUESTIONS — rastreabilidade da fonte (documento → chunk → edital → cargo)
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_chunk_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_edital_id uuid REFERENCES public.editais(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS source_position_id uuid REFERENCES public.positions(id) ON DELETE SET NULL;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'manual';
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS confidence numeric(3,2);
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS topic text;
CREATE INDEX IF NOT EXISTS idx_questions_source_document ON public.questions(source_document_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_questions_origin ON public.questions(origin) WHERE deleted_at IS NULL;

-- 4. QUESTION_MODERATION_EVENTS — histórico de moderação
CREATE TABLE IF NOT EXISTS public.question_moderation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_question_moderation_events_question ON public.question_moderation_events(question_id);
CREATE INDEX IF NOT EXISTS idx_question_moderation_events_admin ON public.question_moderation_events(admin_user_id);

-- 5. FLASHCARDS — fonte (apostila/chunk)
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.flashcards ADD COLUMN IF NOT EXISTS source_chunk_id uuid REFERENCES public.document_chunks(id) ON DELETE SET NULL;

-- 6. AVATARS — professor virtual (personagem ORIGINAL, sem copyright)
CREATE TABLE IF NOT EXISTS public.avatars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  slug text NOT NULL,
  descricao text,
  personalidade text,
  aparencia text,
  voz text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_avatars_slug ON public.avatars(slug) WHERE deleted_at IS NULL;

-- 7. LESSONS — aula gerada a partir da apostila
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  knowledge_subject_id uuid NOT NULL REFERENCES public.knowledge_subjects(id) ON DELETE RESTRICT,
  document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL,
  avatar_id uuid REFERENCES public.avatars(id) ON DELETE SET NULL,
  chapter text,
  title text NOT NULL,
  roteiro jsonb NOT NULL DEFAULT '[]'::jsonb,
  conteudo text,
  duracao_min integer,
  status text NOT NULL DEFAULT 'publicada',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_lessons_user ON public.lessons(user_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_subject ON public.lessons(knowledge_subject_id);
CREATE INDEX IF NOT EXISTS idx_lessons_document ON public.lessons(document_id);

-- 8. LESSON_PROGRESS — progresso do aluno por aula
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  progress numeric(3,2) NOT NULL DEFAULT 0,
  current_section text,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lesson_progress_user_lesson ON public.lesson_progress(user_id, lesson_id);
CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON public.lesson_progress(user_id);

-- 9. CHAT_SESSIONS — contexto de fonte (apostila/capítulo) do Professor IA
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;
ALTER TABLE public.chat_sessions ADD COLUMN IF NOT EXISTS chapter text;
CREATE INDEX IF NOT EXISTS idx_chat_sessions_document ON public.chat_sessions(document_id) WHERE deleted_at IS NULL;

-- ============================================================
-- SEED — AVATAR ORIGINAL (personagem próprio do ConcursoAI)
-- ============================================================
INSERT INTO public.avatars (nome, slug, descricao, personalidade, aparencia, voz, ativo)
SELECT
  'Prof. Rafa',
  'prof-rafa',
  'Professor virtual original do ConcursoAI — energético, didático e focado em concursos.',
  'Energético e animado; usa exemplos do cotidiano, mnemônicos e quebra a tensão antes das questões.',
  'Desenho animado 2D original: cabelo laranja em pé, óculos redondos, camisa xadrez e moletom azul.',
  'pt-BR, masculino, tom jovem e acelerado',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.avatars WHERE slug = 'prof-rafa');

-- ============================================================
-- RLS (defesa em profundidade; acesso real de dados via Drizzle)
-- Admin é definido por ALLOWLIST (ADMIN_EMAILS), não por coluna.
-- ============================================================

ALTER TABLE public.avatars ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS avatars_select_auth ON public.avatars;
CREATE POLICY avatars_select_auth ON public.avatars
  FOR SELECT USING (ativo = true AND deleted_at IS NULL);

ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lessons_select ON public.lessons;
CREATE POLICY lessons_select ON public.lessons
  FOR SELECT USING (deleted_at IS NULL AND (user_id IS NULL OR user_id = auth.uid()));

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS lesson_progress_owner ON public.lesson_progress;
CREATE POLICY lesson_progress_owner ON public.lesson_progress
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

ALTER TABLE public.question_moderation_events ENABLE ROW LEVEL SECURITY;
-- Sem política de leitura por REST: apenas Drizzle/admin (default deny).
