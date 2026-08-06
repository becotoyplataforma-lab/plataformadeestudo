-- ============================================================
-- ConcursoAI — Domínio: STUDY — Seeds
-- PostgreSQL 17 · Supabase
-- Aplicar APENAS em dev/staging.
-- ============================================================

-- ============================================================
-- STUDY_SUBJECTS (exemplo — disciplinas de um usuário de demonstração)
-- ============================================================
-- Requer user_id existente em auth.users (criado via Supabase Auth).
-- Substitua '00000000-0000-0000-0000-000000000002' pelo id real.

INSERT INTO public.study_subjects (user_id, name, color, priority, carga_horaria_total)
VALUES
  ('00000000-0000-0000-0000-000000000002', 'Direito Constitucional', '#dc2626', 1, 80),
  ('00000000-0000-0000-0000-000000000002', 'Raciocínio Lógico', '#84cc16', 2, 60),
  ('00000000-0000-0000-0000-000000000002', 'Português', '#0ea5e9', 3, 50)
ON CONFLICT DO NOTHING;

-- ============================================================
-- QUESTIONS + OPTIONS (exemplo de curadoria pública)
-- ============================================================

DO $$
DECLARE
  v_subject_id UUID;
  v_q1 UUID;
BEGIN
  SELECT id INTO v_subject_id FROM public.knowledge_subjects WHERE slug = 'direito-constitucional';

  IF v_subject_id IS NOT NULL THEN
    -- Questão 1
    INSERT INTO public.questions (
      id, knowledge_subject_id, banca, cargo, ano, nivel, enunciado, gabarito,
      explicacao, tipo, is_public, content_hash, status
    ) VALUES (
      '00000000-0000-0000-0000-000000000101', v_subject_id, 'CESPE', 'Analista', 2024,
      'medio',
      'Conforme a Constituição Federal, é direito fundamental do cidadão:',
      'C',
      'O Art. 5º, II, CF/88 assegura que ninguém será obrigado a fazer ou deixar de fazer algo senão em virtude de lei (Princípio da Legalidade).',
      'multipla_escolha', true,
      'sha256:example-question-1', 'publicada'
    ) ON CONFLICT DO NOTHING
    RETURNING id INTO v_q1;

    IF v_q1 IS NOT NULL THEN
      INSERT INTO public.question_options (question_id, letter, text, is_correct) VALUES
        (v_q1, 'A', 'A liberdade de expressão é ilimitada em qualquer hipótese.', false),
        (v_q1, 'B', 'O voto é facultativo para maiores de 16 anos.', false),
        (v_q1, 'C', 'Ninguém será obrigado a fazer ou deixar de fazer algo senão em virtude de lei.', true),
        (v_q1, 'D', 'A pena de morte é admitida em todos os casos.', false),
        (v_q1, 'E', 'O direito de propriedade é absoluto e sem função social.', false)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;
