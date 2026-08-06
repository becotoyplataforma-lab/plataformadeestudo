-- ============================================================
-- ConcursoAI Platform — Seed (dados de demonstração)
-- Aplicar APÓS policies.sql, APENAS em dev/staging.
-- NOTA: só será visível para usuários autenticados (RLS).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Catálogo de disciplinas (content_subjects)
-- ------------------------------------------------------------
INSERT INTO public.content_subjects (name, slug, color, description) VALUES
  ('Direito Constitucional',   'direito-constitucional',   '#ef4444', 'CF/88, Poderes, Direitos e Garantias'),
  ('Direito Administrativo',   'direito-administrativo',   '#f97316', 'Atos, agentes, licitações, responsabilidade civil'),
  ('Direito Civil',            'direito-civil',            '#eab308', 'CC/2002, obrigações, contratos, família'),
  ('Direito Penal',            'direito-penal',            '#22c55e', 'CP, crimes, penas'),
  ('Direito Processual Penal', 'processo-penal',           '#10b981', 'CPP, inquérito, ação penal'),
  ('Direito do Trabalho',      'direito-trabalho',         '#06b6d4', 'CLT, relações de trabalho'),
  ('Língua Portuguesa',        'lingua-portuguesa',        '#3b82f6', 'Gramática, interpretação, redação'),
  ('Raciocínio Lógico',        'raciocinio-logico',        '#6366f1', 'Lógica, matemática básica'),
  ('Informática',              'informatica',              '#8b5cf6', 'Hardware, software, segurança da informação'),
  ('Matemática Financeira',    'matematica-financeira',    '#d946ef', 'Juros, descontos, fluxo de caixa')
ON CONFLICT (name) DO NOTHING;

-- ------------------------------------------------------------
-- 2. Questões de demonstração (Direito Constitucional)
-- ------------------------------------------------------------
-- NOTA: referências a content_subjects por slug para evitar UUIDs hardcoded.
WITH q AS (
  INSERT INTO public.questions
    (subject_id, banca, cargo, ano, nivel, enunciado, gabarito, explicacao, fonte, is_public, content_hash, status)
  VALUES
    (
      (SELECT id FROM public.content_subjects WHERE slug = 'direito-constitucional'),
      'CEBRASPE', 'Analista Judiciário', 2023, 'medio',
      'À luz da Constituição Federal de 1988, assinale a opção correta acerca dos direitos fundamentais.',
      'C',
      'O art. 5º, X, da CF/88 garante a inviolabilidade da intimidade, da vida privada, da honra e da imagem das pessoas, assegurando o direito à indenização pelo dano material ou moral decorrente de sua violação. As demais alternativas contrariam o texto constitucional.',
      'Prova CEBRASPE 2023 (adaptada)', true, 'hash-demo-1', 'publicada'
    ),
    (
      (SELECT id FROM public.content_subjects WHERE slug = 'direito-constitucional'),
      'FGV', 'Técnico Administrativo', 2022, 'facil',
      'A respeito dos Poderes da República, é correto afirmar que:',
      'B',
      'A CF/88 consagra a independência e a harmonia entre os Poderes Executivo, Legislativo e Judiciário (art. 2º). A separação de funções impede a subordinação entre eles.',
      'Prova FGV 2022 (adaptada)', true, 'hash-demo-2', 'publicada'
    ),
    (
      (SELECT id FROM public.content_subjects WHERE slug = 'direito-administrativo'),
      'VUNESP', 'Agente de Fiscalização', 2023, 'medio',
      'Sobre os princípios da Administração Pública expressos no art. 37 da CF/88, assinale a alternativa que apresenta um deles.',
      'A',
      'O art. 37, caput, da CF/88 elenca os princípios da legalidade, impessoalidade, moralidade, publicidade e eficiência (LIMPE). A moralidade, portanto, é princípio expresso.',
      'Prova VUNESP 2023 (adaptada)', true, 'hash-demo-3', 'publicada'
    ),
    (
      (SELECT id FROM public.content_subjects WHERE slug = 'lingua-portuguesa'),
      'CEBRASPE', 'Técnico Administrativo', 2024, 'facil',
      'Assinale a alternativa em que a concordância verbal está correta.',
      'D',
      'Em "Fazem dez anos que ele estuda" o verbo "fazer" indicando tempo decorrido é impessoal e fica na 3ª pessoa do singular: "Faz dez anos...". A alternativa D apresenta a concordância correta.',
      'Prova CEBRASPE 2024 (adaptada)', true, 'hash-demo-4', 'publicada'
    ),
    (
      (SELECT id FROM public.content_subjects WHERE slug = 'raciocinio-logico'),
      'FGV', 'Analista', 2023, 'dificil',
      'Em uma sequência numérica, cada termo é igual ao dobro do anterior mais 1. Se o primeiro termo é 1, qual é o quinto termo?',
      'E',
      'a1=1; a2=2*1+1=3; a3=2*3+1=7; a4=2*7+1=15; a5=2*15+1=31. Portanto, o quinto termo é 31.',
      'Prova FGV 2023 (adaptada)', true, 'hash-demo-5', 'publicada'
    )
  RETURNING id, enunciado, gabarito, subject_id
)
-- Alternativas (as demais são distratores genéricos)
SELECT '-- questões criadas --';

-- Alternativas da questão 1 (gabarito C)
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'A', 'Os direitos fundamentais são aplicáveis apenas aos brasileiros natos.', false
FROM public.questions WHERE content_hash = 'hash-demo-1';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'B', 'A casa é asilo inviolável do indivíduo, sendo livre o ingresso a qualquer hora por autoridade policial.', false
FROM public.questions WHERE content_hash = 'hash-demo-1';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'C', 'São invioláveis a intimidade, a vida privada, a honra e a imagem das pessoas, assegurado o direito a indenização pelo dano.', true
FROM public.questions WHERE content_hash = 'hash-demo-1';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'D', 'É admitida a pena de morte no Brasil em qualquer hipótese de crime hediondo.', false
FROM public.questions WHERE content_hash = 'hash-demo-1';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'E', 'O habeas data protege apenas o direito de ir e vir do indivíduo.', false
FROM public.questions WHERE content_hash = 'hash-demo-1';

-- Alternativas da questão 2 (gabarito B)
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'A', 'O Poder Judiciário subordina-se ao Poder Executivo.', false
FROM public.questions WHERE content_hash = 'hash-demo-2';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'B', 'Os Poderes são independentes e harmônicos entre si.', true
FROM public.questions WHERE content_hash = 'hash-demo-2';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'C', 'O Poder Legislativo exerce função exclusivamente jurisdicional.', false
FROM public.questions WHERE content_hash = 'hash-demo-2';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'D', 'A função típica do Poder Executivo é legislar.', false
FROM public.questions WHERE content_hash = 'hash-demo-2';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'E', 'Os Poderes podem delegar entre si o exercício de suas funções típicas livremente.', false
FROM public.questions WHERE content_hash = 'hash-demo-2';

-- Alternativas da questão 3 (gabarito A)
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'A', 'Moralidade', true
FROM public.questions WHERE content_hash = 'hash-demo-3';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'B', 'Oportunidade', false
FROM public.questions WHERE content_hash = 'hash-demo-3';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'C', 'Conveniência', false
FROM public.questions WHERE content_hash = 'hash-demo-3';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'D', 'Discricionariedade', false
FROM public.questions WHERE content_hash = 'hash-demo-3';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'E', 'Razoabilidade', false
FROM public.questions WHERE content_hash = 'hash-demo-3';

-- Alternativas da questão 4 (gabarito D)
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'A', 'Fazem dois meses que viajamos.', false
FROM public.questions WHERE content_hash = 'hash-demo-4';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'B', 'Houveram muitos inscritos no concurso.', false
FROM public.questions WHERE content_hash = 'hash-demo-4';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'C', 'Choveu e ventaram forte durante a semana.', false
FROM public.questions WHERE content_hash = 'hash-demo-4';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'D', 'Faz dez anos que ele estuda para concursos.', true
FROM public.questions WHERE content_hash = 'hash-demo-4';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'E', 'Existem um erro grave no edital.', false
FROM public.questions WHERE content_hash = 'hash-demo-4';

-- Alternativas da questão 5 (gabarito E)
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'A', '15', false
FROM public.questions WHERE content_hash = 'hash-demo-5';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'B', '17', false
FROM public.questions WHERE content_hash = 'hash-demo-5';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'C', '25', false
FROM public.questions WHERE content_hash = 'hash-demo-5';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'D', '29', false
FROM public.questions WHERE content_hash = 'hash-demo-5';
INSERT INTO public.question_options (question_id, letter, text, is_correct)
SELECT id, 'E', '31', true
FROM public.questions WHERE content_hash = 'hash-demo-5';

-- ------------------------------------------------------------
-- 3. Demo: usuário admin (opcional — substitua pelos UUIDs reais)
-- NOTA: o trigger handle_new_user cria o perfil automaticamente;
--       execute o UPDATE abaixo com o UUID do usuário desejado.
-- ------------------------------------------------------------
-- UPDATE public.profiles
-- SET is_admin = true, plano = 'intensivo'
-- WHERE id = 'REPLACE-WITH-YOUR-USER-UUID';
