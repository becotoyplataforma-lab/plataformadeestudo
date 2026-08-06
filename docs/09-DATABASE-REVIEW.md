# DATABASE REVIEW

> Revisão completa do modelo físico (`08-DATABASE-PHYSICAL.md`) antes da geração do schema SQL.
> Apenas validação e registro de observações. Nenhum documento foi alterado.
> Conflitos são registrados sem correção automática.

---

## SUMMARY

- Modelo físico com 28 entidades, 15 enums, 4 materialized views, 6 funções, 5 buckets e 3 coleções vetoriais.
- Estrutura aderente ao padrão `07-ENTITY-STANDARDS.md`.
- Aplica as decisões de domínio (KnowledgeSubject e StudySubject) e o modelo de domínio (05).
- Identificados: 1 problema crítico, 8 melhorias recomendadas e 9 observações.
- Conclusão: apto para gerar o schema SQL, exceto pelas entidades vetoriais (dimensão de VECTOR pendente).

---

## DOMAIN VALIDATION

### Identity
- Coesão: alta. Entidades focadas em identidade e sessão.
- Acoplamento: baixo. Base do sistema.
- Aggregate Roots: User e Session coerentes.
- Dependências: nenhuma interna; todos dependem dele.
- Escalabilidade: adequada.

### Contest
- Coesão: alta. Órgãos, bancas, concursos e editais.
- Acoplamento: baixo com os demais.
- Aggregate Roots: Contest, Organ e Board coerentes.
- Dependências: Identity; Study e Analytics dependem dele (futuro).
- Escalabilidade: adequada; conteúdo de catálogo tende a crescer moderadamente.

### Knowledge
- Coesão: alta. Documento, chunks e embeddings.
- Acoplamento: médio — RLS herdado pela cadeia chunk → document → user.
- Aggregate Roots: Document coerente.
- Dependências: Identity; AI e Study consomem (pós-MVP).
- Escalabilidade: embeddings e chunks crescem muito; exige particionamento/limpeza.

### Study
- Coesão: alta, porém domínio denso (muitos aggregate roots).
- Acoplamento: médio — referência a Knowledge (knowledge_subjects) e Identity.
- Aggregate Roots: Question, QuestionAttempt, Flashcard, StudySubject, KnowledgeSubject, StudyTask.
- Dependências: Identity; Contest e Knowledge alimentam (futuro).
- Escalabilidade: question_attempts e review_schedules crescem rápido por usuário.

### AI
- Coesão: alta.
- Acoplamento: médio — AiUsage na fronteira com Billing.
- Aggregate Roots: ChatSession e AiUsage coerentes.
- Dependências: Identity; Knowledge e Billing.
- Escalabilidade: chat_messages cresce rápido; retenção a definir.

### Billing
- Coesão: alta. Planos, assinaturas e pagamentos.
- Acoplamento: baixo; isolado por funções definer.
- Aggregate Roots: Subscription e Plan coerentes.
- Dependências: Identity.
- Escalabilidade: volume baixo; dados financeiros sensíveis.

### Analytics
- Coesão: média — depende de eventos de outros domínios.
- Acoplamento: médio — entrada de eventos ainda sem caminho definido.
- Aggregate Roots: EventLog e DailySummary.
- Dependências: Identity; consume Study, AI e Billing.
- Escalabilidade: event_logs cresce sem limite; exige retenção/particionamento.

### Administration
- Coesão: alta.
- Acoplamento: baixo; atua sobre todos os domínios por auditoria.
- Aggregate Roots: SystemSetting e AdminActionLog.
- Dependências: Identity.
- Escalabilidade: adequada.

---

## ENTITY VALIDATION

Legenda: OK = conforme; OBS = observação registrada.

### Identity
- **users** — OK. Responsabilidade única; ownership individual; RLS ok; audit ok; soft delete ok.
- **profiles** — OK. 1:1 com users; ownership individual; sem soft delete (vive com user).
- **sessions** — OBS: sobrepõe o provedor de autenticação externo (decisão aberta OPEN-003).

### Contest
- **organs** — OK. Catálogo; RLS de catálogo; soft delete ok.
- **boards** — OK. Idem.
- **contests** — OK. Agregado; FKs para organs/boards; índices ok.
- **editais** — OBS: nome em português (mixed naming); unicidade de edital vigente depende de índice parcial não listado em INDEXES.

### Knowledge
- **documents** — OK. Ownership individual; RLS ok; soft delete ok.
- **document_chunks** — OK. Pertence ao agregado; RLS herdado.
- **embeddings** — **OBS (crítico)**: dimensão do VECTOR não definida (OPEN-001); RLS via cadeia de 3 níveis é complexa; 1:1 com chunk sem tratamento para chunk soft-deleted.

### Study
- **knowledge_subjects** — OK. Catálogo compartilhado; RLS ok.
- **study_subjects** — OK. Disciplina do usuário; ownership individual.
- **study_tasks** — OBS: dono do cronograma em aberto (OPEN-002).
- **questions** — OBS: coluna `gabarito` exposta em consulta de listagem — risco de revelar resposta antes da tentativa.
- **question_options** — OK. Compõe questão; letra única.
- **question_attempts** — OK. Imutável; ownership individual; índices ok.
- **flashcards** — OK. Ownership individual; tags com índice GIN.
- **review_schedules** — OK. 1:1 com flashcard; índices ok.

### AI
- **chat_sessions** — OK. Ownership individual.
- **chat_messages** — OK. Imutável; pertence ao agregado.
- **ai_usage** — OBS: fronteira AI/Billing (OPEN-004); sem created_at (diverge do padrão de auditoria); nome singular.

### Billing
- **plans** — OK. Catálogo.
- **subscriptions** — OK. Uma ativa por usuário (índice parcial implícito).
- **payments** — OBS: sem updated_at (aceitável por imutabilidade, mas diverge do padrão de auditoria).

### Analytics
- **event_logs** — **OBS (crítico)**: RLS somente admin, mas não há função definida para outros domínios escreverem eventos — sem caminho de escrita, a entrada de Analytics fica sem fonte.
- **daily_summaries** — OBS: leitura pelo usuário, escrita por definer, mas nenhuma função de agregação listada (OPEN-006).

### Administration
- **system_settings** — OK. Sem ownership; RLS admin.
- **admin_action_logs** — OK. Imutável; RLS admin.

---

## CROSS DOMAIN VALIDATION

- **Dependências circulares:** nenhuma identificada.
- **Acoplamento excessivo:** risco em Analytics (depende de eventos de Study, AI e Billing) e em AiUsage (AI ↔ Billing). Sem caminho formal de eventos, Analytics pode virar consulta direta.
- **Shared Kernel:** coerente (UserId, EmailAddress, Plan, Money).
- **ACL:** prevista para AI←Knowledge, Analytics←origens, Contest→Study, Billing←provedor, Knowledge←provedores externos. Sem conflitos.
- **Comunicação entre domínios:** definida por eventos e contratos; porém o mecanismo de eventos não existe no MVP (conceitual) — registrar que o caminho de escrita de eventos precisa ser resolvido antes do pós-MVP.

---

## PERFORMANCE REVIEW

- **Vetores:** índice HNSW previsto; dimensão pendente (OPEN-001). Busca precisa filtrar por usuário para escala.
- **Índices:** cobrem principais filtros (user_id, datas, status, FKs). Índice parcial para edital vigente e assinatura ativa devem ser explicitados no SQL.
- **Materialized Views:** adequadas para analytics; custo de refresh a monitorar; sujeitas a OPEN-006 (materialização).
- **Buckets:** adequados; uploads via presigned URLs.
- **Consultas previstas:** risco de N+1 em questões com alternativas (prever batch). Listagens com paginação.

---

## SECURITY REVIEW

- **RLS:** aplicado em todas as entidades; catálogos com leitura autenticada e escrita admin; sistema via definer. Consistente.
- **Ownership:** coerente com as políticas (dados de usuário individuais).
- **Auditoria:** presente; observações menores em ai_usage e payments.
- **Dados sensíveis:** gabarito de questão deve ser protegido em listagem (coluna sensível). Dados financeiros isolados.
- **Permissões:** service role somente servidor; funções definer para operações de sistema. Consistente.

---

## FUTURE SCALABILITY

- **event_logs:** crescimento sem limite — prever retenção, particionamento ou TTL.
- **chat_messages:** crescimento rápido por usuário — definir retenção/limite.
- **embeddings:** volume alto — particionar e limpar com o documento.
- **question_attempts / daily_summaries:** crescem por usuário — índices já previstos; daily_summaries limita consultas.
- **Busca semântica:** filtrar por usuário antes da similaridade para escalar.
- **Catálogo Contest:** crescimento moderado — índices e curadoria.

---

## FINAL CHECKLIST

- [ ] Modelo segue o padrão de 07-ENTITY-STANDARDS.
- [ ] Todas as entidades possuem UUID, auditoria e ownership.
- [ ] RLS definido para todas as entidades.
- [ ] Soft delete aplicado conforme a política.
- [ ] Enums, views, funções e buckets documentados.
- [ ] Dimensão de VECTOR definida (pendente — OPEN-001).
- [ ] Caminho de escrita de eventos resolvido (pendente).
- [ ] Função de agregação de daily_summaries definida (pendente).
- [ ] Proteção do gabarito de questões em listagem (pendente).
- [ ] Consistência de nomenclatura pt/en revisada (pendente).
- [ ] Nenhum documento anterior alterado nesta revisão.
- [ ] Conflitos registrados sem correção automática.

---

## RESULTADO DA REVISÃO

- **Problemas críticos:** 1
  - Dimensão do VECTOR (embeddings) indefinida — impede gerar o SQL das tabelas vetoriais.
- **Melhorias recomendadas:** 8
  1. Definir caminho de escrita de eventos (função record_event).
  2. Definir função de agregação de daily_summaries.
  3. Proteger coluna `gabarito` em consultas de listagem.
  4. Padronizar idioma de nomes de tabelas e valores de enums.
  5. Tratar relação chunk ↔ embedding frente ao soft delete.
  6. Explicitar índices parciais (edital vigente, assinatura ativa).
  7. Definir retenção/particionamento para event_logs e chat_messages.
  8. Prever batch nas consultas de questões com alternativas.
- **Observações:** 9
  1. sessions sobrepõe provedor de autenticação externo.
  2. Dono do cronograma em aberto (study_tasks).
  3. Fronteira AiUsage AI/Billing em aberto.
  4. RLS de embeddings via cadeia de 3 níveis é complexa.
  5. Nome `ai_usage` singular (padrão é plural).
  6. Tabelas/valores em pt e en misturados.
  7. payments sem updated_at (imutável, mas diverge do padrão).
  8. ai_usage sem created_at.
  9. Tabelas do Contest são pós-MVP (sem código hoje).

- **Apto para gerar o schema SQL:** **Sim, com ressalva.**
  As entidades não vetoriais estão prontas. Para as coleções vetoriais
  (embeddings e futuras), é necessário resolver a dimensão do VECTOR
  (decisão aberta OPEN-001) antes de gerar o SQL correspondente.
