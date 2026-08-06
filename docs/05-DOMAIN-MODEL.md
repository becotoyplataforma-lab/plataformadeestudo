# 05 — DOMAIN MODEL

> Modelo de domínio oficial da plataforma, segundo DDD.
> Sem código, sem SQL, sem campos, sem diagramas.

> **DECISÃO REGISTRADA NESTE DOCUMENTO (não altera documentos anteriores):**
> - `Subject` passa a ser chamado conceitualmente de `KnowledgeSubject`
>   (catálogo de conteúdo, usado como referência por `Question`).
> - Cria-se o conceito `StudySubject` (disciplina do usuário, usada por
>   `StudyTask` e `Flashcard`).
> Os documentos anteriores (03/04) permanecem como estavam.

---

# IDENTITY

## PURPOSE
- Autenticação, identidade, perfil e sessão do usuário.

## AGGREGATE ROOTS
- User
- Session

## ENTITIES
- User
- Session
- Profile

## VALUE OBJECTS
- EmailAddress
- FullName

## DOMAIN SERVICES
- AuthenticationService
- ProfileService

## DOMAIN EVENTS
- UserCreated
- UserUpdated
- UserDeleted
- UserAuthenticated
- SessionExpired

## REPOSITORIES
- UserRepository
- SessionRepository

## INVARIANTS
- Um usuário possui exatamente um Profile.
- Email é único.
- Dados do usuário são privados.

## DEPENDENCIES
- Nenhum domínio interno. É a base do sistema.

## FUTURE EVOLUTION
- Roles e Permissions.
- Autenticação multifator.

---

# CONTEST

## PURPOSE
- Representar concursos públicos, órgãos, bancas e editais.

## AGGREGATE ROOTS
- Contest
- Organ
- Board

## ENTITIES
- Contest
- Organ
- Board
- Edital

## VALUE OBJECTS
- ContestPeriod
- ProgrammaticContent

## DOMAIN SERVICES
- EditalImporterService

## DOMAIN EVENTS
- ContestCreated
- ContestUpdated
- EditalPublished
- EditalImported

## REPOSITORIES
- ContestRepository
- OrganRepository
- BoardRepository
- EditalRepository

## INVARIANTS
- Um concurso possui um edital vigente.
- Organ e Board possuem nome único.

## DEPENDENCIES
- Identity (vínculos de acompanhamento).
- Study e Analytics dependem deste domínio.

## FUTURE EVOLUTION
- Vagas e inscrições.
- Calendário de provas.

---

# KNOWLEDGE

## PURPOSE
- Ingestão, processamento e indexação do conhecimento autorizado.

## AGGREGATE ROOTS
- Document

## ENTITIES
- Document
- DocumentChunk
- Embedding

## VALUE OBJECTS
- DocumentType
- ProcessingStatus

## DOMAIN SERVICES
- IngestService
- ChunkingService
- EmbeddingService

## DOMAIN EVENTS
- DocumentUploaded
- DocumentProcessed
- DocumentIndexed
- DocumentFailed
- DocumentDeleted

## REPOSITORIES
- DocumentRepository
- DocumentChunkRepository
- EmbeddingRepository

## INVARIANTS
- Document pertence a um usuário.
- Um chunk possui um embedding.
- Documento é processado antes de ser usado.

## DEPENDENCIES
- Identity (propriedade).
- AI depende deste domínio (RAG).
- Study pode consumir o conteúdo indexado.

## FUTURE EVOLUTION
- Transcrição de vídeo/áudio.
- Leis estruturadas.
- Versões de documento.

---

# STUDY

## PURPOSE
- Execução do estudo: questões, flashcards, revisão espaçada e cronograma.

## AGGREGATE ROOTS
- Question
- QuestionAttempt
- Flashcard
- KnowledgeSubject
- StudySubject
- StudyTask

## ENTITIES
- Question
- QuestionOption
- QuestionAttempt
- Flashcard
- ReviewSchedule
- KnowledgeSubject
- StudySubject
- StudyTask

## VALUE OBJECTS
- QuestionLevel
- AttemptMode
- ReviewRating
- TaskStatus

## DOMAIN SERVICES
- QuestionAnsweringService
- SrsSchedulingService
- StudyPlannerService

## DOMAIN EVENTS
- QuestionAnswered
- FlashcardReviewed
- StudyTaskCreated
- StudyTaskCompleted

## REPOSITORIES
- QuestionRepository
- QuestionAttemptRepository
- FlashcardRepository
- ReviewScheduleRepository
- KnowledgeSubjectRepository
- StudySubjectRepository
- StudyTaskRepository

## INVARIANTS
- Uma questão possui um único gabarito.
- Uma questão possui uma única alternativa correta.
- Um flashcard possui um agendamento de revisão.
- StudySubject pertence a um usuário.
- KnowledgeSubject é catálogo compartilhado de conteúdo.

## DEPENDENCIES
- Identity (propriedade).
- Contest alimenta conteúdo (futuro).
- Knowledge alimenta material (futuro).
- Analytics depende deste domínio.

## FUTURE EVOLUTION
- Simulados.
- Sessões de estudo.
- Algoritmo FSRS.

---

# AI

## PURPOSE
- Professor IA, chat, geração de conteúdo e consumo de recursos.

## AGGREGATE ROOTS
- ChatSession
- AiUsage

## ENTITIES
- ChatSession
- ChatMessage
- AiUsage

## VALUE OBJECTS
- AIModel
- MessageRole
- TokenCount

## DOMAIN SERVICES
- ChatService
- PromptService
- RagService

## DOMAIN EVENTS
- MessageSent
- ResponseGenerated
- TokenUsed
- LimitReached

## REPOSITORIES
- ChatSessionRepository
- ChatMessageRepository
- AiUsageRepository

## INVARIANTS
- ChatSession pertence a um usuário.
- Cotas de IA respeitam o plano.
- Respostas em pt-BR.

## DEPENDENCIES
- Identity (propriedade).
- Knowledge (contexto, pós-MVP).
- Billing (cotas).

## FUTURE EVOLUTION
- Geração de questões e flashcards.
- RAG completo.
- Prompts versionados.

---

# BILLING

## PURPOSE
- Planos, assinaturas e pagamentos.

## AGGREGATE ROOTS
- Subscription
- Plan

## ENTITIES
- Plan
- Subscription
- Payment

## VALUE OBJECTS
- Money
- PaymentStatus
- SubscriptionPeriod

## DOMAIN SERVICES
- SubscriptionService
- PaymentService

## DOMAIN EVENTS
- PlanPurchased
- PaymentApproved
- PaymentFailed
- SubscriptionRenewed
- SubscriptionCancelled

## REPOSITORIES
- PlanRepository
- SubscriptionRepository
- PaymentRepository

## INVARIANTS
- Uma assinatura ativa por usuário.
- Pagamento aprovado ativa o plano.
- Money não negativo.

## DEPENDENCIES
- Identity (proprietário).
- Administration consome este domínio.

## FUTURE EVOLUTION
- Invoices e cupons.
- Período de teste.

---

# ANALYTICS

## PURPOSE
- Estatísticas, evolução, tempo de estudo e pontuação.

## AGGREGATE ROOTS
- EventLog
- DailySummary

## ENTITIES
- EventLog
- DailySummary

## VALUE OBJECTS
- MetricValue
- TimeRange

## DOMAIN SERVICES
- AggregationService
- StreakService

## DOMAIN EVENTS
- MetricsAggregated
- SnapshotCreated
- Reported

## REPOSITORIES
- EventLogRepository
- DailySummaryRepository

## INVARIANTS
- EventLog é imutável.
- Um DailySummary por usuário e dia.

## DEPENDENCIES
- Identity (propriedade).
- Consome eventos de Study, AI e Billing.

## FUTURE EVOLUTION
- Benchmarks.
- Previsões de desempenho.
- Leaderboards.

---

# ADMINISTRATION

## PURPOSE
- Gestão da plataforma: configuração e auditoria.

## AGGREGATE ROOTS
- SystemSetting
- AdminActionLog

## ENTITIES
- SystemSetting
- AdminActionLog

## VALUE OBJECTS
- SettingKey
- ActionType

## DOMAIN SERVICES
- AuditService
- ModerationService

## DOMAIN EVENTS
- ActionApproved
- ActionRejected
- EntityBlocked
- AuditRecorded

## REPOSITORIES
- SystemSettingRepository
- AdminActionLogRepository

## INVARIANTS
- Chave de configuração única.
- AdminActionLog é imutável.
- Somente administrador altera configurações.

## DEPENDENCIES
- Identity (identifica o administrador).
- Atua sobre todos os domínios.

## FUTURE EVOLUTION
- Fila de moderação.
- Notificações.

---

# DOMAIN COMMUNICATION

- **Identity é a base.** Todos os domínios recebem a identidade do usuário e validam propriedade.
- **Contest → Study.** Conteúdo programático do edital origina disciplinas, questões e cronograma.
- **Contest → Knowledge.** Editais e materiais do concurso alimentam a ingestão.
- **Knowledge → AI.** Chunks indexados viram contexto para respostas.
- **Knowledge → Study.** Material indexado vira fonte de estudo e questões.
- **Study → Analytics.** Tentativas e revisões geram métricas.
- **AI → Analytics.** Uso e mensagens geram métricas de IA.
- **Billing → Study, AI, Knowledge.** O plano libera limites de uso.
- **Administration → Todos.** Ações administrativas são auditadas.

Padrão de comunicação:
- Domínios se comunicam por **eventos de domínio** e **contratos estáveis**.
- Não há acesso direto a entidades internas de outro domínio.
- Integrações externas passam por serviços dedicados.

---

# SHARED KERNEL

- UserId
- EmailAddress
- Plan
- Money

> Somente objetos realmente compartilhados entre domínios.
> Demais tipos são privados de cada domínio.

---

# ANTI CORRUPTION LAYER

- **AI ← Knowledge**: traduz chunks em contexto sem acoplar ao modelo interno de Knowledge.
- **Analytics ← Study, AI, Billing**: consome eventos sem depender das entidades internas dos domínios de origem.
- **Contest → Study**: traduz edital/conteúdo programático em disciplinas, questões e cronograma.
- **Billing ← Provedor de pagamento**: isola o provedor externo (Mercado Pago) do domínio.
- **Knowledge ← Provedores externos**: isola OCR, transcrição e embeddings externos.
