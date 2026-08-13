# DOMAIN DECISIONS

> Registro oficial das decisões arquiteturais definitivas do domínio.
> Fonte oficial para futuras implementações.
> Sem código, sem SQL. Documentos anteriores não foram alterados.

---

## DECISION ID
DD-001

## TITLE
KnowledgeSubject substitui Subject (catálogo de conteúdo)

## STATUS
Accepted

## CONTEXT
- O conceito "Subject" era ambíguo: servia como catálogo de conteúdo e como disciplina do usuário.

## DECISION
- O catálogo de conteúdo passa a ser chamado conceitualmente de KnowledgeSubject.
- Usado como referência por Question.

## CONSEQUENCES
- Elimina ambiguidade entre catálogo e disciplina do usuário.
- Documentos anteriores mantidos; esta é a terminologia oficial daqui em diante.

## ALTERNATIVES CONSIDERED
- Manter Subject único.
- Criar ContentSubject.

## FUTURE IMPACT
- Modelo físico e código novos usarão KnowledgeSubject.

---

## DECISION ID
DD-002

## TITLE
StudySubject representa a disciplina do aluno

## STATUS
Accepted

## CONTEXT
- Faltava um conceito próprio para a disciplina pertencente ao usuário.

## DECISION
- StudySubject representa a disciplina do aluno.
- Usada por StudyTask e Flashcard.

## CONSEQUENCES
- Separa o catálogo compartilhado do estudo individual.
- Fronteiras de propriedade (RLS) ficam claras.

## ALTERNATIVES CONSIDERED
- Reutilizar Subject para ambos.

## FUTURE IMPACT
- StudySubject é dono de dados do usuário; KnowledgeSubject é compartilhado.

---

## DECISION ID
DD-003

## TITLE
Modular Monolith como arquitetura oficial

## STATUS
Accepted

## CONTEXT
- MVP precisa de simplicidade e velocidade, com possibilidade de evolução.

## DECISION
- Arquitetura oficial: Modular Monolith.
- Módulos independentes internamente, separados logicamente.

## CONSEQUENCES
- Sem custo de microsserviços no MVP.
- Migração futura facilitada pela separação lógica.

## ALTERNATIVES CONSIDERED
- Microsserviços no MVP.
- Monolito sem separação.

## FUTURE IMPACT
- Permite extrair módulos para serviços quando a escala exigir.

---

## DECISION ID
DD-004

## TITLE
Repository Pattern obrigatório

## STATUS
Accepted

## CONTEXT
- Persistência espalhada dificulta manutenção e testes.

## DECISION
- Toda persistência/consulta passa por Repository.

## CONSEQUENCES
- Isolamento do banco.
- Substituição de infraestrutura sem afetar o domínio.

## ALTERNATIVES CONSIDERED
- Acesso direto ao banco nas camadas de aplicação.

## FUTURE IMPACT
- Novas features criam repositório por agregado.

---

## DECISION ID
DD-005

## TITLE
Service Layer obrigatório

## STATUS
Accepted

## CONTEXT
- Regras de negócio em componentes ou fronteiras geram duplicação e acoplamento.

## DECISION
- Toda regra de negócio vive em Service Layer.
- Componentes e fronteiras não contêm regras de negócio.

## CONSEQUENCES
- Testabilidade e reuso.
- Fronteiras enxutas.

## ALTERNATIVES CONSIDERED
- Regras de negócio em components ou route handlers.

## FUTURE IMPACT
- Serviços por domínio em src/lib/services.

---

## DECISION ID
DD-006

## TITLE
DTO obrigatório

## STATUS
Accepted

## CONTEXT
- Entidades do banco não devem cruzar fronteiras.

## DECISION
- Toda saída de fronteira é um DTO validado.
- Entidades não são retornadas cruas.

## CONSEQUENCES
- Contratos estáveis.
- Campos sensíveis não vazam.

## ALTERNATIVES CONSIDERED
- Retornar entidades diretamente.

## FUTURE IMPACT
- Toda nova API/action usa DTO.

---

## DECISION ID
DD-007

## TITLE
Zod obrigatório

## STATUS
Accepted

## CONTEXT
- Entradas não confiáveis exigem validação em todas as fronteiras.

## DECISION
- Toda entrada e saída de fronteira é validada com Zod.
- Proibido uso de any.

## CONSEQUENCES
- Redução de bugs e riscos de segurança.
- Contratos tipados.

## ALTERNATIVES CONSIDERED
- Validação manual.
- Outras bibliotecas de validação.

## FUTURE IMPACT
- Validação central em src/lib/validations e src/lib/dto.

---

## DECISION ID
DD-008

## TITLE
RLS obrigatório

## STATUS
Accepted

## CONTEXT
- Segurança de dados por usuário é essencial em SaaS.

## DECISION
- RLS obrigatório em todas as tabelas.
- Fonte da verdade de permissões no banco.

## CONSEQUENCES
- Usuário acessa apenas os próprios dados.
- Proteção mesmo com falha na aplicação.

## ALTERNATIVES CONSIDERED
- Controle de acesso apenas na aplicação.

## FUTURE IMPACT
- Toda nova tabela cria políticas RLS.

---

## DECISION ID
DD-009

## TITLE
Soft Delete obrigatório

## STATUS
Accepted

## CONTEXT
- Exclusão física prejudica auditoria e histórico.

## DECISION
- Registros são marcados como removidos, não excluídos fisicamente.

## CONSEQUENCES
- Histórico preservado.
- Necessário regra de visibilidade dos removidos.

## ALTERNATIVES CONSIDERED
- Exclusão física.

## FUTURE IMPACT
- Regras de filtro consideram soft delete.

---

## DECISION ID
DD-010

## TITLE
UUID obrigatório

## STATUS
Accepted

## CONTEXT
- Identificadores sequenciais expõem dados e causam colisão entre ambientes.

## DECISION
- Identificadores primários são UUID.

## CONSEQUENCES
- Sem exposição de sequência.
- Compatível com múltiplos ambientes.

## ALTERNATIVES CONSIDERED
- Chaves numéricas autoincrementais.

## FUTURE IMPACT
- Toda nova entidade usa UUID.

---

## DECISION ID
DD-011

## TITLE
Event Driven apenas conceitual no MVP

## STATUS
Accepted

## CONTEXT
- Baixo acoplamento desejado, mas sem infraestrutura de eventos no MVP.

## DECISION
- Eventos de domínio são conceituais no MVP.
- Não há event bus obrigatório nesta fase.

## CONSEQUENCES
- Simplicidade no MVP.
- Domínios podem registrar eventos em log.

## ALTERNATIVES CONSIDERED
- Adotar event bus no MVP.

## FUTURE IMPACT
- Infraestrutura de eventos avaliada no pós-MVP.

---

## DECISION ID
DD-012

## TITLE
RAG como mecanismo oficial da IA

## STATUS
Accepted

## CONTEXT
- Respostas devem ser fundamentadas em material autorizado.

## DECISION
- RAG é o mecanismo oficial de IA.
- Fine-tuning não será usado no MVP.

## CONSEQUENCES
- Menos alucinação.
- Respostas com citação de fonte.

## ALTERNATIVES CONSIDERED
- Fine-tuning no MVP.
- Respostas apenas com conhecimento geral.

## FUTURE IMPACT
- Professor IA usa busca vetorial sobre o Knowledge.

---

## DECISION ID
DD-013

## TITLE
DeepSeek como provedor oficial de IA

## STATUS
Accepted

## CONTEXT
- Custo por token baixo e qualidade competitiva.

## DECISION
- DeepSeek é o provedor oficial de IA.
- OpenAI e Gemini não são o LLM principal.

## CONSEQUENCES
- Custos controlados.
- Abstração permite troca futura.

## ALTERNATIVES CONSIDERED
- OpenAI.
- Gemini.

## FUTURE IMPACT
- Provedor isolado em camada de integração.

---

## DECISION ID
DD-014

## TITLE
Mercado Pago como provedor oficial de pagamentos

## STATUS
Accepted

## CONTEXT
- Necessário processar pagamentos e ativar planos.

## DECISION
- Mercado Pago é o provedor oficial de pagamentos.
- Hubla e Stripe não são usados.

## CONSEQUENCES
- Pix, cartão e boleto.
- Webhook ativa plano.

## ALTERNATIVES CONSIDERED
- Hubla.
- Stripe.

## FUTURE IMPACT
- Provedor isolado em camada de integração.

---

## DECISION ID
DD-015

## TITLE
Cloudflare R2 como storage oficial

## STATUS
Accepted

## CONTEXT
- Documentos e arquivos exigem armazenamento econômico e escalável.

## DECISION
- Cloudflare R2 é o storage oficial de documentos.

## CONSEQUENCES
- Custo baixo.
- URLs presignadas.

## ALTERNATIVES CONSIDERED
- Buckets S3 padrão.
- Storage do Supabase como principal.

## FUTURE IMPACT
- Knowledge Engine armazena materiais no R2.

---

## DECISION ID
DD-016

## TITLE
Supabase PostgreSQL como banco oficial

## STATUS
Accepted

## CONTEXT
- Necessário Postgres com RLS, Auth, Storage e busca vetorial.

## DECISION
- Supabase PostgreSQL é o banco oficial.
- pgvector disponível para vetores.

## CONSEQUENCES
- RLS nativo.
- Ecossistema completo em um provedor.

## ALTERNATIVES CONSIDERED
- Postgres auto-gerenciado.
- Banco não relacional.

## FUTURE IMPACT
- Novas entidades seguem as convenções do Supabase.

---

## DECISION ID
DD-017

## TITLE
Não utilizar microsserviços no MVP

## STATUS
Accepted

## CONTEXT
- Microsserviços aumentam complexidade operacional sem necessidade atual.

## DECISION
- Microsserviços não são utilizados no MVP.
- Modular Monolith é a forma oficial.

## CONSEQUENCES
- Menos infraestrutura.
- Implantações mais simples.

## ALTERNATIVES CONSIDERED
- Microsserviços desde o início.

## FUTURE IMPACT
- Extração de módulos avaliada por demanda.

---

## DECISION ID
DD-018

## TITLE
Não utilizar lógica de negócio no frontend

## STATUS
Accepted

## CONTEXT
- Regras de negócio no frontend geram duplicação e risco de inconsistência.

## DECISION
- Lógica de negócio não fica no frontend.
- Fronteiras delegam a serviços.

## CONSEQUENCES
- Consistência centralizada.
- Frontend apenas apresenta e valida forma.

## ALTERNATIVES CONSIDERED
- Validar e aplicar regras no cliente.

## FUTURE IMPACT
- Componentes permanecem enxutos.

---

## DECISION ID
DD-019

## TITLE
Supabase Auth como fonte oficial de identidade

## STATUS
Accepted

## CONTEXT
- O domínio Identity possuía public.users; o Supabase gerencia auth.users.
- Dupla fonte de verdade geraria dessincronização e risco de segurança.

## DECISION
- auth.users é a única fonte oficial de identidade.
- public.users deixa de existir.
- public.profiles referencia auth.users(id).
- Autenticação é responsabilidade exclusiva do Supabase Auth.
- Sessions internas somente se houver necessidade além do Supabase Auth.

## CONSEQUENCES
- Identidade sem duplicação; RLS via auth.uid(); menor manutenção.
- Dependência do Supabase Auth.

## ALTERNATIVES CONSIDERED
- OPÇÃO B (public.users + auth.users em paralelo) — rejeitada.

## FUTURE IMPACT
- Ver ADR-001 (.ai/adr/ADR-001-SUPABASE-AUTH.md).

---

## DECISION ID
DD-020

## TITLE
Peso de matéria do edital: relacional com escopo por cargo

## STATUS
Accepted

## CONTEXT
- A Contest Intelligence precisa de fonte estruturada do conteúdo programático do edital.
- O edital pode ter peso único para todos os cargos ou pesos específicos por cargo.
- Referência: docs/19-CONTEST-INTELLIGENCE-SPEC.md (Decisão 1).

## DECISION
- `notice_subjects` é a fonte estruturada: (edital_id, knowledge_subject_id, position_id, weight).
- `edital_id` é FK para `editais`.
- `position_id NULL` = peso geral; `position_id` preenchido = peso específico do cargo.
- Peso específico do cargo SUBSTITUI o geral (não soma).
- `weight NOT NULL`, faixa 0–100 (bruto; normalização como share somente no consumo).
- `UNIQUE (edital_id, position_id, knowledge_subject_id)`.
- Ausência de linha = matéria não prevista naquele escopo.
- Sem posição do usuário → usar apenas o peso geral.
- `notice_topics` fica para fase posterior.

## CONSEQUENCES
- JOIN/agregação por matéria diretos no planner (fator editalWeight futuro).
- Cobre edital de peso único e multi-cargo sem refazer a migration.
- Sem edital/linha → fator neutro (regressão dos Grupos B/C preservada).

## ALTERNATIVES CONSIDERED
- Apenas JSON em editais.programmatic_content (flexível, mas não-relacional).
- Peso apenas por edital (sem cargo) — insuficiente para multi-cargo.
- Peso apenas por cargo (sem peso geral).

## FUTURE IMPACT
- Base para o fator `editalWeight` no planner (Grupo D+) e para `notice_topics` (fase 2).
- Ver docs/19-CONTEST-INTELLIGENCE-SPEC.md §4–5.

---

## DECISION ID
DD-021

## TITLE
Escala e semântica do peso do edital

## STATUS
Accepted

## CONTEXT
- O `weight` de notice_subjects precisa de escala e semântica claras.
- `weight = 0` não pode ser confundido com ausência (dados incompletos não podem prejudicar o planner).

## DECISION
- `weight INTEGER NOT NULL`, domínio 0..100.
- `0` é um valor explícito e distinto de ausência.
- Ausência de linha em `notice_subjects` = matéria NÃO declarada naquele escopo.
- `share = weight / SUM(weight)` do escopo (edital_id, position_id) — calculado somente no consumo.
- Soma zero → fator neutro (sem divisão por zero).
- `weight > 0` → participa do fator edital (share).
- `weight = 0` → peso de edital zero.
- Matéria não listada → fator de edital NEUTRO (preserva desempenho e banca).
- Nunca armazenar o `share`.

## CONSEQUENCES
- Dados de edital incompletos não prejudicam o planner existente (Grupos B/C).
- Semântica unívoca entre 0 e ausência.
- Base para o fator editalWeight.

## ALTERNATIVES CONSIDERED
- weight=0 tratado como "não recebe tempo" (rejeitado — matéria pode sumir por falta de dados).
- Armazenar share normalizado (rejeitado — normalização só no consumo).

## FUTURE IMPACT
- Complementa a DD-020; usada pelo fator editalWeight (Grupo D+).

---

## DECISION ID
DD-022

## TITLE
Granularidade do edital: matéria na V1, tópico na fase 2

## STATUS
Accepted

## CONTEXT
- O peso do edital (DD-020/DD-021) é por matéria em notice_subjects.
- O catálogo já possui knowledge_topics; decidir se o peso também desce ao nível de tópico agora.

## DECISION
- `notice_subjects` é a granularidade da primeira versão.
- `editalWeight` é calculado por matéria.
- `notice_topics` será uma tabela ADITIVA, sem alteração de `notice_subjects`.
- FK de `notice_topics` → `notice_subjects`.
- `knowledge_topic_id` identifica o tópico.
- Peso de tópico segue a semântica da DD-021.
- Ausência de `notice_topics` não prejudica o modelo de matéria.
- NÃO criar estrutura de tópico agora.

## CONSEQUENCES
- Domínio simples; sem infraestrutura que o planner atual ainda não consome.
- Modelo de matéria estável; tópico entra depois sem migração de notice_subjects.

## ALTERNATIVES CONSIDERED
- Criar notice_topics já na V1 (rejeitado — esforço sem consumo pelo planner; knowledge_topics esparso).
- Granularidade apenas de tópico (rejeitado).

## FUTURE IMPACT
- Fase 2: notice_topics (FK notice_subjects + knowledge_topic_id + weight) e priorização por tópico (V1.2/V2).

---

## DECISION ID
DD-023

## TITLE
Vínculo do usuário com concurso e cargo

## STATUS
Accepted

## CONTEXT
- O planner D+ precisa resolver edital e cargo do usuário.
- profiles.concurso_alvo é texto legado; não resolve o edital de forma robusta.
- Edital vigente não deve ser inferido por data (o mais recente pode estar errado — ex.: retificação).

## DECISION
- `profiles.contest_id` (FK contests) nullable — concurso escolhido.
- `profiles.position_id` (FK positions) nullable — cargo escolhido explicitamente (não inferido).
- Posição deve pertencer ao concurso selecionado; inconsistência → NÃO aplicar peso específico (fallback para peso geral ou fator neutro).
- `concurso_alvo` permanece como legado/exibição; o planner D+ usa somente o relacionamento estruturado.
- Sem `user_contests` na V1.
- Edital deve ser EXPLICITAMENTE vigente (`is_current`/flag equivalente, ou relação vigente no contest).
- Ambiguidade entre editais → fator de edital NEUTRO; nunca escolha silenciosa por data.

## CONSEQUENCES
- Planner seguro: sem escolha silenciosa de edital/cargo.
- Regressão do Grupo C preservada quando não há vínculo estruturado.
- Base para a resolução: profiles → contest → edital vigente → notice_subjects.

## ALTERNATIVES CONSIDERED
- Escolher edital mais recente por data (rejeitado — pode ser retificação/errado).
- Derivar cargo do concurso (rejeitado — DD-020 exige posição explícita).
- Lista user_contests na V1 (adiado).

## FUTURE IMPACT
- Contests ganham indicação de edital vigente (`is_current`); o planner D+ usa na resolução.

---

## DECISION ID
DD-024

## TITLE
Origem dos dados de Contest Intelligence

## STATUS
Accepted

## CONTEXT
- Decidir de onde vêm os dados de edital/cargo/banca (admin, IA, ETL) e o impacto no modelo.

## DECISION
- Fase 0: administração manual.
- Fase 1: IA assistida, sempre gerando RASCUNHO para revisão humana.
- Fase 2: ETLs por banca.
- `is_current` definido explicitamente pelo administrador (nunca automático por data).
- Origem não altera o modelo relacional (`notice_subjects` é a fonte estruturada).
- O planner consome somente edital PUBLICADO + VIGENTE, independentemente da origem.

## CONSEQUENCES
- Dados confiáveis; IA/ETL nunca publicam diretamente.
- Modelo estável independente da origem dos dados.
- Regressão do Grupo C preservada (sem edital vigente → fator neutro).

## ALTERNATIVES CONSIDERED
- IA publicando diretamente (rejeitado — risco de alucinação).
- ETL na V1 (adiado para fase 2).

## FUTURE IMPACT
- Base para os pipelines ETL (backlog) e para o fluxo de revisão admin.

---

## DECISION ID
DD-025

## TITLE
Estratégia de migration do domínio Contest

## STATUS
Accepted

## CONTEXT
- O banco não possui baseline de migrations (`__drizzle_migrations` ausente); tabelas vieram de SQL manual por domínio.
- Introduzir `drizzle:migrate` agora criaria risco de "already exists" e estado não rastreável.

## DECISION
- SQL manual por domínio como estratégia oficial.
- `database/contest/` com `schema.sql`, `rls.sql`, `seeds.sql` e `functions.sql` (quando necessários).
- Aplicação via DIRECT_URL.
- Scripts idempotentes e reexecutáveis.
- Alterações em `profiles` com `ALTER TABLE ... IF NOT EXISTS`/guards.
- Verificação read-only obrigatória antes da aplicação.
- `contest.ts` passa a espelhar o schema para tipos/introspecção.
- NÃO utilizar `drizzle:migrate` nesta etapa.
- Nenhuma adoção de baseline Drizzle neste momento.

## CONSEQUENCES
- Consistência com o padrão atual do projeto.
- Migração segura e rastreável via SQL versionado no repositório.
- Sem risco de conflito com `__drizzle_migrations`.

## ALTERNATIVES CONSIDERED
- `drizzle:migrate` para o domínio Contest (rejeitado — sem baseline, risco "already exists").
- Híbrido SQL + Drizzle (adiado).

## FUTURE IMPACT
- Base para a implementação do domínio Contest (Grupo E / D+).

---

# OPEN DECISIONS

> Decisões pendentes. Não decididas neste documento. Apenas registradas.

## OPEN-001
- Título: Provedor oficial de embeddings (RAG).
- Contexto: RAG requer embeddings; OpenAI ainda é referenciado em documentos; stack proíbe OpenAI como LLM.
- Pendência: escolher provedor de embeddings oficial.
- **Status: RESOLVIDO** — ver `docs/10-EMBEDDING-STANDARD.md` (BAAI/bge-m3, dimensão 1024, pgvector/HNSW, Hybrid Search).

## OPEN-002
- Título: Dono do cronograma (Contest ou Study).
- Contexto: cronograma deriva de edital, mas é executado pelo aluno.
- Pendência: definir se StudyTask pertence a Study com ACL do Contest, ou a Contest.

## OPEN-003
- Título: Sessão interna versus provedor externo de autenticação.
- Contexto: NextAuth/Supabase Auth gerenciam sessão; modelo define Session.
- Pendência: definir se Session espelha o provedor ou é tratada como externa.

## OPEN-004
- Título: Fronteira de AiUsage entre AI e Billing.
- Contexto: AiUsage serve a cotas (Billing) e à geração (AI).
- Pendência: definir a propriedade e o serviço de cotas.

## OPEN-005
- Título: Mecanismo de eventos para Analytics.
- Contexto: Analytics depende de eventos de Study, AI e Billing.
- Pendência: definir se haverá event bus no pós-MVP e como os eventos chegam.

## OPEN-006
- Título: Materialização do DailySummary.
- Contexto: DailySummary pode ser derivado ou materializado.
- Pendência: definir computação sob demanda versus job de agregação.

## OPEN-007
- Título: Divisão do domínio Study.
- Contexto: Study possui 6 aggregate roots.
- Pendência: avaliar subdomínios (questionamento, memorização, planejamento).

## OPEN-008
- Título: Consolidação dos documentos de banco.
- Contexto: docs contêm múltiplos arquivos de banco (03, 04, 04-logical, 05, 06) e numeração duplicada.
- Pendência: definir estrutura final e numeração oficial dos docs.
