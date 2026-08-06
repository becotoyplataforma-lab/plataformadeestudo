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
