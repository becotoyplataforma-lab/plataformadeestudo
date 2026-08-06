# 04 — DATABASE LOGICAL (Modelo Lógico por Entidade)

> Detalhamento lógico de todas as entidades de `03-DATABASE.md`.
> Sem SQL, sem campos, sem tipos, sem chaves, sem índices, sem diagramas.
> Domínios: Identity, Contest, Knowledge, Study, AI, Billing, Analytics, Administration.

---

# USER

## PURPOSE
- Representar a identidade autenticável do usuário.

## RESPONSIBILITIES
- Autenticar o usuário.
- Ser a origem da propriedade dos dados.
- Vincular todas as informações do sistema ao dono.

## OWNED BY DOMAIN
- Identity

## DEPENDS ON
- Nenhuma entidade interna. É a base do sistema.

## RELATIONSHIPS
- One-to-One: Profile.
- One-to-Many: Session.
- One-to-Many: entidades proprietárias dos demais domínios.

## BUSINESS RULES
- Um usuário tem um único Profile.
- Dados de usuário são privados.
- Exclusão de usuário remove os dados associados.

## LIFE CYCLE
- Created
- Updated
- Activated
- Suspended
- Deleted

## EVENTS
- Created
- Updated
- Deleted
- Authenticated

## FUTURE EXTENSIONS
- Roles e Permissions.

---

# PROFILE

## PURPOSE
- Guardar dados de perfil e preferências do usuário.

## RESPONSIBILITIES
- Complementar a identidade com dados de produto.
- Guardar preferências de estudo e de IA.

## OWNED BY DOMAIN
- Identity

## DEPENDS ON
- User.

## RELATIONSHIPS
- One-to-One: User.

## BUSINESS RULES
- Existe um Profile por usuário.
- Pertence a um único usuário.

## LIFE CYCLE
- Created
- Updated

## EVENTS
- Created
- Updated

## FUTURE EXTENSIONS
- Preferências avançadas de IA.

---

# SESSION

## PURPOSE
- Representar uma sessão autenticada.

## RESPONSIBILITIES
- Controlar o acesso autenticado.
- Controlar expiração da sessão.

## OWNED BY DOMAIN
- Identity

## DEPENDS ON
- User.

## RELATIONSHIPS
- Many-to-One: User.

## BUSINESS RULES
- Sessão expira após período definido.
- Uma sessão ativa por dispositivo.

## LIFE CYCLE
- Created
- Updated
- Expired
- Deleted

## EVENTS
- Created
- Expired
- LoggedOut

## FUTURE EXTENSIONS
- Refresh tokens.
- Autenticação multifator.

---

# ORGAN

## PURPOSE
- Representar o órgão realizador do concurso.

## RESPONSIBILITIES
- Identificar a origem do concurso.

## OWNED BY DOMAIN
- Contest

## DEPENDS ON
- Nenhuma entidade interna.

## RELATIONSHIPS
- One-to-Many: Contest.

## BUSINESS RULES
- Nome único.
- Dado público, não pertence a usuário.

## LIFE CYCLE
- Created
- Updated
- Imported
- Archived

## EVENTS
- Created
- Updated
- Imported

## FUTURE EXTENSIONS
- Dados cadastrais do órgão.

---

# BOARD

## PURPOSE
- Representar a banca organizadora.

## RESPONSIBILITIES
- Definir o perfil das provas.

## OWNED BY DOMAIN
- Contest

## DEPENDS ON
- Nenhuma entidade interna.

## RELATIONSHIPS
- One-to-Many: Contest.

## BUSINESS RULES
- Nome único.
- Dado público.

## LIFE CYCLE
- Created
- Updated
- Imported
- Archived

## EVENTS
- Created
- Updated
- Imported

## FUTURE EXTENSIONS
- Estatísticas por banca.

---

# CONTEST

## PURPOSE
- Representar um concurso público específico.

## RESPONSIBILITIES
- Agregar editais, cronogramas e conteúdo relacionado.

## OWNED BY DOMAIN
- Contest

## DEPENDS ON
- Organ.
- Board.

## RELATIONSHIPS
- Many-to-One: Organ.
- Many-to-One: Board.
- One-to-Many: Edital.

## BUSINESS RULES
- Um concurso tem um edital vigente.
- Período do concurso definido.

## LIFE CYCLE
- Created
- Updated
- Published
- Closed
- Archived

## EVENTS
- Created
- Updated
- Published

## FUTURE EXTENSIONS
- Inscrições e vagas.

---

# EDITAL

## PURPOSE
- Representar o documento oficial do concurso.

## RESPONSIBILITIES
- Ser a fonte da verdade do conteúdo programático.

## OWNED BY DOMAIN
- Contest

## DEPENDS ON
- Contest.

## RELATIONSHIPS
- Many-to-One: Contest.

## BUSINESS RULES
- Um edital vigente por concurso.
- Conteúdo programático vinculado.

## LIFE CYCLE
- Created
- Updated
- Published
- Archived

## EVENTS
- Created
- Updated
- Published
- Imported

## FUTURE EXTENSIONS
- Conteúdo programático estruturado.

---

# DOCUMENT

## PURPOSE
- Representar material autorizado enviado pelo usuário.

## RESPONSIBILITIES
- Ser a origem do conhecimento.
- Controlar o estado de processamento.

## OWNED BY DOMAIN
- Knowledge

## DEPENDS ON
- User (Identity).

## RELATIONSHIPS
- Many-to-One: User.
- One-to-Many: DocumentChunk.

## BUSINESS RULES
- Pertence a um usuário.
- Processado antes de ser usado.

## LIFE CYCLE
- Uploaded
- Processing
- Completed
- Failed
- Deleted

## EVENTS
- Uploaded
- Processed
- Imported
- Indexed
- Failed
- Deleted

## FUTURE EXTENSIONS
- Versões de documento.
- Compartilhamento.

---

# DOCUMENTCHUNK

## PURPOSE
- Representar um trecho extraído e dividido de um documento.

## RESPONSIBILITIES
- Ser a unidade de conteúdo pesquisável.

## OWNED BY DOMAIN
- Knowledge

## DEPENDS ON
- Document.

## RELATIONSHIPS
- Many-to-One: Document.
- One-to-One: Embedding.

## BUSINESS RULES
- Pertence a um documento.
- Possui ordem definida.

## LIFE CYCLE
- Created
- Indexed
- Deleted

## EVENTS
- Created
- Indexed
- Deleted

## FUTURE EXTENSIONS
- Re-chunking.

---

# EMBEDDING

## PURPOSE
- Representar o vetor de um chunk.

## RESPONSIBILITIES
- Habilitar busca semântica.

## OWNED BY DOMAIN
- Knowledge

## DEPENDS ON
- DocumentChunk.

## RELATIONSHIPS
- One-to-One: DocumentChunk.

## BUSINESS RULES
- Um embedding por chunk.
- Modelo de geração definido.

## LIFE CYCLE
- Created
- Deleted

## EVENTS
- Created
- Deleted

## FUTURE EXTENSIONS
- Múltiplos modelos de embedding.

---

# SUBJECT

## PURPOSE
- Representar uma disciplina de estudo.

## RESPONSIBILITIES
- Organizar o estudo por matéria.

## OWNED BY DOMAIN
- Study

## DEPENDS ON
- User (Identity).

## RELATIONSHIPS
- One-to-Many: StudyTask.
- One-to-Many: Flashcard.

## BUSINESS RULES
- Pertence a um usuário.
- Nome único por usuário.

## LIFE CYCLE
- Created
- Updated
- Deleted

## EVENTS
- Created
- Updated
- Deleted

## FUTURE EXTENSIONS
- Vínculo com conteúdo programático.

---

# STUDY TASK

## PURPOSE
- Representar uma tarefa de estudo agendada.

## RESPONSIBILITIES
- Representar o plano de estudos diário.

## OWNED BY DOMAIN
- Study

## DEPENDS ON
- User (Identity).
- Subject.

## RELATIONSHIPS
- Many-to-One: Subject.
- Many-to-One: User.

## BUSINESS RULES
- Pertence a um usuário.
- Possui status controlado.

## LIFE CYCLE
- Created
- Updated
- Completed
- Cancelled
- Deleted

## EVENTS
- Created
- Updated
- Completed
- Deleted

## FUTURE EXTENSIONS
- Recorrência.
- Modo foco (Pomodoro).

---

# QUESTION

## PURPOSE
- Representar uma questão de prova.

## RESPONSIBILITIES
- Servir de prática e avaliação.

## OWNED BY DOMAIN
- Study

## DEPENDS ON
- Subject (conteúdo).

## RELATIONSHIPS
- One-to-Many: QuestionOption.
- One-to-Many: QuestionAttempt.
- Many-to-One: Subject (conteúdo).

## BUSINESS RULES
- Possui um único gabarito.
- Pode ser pública ou privada.

## LIFE CYCLE
- Created
- Updated
- Published
- Blocked
- Deleted

## EVENTS
- Created
- Updated
- Published
- Blocked
- Deleted

## FUTURE EXTENSIONS
- Questões geradas por IA.

---

# QUESTIONOPTION

## PURPOSE
- Representar uma alternativa de questão.

## RESPONSIBILITIES
- Compor a questão.
- Definir o gabarito.

## OWNED BY DOMAIN
- Study

## DEPENDS ON
- Question.

## RELATIONSHIPS
- Many-to-One: Question.

## BUSINESS RULES
- Letra única por questão.
- Uma única alternativa correta.

## LIFE CYCLE
- Created
- Deleted

## EVENTS
- Created
- Deleted

## FUTURE EXTENSIONS
- Peso por alternativa.

---

# QUESTIONATTEMPT

## PURPOSE
- Representar uma tentativa de resposta.

## RESPONSIBILITIES
- Registrar o desempenho do usuário.

## OWNED BY DOMAIN
- Study

## DEPENDS ON
- User (Identity).
- Question.

## RELATIONSHIPS
- Many-to-One: User.
- Many-to-One: Question.

## BUSINESS RULES
- Registra a tentativa e o acerto.
- Vinculada a um momento de estudo.

## LIFE CYCLE
- Created

## EVENTS
- Created (Answered)

## FUTURE EXTENSIONS
- Rastreio de tempo.
- Vínculo com simulados.

---

# FLASHCARD

## PURPOSE
- Representar um cartão de memorização.

## RESPONSIBILITIES
- Suportar revisão ativa.

## OWNED BY DOMAIN
- Study

## DEPENDS ON
- User (Identity).
- Subject.

## RELATIONSHIPS
- Many-to-One: User.
- Many-to-One: Subject.
- One-to-One: ReviewSchedule.

## BUSINESS RULES
- Pertence a um usuário.
- Possui frente e verso.

## LIFE CYCLE
- Created
- Updated
- Deleted

## EVENTS
- Created
- Updated
- Deleted

## FUTURE EXTENSIONS
- Geração automática por IA.

---

# REVIEWSCHEDULE

## PURPOSE
- Representar o agendamento de revisão espaçada.

## RESPONSIBILITIES
- Controlar a próxima revisão.

## OWNED BY DOMAIN
- Study

## DEPENDS ON
- Flashcard.
- User (Identity).

## RELATIONSHIPS
- One-to-One: Flashcard.
- Many-to-One: User.

## BUSINESS RULES
- Um agendamento por flashcard.
- Intervalo derivado da avaliação.

## LIFE CYCLE
- Created
- Updated
- Completed

## EVENTS
- Created
- Updated
- Reviewed

## FUTURE EXTENSIONS
- Algoritmo FSRS.

---

# CHATSESSION

## PURPOSE
- Representar uma conversa com o Professor IA.

## RESPONSIBILITIES
- Agrupar mensagens e contexto.

## OWNED BY DOMAIN
- AI

## DEPENDS ON
- User (Identity).

## RELATIONSHIPS
- Many-to-One: User.
- One-to-Many: ChatMessage.

## BUSINESS RULES
- Pertence a um usuário.

## LIFE CYCLE
- Created
- Updated
- Deleted

## EVENTS
- Created
- Updated
- Deleted

## FUTURE EXTENSIONS
- Vínculo com material (Knowledge).

---

# CHATMESSAGE

## PURPOSE
- Representar uma mensagem de conversa.

## RESPONSIBILITIES
- Registrar o diálogo e o uso de IA.

## OWNED BY DOMAIN
- AI

## DEPENDS ON
- ChatSession.
- User (Identity).

## RELATIONSHIPS
- Many-to-One: ChatSession.
- Many-to-One: User.

## BUSINESS RULES
- Pertence a uma conversa.
- Possui papel definido.

## LIFE CYCLE
- Created

## EVENTS
- MessageSent
- ResponseGenerated

## FUTURE EXTENSIONS
- Metadados de fonte.

---

# AIUSAGE

## PURPOSE
- Representar o consumo de recursos de IA.

## RESPONSIBILITIES
- Controlar cotas e custo.

## OWNED BY DOMAIN
- AI

## DEPENDS ON
- User (Identity).
- Consumido por Billing.

## RELATIONSHIPS
- Many-to-One: User.

## BUSINESS RULES
- Agregado por dia.
- Respeita o limite do plano.

## LIFE CYCLE
- Created
- Updated

## EVENTS
- TokenUsed
- LimitReached

## FUTURE EXTENSIONS
- Detalhamento por recurso.

---

# PLAN

## PURPOSE
- Representar um nível de acesso.

## RESPONSIBILITIES
- Definir limites e preço.

## OWNED BY DOMAIN
- Billing

## DEPENDS ON
- Nenhuma entidade interna.

## RELATIONSHIPS
- One-to-Many: Subscription.

## BUSINESS RULES
- Catálogo de planos fixo.
- Preço definido por plano.

## LIFE CYCLE
- Created
- Updated
- Deactivated

## EVENTS
- Created
- Updated

## FUTURE EXTENSIONS
- Planos customizados.

---

# SUBSCRIPTION

## PURPOSE
- Representar o vínculo usuário-plano.

## RESPONSIBILITIES
- Controlar o período de acesso.

## OWNED BY DOMAIN
- Billing

## DEPENDS ON
- User (Identity).
- Plan.

## RELATIONSHIPS
- Many-to-One: User.
- Many-to-One: Plan.
- One-to-Many: Payment.

## BUSINESS RULES
- Uma assinatura ativa por usuário.
- Renovação periódica.

## LIFE CYCLE
- Created
- Activated
- Renewed
- Suspended
- Cancelled

## EVENTS
- Purchased
- Approved
- Renewed
- Cancelled

## FUTURE EXTENSIONS
- Período de teste.
- Downgrade.

---

# PAYMENT

## PURPOSE
- Representar uma transação de pagamento.

## RESPONSIBILITIES
- Registrar a compra e a confirmação.

## OWNED BY DOMAIN
- Billing

## DEPENDS ON
- User (Identity).
- Subscription.

## RELATIONSHIPS
- Many-to-One: User.
- Many-to-One: Subscription.

## BUSINESS RULES
- Status controlado pelo provedor.
- Aprovação ativa o plano.

## LIFE CYCLE
- Created
- Approved
- Failed
- Refunded

## EVENTS
- Purchased
- Approved
- Failed
- Refunded

## FUTURE EXTENSIONS
- Múltiplos provedores.

---

# EVENTLOG

## PURPOSE
- Representar o registro de eventos de negócio.

## RESPONSIBILITIES
- Servir de fonte de dados para agregações.

## OWNED BY DOMAIN
- Analytics

## DEPENDS ON
- User (Identity, referência).
- Consome eventos dos demais domínios.

## RELATIONSHIPS
- Many-to-One: User (referência).

## BUSINESS RULES
- Imutável após registro.
- Retenção definida.

## LIFE CYCLE
- Created

## EVENTS
- Aggregated
- Reported

## FUTURE EXTENSIONS
- Streaming de eventos.

---

# DAILYSUMMARY

## PURPOSE
- Representar o resumo diário de desempenho.

## RESPONSIBILITIES
- Acelerar consultas de evolução.

## OWNED BY DOMAIN
- Analytics

## DEPENDS ON
- User (Identity).

## RELATIONSHIPS
- Many-to-One: User.

## BUSINESS RULES
- Um resumo por usuário e dia.
- Derivado de eventos.

## LIFE CYCLE
- Created
- Updated

## EVENTS
- SnapshotCreated

## FUTURE EXTENSIONS
- Benchmarks.

---

# SYSTEMSETTING

## PURPOSE
- Representar configuração global da plataforma.

## RESPONSIBILITIES
- Controlar parâmetros operacionais.

## OWNED BY DOMAIN
- Administration

## DEPENDS ON
- Nenhuma entidade interna.

## RELATIONSHIPS
- Independente (sem vínculo de propriedade).

## BUSINESS RULES
- Chave única.
- Somente administrador altera.

## LIFE CYCLE
- Created
- Updated
- Deleted

## EVENTS
- Created
- Updated

## FUTURE EXTENSIONS
- Feature flags.

---

# ADMINACTIONLOG

## PURPOSE
- Representar o registro de auditoria.

## RESPONSIBILITIES
- Rastrear ações administrativas.

## OWNED BY DOMAIN
- Administration

## DEPENDS ON
- User (Identity, identifica o administrador).

## RELATIONSHIPS
- Many-to-One: User (administrador).

## BUSINESS RULES
- Imutável após registro.
- Registra quem fez o quê.

## LIFE CYCLE
- Created

## EVENTS
- Audited
- Exported

## FUTURE EXTENSIONS
- Exportação de auditoria.

---

# CROSS DOMAIN RELATIONSHIPS

- **User (Identity)** é referenciado por praticamente todos os domínios: Document, Subject, StudyTask, QuestionAttempt, Flashcard, ChatSession, ChatMessage, AiUsage, Subscription, Payment, EventLog, DailySummary, AdminActionLog.
- **Contest → Study**: Questões e cronograma podem ser derivados de Concurso e Edital (conteúdo programático).
- **Contest → Knowledge**: Editais e materiais do concurso alimentam a ingestão.
- **Knowledge → AI**: DocumentChunk indexado vira contexto do ChatMessage.
- **Study → Analytics**: QuestionAttempt e ReviewSchedule alimentam EventLog e DailySummary.
- **AI → Billing**: AiUsage é consumido por Billing para validar cotas.
- **AI → Analytics**: ChatMessage e AiUsage geram métricas de uso de IA.
- **Billing → Study/AI/Knowledge**: Subscription/Plan liberam limites de uso.
- **Administration → Todos**: AdminActionLog referencia entidades de qualquer domínio.

---

# AGGREGATE ROOTS

- **Identity**: `User` (raiz). `Session` é agregado próprio.
- **Contest**: `Contest` (agrega Edital). `Organ` e `Board` são raízes independentes referenciadas.
- **Knowledge**: `Document` (agrega DocumentChunk e Embedding).
- **Study**: `Question` (agrega QuestionOption). `QuestionAttempt` é agregado próprio (envolve User). `Flashcard` (agrega ReviewSchedule). `Subject` é raiz própria.
- **AI**: `ChatSession` (agrega ChatMessage). `AiUsage` é agregado próprio.
- **Billing**: `Subscription` (agrega Payment). `Plan` é raiz própria.
- **Analytics**: `EventLog` é raiz própria. `DailySummary` é raiz própria.
- **Administration**: `SystemSetting` é raiz própria. `AdminActionLog` é raiz própria.

---

# DOMAIN INVARIANTS

- Um usuário possui exatamente um Profile.
- Um usuário possui no máximo uma assinatura ativa.
- Uma questão possui uma única alternativa correta.
- Uma alternativa possui letra única dentro da questão.
- Um flashcard possui um único agendamento de revisão.
- Um chunk possui um único embedding.
- Um concurso possui um edital vigente.
- Um usuário possui um único registro de uso de IA por dia.
- Um usuário acessa somente os próprios dados.
- Um pagamento aprovado ativa o plano correspondente.
- Registros de auditoria e eventos são imutáveis.
