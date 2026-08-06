-- ============================================================
-- ConcursoAI — Domínio: AI — Seeds (dev/staging apenas)
-- ============================================================

-- Sessão de demonstração para o usuário demo.
-- Requer user_id existente em auth.users.

INSERT INTO public.chat_sessions (user_id, title, knowledge_subject_id, model)
SELECT
  '00000000-0000-0000-0000-000000000002',
  'Boas-vindas',
  ks.id,
  'flash'
FROM public.knowledge_subjects ks
WHERE ks.slug = 'direito-constitucional'
ON CONFLICT DO NOTHING;
