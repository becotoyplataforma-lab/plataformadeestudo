-- ============================================================
-- ConcursoAI — 2026-08-15-pme-rj-seed.sql
-- Seed idempotente do PME-RJ (PLANO-MESTRE-TESTE, seção 4).
-- DADO REAL do material do usuário (marcado como "REAL" no nome/descrição,
-- para diferenciar de qualquer mock/exemplo pré-existente).
-- NUNCA inventa peso de edital: edital/pesos ficam PENDENTES de confirmação
-- manual (nenhuma linha em notice_subjects é criada aqui).
-- Aplicar via:
--   node scripts/apply-migration.mjs database/migrations/2026-08-15-pme-rj-seed.sql
-- ============================================================

-- Órgão: PMERJ (REAL)
INSERT INTO public.organs (id, name, slug, description, status) VALUES
('aaaaaaaa-0000-4000-8000-000000000201',
 'PMERJ — Polícia Militar do Estado do Rio de Janeiro (REAL)',
 'real-pmerj',
 'Órgão REAL do material do usuário (PME-RJ).',
 'active')
ON CONFLICT DO NOTHING;

-- Banca: a confirmar (NÃO inventar).
INSERT INTO public.boards (id, name, slug, description, status) VALUES
('aaaaaaaa-0000-4000-8000-000000000202',
 'Banca a confirmar — PMERJ (REAL)',
 'real-pmerj-banca-a-confirmar',
 'Banca NÃO confirmada — pendente de confirmação manual. Não inventar.',
 'active')
ON CONFLICT DO NOTHING;

-- Concurso: PMERJ — Soldado PM (REAL)
INSERT INTO public.contests (id, organ_id, board_id, title, slug, description, status) VALUES
('aaaaaaaa-0000-4000-8000-000000000103',
 'aaaaaaaa-0000-4000-8000-000000000201',
 'aaaaaaaa-0000-4000-8000-000000000202',
 'Concurso PMERJ — Soldado PM (REAL)',
 'real-pmerj-soldado',
 'DADO REAL (PME-RJ — material do usuário). Edital e pesos de matéria: PENDENTES de confirmação manual.',
 'publicado')
ON CONFLICT DO NOTHING;

-- Correção de vínculo (idempotente): garante que o concurso aponte para o
-- órgão/banca corretos, mesmo se uma execução anterior tiver colidido com
-- IDs pré-existentes.
UPDATE public.contests
   SET organ_id = 'aaaaaaaa-0000-4000-8000-000000000201',
       board_id = 'aaaaaaaa-0000-4000-8000-000000000202'
 WHERE id = 'aaaaaaaa-0000-4000-8000-000000000103';

-- Cargo: Soldado PM (REAL)
INSERT INTO public.positions (id, contest_id, name, slug, description, status) VALUES
('aaaaaaaa-0000-4000-8000-000000000104',
 'aaaaaaaa-0000-4000-8000-000000000103',
 'Soldado PM (REAL)',
 'real-pmerj-soldado',
 'Cargo REAL do material do usuário (PME-RJ).',
 'active')
ON CONFLICT DO NOTHING;

-- Matéria: Português (garante existência por slug; id fixo para rastreabilidade)
INSERT INTO public.knowledge_subjects (id, name, slug, status, keywords)
SELECT 'aaaaaaaa-0000-4000-8000-000000000001', 'Português', 'portugues', 'active', '[]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.knowledge_subjects WHERE slug = 'portugues');
