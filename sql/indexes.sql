-- ============================================================
-- ConcursoAI Platform — Índices
-- Aplicar após schema.sql
-- ============================================================

-- ------------------------------------------------------------
-- PROFILES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_plano ON public.profiles(plano);

-- ------------------------------------------------------------
-- SUBJECTS
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_subjects_user ON public.subjects(user_id);

-- ------------------------------------------------------------
-- STUDY_TASKS
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_study_tasks_user_date ON public.study_tasks(user_id, scheduled_date);
CREATE INDEX IF NOT EXISTS idx_study_tasks_subject ON public.study_tasks(subject_id);
CREATE INDEX IF NOT EXISTS idx_study_tasks_status ON public.study_tasks(user_id, status);

-- ------------------------------------------------------------
-- QUESTIONS
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_questions_subject ON public.questions(subject_id);
CREATE INDEX IF NOT EXISTS idx_questions_banca ON public.questions(banca);
CREATE INDEX IF NOT EXISTS idx_questions_nivel ON public.questions(nivel);
CREATE INDEX IF NOT EXISTS idx_questions_status ON public.questions(status) WHERE status = 'publicada';
CREATE INDEX IF NOT EXISTS idx_questions_trgm_enunciado
  ON public.questions USING gin (enunciado gin_trgm_ops);

-- ------------------------------------------------------------
-- QUESTION_OPTIONS
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_question_options_q ON public.question_options(question_id);

-- ------------------------------------------------------------
-- QUESTION_ATTEMPTS
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_attempts_user_date ON public.question_attempts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON public.question_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user_correct ON public.question_attempts(user_id, is_correct);

-- ------------------------------------------------------------
-- FLASHCARDS
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_flashcards_user ON public.flashcards(user_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_subject ON public.flashcards(subject_id);

-- ------------------------------------------------------------
-- REVIEW_SCHEDULES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_review_user_due ON public.review_schedules(user_id, due_date);
CREATE INDEX IF NOT EXISTS idx_review_flashcard ON public.review_schedules(flashcard_id);

-- ------------------------------------------------------------
-- CHAT_SESSIONS / MESSAGES
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON public.chat_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON public.chat_messages(session_id, created_at);

-- ------------------------------------------------------------
-- AI_USAGE
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_ai_usage_user_date ON public.ai_usage(user_id, usage_date);

-- ------------------------------------------------------------
-- PAYMENTS
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON public.payments(provider_id);

-- ------------------------------------------------------------
-- DOCUMENTS / CHUNKS / EMBEDDINGS (Knowledge Engine - futuro)
-- ------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_documents_user ON public.documents(user_id, status);
CREATE INDEX IF NOT EXISTS idx_document_chunks_doc ON public.document_chunks(document_id, seq);

-- Índice HNSW para busca vetorial (pgvector)
-- A dimensão deve bater com o modelo de embedding usado (1536 = text-embedding-3-small)
CREATE INDEX IF NOT EXISTS idx_embeddings_hnsw
  ON public.embeddings
  USING hnsw (embedding vector_cosine_ops);
