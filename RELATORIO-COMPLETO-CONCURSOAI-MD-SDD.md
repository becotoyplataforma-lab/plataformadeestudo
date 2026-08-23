# 🗺️ ConcursoAI — SDD Completo do Projeto

> **Documento:** Software Design Document consolidado — relatório técnico completo da plataforma ConcursoAI.
> **Formato:** Markdown hierárquico (compatível com visualização em árvore/mapa mental, sem código HTML).
> **Uso:** destinado à análise por outra IA — máximo de detalhes técnicos, **zero dados sensíveis**.
> **Data:** 2026-08-23 · **Versão do projeto:** `concursoai-platform` v1.0.0-alpha

--- 

## 🏗️ Arquitetura Geral

### Stack Tecnológica

#### Frontend
- **Next.js 16.3.0** — App Router, Turbopack, React 19, TypeScript strict
- **React 19** — Server Components + Client Components (`"use client"`)
- **Tailwind CSS 3.4** — tema shadcn/ui com CSS vars HSL, darkMode por classe
- **shadcn/ui** (Radix UI) — componentes acessíveis (dialog, dropdown, select, tabs, etc.)
- **Recharts 2.15** — gráficos do dashboard (AreaChart, BarChart, PieChart)
- **react-markdown + remark-gfm** — renderização de markdown no chat do Professor IA
- **sonner** — toasts; **zustand 5** — estado leve do cliente
- **next-themes** — troca de tema; **lucide-react** — ícones
- **date-fns 4** — datas; **class-variance-authority + tailwind-merge + clsx** — estilos

#### Backend
- **Next.js API Routes** — ~90 endpoints em `src/app/api/`
- **Server Actions** — ações de mutação (ex.: `actionUpdateProfile` em perfil)
- **Drizzle ORM 0.45** — queries tipadas sobre PostgreSQL
- **Auth.js (NextAuth v5 beta.25)** — autenticação com Credentials + Supabase Auth
- **postgres 3.4** — driver SQL nativo (single-connection pool)
- **Zod 3.24** — validação de fronteira (DTOs + inputs de API)

#### Banco de Dados
- **PostgreSQL 17** — via **Supabase** (Auth, Storage, RLS)
- **pgvector** — colunas `vector(1024)` + índice HNSW (m=16) em `embeddings`
- **Full Text Search** — coluna gerada `fts_vector` (config `portuguese`) em `document_chunks`
- **Drizzle Kit 0.31** — geração de migrações (`drizzle/`) + SQL manual em `database/migrations/`

#### Infraestrutura
- **Oracle Cloud VPS** — servidor de produção
- **Cloudflare** — DNS, CDN, certificado Origin, proxy
- **Nginx** — reverse proxy no host (TLS 1.2/1.3, headers de segurança)
- **Docker + Docker Compose** — app standalone + job de migração
- **GitHub Actions** — CI/CD (lint → typecheck → vitest → build → deploy SSH)

#### Ferramentas de Dev
- **ESLint 9** (flat config) + **eslint-config-next** 16.0
- **TypeScript 5.7** — `strict: true`, `moduleResolution: bundler`
- **Vitest 4** — unit/integration (coverage v8, thresholds)
- **Playwright 1.62** — E2E (chromium, locale pt-BR)
- **PostCSS + Autoprefixer**; **tailwindcss-animate**
- **Node ≥ 20.9** (engines) — Dockerfile usa Node 24 LTS Alpine

### Diagrama de Camadas

#### Camada de Apresentação
- `src/app/` — páginas, layouts, error/loading/not-found boundaries
- `src/components/` — componentes React por domínio (admin, study, ui, etc.)
- Server Components fazem `auth()` e queries; Client Components consomem API

#### Camada de API
- `src/app/api/**/route.ts` — endpoints HTTP com validação Zod + DTO
- `src/lib/api/helpers.ts` — `requireAuth()`, `apiError()`, `apiOk()`
- Rate limiting aplicado nas rotas sensíveis (`rateLimit()`)

#### Camada de Serviço
- `src/lib/<domain>/services/*.service.ts` — orquestração de regras de negócio
- Services de orquestração: `DocumentPipelineService`, `ProfessorService`, `RagService`, `EntitlementService`, `QuestionGenerationService`, etc.
- Dependem de repositories + providers externos (DeepSeek, embeddings, storage)

#### Camada de Repositório
- `src/lib/<domain>/repositories/*.repository.ts` — persistência tipada
- `src/lib/db/repositories/` — repositórios de leitura Drizzle (perfil, edital, chat, questões, etc.)
- Padrão obrigatório (DD-004): toda query passa por repositórios

#### Camada de Banco
- `src/db/schema/` — 8 arquivos de domínio + `enums.ts`
- SQL físico em `database/<dominio>/` (tables, rls, índices, triggers)
- Migrações: `drizzle/` (Drizzle Kit) + `database/migrations/` (SQL manual idempotente)

---

## 📁 Estrutura de Diretórios

### src/app/ — Rotas Next.js
- `page.tsx` — landing page pública (features, passos, CTA)
- `(auth)/` — grupo público: `login`, `cadastro`, `recuperar-senha` (metadata `noindex`)
- `(dashboard)/` — grupo autenticado: dashboard, analises, apostilas, aulas, configuracoes, cronograma, flashcards, perfil, professor, questoes, redacao
- `(study)/` — grupo modo foco: `sessao` (Pomodoro, sem sidebar, `noindex`)
- `dashboard/` — re-exporta layout e página do grupo `(dashboard)` (URL limpa)
- `admin/` — 20+ páginas administrativas (todas `force-dynamic`, protegidas)
- `api/` — ~90 rotas (ver seção API)
- Arquivos especiais: `error.tsx`, `not-found.tsx`, `loading.tsx`, `sitemap.ts`, `robots.ts`, `manifest.ts`, `icon.svg`, `apple-icon.png`, `opengraph-image.png`, `twitter-image.png`, `globals.css`

### src/components/ — Componentes React
- `admin/` — 20 arquivos (formulários, filas de revisão, geradores, shell)
- `analises/` — `analises-client.tsx` (recharts)
- `apostilas/` — `apostilas-list.tsx`, `gerar-questoes.tsx`
- `auth/` — `login-form.tsx`, `register-form.tsx`, `forgot-password-form.tsx`
- `cronograma/` — `cronograma-client.tsx`
- `dashboard/` — `dashboard-stats.tsx`, `evolution-chart.tsx`, `performance-chart.tsx`
- `effects/` — `matrix-rain.tsx` (canvas)
- `flashcards/` — `flashcards-client.tsx`
- `layout/` — `app-header.tsx`, `app-sidebar.tsx`, `user-menu.tsx`
- `perfil/` — `profile-form.tsx`
- `professor/` — `chat-client.tsx`
- `questoes/` — `question-browser.tsx`, `question-card.tsx`
- `settings/` — `settings-content.tsx`
- `study/` — `essay-correction-form.tsx`, `focus-session.tsx`, `lesson-player.tsx`
- `ui/` — 22 componentes shadcn/ui (button, card, dialog, select, table, tabs, etc.)

### src/lib/ — Bibliotecas e Serviços
- `administration/` — guards, auditoria, moderação, concursos, editais
- `ai/` — chat, RAG, geração de questões, correção de redação, provedores
- `analytics/` — streak, agregação, daily summary
- `api/` — helpers de API routes
- `auth/` — NextAuth v5 (handlers, callbacks, configuração)
- `billing/` — planos, assinaturas, checkout, webhooks, limites
- `contest/` — inteligência de concursos
- `db/` — cliente Drizzle + repositórios de leitura
- `dto/` — Data Transfer Objects (Zod) por domínio
- `env.ts` — schema Zod de variáveis de ambiente (fail-fast)
- `knowledge/` — pipeline de conhecimento (ingestão → chunking → embedding → busca)
- `observability.ts` — logs estruturados
- `payments/` — integração Mercado Pago
- `security/` — rate limit, IP, course-scope
- `study/` — flashcards, planejador adaptativo, questões, FSRS
- `supabase/` — clientes admin + middleware de sessão
- `utils.ts` — helpers (`cn`, `formatMinutes`, `formatPercent`, `firstName`, `initials`)
- `validations/` — schemas Zod de entrada (auth, chat, questões, cronograma, flashcards)

### src/db/ — Schema e Repositórios
- `schema/` — `identity.ts`, `contest.ts`, `knowledge.ts`, `study.ts`, `ai.ts`, `billing.ts`, `analytics.ts`, `administration.ts`, `enums.ts`, `index.ts`
- `src/lib/db/drizzle.ts` — singleton lazy do cliente `db` (Proxy + postgres + drizzle-orm)
- `src/lib/db/repositories/` — `perfil.ts`, `edital.ts`, `chat.ts`, `questoes.ts`, `contest.ts`, `analises.ts`, `flashcards.ts`

### database/ — Migrations e SQL
- `identity/`, `contest/`, `knowledge/`, `study/`, `ai/`, `billing/`, `analytics/`, `administration/` — cada um com `tables.sql`, `rls.sql`, `indexes.sql`, `seed.sql`
- `migrations/` — SQL manual idempotente: `2026-08-15-consolidation.sql`, `-fsrs.sql`, `-pricing-limits.sql`, `-admin-content.sql`, `-concursoai-e2e.sql`, `-pme-rj-seed.sql`

### docs/ — Documentação
- 20 documentos numerados (specs/arquitetura) — ver seção Documentação
- 29 documentos temáticos (ADMIN, AI, ARCHITECTURE, RAG, KNOWLEDGE_PIPELINE, etc.)
- `screenshots-telas/` — 25 screenshots PNG

### tests/ — Testes
- `tests/e2e/` — 13 specs Playwright + `global-setup.ts` + `support/auth.ts`
- `tests/stubs/server-only.ts` — stub para Vitest

### infra/ — Configuração de Deploy
- `Dockerfile`, `docker-compose.yml`, `docker-compose.migrate.yml`
- `nginx/app.becotoy.com.conf`, `deploy.sh`, `migrate.sh`, `backup.sh`, `healthcheck.sh`
- `github/deploy.yml`, `.env.production.example`, `.dockerignore`

### scripts/ — Scripts Operacionais
- `apply-migration.mjs`, `create-mp-test-user.ts`, `generate-embeddings.ts`, `test-embeddings-flow.ts`, `test-mercadopago-flow.ts`

### public/ — Assets Estáticos
- Ícones, imagens de mídia social, assets do manifest PWA

---

## 🔐 Autenticação e Autorização

### NextAuth v5 (Auth.js)
- Arquivo: `src/lib/auth/auth.ts` — exporta `handlers`, `auth`, `signIn`, `signOut`
- **Provider**: Credentials — valida e-mail/senha contra Supabase Auth (admin client)
- **JWT Strategy**: sessão em JWT (sem adapter de banco)
- **Callbacks**:
  - `jwt` — grava `token.id` (Supabase `user_id`), `email`, `name`
  - `session` — injeta `session.user.id` a partir do token
- **Interface**: `CredentialsInput` (`email`, `password`)
- API route: `/api/auth/[...nextauth]`

### Roles e Níveis de Acesso
- **aluno** — usuário autenticado padrão (dashboard, estudo, IA, analytics)
- **admin** — verificado por `AdminGuardService.requireAdmin` + `getAdminSession()`
- **professor** — papel conceitual (conteúdo gerado por IA; upload de apostilas restrito a admin)

### Proteção de Rotas
- **Layouts Server Components**:
  - `(dashboard)/layout.tsx` — chama `auth()`, redireciona para `/login` se sem sessão
  - `admin/layout.tsx` — `auth()` + `AdminGuardService.isAdminEmail` (redireciona para `/dashboard` se não admin)
  - `(study)/layout.tsx` — autenticado via middleware
  - `(auth)/layout.tsx` — público com `noindex`
- **`getAdminSession()`** — obtém sessão e valida admin em rotas de API admin
- **`AdminGuardService.requireAdmin`** — guarda de serviço para ações administrativas
- **Middleware Supabase** — `src/lib/supabase/middleware.ts` (`updateSession`) renova sessão e mantém cookies
- **Admin no banco**: `raw_app_meta_data->>'is_admin' = 'true'` no Supabase; allowlist de e-mails via `ADMIN_EMAILS` (env) + `system_settings['admin.emails']`

---

## 📚 Funcionalidades por Módulo

### Módulo: Apostilas (Knowledge)

#### Upload de Apostilas (Admin)
- **Componentes**: `apostila-upload-form.tsx`, `batch-upload-form.tsx` (máx. 20 arquivos)
- **API Routes**: `POST /api/knowledge/upload` (admin only), `POST /api/admin/apostilas/batch`
- **Serviços**: `IngestionService.ingest()` → `DocumentPipelineService.processDocument()`
- **Pipeline**: storage → extração → normalização → chunking → embedding → indexed
- **Formatos Suportados**: PDF (`pdf-parse`), DOCX (`mammoth`), HTML (`stripHtml`), TXT/Markdown
- **Limites e Validações**:
  - Tamanho máximo 25MB; MIME allowlist
  - Hash SHA-256 + dedup por usuário
  - Magic bytes (PDF `%PDF`, DOCX ZIP + `word/`, TXT/HTML ≥95% ASCII imprimível)
  - Sanitização de filename (anti path traversal)
  - Rate limit por plano: free 10/h, pro 50/h, intensivo 100/h
  - Quota por plano (`validateQuota(userId, fileSize, planLimit)`)

#### Listagem de Apostilas (Aluno)
- `GET /api/knowledge/documents` — documentos do usuário
- Componente: `apostilas-list.tsx` (com seleção/consolidação)

#### Visualização de Apostila
- `GET /api/knowledge/documents/[id]` — detalhe (dono ou admin)
- Página: `/apostilas/[id]` — info do doc, questões relacionadas, `GerarQuestoes`
- Admin: `/admin/apostilas/[id]` — chunks, embeddings, páginas, matérias

#### Busca em Apostilas
- `POST /api/knowledge/search` — busca híbrida sobre documentos do usuário (escopo do curso)

#### Consolidação
- `POST /api/documents/consolidate` — consolida 2–10 apostilas da mesma matéria (admin ou dono), rate limit 10/min

### Módulo: Questões

#### Geração de Questões (Aluno)
- `POST /api/questions/generate` — a partir de apostila própria (rate limit 10/min, verifica propriedade)
- `QuestionGenerationService.generateFromDocument()` — monta contexto (máx 12000 chars), gera via DeepSeek flash, valida (10 regras), persiste como `em_revisao`

#### Geração de Questões (Admin)
- `POST /api/admin/questions/generate` — quantidade 1–20, entram em `EM_REVISÃO`
- `POST /api/admin/questions/import` — importa CSV/XLSX/JSON (entram em `EM_REVISÃO`)
- `GET /api/admin/questions/import/template` — modelo CSV
- Componentes: `questao-generate-form.tsx`, `questoes-import-form.tsx`

#### Revisão de Questões (Admin)
- `GET /api/admin/questions` — curadoria com filtros (status, subject_id, banca, page)
- `PATCH /api/admin/questions/[id]` — status de curadoria
- `POST /api/admin/questions/[id]/review` — `aprovar`/`rejeitar`/`publicar`/`bloquear`/`revisar`
- Componente: `questao-review-queue.tsx`; página `/admin/questoes/revisao`

#### Publicação de Questões
- Status `em_revisao → publicada` via moderação
- `QuestionModerationEvents` registra eventos (ex.: `gerada_por_ia`)

#### Tipos de Questão Suportados
- Múltipla escolha com 5 alternativas A–E (`questionOptions`), gabarito com CHECK `^[A-E]$`

#### Rastreabilidade
- `source_document_id`, `source_chunk_id` (`pickSourceChunkId()`), `moderation_event`, `generated_by` (IA)

### Módulo: Professor IA (RAG)

#### Chat com IA
- `POST /api/chat` — streaming SSE, rate limit 30/min, maxDuration 60
- `POST /api/ai/chat` — sem RAG; `POST /api/ai/rag` — com RAG (rate limit 30/min)
- `POST /api/professor/chat` — orquestração (intent chat vs RAG)
- `ProfessorService.ask()` — decide intent, aplica limite de uso, roteia modelo, executa com timeout

#### Busca Híbrida (FTS + Vetorial)
- `HybridSearchService.search()` — combina pgvector (cosseno `<=>`) + FTS `portuguese`
- Pesos configuráveis (`vectorWeight`/`ftsWeight`), isolamento por `positionId`/`editalId`
- Fallback: sem embeddings configurados, busca FTS-only (documento termina em `chunked`, não é falha)

#### Pipeline de Embeddings
- **Chunking**: `ChunkService.chunk()` — estratégia `fixed` ou `structural` (headings), com `content_hash`
- **Geração**: `EmbeddingService.embedDocument()` — BAAI/bge-m3, dimensão 1024, lotes de 20
- **Cache**: `EmbeddingCacheRepository` — PK composta `content_hash + model`
- **Armazenamento**: `embeddings` (vector(1024)) + índice HNSW (m=16); cache separado
- **Busca Vetorial**: via `embeddingClient.embed()` + query pgvector

#### Fallbacks
- Sem `EMBEDDING_API_URL` → pipeline para em `chunked`; busca FTS-only; chat sem RAG

### Módulo: Redação/Essay
- `POST /api/essay/correct` — correção pelo Professor IA (rate limit 10/min, verifica cota)
- `EssayCorrectionService.correct(text)` — valida texto (mín 120 chars), prompt com critérios ENEM
- **Critérios**: Coerência, Coesão, Norma culta, Argumentação, Proposta de intervenção
- **Resultado**: `notaTotal` (0–1000), `criterios[]`, `comentarioGeral` — modelo `pro`
- **Integração com LLM**: `DeepSeekProvider.complete()` + `stripCodeFences() → extractJson() → validateResult()`
- Componente: `essay-correction-form.tsx`; página `/redacao`

### Módulo: Dashboard

#### Dashboard do Aluno
- Página `/dashboard` — saudação, `DashboardStats`, `EvolutionChart`, `PerformanceChart`, análise de fraquezas, "continuar aula"
- API: `/api/analytics/summary`, `/api/analytics/evolution`, `/api/analytics/subjects`, `/api/analytics/study-time`, `/api/analytics/schedule`, `/api/analytics/distribution`, `/api/analytics/daily-summary`

#### Dashboard do Admin
- Página `/admin` — cards de stats (alunos, concursos, editais, apostilas, questões, revisões, aulas, avatares, mensagens IA)

#### Métricas e Estatísticas
- `AnalyticsService` — streak, agregação diária (`dailySummaries`), eventos (`eventLogs`)
- `AnalisesClient` — gráficos recharts (bar, pie) + tabelas
- Clamps: `?days=` limitado a 1–90

### Módulo: Planos e Pagamentos
- **Planos**: `free`, `pro`, `intensivo` (tabela `plans`)
- **Checkout**: `POST /api/billing/checkout` — cria checkout Mercado Pago (`CheckoutService.createCheckout`)
- **Gestão de Assinatura**: `POST /api/billing/subscriptions/cancel` — `SubscriptionService.cancel`
- **Entitlement**: `GET /api/billing/entitlement` — plano + assinatura + limites
- **Catálogo**: `GET /api/billing/plans`
- **Webhooks**: `/api/billing/webhook`, `/api/payments/webhook` — HMAC constant-time; 401 inválido, 500 em falha, 200 em sucesso/duplicidade
- **Limites por Plano**: `limits.resolver.ts` — `DEFAULT_FREE_LIMITS`, uploads/hora, mensagens IA/dia, modelo disponível (`canUseModel`)
- **Integração**: `payments/mercadopago.ts` — `getPayment`, `createPreapproval`, `getPreapproval`

### Módulo: Configurações
- **Perfil do Usuário**: `/perfil` — `ProfileForm` + Server Action `actionUpdateProfile` (concursos/cargos, meta diária)
- **Preferências de Estudo**: cronograma, flashcards, matérias, tarefas
- **Configurações de Admin**: `/api/admin/settings` (CRUD) — `systemSettings` (ex.: `admin.emails`)

---

## 🗄️ Banco de Dados

### Tecnologia
- **PostgreSQL 17** (Supabase) — RLS deny-by-default, pgvector, FTS
- **Drizzle ORM** — schema tipado em `src/db/schema/`, migrações em `drizzle/`

### Schema — Domínio Identity (`identity.ts`)
- `authUsers` — espelha `auth.users` do Supabase (fonte de identidade, ADR-001)
- `profiles` — `id`, `fullName`, `avatarUrl`, `level`, `concursoAlvo`, `bancaPreferida`, `contestId`, `positionId`, `metaDiariaMin`, `modeloIaPadrao`
- `sessions` — sessões da aplicação

### Schema — Domínio Contest (`contest.ts`)
- `organs` — órgãos; `boards` — bancas
- `contests` — concursos (status: rascunho/publicado/encerrado/arquivado)
- `editais` — editais por concurso (vigentes, pesos de matéria)
- `positions` — cargos por concurso; `noticeSubjects` — matérias do edital

### Schema — Domínio Knowledge (`knowledge.ts`)
- `documents` — apostilas/materiais (status: pending → processing → processed/chunked → indexing → indexed/failed; reviewStatus)
- `documentChunks` — chunks de texto com `fts_vector` GENERATED (tsvector `portuguese`)
- `embeddings` — `vector(1024)`, índice HNSW m=16
- `embeddingCache` — PK composta `content_hash + model`
- `knowledgeSubjects`, `knowledgeTopics`, `knowledgeTags` — catálogo
- `documentSubjects`, `documentTopics`, `documentTags` — junctions

### Schema — Domínio Study (`study.ts`)
- `studySubjects`, `studyTasks` — plano de estudos
- `questions` — banco de questões (gabarito CHECK `^[A-E]$`)
- `questionOptions` — alternativas A–E
- `questionAttempts` — tentativas de resposta
- `flashcards` — cards de revisão
- `reviewSchedules` — agendamento FSRS (`stability`, `difficulty`, `lastRating`)
- `questionModerationEvents` — trilha de moderação
- `lessons`, `lessonProgress` — aulas geradas e progresso

### Schema — Domínio AI (`ai.ts`)
- `chatSessions`, `chatMessages` — conversas do Professor IA
- `aiUsage` — consumo diário (tokens, custo, mensagens), RLS por `user_id` para `authenticated` e acesso integral do `service_role`
- `avatars` — personagens (ex.: "Prof. Rafa")

### Schema — Domínio Billing (`billing.ts`)
- `plans` — catálogo de planos
- `subscriptions` — assinaturas (campo `preapprovalId` Mercado Pago)
- `payments` — pagamentos

### Schema — Domínio Analytics (`analytics.ts`)
- `eventLogs` — eventos brutos
- `dailySummaries` — resumos materializados por dia

### Schema — Domínio Administration (`administration.ts`)
- `systemSettings` — configurações do sistema (admin only)
- `adminActionLogs` — auditoria de ações administrativas (admin only)

### Relacionamentos
- `profiles.contestId → contests.id`, `profiles.positionId → positions.id`
- `documents.subjectId → knowledgeSubjects.id`
- `documentChunks.documentId → documents.id`; `embeddings.chunkId → documentChunks.id`
- `questions.subjectId → knowledgeSubjects.id` (ou study), `questions.sourceDocumentId → documents.id`
- `questionAttempts.questionId → questions.id`, `questionAttempts.userId → profiles.id`
- `chatMessages.sessionId → chatSessions.id`
- `subscriptions.userId → profiles.id`, `subscriptions.planId → plans.id`
- `payments.subscriptionId → subscriptions.id`

### Índices
- HNSW em `embeddings.vector` (m=16)
- GIN/tsvector em `documentChunks.fts_vector`
- Índices em FKs e filtros de busca (subject_id, status, user_id, dates)

### RLS Policies
- **Princípio**: deny-by-default — sem política = sem acesso
- `identity/rls.sql` — usuário acessa apenas o próprio perfil/sessão
- `knowledge/rls.sql` — dono do documento (ou admin) acessa; `embedding_cache` deny-by-default (service_role)
- `study/rls.sql` — propriedade por `user_id`
- `contest/rls.sql` — catálogo público (leitura), escrita admin
- `billing/rls.sql` — `plans_select_authenticated`, `subscriptions_select_own`
- `ai/rls.sql` — `ai_usage` permite SELECT/INSERT próprios para `authenticated`; UPDATE/DELETE ficam restritos ao service role
- `analytics/rls.sql` — eventos do próprio usuário
- `administration/rls.sql` — `system_settings` e `admin_action_logs` sem políticas permissivas (service_role/SECURITY DEFINER)
- Acesso administrativo: `raw_app_meta_data->>'is_admin' = 'true'` + service_role

---

## 🌐 API — Rotas Endpoints

### Rotas Públicas
- `GET /` — landing page
- `GET /login`, `GET /cadastro`, `GET /recuperar-senha` — páginas de autenticação
- `GET /api/health` — health check de deploy
- `GET /api/health/storage` — backend de storage ativo + status IA (booleans)
- `POST /api/register` — cria conta Supabase Auth (rate limit 5/IP/15min, 3/email/15min)
- `POST /api/auth/[...nextauth]` — handlers NextAuth
- `POST /api/auth/recuperar-senha` — e-mail de redefinição (rate limit 3/email, 5/IP/15min)
- `GET /api/knowledge/subjects`, `GET /api/knowledge/topics` — catálogo público
- `POST /api/billing/webhook`, `POST /api/payments/webhook` — webhooks Mercado Pago (HMAC; 401/500/200 conforme resultado)

### Rotas Autenticadas (Aluno)
- `GET /api/knowledge/documents`, `GET /api/knowledge/documents/[id]`, `DELETE /api/knowledge/documents/[id]`, `POST /api/knowledge/documents/[id]/process`
- `POST /api/knowledge/search`, `POST /api/knowledge/upload` (admin only)
- `POST /api/chat`, `GET/POST /api/chat/sessions`, `DELETE /api/chat/sessions/[id]`, `GET /api/chat/sessions/[id]/messages`
- `POST /api/ai/chat`, `POST /api/ai/rag`, `POST /api/professor/chat`
- `GET/POST /api/flashcards`, `DELETE /api/flashcards/[id]`, `POST /api/flashcards/review`
- `GET /api/lessons`, `GET /api/lessons/[id]`, `POST /api/lessons/[id]/progress`
- `GET /api/questoes`, `POST /api/questoes/[id]/responder`
- `POST /api/essay/correct`, `POST /api/questions/generate`
- `GET /api/analises/por-materia`, `GET /api/analises/resumo`
- `GET /api/analytics/*` — summary, evolution, subjects, study-time, schedule, distribution, daily-summary
- `GET /api/study/attempts`, `GET /api/study/edital-subjects`
- `GET/POST /api/study/subjects`, `GET/PATCH/DELETE /api/study/subjects/[id]`
- `GET/POST /api/study/tasks`, `PATCH/DELETE /api/study/tasks/[id]`, `POST /api/study/tasks/[id]/complete`
- `GET/POST /api/study/flashcards`, `PATCH/DELETE /api/study/flashcards/[id]`, `POST /api/study/flashcards/[id]/review`
- `GET/POST /api/study/questions`, `GET /api/study/questions/[id]`, `POST /api/study/questions/[id]/answer`
- `POST /api/study/planner/generate` — planejador adaptativo
- `POST /api/billing/checkout`, `GET /api/billing/entitlement`, `GET /api/billing/plans`, `POST /api/billing/subscriptions/cancel`
- `POST /api/documents/consolidate`

### Rotas Autenticadas (Admin) — todas `getAdminSession()` + `AdminGuardService.requireAdmin`
- `POST /api/admin/apostilas/batch` — upload em lote (máx. 20)
- `GET /api/admin/audit` — ações administrativas
- `GET/POST /api/admin/avatares` — avatares
- `GET /api/admin/contest-intelligence` — análise banca/edital (`?edital_id=` UUID)
- `GET/POST /api/admin/contests`, `PATCH/DELETE /api/admin/contests/[id]`
- `POST /api/admin/documents/[id]/fonte`, `GET /api/admin/documents/[id]/preview`, `POST /api/admin/documents/[id]/review`
- `POST /api/admin/editais/apply`, `POST /api/admin/editais/parse`
- `GET /api/admin/fontes`, `POST /api/admin/import/url`
- `POST /api/admin/lessons/generate`
- `GET/POST /api/admin/organs-boards`
- `GET/POST /api/admin/positions`, `PATCH/DELETE /api/admin/positions/[id]`
- `GET /api/admin/questions`, `PATCH /api/admin/questions/[id]`, `POST /api/admin/questions/[id]/review`
- `POST /api/admin/questions/generate`, `POST /api/admin/questions/import`, `GET /api/admin/questions/import/template`
- `GET/POST /api/admin/settings`, `GET/PATCH/DELETE /api/admin/settings/[key]`
- `GET/POST /api/admin/subjects`

### Rotas de Sistema (SEO)
- `GET /sitemap.xml` — URLs `/`, `/login`, `/cadastro` (usa `publicEnv.appUrl`)
- `GET /robots.txt` — permite `/`, `/login`, `/cadastro`; bloqueia `/admin/`, `/dashboard`, `/api/`, áreas autenticadas
- `GET /manifest.webmanifest` — PWA (nome "ConcursoAI", tema `#03050a`, ícones)

---

## ⚙️ Serviços Core (src/lib/)

### knowledge/
- `services/ingestion.service.ts` — `IngestionService.ingest()`, `validateQuota()`; helpers `computeHash`, `sanitizeFilename`, `isPrintableASCII`, `validateMagicBytes`, `deriveTitle`, `mapMimeToType`
- `services/document-pipeline.service.ts` — `DocumentPipelineService.processDocument()` (estados do pipeline)
- `services/chunk.service.ts` — `ChunkService.chunk()`; `fixedChunk`, `structuralChunk`, `findBreakpoint`, `selectStrategy`
- `services/embedding.service.ts` — `EmbeddingService.embedDocument()` (cache + batch 20)
- `services/hybrid-search.service.ts` — `HybridSearchService.search()` (vetorial + FTS, pesos)
- `services/extraction.service.ts` — `DocumentExtractionService.extract()` (pdf-parse, mammoth, stripHtml)
- `services/metadata.service.ts` + `metadata.helpers.ts` — classificação de matéria/tópicos, `extractLegalReferences`, `detectLanguage`, `extractKeywords`
- `services/consolidation.service.ts` — `ConsolidationService.consolidate()` (síntese DeepSeek)
- `services/transcription.service.ts` — `TranscriptionService` (STUB Whisper, `isConfigured()`)
- `services/url-import.service.ts` — `UrlImportService.importFromUrl()`
- `repositories/` — `DocumentRepository`, `DocumentChunkRepository`, `EmbeddingRepository`, `EmbeddingCacheRepository`, `KnowledgeSubjectRepository`, `KnowledgeTopicRepository`, `KnowledgeTagRepository`, junctions
- `embedding/client.ts` — `embeddingClient.embed()`, `isConfigured()` (OpenAI-compatible + nativo, 1024d)
- `security/course-scope.ts` — `resolveCourseScope(profile)`, `isDocInUserScope(doc, profile)`
- `storage/storage.service.ts` — `DocumentStorageService` (R2 preferencial, Supabase fallback; `ensureBucket`, `upload`, `download`, `remove`)
- `storage/r2-storage.service.ts` — `R2StorageService` (S3-compatível via `@aws-sdk/client-s3`)

### auth/
- `auth.ts` — handlers/config NextAuth v5 (JWT, Credentials, Supabase)
- `administration/services/admin-guard.service.ts` — `AdminGuardService.requireAdmin`, `isAdminEmail`

### ai/
- `services/chat.service.ts` — `ChatService.send()` (chat sem RAG)
- `services/rag.service.ts` — `RagService.answer()` (recupera chunks, prompt, citações, confiança)
- `services/professor.service.ts` — `ProfessorService.ask()` (intent chat vs RAG, limite de uso, modelo, timeout)
- `services/deepseek-provider.service.ts` — `DeepSeekProvider.complete()`
- `services/model-router.service.ts` — `ModelRouterService.route()` (flash/pro/kimi)
- `services/usage.service.ts` — `UsageService` (`getToday`, `record`, `checkLimit`, `estimateCost`, `USD_TO_BRL`)
- `services/prompt.service.ts` — `PromptService` (`buildSystemPrompt`, `buildMessages`)
- `services/question-generation.service.ts` — `QuestionGenerationService.generateFromDocument()`
- `services/question-validation.service.ts` — `QuestionValidationService.validate()` (10 regras)
- `services/essay-correction.service.ts` — `EssayCorrectionService.correct()`
- `services/edital-parsing.service.ts` — `EditalParsingService.parseFromDocument()`
- `services/lesson-generation.service.ts` — `LessonGenerationService.generateFromDocument()`
- `generation/question-generation.provider.ts` — `DeepSeekQuestionProvider.generateQuestions()`
- `repositories/` — `ChatRepository`, `UsageRepository`, `AvatarRepository`
- `types.ts` — `AIModel` (`flash|pro|kimi`), `MODEL_PARAMS`, `MODEL_NAMES`
- `deepseek.ts`, `kimi.ts` — clients de chat/streaming; `limits.ts` — `getAiUsage`, `registerUsage`; `prompts.ts` — prompts versionados + `interpolate`

### billing/
- `services/entitlement.service.ts` — `getCurrent`, `getLimits`, `canUseModel`
- `services/subscription.service.ts` — `activate`, `renew`, `cancel`, `getCurrent`
- `services/checkout.service.ts` — `createCheckout`
- `services/webhook.service.ts` — `handleNotification`, `handlePreapproval`, `handlePayment`, `verifyMpSignature`, `mapMpStatus`
- `services/limits.resolver.ts` — `resolveUserLimits`; `services/plan.resolver.ts` — `resolveUserPlan`
- `repositories/` — `PlanRepository`, `SubscriptionRepository`, `PaymentRepository`
- `types.ts` — `SubscriptionStatus`, `PaymentStatus`, `PlanLimits`, `DEFAULT_FREE_LIMITS`, `CurrentEntitlement`, `normalizeLimits`

### security/
- `rate-limit.ts` — `rateLimit(bucket, key, limit, windowMs)` (in-memory sliding window, limpeza 10min), `resetRateLimitStore()`
- `client-ip.ts` — `getClientIP(req)` (`x-real-ip` → `x-forwarded-for` → `unknown`)

### analytics/
- `services/streak.service.ts`, `services/daily-summary-event-log.service.ts`, `services/aggregation.service.ts`

### study/
- Planejador adaptativo (`study-planner`, `adaptive-planner`), FSRS (`fsrs`, `review-schedule`), `flashcard.service`, `question-answering.service`, `link-resolver.service`

### administration/
- `services/` — `system-setting.service`, `question-import.service`, `position.service`, `moderation.service`, `contest.service`, `audit.service`, `admin-guard.service`

### dto/ — schemas Zod + mappers
- `knowledge.dto.ts`, `ai.dto.ts`, `billing.dto.ts`, `study.dto.ts`, `rag.dto.ts`, `professor.dto.ts`, `administration.dto.ts`, `analytics.dto.ts`, `index.ts` (`parseDto`, `strictDto`)

### validations/
- `auth.ts` (`registerSchema`), `chat.ts`, `questoes.ts`, `cronograma.ts`, `flashcards.ts`

### supabase/
- `admin.ts` — `createAdminClient()` (service role, server-only, bypass RLS)
- `middleware.ts` — `updateSession(request)`

---

## 🔄 Fluxos de Dados

### Fluxo: Upload de Apostila
1. `POST /api/knowledge/upload` (admin) → `IngestionService.ingest()`
2. Valida MIME (allowlist) e tamanho (25MB)
3. Calcula hash SHA-256; valida magic bytes (conteúdo vs MIME)
4. Dedup (`findByHash` por usuário); sanitiza filename
5. Gera `storagePath = {userId}/{docId}/{safeName}`
6. `DocumentRepository.create(status="pending")`
7. Upload físico → `DocumentStorageService.upload` (R2 ou Supabase)
8. `DocumentPipelineService.processDocument()` (assíncrono)

### Fluxo: Geração de Questão
1. `QuestionGenerationService.generateFromDocument()`
2. Valida documento (status chunked/indexed, reviewStatus)
3. Busca chunks; monta contexto (máx 12000 chars)
4. `questionGenerationProvider.generateQuestions()` → DeepSeek flash
5. Para cada questão: `QuestionValidationService.validate()` (10 regras)
6. `pickSourceChunkId()` (rastreabilidade) → cria questão `em_revisao`
7. `createOptions()` (5 alternativas A–E); `createModerationEvent(action="gerada_por_ia")`

### Fluxo: Chat com Professor IA
1. `ProfessorService.ask()` — valida mensagem
2. `EntitlementService.getLimits(userId)` → limites do plano
3. `UsageService.checkLimit()` — pode enviar?
4. `defaultResolveIntent()` → `rag` ou `chat`
5. `ModelRouterService.route()` → flash/pro/kimi
6. Se RAG: `RagService.answer()` → `HybridSearchService.search()` → `PromptService` → `DeepSeekProvider.complete()` (timeout) → citações + confiança
7. Se chat: `ChatService.send()` → `ChatRepository` → persistência → `UsageService.record()`
8. Retorna `ProfessorOutput` (answer, citations, tokens, costBRL)

### Fluxo: Correção de Redação
1. `EssayCorrectionService.correct(text)` — valida (mín 120 chars) e configuração
2. Monta prompt (critérios ENEM)
3. `DeepSeekProvider.complete(model="pro")`
4. `stripCodeFences()` → `extractJson()` → `validateResult()`
5. Retorna `{ notaTotal 0-1000, criterios[], comentarioGeral }`

### Fluxo: Registro de Usuário
1. `POST /api/register` — valida `registerSchema` (nome, email, senha letras+números)
2. Cria conta no Supabase Auth (admin client)
3. Login via NextAuth Credentials (`signInWithPassword`)
4. Callback `jwt` → `token.id`; callback `session` → `session.user.id`
5. Perfil criado/atualizado via `getProfile`/`updateProfile` (Drizzle)

### Fluxo: Pipeline de Embeddings
1. `ChunkService.chunk()` → chunks com `content_hash` (SHA-256)
2. `EmbeddingService.embedDocument()`: `getPendingChunks()` → `findByChunkIds()` (filtra embedados)
3. Para cada batch de 20: `EmbeddingCacheRepository.get(hash, model)` → cache hit? → `embeddingClient.embed()` (1024d) → `EmbeddingCacheRepository.set()` → `EmbeddingRepository.createBatch()`
4. `DocumentRepository.updateStatus("indexed")`
5. `HybridSearchService.search()` usa pgvector (cosseno) + FTS

---

## 🧪 Testes

### Estrutura de Testes
- **Unitários/Integração (Vitest)**: 75 arquivos em `src/**/__tests__/` e `src/integration/`
- **E2E (Playwright)**: 13 specs em `tests/e2e/`
- **Stubs**: `tests/stubs/server-only.ts` (no-op fora do contexto React Server)

### Cobertura por Módulo
- **API Routes**: api-billing, api-knowledge-upload, api-knowledge-search, api-recuperar-senha, api-analytics, api-professor, api-rag, api-admin, api-admin-contest, api-admin-auth, api-payments
- **Study**: study-planner, review-schedule, question-answering, link-resolver, fsrs, flashcard, adaptive-planner + study-task.repository
- **Billing**: webhook, subscription, plan.resolver, limits.resolver, entitlement, checkout + billing-professor.integration
- **Analytics**: streak, daily-summary-event-log, aggregation
- **AI**: professor.e2e, limits, kimi, question-generation.provider, professor.service, model-router, chat.service, question-validation, question-generation, rag.service, usage.service
- **Administration**: system-setting, question-import, position, moderation, contest, audit, admin-guard
- **DTOs**: study, rag, professor, knowledge, billing, analytics, ai, administration
- **Knowledge**: metadata, ingestion, hybrid-search, embedding, consolidation, chunk + course-scope
- **DB Repositories**: flashcards.repository, chat.repository
- **Security**: rate-limit
- **Integração**: e2e-flows, billing, analytics, ai, administration, knowledge, identity, rag, professor, study
- **E2E**: administration, analytics, apostila-questoes, auth, billing, contest, flashcards, grupob-p1p5, grupob-replan, grupob, professor, study

### Mocks e Fixtures
- `global-setup.ts` — isolamento do usuário E2E (limpa dados de teste por `user_id`)
- `support/auth.ts` — autenticação NextAuth v5 (credentials + Supabase)
- Stub `server-only` para Vitest; variáveis E2E: `E2E_BASE_URL`, `E2E_USER_EMAIL`, `E2E_USER_PASSWORD`, `E2E_ADMIN_EMAIL`

### Estado Atual
- **641 testes passando** (25 skipped) — lint ✅, typecheck ✅, build ✅ (86 páginas)

---

## 📦 Dependências Principais

### Produção
- **Framework**: `next` ^16.3.0, `react` ^19.0.0, `react-dom` ^19.0.0, `next-auth` ^5.0.0-beta.25
- **UI/UX**: `@radix-ui/*` (18 pacotes), `class-variance-authority` ^0.7.1, `tailwind-merge` ^2.6.0, `clsx` ^2.1.1, `lucide-react` ^0.469.0, `sonner` ^1.7.1, `react-markdown` ^9.0.3, `remark-gfm` ^4.0.0, `recharts` ^2.15.0, `next-themes` ^0.4.4, `zustand` ^5.0.3
- **Banco de Dados**: `drizzle-orm` ^0.45.2, `postgres` ^3.4.9, `@supabase/supabase-js` ^2.49.1, `@supabase/ssr` ^0.6.1
- **Autenticação**: `@auth/prisma-adapter` ^2.7.4 (transitivo)
- **IA/LLM**: `zod` ^3.24.1 (validação), clients HTTP próprios (DeepSeek/Kimi/embeddings)
- **Storage**: `@aws-sdk/client-s3` ^3.1111.0 (R2)
- **Documentos**: `pdf-parse` ^2.4.5, `mammoth` ^1.12.1, `xlsx` ^0.18.5
- **Utilitários**: `date-fns` ^4.1.0, `tailwindcss-animate`

### Desenvolvimento
- **Testes**: `vitest` ^4.1.10, `@vitest/coverage-v8` ^4.1.11, `@playwright/test` ^1.62.1
- **Lint/Format**: `eslint` ^9.17.0, `eslint-config-next` 16.0.0
- **Build**: `typescript` ^5.7.3, `drizzle-kit` ^0.31.10, `server-only` ^0.0.1, `tailwindcss` ^3.4.17, `postcss` ^8.4.49, `autoprefixer` ^10.4.20
- **Tipos**: `@types/node` ^22.10.5, `@types/react` ^19.0.3, `@types/react-dom` ^19.0.2

---

## 🔧 Variáveis de Ambiente (nomes apenas)

### Obrigatórias
- `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_APP_NAME`
- `AUTH_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`
- `DATABASE_URL`, `DIRECT_URL`

### Opcionais
- `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL_FLASH`, `DEEPSEEK_MODEL_PRO`
- `KIMI_API_KEY`, `KIMI_BASE_URL`, `KIMI_MODEL`
- `EMBEDDING_API_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`
- `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_SUCCESS_URL`, `MERCADO_PAGO_FAILURE_URL`
- `WHISPER_API_URL`
- `ADMIN_EMAILS`
- `APP_NAME`, `APP_ENV`, `APP_URL`, `LOG_LEVEL`, `TZ`, `AUTH_TRUST_HOST`

### Placeholders Pendentes
- `WHISPER_API_URL` — transcrição ainda é STUB (`TranscriptionService.isConfigured()` retorna false)
- `EMBEDDING_API_URL` — se ausente, pipeline para em `chunked` (busca FTS-only)
- Template de referência: `infra/.env.production.example` (o `.env.production` real fica apenas na VPS, nunca versionado)

---

## 🐳 Infraestrutura e Deploy

### Docker
- **`infra/Dockerfile`** — multi-stage, Node 24 LTS Alpine, standalone, usuário não-root:
  - `base` — Node 24-alpine + `libc6-compat`, `NEXT_TELEMETRY_DISABLED=1`
  - `deps` — `npm ci --no-audit --no-fund`
  - `builder` — build args `NEXT_PUBLIC_*` em build-time; `npm run build`
  - `runner` — imagem runtime (standalone `server.js`), porta 3000, `USER nextjs`, HEALTHCHECK em `/api/health`
  - `migrator` — mesma base, roda `npx drizzle-kit migrate` (job one-off)
- **`infra/docker-compose.yml`** — serviço `app` (target runner), imagem `concursoai-app:latest`, `env_file: ../.env.production`, porta `127.0.0.1:3001:3000`, healthcheck `/api/health`, `restart: unless-stopped`
- **`infra/docker-compose.migrate.yml`** — serviço `migrate` (target migrator), job one-off `npx drizzle-kit migrate`, `restart: "no"`
- **`infra/.dockerignore`** — exclui arquivos desnecessários do build

### nginx
- **`infra/nginx/app.becotoy.com.conf`**:
  - HTTP → HTTPS (301)
  - TLS 1.2/1.3, certificado Cloudflare Origin
  - `client_max_body_size 10m`, gzip, headers de segurança (HSTS, X-Frame-Options, etc.)
  - Proxy para `app:3000`; rotas de IA (`/api/(ai|professor|chat)`) com streaming (`proxy_buffering off`, timeout 600s)
  - Healthcheck em `/api/health`

### Oracle VPS
- **Arquitetura**: Cloudflare → Nginx (host) → app Docker (127.0.0.1:3001) → Supabase
- **Deploy Process** (`infra/deploy.sh`): valida `.env.production` → build (BuildKit) → `up -d` → aguarda healthcheck (30 tentativas) → **rollback automático** em falha → migrações Drizzle (pulável com `RUN_MIGRATE=0`) → `drizzle-kit check` → revalida health → limpa imagens antigas
- **Backup** (`infra/backup.sh`): `pg_dump` (gzip) + cópia do `.env.production` (permissão 600), retenção dos 7 mais recentes
- **Migração** (`infra/migrate.sh`): aplica migrações via imagem `migrator`
- **Healthcheck** (`infra/healthcheck.sh`): `curl` para `/api/health`

### CI/CD
- **`infra/github/deploy.yml`** — GitHub Actions: CI (lint, typecheck, vitest, build) + deploy na VPS via `appleboy/scp-action` e `appleboy/ssh-action`
- **Triggers**: push na `main` (paths `src/**`, `infra/**`, `package.json`, `package-lock.json`, `next.config.ts`, `tsconfig.json`, `prompts/**`) ou `workflow_dispatch`
- **Secrets**: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_PORT` (nomes apenas)

### Configurações
- `next.config.ts` — `output: "standalone"`, `reactStrictMode: true`, `poweredByHeader: false`, `images.remotePatterns` (`*.supabase.co`, `*.r2.dev`), `experimental.serverActions.bodySizeLimit: "2mb"`
- `drizzle.config.ts` — schema `./src/db/schema/index.ts`, out `./drizzle`, dialect postgresql, `schemaFilter: ["public"]`
- `tsconfig.json` — target ES2022, strict, `moduleResolution: bundler`, alias `@/*` → `./src/*`
- `vitest.config.mts` — thresholds: lines 50, functions 30, branches 40, statements 50
- `playwright.config.ts` — chromium, locale pt-BR, `webServer` automático
- `components.json` — shadcn style `new-york`, baseColor slate, cssVariables true

---

## 📊 Performance e Otimizações

### Cache
- `embeddingCache` — PK `content_hash + model` (evita re-embedding)
- `dailySummaries` — resumos materializados (evita agregação sob demanda)
- Cache de sessão JWT (stateless)

### Lazy Loading
- Client Components isolados por rota (dashboard, analises, apostilas, etc.)
- Gráficos recharts apenas nas páginas de analytics

### Code Splitting
- Next.js App Router — divisão automática por rota
- Streaming SSE no chat (resposta incremental)

### Otimizações de Banco
- Índice HNSW (m=16) para busca vetorial
- Índice GIN/tsvector (portuguese) para FTS
- Clamps de período (1–90 dias) em analytics
- Paginação em listagens (questões, tentativas, docs)

### Rate Limiting
- `src/lib/security/rate-limit.ts` — in-memory sliding window (Map), limpeza a cada 10 min
- Aplicado em: register, recuperar-senha, chat, ai/chat, ai/rag, essay/correct, questions/generate, documents/consolidate, knowledge/upload (por plano)
- Comentários TODO: migração futura para Redis/Upstash (multi-instância)

---

## 🔒 Segurança

### Headers HTTP
- `poweredByHeader: false` (Next)
- Nginx: HSTS, X-Frame-Options, X-Content-Type-Options, etc.
- `robots.txt` bloqueia áreas autenticadas/admin de indexação

### CORS
- `images.remotePatterns` restrito a `*.supabase.co` e `*.r2.dev`
- Webhooks validam assinatura HMAC-SHA256 com comparação constant-time; inválidos retornam 401 e falhas de processamento retornam 500 para retry

### Sanitização de Input
- Zod em todas as fronteiras de API (DTOs + validations)
- `sanitizeFilename` (anti path traversal); `storagePath = {userId}/{docId}/{safeName}`
- `normalizeText()` — BOM, CRLF, NBSP, espaços

### Magic Byte Validation
- `validateMagicBytes(buffer, mimeType)`:
  - PDF: `%PDF` no cabeçalho
  - DOCX: assinatura ZIP + presença de `word/` nos primeiros 8KB
  - TXT/HTML: `isPrintableASCII()` — ≥95% de caracteres ASCII imprimíveis

### Filename Sanitization
- Remove path traversal, caracteres especiais e extensões duplas

### RLS
- Deny-by-default em todos os domínios (ver seção Banco de Dados → RLS Policies)
- Tabelas sensíveis (`system_settings`, `admin_action_logs`, `embedding_cache`) permanecem deny-by-default; `ai_usage` restringe leitura/inserção ao próprio usuário e mutações ao service role

### Rate Limiting
- In-memory com buckets por rota; registros por IP (`getClientIP`) e por e-mail/usuário

### Fail-Fast
- `src/lib/env.ts` — validação Zod com fail-fast em produção (`AUTH_SECRET`, URLs, chaves)
- `z.preprocess(emptyToUndefined, ...)` evita falha por env vazia

### Outras Camadas
- `import "server-only"` em serviços de IA/knowledge/billing (nunca no cliente)
- Escopo de curso resolvido no backend (`resolveCourseScope`) — nunca aceito do cliente
- Upload de apostilas restrito a admin (403 para não-admin) — regra de negócio crítica
- Admin via allowlist (`ADMIN_EMAILS` + `system_settings['admin.emails']`) + `raw_app_meta_data->>'is_admin'`
- Error boundaries por segmento (root, dashboard, admin, auth)
- Anti spoofing de IP: prioridade `x-real-ip` → `x-forwarded-for`

---

## 📈 Métricas e Observabilidade

### Logs
- `src/lib/observability.ts` — `logger`, `structuredLog`, `now`, `elapsed`, `LogLevel`, `LogFields`
- `LOG_LEVEL` configurável via env

### Erros
- `src/app/error.tsx` — error boundary global com "Tentar novamente" e "Ir para o início"
- Error boundaries por segmento: `(dashboard)`, `admin`, `(auth)`
- `src/app/not-found.tsx` — 404 amigável em português
- `src/app/loading.tsx` — loading global

### Monitoramento
- `/api/health` — health check (container + nginx)
- `/api/health/storage` — backend de storage ativo + status de IA (booleans)
- `healthcheck.sh` — validação manual/CI
- `deploy.sh` — healthcheck com rollback automático (30 tentativas)

### TODOs Futuros
- Sentry/APM — não implementado
- Rate limiting distribuído (Redis/Upstash) — TODO em endpoints
- Transcrição de áudio/vídeo (Whisper) — STUB

---

## 📝 Documentação Interna

### docs/ (20 numerados)
- `01-PRD.md` — visão do produto SaaS de preparação com IA
- `02-SDD.md` — arquitetura técnica completa
- `03-AIDD.md` — design do Professor IA (provedores, modelos, custos)
- `03-DATABASE.md`, `04-DATABASE-LOGICAL.md`, `08-DATABASE-PHYSICAL.md`, `09-DATABASE-REVIEW.md` — modelagem (conceitual → lógico → físico → revisão)
- `04-DATABASE.md` — stack de banco (PostgreSQL 15+ via Supabase, pgvector, RLS)
- `05-API.md`, `05-DOMAIN-MODEL.md` — API e modelo de domínio (DDD)
- `06-DOMAIN-DECISIONS.md` (DD-001+), `06-KNOWLEDGE-ENGINE.md` — decisões e Knowledge Engine
- `07-ENTITY-STANDARDS.md`, `07-RAG.md` — padrões de entidade e RAG
- `08-ETL.md` — coleta/limpeza/carga de questões, editais, legislação
- `09-INFRASTRUCTURE.md`, `11-DEPLOYMENT.md` — infra e deploy v2.0
- `10-EMBEDDING-STANDARD.md`, `10-SECURITY.md` — embeddings (bge-m3 1024d) e segurança/LGPD
- `11-IDENTITY-ARCHITECTURE-REVIEW.md`, `12-CONTEST-DOMAIN-REVIEW.md` — revisões de domínio
- `12-ROADMAP.md`, `13-BACKLOG.md` — roadmap (MVP, V1.1, V1.2) e backlog P0–P3
- `13-KNOWLEDGE-CORE-ARCHITECTURE.md` — Knowledge Core
- `14-ARCHITECTURE-BASELINE.md` (FASE 10), `14-PROMPTS.md` — baseline e prompts
- `15-ADMIN.md`, `16-ANALYTICS.md` — admin e analytics
- `17-DIAGRAMS.md` — diagramas Mermaid
- `18-CREDENTIAL-ROTATION.md` — rotação de credenciais pós-exposição
- `19-CONTEST-INTELLIGENCE-SPEC.md`, `20-CONTEST-IMPLEMENTATION-MAP.md` — Contest Intelligence (Grupo D)

### docs/ (temáticos)
- `ADMIN.md`, `AI.md`, `ARCHITECTURE.md`, `AVATAR.md`, `ENGINE-ARCHITECTURE.md`, `GUIA-CONTEUDO-ADMIN-CONCURSOAI.md`, `IMPLEMENTATION-REPORT.md`, `INFRASTRUCTURE.md`, `KNOWLEDGE_PIPELINE.md`, `LESSONS.md`, `LOG-NOTURNO.md`, `PLANO-MESTRE-TESTE-CONCURSOAI.md`, `QUESTION_GENERATION.md`, `RELATORIO-NOTURNO.md`, `RETOMADA_PROJETO.md`, `SDD-CONCURSOAI.md`, `AUDIT-APOSTILA-QUESTOES.md`

### Raiz
- `README.md`, `CHANGELOG.md`, `CHECKLIST-DEPLOY.md`, `DIAGNOSTICO-CONCURSOAI-2026-08-22.md`, `RELATORIO-FINALIZACAO-2026-08-22.md`, `AGENTS.md`, `CLAUDE.md`

---

## 🎯 Estado Atual do Projeto

### Build Status
- ✅ `npm run build` — sucesso (Next.js 16.3.0, 86 páginas incluindo `/twitter-image.png`)
- ✅ `npm run lint` — sem erros
- ✅ `npm run typecheck` — sem erros

### Test Status
- ✅ **641 testes passando** (25 skipped)
- ✅ Vitest — unit/integração (75 arquivos)
- ✅ Playwright — E2E (13 specs)
- ✅ Cobertura com thresholds configurados (lines 50, functions 30, branches 40, statements 50)

### Nota de Prontidão
- **93/100** (conforme relatório pós-deploy `relatorio_pos_deploy_template.md`)

### Itens Críticos Resolvidos
- ✅ Upload de apostilas restrito a admin (403 para aluno)
- ✅ Magic bytes para PDF/DOCX + `isPrintableASCII()` para TXT/HTML
- ✅ Error boundaries por segmento (root/dashboard/admin/auth)
- ✅ Anti IP spoofing (`getClientIP` com `x-real-ip`)
- ✅ SEO completo: sitemap, robots, manifest, icon.svg (path), opengraph-image, twitter-image (1200x600), apple-icon
- ✅ Rate limiting em rotas sensíveis
- ✅ Fail-fast de `AUTH_SECRET` em produção
- ✅ RLS deny-by-default, com políticas próprias para `ai_usage` e acesso de serviço explícito
- ✅ Fase 1 (segurança/robustez) + Fase 2 (SEO/identidade) implementadas e validadas

### Itens Pendentes
- 🔄 Migrações `drizzle/` (0000–0002) estão defasadas — tabelas novas só em `database/migrations/2026-08-15-*.sql`
- 🔄 Rate limiting em memória — migrar para Redis/Upstash em multi-instância
- 🔄 Transcrição Whisper — STUB (`transcription.service.ts`)
- 🔄 Embeddings dependem de `EMBEDDING_API_URL` configurada em produção
- 🔄 Credential rotation — documentada em `docs/18-CREDENTIAL-ROTATION.md` (não executada)

### Próximos Passos
- Consolidar migrações Drizzle com o SQL manual (baseline único)
- Configurar Redis para rate limiting distribuído
- Configurar Whisper para transcrição de áudio/vídeo
- Validar pipeline de embeddings completo em produção (gera `indexed`)
- Monitorar custos de IA via `aiUsage` + `UsageService.estimateCost`
- Rotacionar credenciais conforme `18-CREDENTIAL-ROTATION.md` quando aplicável

---

> **Fim do SDD.** Documento gerado a partir da exploração completa do código-fonte — 100% dos módulos cobertos, sem exposição de segredos, credenciais, dados de usuários ou IPs de servidores. Domínio público de referência: `app.becotoy.com`.
