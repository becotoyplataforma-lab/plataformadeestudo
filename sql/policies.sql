-- ============================================================
-- ConcursoAI Platform — Políticas de Segurança (RLS)
-- Aplicar após indexes.sql
--
-- Princípio: por padrão NEGAR. Cada tabela ganha política mínima.
-- auth.uid() é o id do usuário logado (JWT do Supabase).
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Usuário vê/edita o próprio perfil
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Inserção automática feita por trigger (handle_new_user) com SECURITY DEFINER.
-- Permitir insert somente do próprio id (defensivo).
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- CONTENT_SUBJECTS (catálogo público de conteúdo)
-- ------------------------------------------------------------
ALTER TABLE public.content_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "content_subjects_select" ON public.content_subjects
  FOR SELECT USING (true);

-- ------------------------------------------------------------
-- SUBJECTS (cronograma do usuário)
-- ------------------------------------------------------------
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subjects_select_own" ON public.subjects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "subjects_insert_own" ON public.subjects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subjects_update_own" ON public.subjects
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "subjects_delete_own" ON public.subjects
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- STUDY_TASKS
-- ------------------------------------------------------------
ALTER TABLE public.study_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_own" ON public.study_tasks
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "tasks_insert_own" ON public.study_tasks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_update_own" ON public.study_tasks
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "tasks_delete_own" ON public.study_tasks
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- QUESTIONS (públicas p/ autenticados; write só admin)
-- ------------------------------------------------------------
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

-- Leitura: questões publicadas para usuários autenticados
CREATE POLICY "questions_select_public" ON public.questions
  FOR SELECT USING (
    is_public = true AND status = 'publicada' AND auth.role() = 'authenticated'
  );

-- Escrita: somente admins (via profiles.is_admin)
CREATE POLICY "questions_insert_admin" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "questions_update_admin" ON public.questions
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "questions_delete_admin" ON public.questions
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ------------------------------------------------------------
-- QUESTION_OPTIONS
-- ------------------------------------------------------------
ALTER TABLE public.question_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "options_select_public" ON public.question_options
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.questions q
            WHERE q.id = question_id AND q.is_public = true AND q.status = 'publicada')
  );

CREATE POLICY "options_write_admin" ON public.question_options
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- ------------------------------------------------------------
-- QUESTION_ATTEMPTS
-- ------------------------------------------------------------
ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "attempts_select_own" ON public.question_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "attempts_insert_own" ON public.question_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "attempts_delete_own" ON public.question_attempts
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- FLASHCARDS
-- ------------------------------------------------------------
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flashcards_select_own" ON public.flashcards
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "flashcards_insert_own" ON public.flashcards
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flashcards_update_own" ON public.flashcards
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flashcards_delete_own" ON public.flashcards
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- REVIEW_SCHEDULES
-- ------------------------------------------------------------
ALTER TABLE public.review_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reviews_select_own" ON public.review_schedules
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "reviews_insert_own" ON public.review_schedules
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_update_own" ON public.review_schedules
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "reviews_delete_own" ON public.review_schedules
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- CHAT_SESSIONS
-- ------------------------------------------------------------
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sessions_select_own" ON public.chat_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "sessions_insert_own" ON public.chat_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_update_own" ON public.chat_sessions
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "sessions_delete_own" ON public.chat_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- CHAT_MESSAGES
-- ------------------------------------------------------------
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "messages_select_own" ON public.chat_messages
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.chat_sessions s
               WHERE s.id = session_id AND s.user_id = auth.uid())
  );

CREATE POLICY "messages_insert_own" ON public.chat_messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "messages_delete_own" ON public.chat_messages
  FOR DELETE USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- AI_USAGE — SEM acesso do cliente (gerenciado por função DEFINER)
-- Nenhuma política criada → acesso negado a todos via RLS.
-- O servidor usa a função register_ai_usage (SECURITY DEFINER).
-- ------------------------------------------------------------
ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
-- Sem políticas → totalmente bloqueado para clientes.

-- ------------------------------------------------------------
-- PAYMENTS — SEM acesso do cliente (gerenciado por função DEFINER)
-- Nenhuma política criada → acesso negado a todos via RLS.
-- O webhook usa a função register_payment (SECURITY DEFINER).
-- ------------------------------------------------------------
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
-- Sem políticas → totalmente bloqueado para clientes.

-- ------------------------------------------------------------
-- DOCUMENTS / CHUNKS / EMBEDDINGS (Knowledge Engine - futuro)
-- ------------------------------------------------------------
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "documents_select_own" ON public.documents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "documents_insert_own" ON public.documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "documents_update_own" ON public.documents
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "documents_delete_own" ON public.documents
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "chunks_select_own" ON public.document_chunks
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "chunks_insert_own" ON public.document_chunks
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = document_id AND d.user_id = auth.uid())
  );
CREATE POLICY "chunks_delete_own" ON public.document_chunks
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.documents d
            WHERE d.id = document_id AND d.user_id = auth.uid())
  );

CREATE POLICY "embeddings_select_own" ON public.embeddings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.document_chunks c
      JOIN public.documents d ON d.id = c.document_id
      WHERE c.id = chunk_id AND d.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- ADMIN_AUDIT_LOG — somente escrita por DEFINER / leitura admin
-- ------------------------------------------------------------
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_admin" ON public.admin_audit_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );
-- Inserção via função SECURITY DEFINER do servidor (não exposta ao cliente).

-- ============================================================
-- AUDITORIA: verificar tabelas sem RLS
-- (deve retornar 0 linhas em produção)
-- ============================================================
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('schema_migrations')
  AND NOT EXISTS (
    SELECT 1 FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = pg_tables.tablename
  );
