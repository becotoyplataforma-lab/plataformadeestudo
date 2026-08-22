-- ============================================================
-- ConcursoAI — DADOS MÍNIMOS PARA VALIDAR P1–P5 DO PLANNER
-- Projeto: sqrjovmqupjowyilgbsp (Supabase)
-- Escopo: SOMENTE 5 knowledge_subjects + 25 questões públicas de teste.
-- Não altera schema, não roda migration, não roda seed global.
-- Idempotente: ON CONFLICT DO NOTHING (pode rodar mais de uma vez).
-- Execução via DIRECT_URL (role postgres — bypass RLS).
-- ============================================================

BEGIN;

-- ============================================================
-- 1) KNOWLEDGE_SUBJECTS (5) — nomes casam EXATAMENTE com as
--    study_subjects já criadas pela UI (LinkResolver: exact/slug)
-- ============================================================
INSERT INTO public.knowledge_subjects (id, name, slug, description, color, keywords, status)
VALUES
  ('aaaaaaaa-0000-4000-8000-000000000001', 'Português',              'portugues',              'Matéria de teste (Planner E2E)', '#0ea5e9', '["gramatica","interpretacao"]', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'Direito Constitucional', 'direito-constitucional', 'Matéria de teste (Planner E2E)', '#dc2626', '["cf/88","direitos fundamentais"]', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'Direito Administrativo', 'direito-administrativo', 'Matéria de teste (Planner E2E)', '#ea580c', '["ato administrativo","licitacao"]', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'Raciocínio Lógico',      'raciocinio-logico',      'Matéria de teste (Planner E2E)', '#84cc16', '["logica","conjuntos"]', 'active'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'Informática',            'informatica',            'Matéria de teste (Planner E2E)', '#6366f1', '["windows","office"]', 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 2) QUESTIONS (25 = 5 por matéria) — públicas e publicadas
--    Gabaritos definidos p/ o E2E controlar acerto/erro por matéria
-- ============================================================
INSERT INTO public.questions (
  knowledge_subject_id, banca, cargo, ano, nivel, enunciado, gabarito,
  explicacao, tipo, is_public, content_hash, status
) VALUES
-- Português (aaaaaaaa-...-001)
('aaaaaaaa-0000-4000-8000-000000000001', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Português 1: análise sintática.', 'C', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-portugues-1',  'publicada'),
('aaaaaaaa-0000-4000-8000-000000000001', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Português 2: concordância verbal.', 'A', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-portugues-2',  'publicada'),
('aaaaaaaa-0000-4000-8000-000000000001', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Português 3: regência nominal.', 'E', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-portugues-3',  'publicada'),
('aaaaaaaa-0000-4000-8000-000000000001', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Português 4: crase.', 'B', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-portugues-4',  'publicada'),
('aaaaaaaa-0000-4000-8000-000000000001', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Português 5: pontuação.', 'D', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-portugues-5',  'publicada'),
-- Direito Constitucional (aaaaaaaa-...-002)
('aaaaaaaa-0000-4000-8000-000000000002', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Constitucional 1: direitos fundamentais.', 'A', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-dircon-1', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000002', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Constitucional 2: organização do Estado.', 'C', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-dircon-2', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000002', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Constitucional 3: poder constituinte.', 'B', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-dircon-3', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000002', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Constitucional 4: controle de constitucionalidade.', 'E', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-dircon-4', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000002', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Constitucional 5: remédios constitucionais.', 'D', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-dircon-5', 'publicada'),
-- Direito Administrativo (aaaaaaaa-...-003)
('aaaaaaaa-0000-4000-8000-000000000003', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Administrativo 1: ato administrativo.', 'B', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-diradm-1', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000003', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Administrativo 2: licitações.', 'D', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-diradm-2', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000003', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Administrativo 3: poder de polícia.', 'A', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-diradm-3', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000003', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Administrativo 4: servidores públicos.', 'C', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-diradm-4', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000003', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Dir. Administrativo 5: improbidade.', 'E', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-diradm-5', 'publicada'),
-- Raciocínio Lógico (aaaaaaaa-...-004)
('aaaaaaaa-0000-4000-8000-000000000004', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Raciocínio Lógico 1: proposições.', 'D', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-raclog-1', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000004', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Raciocínio Lógico 2: tabela verdade.', 'B', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-raclog-2', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000004', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Raciocínio Lógico 3: argumentos.', 'E', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-raclog-3', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000004', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Raciocínio Lógico 4: conjuntos.', 'A', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-raclog-4', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000004', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Raciocínio Lógico 5: diagramas lógicos.', 'C', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-raclog-5', 'publicada'),
-- Informática (aaaaaaaa-...-005)
('aaaaaaaa-0000-4000-8000-000000000005', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Informática 1: Windows.', 'E', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-infor-1', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000005', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Informática 2: pacote Office.', 'A', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-infor-2', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000005', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Informática 3: segurança da informação.', 'C', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-infor-3', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000005', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Informática 4: internet.', 'B', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-infor-4', 'publicada'),
('aaaaaaaa-0000-4000-8000-000000000005', 'CESPE', 'Analista', 2025, 'medio', 'Questão teste Planner — Informática 5: hardware.', 'D', 'Explicação de teste.', 'multipla_escolha', true, 'sha256:planner-e2e-infor-5', 'publicada')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 3) QUESTION_OPTIONS (5 por questão) — a correta casa com o gabarito
-- ============================================================
DO $$
DECLARE
  r record;
  l text;
BEGIN
  FOR r IN
    SELECT content_hash, gabarito
    FROM public.questions
    WHERE content_hash LIKE 'sha256:planner-e2e-%'
  LOOP
    FOREACH l IN ARRAY ARRAY['A','B','C','D','E']
    LOOP
      INSERT INTO public.question_options (question_id, letter, text, is_correct)
      SELECT q.id, l, 'Alternativa ' || l || ' da questão ' || q.id, (l = r.gabarito)
      FROM public.questions q
      WHERE q.content_hash = r.content_hash
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

COMMIT;
