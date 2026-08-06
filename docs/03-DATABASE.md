# 03 — DATABASE (Modelagem por Domínio)

> Projeto conceitual do banco de dados do ConcursoAI, orientado por domínio.
> Este documento define o QUÊ existe em cada domínio, sem detalhes físicos.
> Sem SQL, sem campos, sem tipos, sem índices.

---

# IDENTITY

## PURPOSE
- Autenticação e cadastro de usuários.
- Sessão e recuperação de senha.
- Perfil e identidade do usuário.

## ENTITIES

### User
- Nome: User
- Descrição: Representa a identidade autenticável do usuário.
- Responsabilidade: Origem da autenticação e vínculo de propriedade dos dados.

### Profile
- Nome: Profile
- Descrição: Dados de perfil e preferências do usuário.
- Responsabilidade: Complementa a identidade com dados de produto e preferências.

### Session
- Nome: Session
- Descrição: Representa uma sessão autenticada do usuário.
- Responsabilidade: Controla o acesso autenticado.

## RELATIONSHIPS
- User possui um Profile.
- User possui múltiplas Session.
- Demais domínios referenciam User como proprietário de seus dados.

## DEPENDENCIES
- Todos os domínios dependem de Identity (Contest, Knowledge, Study, AI, Billing, Analytics, Administration).

## EVENTS
- Created
- Updated
- Deleted
- Authenticated
- PasswordResetRequested
- LoggedOut

## FUTURE ENTITIES
- Role
- Permission

---

# CONTEST

## PURPOSE
- Representar o universo de concursos públicos.
- Órgãos, bancas, concursos e editais.

## ENTITIES

### Organ
- Nome: Organ
- Descrição: Órgão ou instituição que realiza o concurso.
- Responsabilidade: Identifica a origem do concurso.

### Board
- Nome: Board
- Descrição: Banca organizadora responsável pela prova.
- Responsabilidade: Define o perfil das provas e questões.

### Contest
- Nome: Contest
- Descrição: Concurso público específico.
- Responsabilidade: Agrega editais, cronogramas e conteúdo relacionado.

### Edital
- Nome: Edital
- Descrição: Documento oficial do concurso.
- Responsabilidade: Fonte da verdade do conteúdo programático e regras.

## RELATIONSHIPS
- Organ possui múltiplos Contest.
- Contest pertence a um Organ.
- Contest relaciona-se a Board.
- Edital pertence a um Contest.

## DEPENDENCIES
- Identity (proprietário de vínculos de acompanhamento).
- Study e Analytics dependem de Contest (questões, cronograma e estatísticas por concurso).

## EVENTS
- Created
- Updated
- Published
- Imported

## FUTURE ENTITIES
- Vaga
- CalendárioDeProvas
- ConteudoProgramaticoEstruturado

---

# KNOWLEDGE

## PURPOSE
- Ingestão e organização do conhecimento autorizado.
- OCR, transcrição, embeddings e indexação.

## ENTITIES

### Document
- Nome: Document
- Descrição: Material autorizado enviado pelo usuário (PDF, áudio, vídeo, lei).
- Responsabilidade: Representa a origem do conhecimento.

### DocumentChunk
- Nome: DocumentChunk
- Descrição: Trecho extraído e dividido de um documento.
- Responsabilidade: Unidade de conteúdo pesquisável e utilizável pela IA.

### Embedding
- Nome: Embedding
- Descrição: Vetor de representação de um chunk.
- Responsabilidade: Habilita busca semântica.

## RELATIONSHIPS
- Document pertence a User.
- Document possui múltiplos DocumentChunk.
- DocumentChunk possui um Embedding.

## DEPENDENCIES
- Identity (propriedade dos documentos).
- AI depende de Knowledge para RAG.
- Study pode consumir conteúdo indexado.

## EVENTS
- Uploaded
- Processed
- Imported
- Indexed
- Failed
- Deleted

## FUTURE ENTITIES
- Transcript
- LeiEstruturada
- ResumoGerado

---

# STUDY

## PURPOSE
- Execução do estudo do aluno.
- Questões, simulados, flashcards, revisão espaçada e cronograma.

## ENTITIES

### Subject
- Nome: Subject
- Descrição: Disciplina de estudo do usuário.
- Responsabilidade: Organiza o estudo por matéria.

### StudyTask
- Nome: StudyTask
- Descrição: Tarefa de estudo agendada.
- Responsabilidade: Representa o plano de estudos diário.

### Question
- Nome: Question
- Descrição: Questão de prova com alternativas e gabarito.
- Responsabilidade: Fonte de prática e avaliação.

### QuestionOption
- Nome: QuestionOption
- Descrição: Alternativa de uma questão.
- Responsabilidade: Compõe a questão e o gabarito.

### QuestionAttempt
- Nome: QuestionAttempt
- Descrição: Tentativa de resposta de um usuário.
- Responsabilidade: Registra desempenho individual.

### Flashcard
- Nome: Flashcard
- Descrição: Cartão de frente e verso para memorização.
- Responsabilidade: Suporta revisão ativa.

### ReviewSchedule
- Nome: ReviewSchedule
- Descrição: Agendamento de revisão espaçada de um flashcard.
- Responsabilidade: Controla quando revisar.

## RELATIONSHIPS
- StudyTask pertence a Subject.
- Question pertence a Subject (conteúdo).
- Question possui múltiplos QuestionOption.
- QuestionAttempt pertence a Question e a User.
- Flashcard pertence a Subject e a User.
- ReviewSchedule pertence a Flashcard.

## DEPENDENCIES
- Identity (propriedade).
- Analytics depende de Study (dados de desempenho).

## EVENTS
- Created
- Updated
- Deleted
- Completed
- Answered
- Reviewed
- Scheduled

## FUTURE ENTITIES
- Simulado
- SessaoDeEstudo
- NotaDeDesempenho

---

# AI

## PURPOSE
- Professor IA e geração de conteúdo.
- Chat, contexto, geração e uso de cotas.

## ENTITIES

### ChatSession
- Nome: ChatSession
- Descrição: Conversa do usuário com o Professor IA.
- Responsabilidade: Agrupa mensagens de uma conversa.

### ChatMessage
- Nome: ChatMessage
- Descrição: Mensagem trocada dentro de uma conversa.
- Responsabilidade: Registra o histórico do diálogo.

### AiUsage
- Nome: AiUsage
- Descrição: Consumo de recursos de IA pelo usuário.
- Responsabilidade: Controla cotas e custo.

## RELATIONSHIPS
- ChatSession pertence a User.
- ChatSession possui múltiplos ChatMessage.
- AiUsage pertence a User.

## DEPENDENCIES
- Identity (propriedade).
- Knowledge (fonte de contexto no pós-MVP).
- Billing (cotas por plano).

## EVENTS
- MessageSent
- ResponseGenerated
- Generated
- TokenUsed
- LimitReached

## FUTURE ENTITIES
- PromptTemplate
- QuestaoGerada
- FlashcardGerado

---

# BILLING

## PURPOSE
- Planos, assinaturas e pagamentos.

## ENTITIES

### Plan
- Nome: Plan
- Descrição: Nível de acesso e limites do usuário.
- Responsabilidade: Define o que cada assinatura oferece.

### Subscription
- Nome: Subscription
- Descrição: Vínculo de um usuário a um plano.
- Responsabilidade: Controla o período de acesso pago.

### Payment
- Nome: Payment
- Descrição: Transação de pagamento registrada.
- Responsabilidade: Registra a compra e a confirmação.

## RELATIONSHIPS
- Subscription pertence a User.
- Subscription relaciona-se a Plan.
- Payment pertence a Subscription e a User.

## DEPENDENCIES
- Identity (proprietário).
- Administration usa Billing para gestão.
- Analytics consome dados de Billing.

## EVENTS
- Purchased
- Approved
- Renewed
- Cancelled
- Failed
- Refunded

## FUTURE ENTITIES
- Invoice
- Coupon
- Discount

---

# ANALYTICS

## PURPOSE
- Estatísticas, evolução, tempo de estudo e pontuação.

## ENTITIES

### EventLog
- Nome: EventLog
- Descrição: Registro de eventos de negócio para análise.
- Responsabilidade: Fonte de dados para agregações.

### DailySummary
- Nome: DailySummary
- Descrição: Resumo diário de desempenho do usuário.
- Responsabilidade: Acelera consultas de evolução.

## RELATIONSHIPS
- EventLog relaciona-se a User.
- DailySummary pertence a User.
- DailySummary é derivado de eventos de Study, AI e Billing.

## DEPENDENCIES
- Identity (propriedade).
- Study, AI e Billing são fontes de dados.
- Administration consome os resultados.

## EVENTS
- Aggregated
- SnapshotCreated
- Reported

## FUTURE ENTITIES
- Benchmark
- Forecast
- Leaderboard

---

# ADMINISTRATION

## PURPOSE
- Gestão da plataforma: usuários, conteúdo, IA e logs.

## ENTITIES

### SystemSetting
- Nome: SystemSetting
- Descrição: Configuração global da plataforma.
- Responsabilidade: Controla parâmetros operacionais.

### AdminActionLog
- Nome: AdminActionLog
- Descrição: Registro de auditoria de ações administrativas.
- Responsabilidade: Garante rastreabilidade e auditoria.

## RELATIONSHIPS
- AdminActionLog registra ações sobre entidades de qualquer domínio.
- SystemSetting é global e não pertence a usuário.

## DEPENDENCIES
- Identity (identificação do administrador).
- Todos os domínios são alvo de ações administrativas.

## EVENTS
- Approved
- Rejected
- Blocked
- Exported
- Audited

## FUTURE ENTITIES
- ModerationQueue
- NotificationTemplate

---

# GLOBAL RELATIONSHIPS

- **Identity é a base.** Todos os domínios dependem de Identity para propriedade e autenticação.
- **Contest alimenta Study.** Questões e cronograma derivam do universo de concursos e editais.
- **Knowledge alimenta AI e Study.** Conteúdo indexado vira contexto do Professor IA e material de estudo.
- **Study alimenta Analytics.** Desempenho e tempo de estudo geram as estatísticas.
- **AI consome Knowledge e Billing.** Usa contexto indexado e respeita cotas do plano.
- **Billing habilita recursos.** O plano libera limites para Study, AI e Knowledge.
- **Analytics consome Study, AI e Billing.** Agrega eventos dos demais domínios.
- **Administration supervisiona tudo.** Audita ações e gerencia configurações globais.

Fluxo de dados principal:
- Identity autentica → Contest define o alvo → Knowledge indexa material → Study executa → AI assiste → Analytics mede → Billing libera → Administration controla.

---

# DATABASE PRINCIPLES

### Modularidade
- Dados agrupados por domínio.
- Cada domínio evolui de forma independente.

### Baixo Acoplamento
- Domínios se relacionam por referências estáveis, não por duplicação de dados.
- Mudanças internas de um domínio não afetam os demais.

### Alta Coesão
- Entidades de um mesmo domínio compartilham propósito e responsabilidade.
- Evita entidades "guarda-chuva" misturando domínios.

### Auditoria
- Ações administrativas e eventos de negócio são registrados.
- Rastreabilidade de quem fez o quê.

### Soft Delete
- Dados podem ser marcados como removidos sem perda física.
- Preserva histórico e integridade referencial.

### RLS (Row Level Security)
- Controle de acesso em nível de linha.
- Usuário enxerga apenas seus dados.
- Fonte da verdade de permissões.

### UUID
- Identificadores únicos universais.
- Evita exposição de sequências e colisões entre ambientes.

### Event Driven
- Eventos de negócio alimentam integrações e analíticas.
- Domínios publicam o que aconteceu, sem acoplamento direto.

### Evolução por Migration
- Estrutura versionada e aplicada por migrations.
- Migrations reversíveis e não destrutivas quando possível.
