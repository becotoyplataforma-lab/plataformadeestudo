# 08 — DATABASE PHYSICAL (Modelo Físico)

> Modelo físico oficial, derivado do modelo lógico (04) e do modelo de domínio (05),
> seguindo obrigatoriamente o padrão de `07-ENTITY-STANDARDS.md`.
> Tipos lógicos apenas (sem tipo SQL). Fonte única para a futura geração do schema SQL.
> Sem SQL, sem migrations, sem código, sem diagramas.

> **DECISÃO OFICIAL (ADR-001):** `auth.users` é a única fonte oficial de identidade.
> `public.users` não existe. `public.profiles` referencia `auth.users(id)`.
> Autenticação é responsabilidade exclusiva do Supabase Auth.

---

# USER

## DOMAIN
- Identity

## TABLE NAME
- auth.users (fonte oficial — não criada no schema public)

## DESCRIPTION
- Identidade gerenciada pelo Supabase Auth (fonte única de verdade).
- As colunas de identidade (email, senha, MFA, recovery) são gerenciadas pelo provedor.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **email** — STRING — Sim — E-mail do usuário (único).
- **email_verified** — BOOLEAN — Sim — Indica e-mail confirmado.
- **phone** — STRING — Não — Telefone opcional.
- **password_hash** — STRING — Não — Hash da senha.
- **status** — ENUM — Sim — Estado do usuário (lifecycle).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção (soft delete).

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- Nenhuma (raiz do domínio).

## UNIQUE CONSTRAINTS
- email único.

## CHECK CONSTRAINTS
- Formato de e-mail válido.

## INDEXES
- Índice por email.
- Índice por status.

## RLS POLICY
- Usuário acessa somente o próprio registro.
- Administrador gerencia usuários.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- UserCreated, UserUpdated, UserDeleted, UserAuthenticated.

## NOTES
- DECISÃO ADR-001: auth.users é a única fonte oficial de identidade.
- public.users não existe.
- Identidade e autenticação são responsabilidade exclusiva do Supabase Auth.

---

# PROFILE

## DOMAIN
- Identity

## TABLE NAME
- profiles

## DESCRIPTION
- Dados de perfil e preferências do usuário.

## COLUMNS
- **id** — UUID — Sim — Identificador (igual ao do user).
- **full_name** — STRING — Não — Nome completo.
- **avatar_url** — STRING — Não — URL do avatar.
- **level** — ENUM — Sim — Nível do aluno.
- **concurso_alvo** — STRING — Não — Concurso alvo.
- **banca_preferida** — STRING — Não — Banca preferida.
- **meta_diaria_min** — INTEGER — Sim — Meta diária em minutos.
- **modelo_ia_padrao** — ENUM — Sim — Modelo de IA padrão.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.

## PRIMARY KEY
- id (UUID), 1:1 com auth.users.

## FOREIGN KEYS
- auth.users (id).

## UNIQUE CONSTRAINTS
- Nenhuma adicional (1:1 via PK).

## CHECK CONSTRAINTS
- meta_diaria_min dentro de faixa permitida.

## INDEXES
- Nenhum adicional.

## RLS POLICY
- Usuário acessa somente o próprio perfil.

## SOFT DELETE
- Não (vive com o user).

## AUDIT
- created_at e updated_at.

## EVENTS
- ProfileUpdated.

## NOTES
- Relação 1:1 com auth.users (id = auth.users.id).
- Contém apenas dados complementares à identidade.

---

# SESSION

## DOMAIN
- Identity

## TABLE NAME
- sessions

## DESCRIPTION
- Sessão autenticada do usuário.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Usuário da sessão.
- **token** — STRING — Sim — Token da sessão (único).
- **expires_at** — TIMESTAMP — Sim — Expiração.
- **ip** — STRING — Não — IP de origem.
- **user_agent** — STRING — Não — Agente do dispositivo.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- auth.users (user_id).

## UNIQUE CONSTRAINTS
- token único.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por user_id.
- Índice por expires_at.

## RLS POLICY
- Usuário acessa somente as próprias sessões.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- SessionCreated, SessionExpired, SessionRevoked.

## NOTES
- Sessions internas existem somente se houver necessidade funcional além do Supabase Auth.
- Por padrão, a sessão é delegada ao Supabase Auth.

---

# ORGAN

## DOMAIN
- Contest

## TABLE NAME
- organs

## DESCRIPTION
- Órgão ou instituição realizadora de concursos.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **name** — STRING — Sim — Nome do órgão (único).
- **slug** — STRING — Sim — Identificador amigável (único).
- **description** — TEXT — Não — Descrição.
- **status** — ENUM — Sim — Estado (lifecycle).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- Nenhuma.

## UNIQUE CONSTRAINTS
- name único.
- slug único.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por status.

## RLS POLICY
- Catálogo: leitura para autenticados; escrita para administrador.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- OrganCreated, OrganUpdated, OrganImported.

## NOTES
- Dado público de catálogo.

---

# BOARD

## DOMAIN
- Contest

## TABLE NAME
- boards

## DESCRIPTION
- Banca organizadora de provas.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **name** — STRING — Sim — Nome da banca (único).
- **slug** — STRING — Sim — Identificador amigável (único).
- **description** — TEXT — Não — Descrição.
- **status** — ENUM — Sim — Estado (lifecycle).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- Nenhuma.

## UNIQUE CONSTRAINTS
- name único.
- slug único.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por status.

## RLS POLICY
- Catálogo: leitura para autenticados; escrita para administrador.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- BoardCreated, BoardUpdated, BoardImported.

## NOTES
- Dado público de catálogo.

---

# CONTEST

## DOMAIN
- Contest

## TABLE NAME
- contests

## DESCRIPTION
- Concurso público específico.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **organ_id** — REFERENCE — Sim — Órgão responsável.
- **board_id** — REFERENCE — Sim — Banca organizadora.
- **title** — STRING — Sim — Título do concurso.
- **slug** — STRING — Sim — Identificador amigável (único).
- **description** — TEXT — Não — Descrição.
- **status** — ENUM — Sim — Estado (contest_status).
- **start_date** — TIMESTAMP — Não — Início.
- **end_date** — TIMESTAMP — Não — Fim.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- organs (organ_id).
- boards (board_id).

## UNIQUE CONSTRAINTS
- slug único.

## CHECK CONSTRAINTS
- end_date após start_date quando informado.

## INDEXES
- Índice por status.
- Índice por organ_id.
- Índice por board_id.

## RLS POLICY
- Catálogo: leitura para autenticados; escrita para administrador.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- ContestCreated, ContestUpdated, ContestPublished, ContestClosed.

## NOTES
- Agregado raiz do domínio Contest.

---

# EDITAL

## DOMAIN
- Contest

## TABLE NAME
- editais

## DESCRIPTION
- Documento oficial do concurso.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **contest_id** — REFERENCE — Sim — Concurso ao qual pertence.
- **title** — STRING — Sim — Título do edital.
- **version** — STRING — Não — Versão.
- **published_date** — TIMESTAMP — Não — Data de publicação.
- **content_url** — STRING — Não — Referência ao arquivo.
- **programmatic_content** — JSON — Não — Conteúdo programático estruturado.
- **status** — ENUM — Sim — Estado (publicado/arquivado).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- contests (contest_id).

## UNIQUE CONSTRAINTS
- Um edital vigente por concurso (via status).

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por contest_id.
- Índice por status.

## RLS POLICY
- Catálogo: leitura para autenticados; escrita para administrador.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- EditalPublished, EditalImported, EditalUpdated.

## NOTES
- Pertence ao agregado Contest.

---

# DOCUMENT

## DOMAIN
- Knowledge

## TABLE NAME
- documents

## DESCRIPTION
- Material autorizado enviado pelo usuário.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Proprietário.
- **type** — ENUM — Sim — Tipo do documento (document_type).
- **title** — STRING — Sim — Título.
- **storage_path** — STRING — Sim — Caminho no storage (único).
- **status** — ENUM — Sim — Estado de processamento (document_status).
- **file_size** — INTEGER — Não — Tamanho do arquivo.
- **mime_type** — STRING — Não — Tipo MIME.
- **metadata** — JSON — Não — Metadados.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).

## UNIQUE CONSTRAINTS
- storage_path único.

## CHECK CONSTRAINTS
- file_size não negativo.

## INDEXES
- Índice por (user_id, status).

## RLS POLICY
- Usuário acessa somente os próprios documentos.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- DocumentUploaded, DocumentProcessed, DocumentIndexed, DocumentFailed, DocumentDeleted.

## NOTES
- Agregado raiz do domínio Knowledge.

---

# DOCUMENTCHUNK

## DOMAIN
- Knowledge

## TABLE NAME
- document_chunks

## DESCRIPTION
- Trecho extraído e dividido de um documento.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **document_id** — REFERENCE — Sim — Documento de origem.
- **seq** — INTEGER — Sim — Ordem no documento.
- **content** — TEXT — Sim — Conteúdo do trecho.
- **metadata** — JSON — Não — Metadados (página, seção).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- documents (document_id).

## UNIQUE CONSTRAINTS
- (document_id, seq) único.

## CHECK CONSTRAINTS
- seq não negativo.

## INDEXES
- Índice por document_id.

## RLS POLICY
- Acesso herdado do documento proprietário.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at.

## EVENTS
- ChunkCreated, ChunkIndexed, ChunkDeleted.

## NOTES
- Pertence ao agregado Document.

---

# EMBEDDING

## DOMAIN
- Knowledge

## TABLE NAME
- embeddings

## DESCRIPTION
- Vetor de representação de um chunk.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **chunk_id** — REFERENCE — Sim — Chunk correspondente.
- **model** — STRING — Sim — Modelo que gerou o vetor.
- **embedding** — VECTOR — Sim — Vetor de representação.
- **created_at** — TIMESTAMP — Sim — Data de criação.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- document_chunks (chunk_id).

## UNIQUE CONSTRAINTS
- chunk_id único (1:1).

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice vetorial (HNSW) sobre embedding.

## RLS POLICY
- Acesso herdado do chunk proprietário.

## SOFT DELETE
- Não (regenerável).

## AUDIT
- created_at.

## EVENTS
- EmbeddingCreated, EmbeddingDeleted.

## NOTES
- Relação 1:1 com chunk.

---

# KNOWLEDGESUBJECT

## DOMAIN
- Study

## TABLE NAME
- knowledge_subjects

## DESCRIPTION
- Catálogo de conteúdo (matéria), compartilhado.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **name** — STRING — Sim — Nome (único).
- **slug** — STRING — Sim — Identificador amigável (único).
- **description** — TEXT — Não — Descrição.
- **color** — STRING — Não — Cor para UI.
- **status** — ENUM — Sim — Estado (lifecycle).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- Nenhuma.

## UNIQUE CONSTRAINTS
- name único.
- slug único.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por status.

## RLS POLICY
- Catálogo: leitura para autenticados; escrita para administrador.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- KnowledgeSubjectCreated, KnowledgeSubjectUpdated.

## NOTES
- Substitui conceitualmente Subject (catálogo).

---

# STUDYSUBJECT

## DOMAIN
- Study

## TABLE NAME
- study_subjects

## DESCRIPTION
- Disciplina pertencente ao aluno.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Proprietário.
- **name** — STRING — Sim — Nome da disciplina.
- **color** — STRING — Não — Cor para UI.
- **priority** — INTEGER — Sim — Prioridade (1 a 5).
- **carga_horaria_total** — INTEGER — Sim — Carga horária planejada.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).

## UNIQUE CONSTRAINTS
- (user_id, name) único.

## CHECK CONSTRAINTS
- priority entre 1 e 5.

## INDEXES
- Índice por user_id.

## RLS POLICY
- Usuário acessa somente as próprias disciplinas.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- StudySubjectCreated, StudySubjectUpdated, StudySubjectDeleted.

## NOTES
- Conceito novo (disciplina do aluno).

---

# STUDYTASK

## DOMAIN
- Study

## TABLE NAME
- study_tasks

## DESCRIPTION
- Tarefa de estudo agendada.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Proprietário.
- **study_subject_id** — REFERENCE — Não — Disciplina relacionada.
- **title** — STRING — Sim — Título da tarefa.
- **description** — TEXT — Não — Descrição.
- **scheduled_date** — TIMESTAMP — Sim — Data agendada.
- **duration_min** — INTEGER — Sim — Duração estimada.
- **status** — ENUM — Sim — Estado (task_status).
- **completed_at** — TIMESTAMP — Não — Data de conclusão.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).
- study_subjects (study_subject_id).

## UNIQUE CONSTRAINTS
- Nenhuma.

## CHECK CONSTRAINTS
- duration_min dentro de faixa permitida.

## INDEXES
- Índice por (user_id, scheduled_date).
- Índice por (user_id, status).

## RLS POLICY
- Usuário acessa somente as próprias tarefas.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- StudyTaskCreated, StudyTaskUpdated, StudyTaskCompleted, StudyTaskCancelled.

## NOTES
- Dono do cronograma é decisão aberta (Contest ou Study).

---

# QUESTION

## DOMAIN
- Study

## TABLE NAME
- questions

## DESCRIPTION
- Questão de prova com gabarito.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **knowledge_subject_id** — REFERENCE — Sim — Matéria (catálogo).
- **banca** — STRING — Não — Banca.
- **cargo** — STRING — Não — Cargo.
- **ano** — INTEGER — Não — Ano.
- **nivel** — ENUM — Sim — Dificuldade (question_level).
- **enunciado** — TEXT — Sim — Enunciado.
- **gabarito** — STRING — Sim — Alternativa correta.
- **explicacao** — TEXT — Não — Comentário do gabarito.
- **tipo** — STRING — Sim — Tipo da questão.
- **fonte** — STRING — Não — Origem.
- **is_public** — BOOLEAN — Sim — Visibilidade pública.
- **content_hash** — STRING — Não — Hash para deduplicação (único).
- **status** — ENUM — Sim — Estado (question_status).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- knowledge_subjects (knowledge_subject_id).

## UNIQUE CONSTRAINTS
- content_hash único.

## CHECK CONSTRAINTS
- gabarito pertence a A-E.

## INDEXES
- Índice por knowledge_subject_id.
- Índice por banca.
- Índice por nivel.
- Índice por status.

## RLS POLICY
- Leitura de questões públicas para autenticados.
- Escrita para administrador.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- QuestionCreated, QuestionUpdated, QuestionPublished, QuestionBlocked, QuestionDeleted.

## NOTES
- Agregado raiz do domínio Study.

---

# QUESTIONOPTION

## DOMAIN
- Study

## TABLE NAME
- question_options

## DESCRIPTION
- Alternativa de uma questão.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **question_id** — REFERENCE — Sim — Questão relacionada.
- **letter** — STRING — Sim — Letra da alternativa.
- **text** — TEXT — Sim — Texto da alternativa.
- **is_correct** — BOOLEAN — Sim — Indica o gabarito.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- questions (question_id).

## UNIQUE CONSTRAINTS
- (question_id, letter) único.

## CHECK CONSTRAINTS
- letter pertence a A-E.
- is_correct implica gabarito da questão.

## INDEXES
- Índice por question_id.

## RLS POLICY
- Acesso herdado da questão.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at.

## EVENTS
- OptionCreated, OptionDeleted.

## NOTES
- Pertence ao agregado Question.

---

# QUESTIONATTEMPT

## DOMAIN
- Study

## TABLE NAME
- question_attempts

## DESCRIPTION
- Tentativa de resposta de um usuário.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Usuário.
- **question_id** — REFERENCE — Sim — Questão.
- **selected_letter** — STRING — Sim — Alternativa escolhida.
- **is_correct** — BOOLEAN — Sim — Acerto.
- **time_spent_sec** — INTEGER — Sim — Tempo gasto.
- **mode** — ENUM — Sim — Modo (attempt_mode).
- **created_at** — TIMESTAMP — Sim — Data de criação.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).
- questions (question_id).

## UNIQUE CONSTRAINTS
- Nenhuma.

## CHECK CONSTRAINTS
- selected_letter pertence a A-E.
- time_spent_sec não negativo.

## INDEXES
- Índice por (user_id, created_at).
- Índice por question_id.

## RLS POLICY
- Usuário acessa somente as próprias tentativas.

## SOFT DELETE
- Não (registro imutável).

## AUDIT
- created_at.

## EVENTS
- QuestionAnswered.

## NOTES
- Agregado raiz próprio.

---

# FLASHCARD

## DOMAIN
- Study

## TABLE NAME
- flashcards

## DESCRIPTION
- Cartão de memorização do usuário.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Proprietário.
- **study_subject_id** — REFERENCE — Não — Disciplina.
- **front** — TEXT — Sim — Frente.
- **back** — TEXT — Sim — Verso.
- **tags** — JSON — Sim — Etiquetas.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).
- study_subjects (study_subject_id).

## UNIQUE CONSTRAINTS
- Nenhuma.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por user_id.
- Índice GIN sobre tags.

## RLS POLICY
- Usuário acessa somente os próprios flashcards.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- FlashcardCreated, FlashcardUpdated, FlashcardDeleted.

## NOTES
- Agregado raiz que inclui ReviewSchedule.

---

# REVIEWSCHEDULE

## DOMAIN
- Study

## TABLE NAME
- review_schedules

## DESCRIPTION
- Agendamento de revisão espaçada de um flashcard.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Proprietário.
- **flashcard_id** — REFERENCE — Sim — Flashcard.
- **interval_days** — INTEGER — Sim — Intervalo atual.
- **ease_factor** — DECIMAL — Sim — Fator de facilidade.
- **repetitions** — INTEGER — Sim — Repetições bem-sucedidas.
- **due_date** — TIMESTAMP — Sim — Próxima revisão.
- **last_reviewed_at** — TIMESTAMP — Não — Última revisão.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).
- flashcards (flashcard_id).

## UNIQUE CONSTRAINTS
- (user_id, flashcard_id) único.

## CHECK CONSTRAINTS
- interval_days não negativo.
- ease_factor positivo.

## INDEXES
- Índice por (user_id, due_date).

## RLS POLICY
- Usuário acessa somente os próprios agendamentos.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- ReviewUpdated, FlashcardReviewed.

## NOTES
- Relação 1:1 com Flashcard.

---

# CHATSESSION

## DOMAIN
- AI

## TABLE NAME
- chat_sessions

## DESCRIPTION
- Conversa com o Professor IA.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Proprietário.
- **title** — STRING — Sim — Título da conversa.
- **knowledge_subject_id** — REFERENCE — Não — Matéria em contexto.
- **model** — ENUM — Sim — Modelo de IA (ai_model).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).
- knowledge_subjects (knowledge_subject_id).

## UNIQUE CONSTRAINTS
- Nenhuma.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por (user_id, updated_at).

## RLS POLICY
- Usuário acessa somente as próprias conversas.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- ChatSessionCreated, ChatSessionUpdated, ChatSessionDeleted.

## NOTES
- Agregado raiz do domínio AI.

---

# CHATMESSAGE

## DOMAIN
- AI

## TABLE NAME
- chat_messages

## DESCRIPTION
- Mensagem de uma conversa.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **session_id** — REFERENCE — Sim — Conversa.
- **user_id** — REFERENCE — Sim — Usuário.
- **role** — ENUM — Sim — Papel (chat_role).
- **content** — TEXT — Sim — Conteúdo.
- **model** — ENUM — Não — Modelo usado.
- **tokens_in** — INTEGER — Sim — Tokens de entrada.
- **tokens_out** — INTEGER — Sim — Tokens de saída.
- **created_at** — TIMESTAMP — Sim — Data de criação.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- chat_sessions (session_id).
- users (user_id).

## UNIQUE CONSTRAINTS
- Nenhuma.

## CHECK CONSTRAINTS
- tokens não negativos.

## INDEXES
- Índice por (session_id, created_at).

## RLS POLICY
- Usuário acessa somente mensagens de suas conversas.

## SOFT DELETE
- Não (registro imutável).

## AUDIT
- created_at.

## EVENTS
- MessageSent, ResponseGenerated.

## NOTES
- Pertence ao agregado ChatSession.

---

# AIUSAGE

## DOMAIN
- AI

## TABLE NAME
- ai_usage

## DESCRIPTION
- Consumo de recursos de IA por usuário e dia.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Usuário.
- **usage_date** — TIMESTAMP — Sim — Dia de uso.
- **messages_count** — INTEGER — Sim — Mensagens consumidas.
- **tokens_in** — INTEGER — Sim — Tokens de entrada.
- **tokens_out** — INTEGER — Sim — Tokens de saída.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).

## UNIQUE CONSTRAINTS
- (user_id, usage_date) único.

## CHECK CONSTRAINTS
- contadores não negativos.

## INDEXES
- Índice por (user_id, usage_date).

## RLS POLICY
- Sistema: sem política de cliente; acesso por função definer.

## SOFT DELETE
- Não.

## AUDIT
- updated_at.

## EVENTS
- TokenUsed, LimitReached.

## NOTES
- Fronteira AI/Billing é decisão aberta.

---

# PLAN

## DOMAIN
- Billing

## TABLE NAME
- plans

## DESCRIPTION
- Nível de acesso e limites.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **name** — STRING — Sim — Nome do plano.
- **code** — STRING — Sim — Código (único).
- **price_cents** — INTEGER — Sim — Preço em centavos.
- **limits** — JSON — Sim — Limites por plano.
- **status** — ENUM — Sim — Estado (lifecycle).
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- Nenhuma.

## UNIQUE CONSTRAINTS
- code único.

## CHECK CONSTRAINTS
- price_cents não negativo.

## INDEXES
- Índice por status.

## RLS POLICY
- Catálogo: leitura para autenticados; escrita para administrador.

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- PlanCreated, PlanUpdated.

## NOTES
- Agregado raiz do domínio Billing.

---

# SUBSCRIPTION

## DOMAIN
- Billing

## TABLE NAME
- subscriptions

## DESCRIPTION
- Vínculo do usuário a um plano.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Usuário.
- **plan_id** — REFERENCE — Sim — Plano.
- **status** — ENUM — Sim — Estado (subscription_status).
- **starts_at** — TIMESTAMP — Sim — Início.
- **ends_at** — TIMESTAMP — Não — Fim.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.
- **deleted_at** — TIMESTAMP — Não — Marcador de remoção.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).
- plans (plan_id).

## UNIQUE CONSTRAINTS
- Uma assinatura ativa por usuário (parcial).

## CHECK CONSTRAINTS
- ends_at após starts_at quando informado.

## INDEXES
- Índice por (user_id, status).

## RLS POLICY
- Usuário acessa somente as próprias assinaturas.
- Escrita por função definer (sistema).

## SOFT DELETE
- Sim, via deleted_at.

## AUDIT
- created_at e updated_at.

## EVENTS
- SubscriptionActivated, SubscriptionRenewed, SubscriptionCancelled, SubscriptionSuspended.

## NOTES
- Agregado raiz que inclui Payment.

---

# PAYMENT

## DOMAIN
- Billing

## TABLE NAME
- payments

## DESCRIPTION
- Transação de pagamento registrada.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Usuário.
- **subscription_id** — REFERENCE — Sim — Assinatura.
- **provider** — STRING — Sim — Provedor de pagamento.
- **provider_id** — STRING — Não — ID no provedor (único).
- **amount_cents** — INTEGER — Sim — Valor em centavos.
- **currency** — STRING — Sim — Moeda.
- **status** — ENUM — Sim — Estado (payment_status).
- **external_reference** — STRING — Não — Referência externa.
- **paid_at** — TIMESTAMP — Não — Data de pagamento.
- **created_at** — TIMESTAMP — Sim — Data de criação.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).
- subscriptions (subscription_id).

## UNIQUE CONSTRAINTS
- provider_id único.

## CHECK CONSTRAINTS
- amount_cents não negativo.

## INDEXES
- Índice por (user_id, created_at).
- Índice por subscription_id.

## RLS POLICY
- Sistema: sem política de cliente; acesso por função definer.

## SOFT DELETE
- Não (registro imutável).

## AUDIT
- created_at.

## EVENTS
- PaymentApproved, PaymentFailed, PaymentRefunded.

## NOTES
- Pertence ao agregado Subscription.

---

# EVENTLOG

## DOMAIN
- Analytics

## TABLE NAME
- event_logs

## DESCRIPTION
- Registro de eventos de negócio.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Não — Usuário relacionado (opcional).
- **entity_type** — STRING — Sim — Tipo da entidade.
- **entity_id** — UUID — Não — Identificador da entidade.
- **event_name** — STRING — Sim — Nome do evento.
- **payload** — JSON — Não — Dados do evento.
- **occurred_at** — TIMESTAMP — Sim — Momento do evento.
- **created_at** — TIMESTAMP — Sim — Data de registro.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).

## UNIQUE CONSTRAINTS
- Nenhuma.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por (entity_type, entity_id).
- Índice por (user_id, occurred_at).

## RLS POLICY
- Sistema/admin: somente administração acessa.

## SOFT DELETE
- Não (registro imutável).

## AUDIT
- created_at.

## EVENTS
- MetricsAggregated, Reported.

## NOTES
- Consome eventos de Study, AI e Billing.

---

# DAILYSUMMARY

## DOMAIN
- Analytics

## TABLE NAME
- daily_summaries

## DESCRIPTION
- Resumo diário de desempenho do usuário.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **user_id** — REFERENCE — Sim — Usuário.
- **summary_date** — TIMESTAMP — Sim — Dia do resumo.
- **total_questions** — INTEGER — Sim — Questões respondidas.
- **correct_answers** — INTEGER — Sim — Acertos.
- **study_minutes** — INTEGER — Sim — Minutos estudados.
- **reviews_done** — INTEGER — Sim — Revisões feitas.
- **ai_messages** — INTEGER — Sim — Mensagens de IA.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (user_id).

## UNIQUE CONSTRAINTS
- (user_id, summary_date) único.

## CHECK CONSTRAINTS
- contadores não negativos.

## INDEXES
- Índice por (user_id, summary_date).

## RLS POLICY
- Usuário lê o próprio resumo.
- Escrita por função definer (sistema).

## SOFT DELETE
- Não (derivado e recalculável).

## AUDIT
- created_at e updated_at.

## EVENTS
- SnapshotCreated.

## NOTES
- Materialização é decisão aberta.

---

# SYSTEMSETTING

## DOMAIN
- Administration

## TABLE NAME
- system_settings

## DESCRIPTION
- Configuração global da plataforma.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **key** — STRING — Sim — Chave da configuração (única).
- **value** — JSON — Sim — Valor.
- **description** — TEXT — Não — Descrição.
- **created_at** — TIMESTAMP — Sim — Data de criação.
- **updated_at** — TIMESTAMP — Sim — Data da última alteração.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- Nenhuma.

## UNIQUE CONSTRAINTS
- key único.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por key.

## RLS POLICY
- Somente administrador acessa.

## SOFT DELETE
- Não.

## AUDIT
- created_at e updated_at.

## EVENTS
- SettingUpdated.

## NOTES
- Sem ownership de usuário.

---

# ADMINACTIONLOG

## DOMAIN
- Administration

## TABLE NAME
- admin_action_logs

## DESCRIPTION
- Registro de auditoria de ações administrativas.

## COLUMNS
- **id** — UUID — Sim — Identificador único.
- **admin_id** — REFERENCE — Não — Administrador responsável.
- **action** — STRING — Sim — Ação executada.
- **entity_type** — STRING — Sim — Tipo da entidade alvo.
- **entity_id** — UUID — Não — Entidade alvo.
- **details** — JSON — Não — Detalhes da ação.
- **ip** — STRING — Não — IP de origem.
- **created_at** — TIMESTAMP — Sim — Data de registro.

## PRIMARY KEY
- id (UUID).

## FOREIGN KEYS
- users (admin_id).

## UNIQUE CONSTRAINTS
- Nenhuma.

## CHECK CONSTRAINTS
- Nenhuma.

## INDEXES
- Índice por (admin_id, created_at).

## RLS POLICY
- Somente administrador acessa.

## SOFT DELETE
- Não (registro imutável).

## AUDIT
- created_at.

## EVENTS
- ActionRecorded, AuditExported.

## NOTES
- Referencia entidades de qualquer domínio.

---

# DATABASE ENUMS

### user_plan
- Descrição: Planos de acesso.
- Valores possíveis: free, pro, intensivo.

### user_level
- Descrição: Nível de conhecimento do aluno.
- Valores possíveis: iniciante, intermediario, avancado.

### lifecycle_status
- Descrição: Estado genérico de ciclo de vida.
- Valores possíveis: active, inactive, archived.

### contest_status
- Descrição: Estado de um concurso.
- Valores possíveis: draft, published, closed, archived.

### task_status
- Descrição: Estado de uma tarefa de estudo.
- Valores possíveis: pendente, concluida, adiada.

### question_level
- Descrição: Dificuldade de uma questão.
- Valores possíveis: facil, medio, dificil.

### question_status
- Descrição: Estado de curadoria de uma questão.
- Valores possíveis: rascunho, publicada, bloqueada.

### attempt_mode
- Descrição: Modo de resolução de questão.
- Valores possíveis: estudo, simulado, revisao.

### review_rating
- Descrição: Autoavaliação de revisão.
- Valores possíveis: facil, medio, dificil.

### chat_role
- Descrição: Papel da mensagem no chat.
- Valores possíveis: system, user, assistant.

### ai_model
- Descrição: Modelo de IA utilizado.
- Valores possíveis: flash, pro.

### document_type
- Descrição: Tipo de documento ingerido.
- Valores possíveis: pdf, audio, video, law, edital, apostila.

### document_status
- Descrição: Estado de processamento de documento.
- Valores possíveis: pending, processing, done, error.

### subscription_status
- Descrição: Estado de uma assinatura.
- Valores possíveis: active, pending, cancelled, suspended, expired.

### payment_status
- Descrição: Estado de um pagamento.
- Valores possíveis: approved, pending, rejected, cancelled, refunded.

---

# MATERIALIZED VIEWS

### mv_user_performance_daily
- Finalidade: Resumo diário de desempenho por usuário (derivado de eventos).

### mv_subject_performance
- Finalidade: Taxa de acerto por matéria.

### mv_ai_usage_daily
- Finalidade: Consumo de IA por usuário e dia.

### mv_contest_stats
- Finalidade: Estatísticas por concurso e banca (futuro).

---

# DATABASE FUNCTIONS

### set_updated_at
- Responsabilidade: Atualiza updated_at automaticamente em alterações.

### handle_new_user
- Responsabilidade: Cria o profile ao criar um usuário.

### get_plan_limits
- Responsabilidade: Retorna os limites de um plano.

### register_ai_usage
- Responsabilidade: Incrementa o consumo de IA por usuário e dia.

### register_payment
- Responsabilidade: Registra pagamento e ativa o plano quando aprovado.

### search_documents_semantic
- Responsabilidade: Busca vetorial sobre chunks indexados (RAG, futuro).

---

# STORAGE BUCKETS

- documents: arquivos de documentos e apostilas.
- media: vídeos e áudios de aulas.
- transcripts: transcrições geradas.
- thumbnails: miniaturas de mídia.
- avatars: imagens de perfil.

---

# VECTOR COLLECTIONS

- document_chunks → vetores dos chunks (busca semântica oficial).
- questions → vetores de questões (busca semântica futura).
- knowledge_subjects → vetores de matérias (recomendação futura).
