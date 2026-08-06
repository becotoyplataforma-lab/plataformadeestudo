-- ============================================================
-- ConcursoAI — Domínio KNOWLEDGE — Seeds
-- Catálogo inicial de matérias e tópicos para concursos públicos.
-- ============================================================

-- ============================================================
-- KNOWLEDGE_SUBJECTS (25 matérias)
-- ============================================================

INSERT INTO knowledge_subjects (name, slug, description, color, keywords) VALUES
('Direito Constitucional', 'direito-constitucional', 'Constituição Federal, direitos fundamentais, organização do Estado', '#dc2626', '["constituição","CF/88","controle de constitucionalidade","ADI","ADC","direitos fundamentais","poder constituinte","remédios constitucionais"]'),
('Direito Administrativo', 'direito-administrativo', 'Administração pública, atos, licitações, servidores', '#ea580c', '["ato administrativo","licitação","lei 8.112","lei 14.133","improbidade","poder de polícia","serviço público"]'),
('Direito Penal', 'direito-penal', 'Crimes, penas, teoria do crime', '#ca8a04', '["código penal","crime","pena","tipicidade","culpabilidade","imputabilidade"]'),
('Direito Processual Penal', 'direito-processual-penal', 'Processo penal, investigação, provas, recursos', '#65a30d', '["código de processo penal","inquérito","ação penal","provas","prisão","recursos"]'),
('Direito Civil', 'direito-civil', 'Código Civil, obrigações, contratos, família', '#16a34a', '["código civil","obrigações","contratos","responsabilidade civil","família","sucessões"]'),
('Direito Processual Civil', 'direito-processual-civil', 'Processo civil, jurisdição, ação, recursos', '#0891b2', '["cpc","jurisdição","competência","tutela","recursos","execução"]'),
('Direito do Trabalho', 'direito-do-trabalho', 'CLT, relações de trabalho, direitos trabalhistas', '#2563eb', '["clt","empregado","empregador","jornada","férias","rescisão","justiça do trabalho"]'),
('Direito Processual do Trabalho', 'direito-processual-do-trabalho', 'Processo trabalhista, reclamação, recursos', '#7c3aed', '["reclamação trabalhista","dissídio","execução trabalhista","recursos trabalhistas"]'),
('Direito Tributário', 'direito-tributario', 'Tributos, impostos, contribuições, CTN', '#9333ea', '["ctn","tributo","imposto","taxa","contribuição","competência tributária","imunidade"]'),
('Direito Previdenciário', 'direito-previdenciario', 'RGPS, benefícios, aposentadoria, RPPS', '#c026d3', '["inss","aposentadoria","benefício","pensão","auxílio","segurado","carência"]'),
('Direito Ambiental', 'direito-ambiental', 'Meio ambiente, licenciamento, responsabilidade', '#db2777', '["meio ambiente","licenciamento","eia-rima","poluição","unidades de conservação","responsabilidade ambiental"]'),
('Direito Empresarial', 'direito-empresarial', 'Empresas, sociedades, títulos de crédito, falência', '#e11d48', '["empresário","sociedade","ltda","sa","título de crédito","falência","recuperação judicial"]'),
('Direitos Humanos', 'direitos-humanos', 'Direitos humanos, tratados, DUDH, Corte IDH', '#ef4444', '["direitos humanos","dudh","tratados","corte idh","dignidade","igualdade"]'),
('Legislação Especial', 'legislacao-especial', 'Leis especiais para concursos', '#f97316', '["lei 8.112","lei 8.666","lei 14.133","lei de improbidade","lei de licitações","estatuto"]'),
('Raciocínio Lógico', 'raciocinio-logico', 'Lógica proposicional, argumentos, conjuntos', '#84cc16', '["proposição","tabela verdade","argumento","silogismo","conjuntos","diagrama lógico"]'),
('Matemática', 'matematica', 'Matemática básica, álgebra, geometria, financeira', '#14b8a6', '["álgebra","geometria","porcentagem","juros","estatística","probabilidade","trigonometria"]'),
('Estatística', 'estatistica', 'Estatística descritiva, probabilidade, inferência', '#06b6d4', '["média","mediana","moda","desvio padrão","distribuição","probabilidade","amostragem"]'),
('Português', 'portugues', 'Gramática, interpretação, redação', '#0ea5e9', '["gramática","interpretação","redação","concordância","regência","crase","pontuação","morfologia"]'),
('Redação', 'redacao', 'Redação oficial, dissertação, discursiva', '#3b82f6', '["dissertação","argumentação","redação oficial","coesão","coerência","manual de redação"]'),
('Informática', 'informatica', 'TI básica, segurança, pacote Office, internet', '#6366f1', '["windows","linux","office","excel","word","internet","segurança","hardware","software"]'),
('Atualidades', 'atualidades', 'Atualidades, geopolítica, economia, meio ambiente', '#8b5cf6', '["atualidades","geopolítica","economia","meio ambiente","tecnologia","política","sociedade"]'),
('Ética no Serviço Público', 'etica-no-servico-publico', 'Ética, moral, deontologia, código de conduta', '#a855f7', '["ética","moral","deontologia","código de conduta","improbidade","moralidade"]'),
('Administração Pública', 'administracao-publica', 'Administração, gestão, políticas públicas', '#d946ef', '["administração","gestão","políticas públicas","planejamento","orçamento","governança"]'),
('Economia', 'economia', 'Economia, macro, micro, finanças públicas', '#ec4899', '["pib","inflação","política monetária","política fiscal","câmbio","crescimento","desenvolvimento"]'),
('Contabilidade', 'contabilidade', 'Contabilidade geral, pública, análise', '#f43f5e', '["contabilidade geral","contabilidade pública","balanço","demonstrações","receita","despesa","orçamento"]')
ON CONFLICT DO NOTHING;

-- ============================================================
-- KNOWLEDGE_TOPICS (exemplo: Direito Constitucional)
-- ============================================================

DO $$
DECLARE
  v_subject_id UUID;
BEGIN
  SELECT id INTO v_subject_id FROM knowledge_subjects WHERE slug = 'direito-constitucional';

  IF v_subject_id IS NOT NULL THEN
    -- Tópicos raiz
    INSERT INTO knowledge_topics (subject_id, name, slug, description) VALUES
    (v_subject_id, 'Teoria da Constituição', 'teoria-da-constituicao', 'Conceito, classificação, elementos, supremacia, eficácia das normas'),
    (v_subject_id, 'Poder Constituinte', 'poder-constituinte', 'Originário, derivado, reformador, revisor, limitações'),
    (v_subject_id, 'Direitos e Garantias Fundamentais', 'direitos-e-garantias-fundamentais', 'Direitos individuais, coletivos, sociais, nacionalidade, políticos'),
    (v_subject_id, 'Organização do Estado', 'organizacao-do-estado', 'Federação, União, Estados, Municípios, DF, Territórios, intervenção'),
    (v_subject_id, 'Administração Pública', 'administracao-publica-constitucional', 'Princípios, servidores, militares, regiões'),
    (v_subject_id, 'Poder Legislativo', 'poder-legislativo', 'Congresso, Câmara, Senado, deputados, senadores, processo legislativo, CPI, TCU'),
    (v_subject_id, 'Poder Executivo', 'poder-executivo', 'Presidente, ministros, atribuições, responsabilidade, crimes de responsabilidade'),
    (v_subject_id, 'Poder Judiciário', 'poder-judiciario', 'STF, STJ, CNJ, tribunais, juízes, garantias, competências, súmula vinculante'),
    (v_subject_id, 'Funções Essenciais à Justiça', 'funcoes-essenciais-a-justica', 'MP, AGU, DP, advocacia'),
    (v_subject_id, 'Defesa do Estado e Instituições Democráticas', 'defesa-do-estado', 'Estado de defesa, estado de sítio, Forças Armadas, segurança pública'),
    (v_subject_id, 'Controle de Constitucionalidade', 'controle-de-constitucionalidade', 'ADI, ADC, ADPF, ADO, controle difuso, concentrado, abstrato'),
    (v_subject_id, 'Ordem Social', 'ordem-social', 'Seguridade, saúde, previdência, assistência, educação, cultura, meio ambiente'),
    (v_subject_id, 'Ordem Econômica e Financeira', 'ordem-economica-financeira', 'Princípios, intervenção do Estado, política urbana, agrícola, SFN')
    ON CONFLICT DO NOTHING;

    -- Sub-tópicos de Direitos e Garantias Fundamentais
    DECLARE
      v_parent_id UUID;
    BEGIN
      SELECT id INTO v_parent_id FROM knowledge_topics WHERE subject_id = v_subject_id AND slug = 'direitos-e-garantias-fundamentais';

      IF v_parent_id IS NOT NULL THEN
        INSERT INTO knowledge_topics (subject_id, parent_topic_id, name, slug, description) VALUES
        (v_subject_id, v_parent_id, 'Direitos Individuais (Art. 5º)', 'direitos-individuais-art-5', 'Vida, liberdade, igualdade, segurança, propriedade, devido processo legal'),
        (v_subject_id, v_parent_id, 'Direitos Sociais (Art. 6º a 11)', 'direitos-sociais', 'Educação, saúde, alimentação, trabalho, moradia, transporte, lazer, segurança, previdência'),
        (v_subject_id, v_parent_id, 'Nacionalidade', 'nacionalidade', 'Brasileiros natos, naturalizados, portugueses equiparados, perda'),
        (v_subject_id, v_parent_id, 'Direitos Políticos', 'direitos-politicos', 'Sufrágio, voto, elegibilidade, partidos políticos, inelegibilidade, perda, suspensão'),
        (v_subject_id, v_parent_id, 'Remédios Constitucionais', 'remedios-constitucionais', 'Habeas corpus, mandado de segurança, habeas data, mandado de injunção, ação popular')
        ON CONFLICT DO NOTHING;
      END IF;
    END;
  END IF;
END $$;

-- ============================================================
-- KNOWLEDGE_TAGS (exemplos iniciais)
-- ============================================================

INSERT INTO knowledge_tags (name, slug) VALUES
('cespe', 'cespe'),
('fgv', 'fgv'),
('cesgranrio', 'cesgranrio'),
('fcc', 'fcc'),
('vunesp', 'vunesp'),
('trt', 'trt'),
('trf', 'trf'),
('stf', 'stf'),
('stj', 'stj'),
('tcu', 'tcu'),
('inss', 'inss'),
('policia-federal', 'policia-federal'),
('policia-civil', 'policia-civil'),
('receita-federal', 'receita-federal'),
('2024', '2024'),
('2025', '2025'),
('sumula-vinculante', 'sumula-vinculante'),
('sumula', 'sumula'),
('jurisprudencia', 'jurisprudencia'),
('doutrina', 'doutrina')
ON CONFLICT DO NOTHING;
