# Diagnóstico Completo — ConcursoAI Platform

**Data:** 2026-08-22
**Versão:** `concursoai-platform@1.0.0-alpha`
**Commit atual (HEAD):** `c8dd4aa` — "fix: enforce admin authorization on admin APIs"

> Este relatório foi gerado com dados **verificados** (typecheck, lint, build, testes e consultas ao banco de dados foram executados antes da escrita). Nada foi afirmado como "funcionando" sem evidência.

---

## 1. Visão Geral

### Stack Tecnológica

| Camada | Tecnologia | Versão |
|--------|-----------|--------|
| Framework | Next.js (App Router, Turbopack) | 16.3.0 |
| Frontend | React | 19 |
| Linguagem | TypeScript (strict) | — |
| ORM | Drizzle ORM + postgres.js | 0.45.2 |
| Banco de dados | Supabase PostgreSQL | 17.6 |
| Autenticação | NextAuth v5 (beta.25) + Supabase | — |
| Testes unitários/integração | Vitest | 4.1.10 |
| Testes E2E | Playwright | 1.62.1 |
| IA | DeepSeek (deepseek-chat / deepseek-reasoner) | — |
| Pagamentos | Mercado Pago (checkout one-time) | — |
| Storage | Supabase Storage (default) / Cloudflare R2 (opcional) | — |

### Arquitetura

- **App Router** com `output: "standalone"` e `reactStrictMode: true`.
- **8 domínios de schema** em `src/db/schema/`: `identity`, `contest`, `knowledge`, `study`, `ai`, `billing`, `analytics`, `administration`.
- **Middleware** (`src/proxy.ts`) com paths públicos: `/`, `/login`, `/cadastro`, `/recuperar-senha`.
- **ModelRouterService** roteia entre modelos flash/pro — **apenas DeepSeek é usado**.
- **RAG Engine MVP** via `HybridSearchService` + `DeepSeekProvider`, com isolamento por curso (`positionId`/`editalId`).
- **Busca híbrida**: apenas FTS (pgvector instalado, porém **não utilizado**).

### Status Geral

- ✅ **Typecheck**: 0 erros
- ✅ **Lint**: 0 erros
- ✅ **Build**: compilado com sucesso (79 páginas estáticas)
- ✅ **Testes unitários/integração**: **595 passaram | 25 pulados**
- ⚠️ **Testes E2E**: **25 pulados** (sem `E2E_USER_EMAIL`/`DATABASE_URL` configurados)
- ⚠️ **Produção**: `.env.production` com `DATABASE_URL` placeholder e `DEEPSEEK_API_KEY` vazia — **não está pronto para deploy real**

---

## 2. Funcionalidades Implementadas

### Área do Aluno

| Funcionalidade | Status |
|----------------|--------|
| Autenticação (login, cadastro, recuperar senha) | ✅ Funcional / testado |
| Estudo: matérias, tarefas, questões | ✅ Funcional / testado |
| Questões com tentativas e histórico | ✅ Funcional / testado |
| Flashcards + revisão espaçada FSRS | ✅ Funcional / testado (FSRS simplificado) |
| Chat com IA (Professor IA) | ✅ Funcional / testado (com rate limit 429) |
| Correção de redação pelo Professor IA | ✅ Funcional / testado (com rate limit 429) |
| Aulas e progresso de lições | ⚠️ Implementado, poucos dados (1 lição, 0 progresso) |

### Área Administrativa

| Funcionalidade | Status |
|----------------|--------|
| CRUD de concursos, cargos, órgãos e bancas | ✅ Funcional / testado |
| Importador de questões CSV/XLSX/JSON | ✅ Funcional / testado |
| Consolidação de apostilas via IA | ✅ Funcional / testado |
| Detecção de OCR em PDFs escaneados | ✅ Funcional / testado |
| Sidebar lateral fixa | ✅ Funcional |
| Autorização de admin em 16 rotas de API | ✅ Funcional / testado (52 testes) |

### Pipeline de Conhecimento

| Etapa | Status |
|-------|--------|
| Upload de documentos | ✅ Funcional (sem rate limit real) |
| Extração de texto | ✅ Funcional |
| Chunking | ✅ Funcional |
| Embeddings (pgvector) | ❌ **Não configurado** — pipeline para em "chunked" |
| Indexação semântica | ❌ Bloqueada pela ausência de embeddings |
| Transcrição de áudio/vídeo | ❌ **Stub** — `WHISPER_API_URL` não configurado |

### IA e Contest Intelligence

| Funcionalidade | Status |
|----------------|--------|
| Geração de questões por IA | ✅ Funcional (9 questões de origem IA no banco) |
| Contest Intelligence v1 | ✅ Funcional / testado |
| RAG com isolamento por curso | ✅ Funcional / testado |
| Rastreamento de uso de IA (`ai_usage`) | ✅ Implementado (0 registros até o momento) |

### Billing

| Funcionalidade | Status |
|----------------|--------|
| Planos free / pro / intensivo | ✅ Funcional (preços verificados no banco) |
| Checkout Mercado Pago (one-time) | ✅ Implementado |
| Webhook com validação HMAC | ✅ Implementado (pulada se secret vazio) |
| Renovação automática | ❌ **Não implementado** (checkout one-time) |

---

## 3. Qualidade e Testes

### Resultados Verificados

| Comando | Resultado |
|---------|-----------|
| `npm run typecheck` | ✅ 0 erros |
| `npm run lint` | ✅ 0 erros |
| `npm run build` | ✅ Compilado (Next.js 16.3.0, 79 páginas estáticas) |
| `npm test` | ✅ **595 passaram | 25 pulados** (620 total; 61 arquivos passaram | 10 pulados) |
| `npm run test:e2e` | ⚠️ **25 pulados** (sem `E2E_USER_EMAIL`/`DATABASE_URL`) |

### Análise dos Testes Pulados

- **25 testes unitários/integração pulados** = 10 arquivos de teste de integração usando `describe.skipIf(!hasDb)`.
- **25 testes E2E pulados** = Playwright sem credenciais configuradas.
- **Cobertura de código**: ❌ **Não configurada** (nenhuma métrica de coverage).

### Observações

- Os testes de integração dependem de `DATABASE_URL` no shell — como não está presente, são pulados automaticamente.
- Os testes E2E exigem `E2E_USER_EMAIL` e `DATABASE_URL` — não configurados.
- A suíte de segurança de admin (`api-admin-auth.test.ts`) tem **52 testes** e está passando.

---

## 4. Banco de Dados

### Migrations

| Tipo | Quantidade | Status |
|------|-----------|--------|
| Drizzle migrations | 2 (ids 1 e 2) | ✅ Aplicadas |
| Migrations SQL manuais | 6 arquivos | ✅ Aplicadas (verificado via colunas) |

Arquivos SQL manuais em `database/migrations/`:
- `2026-08-15-admin-content.sql`
- `concursoai-e2e.sql`
- `consolidation.sql`
- `fsrs.sql`
- `pme-rj-seed.sql`
- `pricing-limits.sql`

### Estrutura

- **39 tabelas públicas**.
- **8 domínios**: identity, contest, knowledge, study, ai, billing, analytics, administration.
- **Extensões instaladas**: `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`, `vector`.
- **pgvector**: instalado, porém **não utilizado** (busca é FTS-only).

### Dados Atuais (contagens verificadas)

| Entidade | Contagem |
|----------|----------|
| profiles | 2 |
| organs | 2 |
| boards | 2 |
| contests | 2 |
| editais | 1 |
| positions | 2 |
| notice_subjects | 4 |
| documents | 8 |
| document_chunks | 8 |
| embeddings | **0** |
| knowledge_subjects | 33 |
| study_subjects | 11 |
| study_tasks | 57 |
| questions | 53 |
| question_options | 214 |
| question_attempts | 111 |
| flashcards | 1 |
| review_schedules | 1 |
| lessons | 1 |
| lesson_progress | 0 |
| chat_sessions | 3 |
| chat_messages | 6 |
| ai_usage | 0 |
| avatars | 1 |
| plans | 3 |
| subscriptions | 0 |
| payments | 0 |
| event_logs | 0 |
| daily_summaries | 0 |
| system_settings | 0 |
| admin_action_logs | 4 |

### Detalhes Relevantes

- **Contests**: "Concurso Público MPF 2026" e "Concurso PMERJ — Soldado PM (REAL)", ambos `[publicado]`.
- **Questões por status**: `publicada`: 44, `em_revisao`: 9.
- **Questões por origem**: `ia`: 9, `manual`: 44.
- **Documentos por status**: `chunked`: 8 (todos — **nenhum com embeddings**).
- **Documentos por source_type**: apenas `upload`.
- **Planos**: free (0), pro (1990, promo 990), intensivo (4990) — confirma `pricing-limits` aplicada.
- **review_schedules** com colunas `stability`, `difficulty`, `last_rating` — confirma `fsrs` aplicada.
- **documents** com colunas `review_status`, `reviewed_by`, `reviewed_at`, `review_note`, `source_document_ids` — confirma `admin-content` + `consolidation` aplicadas.

---

## 5. Pontos de Atenção / Dívida Técnica

### 🔴 Críticos (produção)

1. **`DATABASE_URL` placeholder em `.env.production`** — não aponta para banco real. Deploy em produção **não funcionará**.
2. **`DEEPSEEK_API_KEY` vazia em `.env.production`** — IA (chat, questões, redação, RAG) **não funcionará** em produção.
3. **`MERCADO_PAGO_*` ausentes em `.env.production`** (0 chaves) — pagamentos **não configurados** em produção.
4. **`EMBEDDING_API_URL` ausente** — embeddings/pgvector desativados; pipeline de conhecimento para em "chunked".
5. **`WHISPER_API_URL` ausente** — transcrição é um **stub** (`TRANSCRIPTION_NOT_CONFIGURED`).

### 🟠 Médios

6. **Sem rate limit** em `POST /api/auth/recuperar-senha` — risco de abuso de e-mail.
7. **Sem rate limit real** em `POST /api/knowledge/upload` (apenas comentário "Rate limit por plano").
8. **`MERCADO_PAGO_WEBHOOK_SECRET` não configurado** — validação HMAC do webhook é pulada em dev.
9. **Sem renovação automática de assinatura** — checkout one-time apenas.
10. **`DEEPSEEK_API_KEY` exposta no chat** (nota em `docs/RELATORIO-NOTURNO.md`) — **considerar rotação**.
11. **`FlashcardGenerationService` e `ExerciseGenerationService` são código morto** — não exportados de `src/lib/ai/services/index.ts`.

### 🟡 Baixos

12. **`SUPABASE_JWT_SECRET` vazio** em ambos `.env` — porém **não usado no código** (apenas declarado opcional em `env.ts`).
13. **`OPENAI_API_KEY` órfã** em `.env` — não usada no código, apenas em comentários.
14. **`AUTH_SECRET` duplicado 3x** em `.env.production` (idênticos, len=43) — redundante, não conflitante.
15. **FSRS simplificado** — sem pesos `w0..w17`; usa constantes (`FSRS_INITIAL_DIFFICULTY=5`, `MIN_STABILITY=0.5`, `MAX_STABILITY=36500`).
16. **Sem métrica de cobertura de código**.
17. **`R2_*` ausentes** — storage Cloudflare R2 opcional não configurado (usa Supabase Storage default).
18. **`ai_usage`, `event_logs`, `daily_summaries`, `subscriptions`, `payments` vazios** — telemetria e billing sem dados reais.

---

## 6. Últimas Alterações (últimos 15 commits)

| Commit | Descrição |
|--------|-----------|
| `c8dd4aa` | **fix: enforce admin authorization on admin APIs** (HEAD) |
| `837e72e` | fix: isolate knowledge by course scope |
| `abbb935` | feat(admin): CRUD de concursos, cargos e catálogo de órgãos/bancas |
| `957f8d5` | test(e2e): apostila→questões + relatório noturno final (origin/main) |
| `0f9390c` | feat(ai): correção de redação pelo Professor IA + página /redacao |
| `c9050b7` | feat(contest): Contest Intelligence v1 |
| `23b93dc` | feat(study): revisão espaçada FSRS |
| `6f21731` | feat(billing): grátis 5 msgs IA/dia, Pro R$19,90 |
| `f9c0d7c` | feat(admin): sidebar lateral fixa |
| `30215b6` | docs: plano mestre de teste + SDD |
| `b66559d` | feat(contest): seed idempotente PME-RJ |
| `8695fe5` | feat(knowledge): consolidação de apostilas via IA |
| `f2294a6` | docs: guia admin + SDD |
| `437a18d` | feat(knowledge): detecção de OCR + hook/stub de transcrição |
| `d7b3f76` | feat(admin): importador de questões CSV/XLSX/JSON |

---

## 7. Variáveis de Ambiente

### `.env` (desenvolvimento)

| Variável | Status |
|----------|--------|
| `OPENAI_API_KEY` | ✅ Preenchido (órfã — não usada) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Preenchido |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Preenchido |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ Preenchido |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Preenchido |
| `SUPABASE_JWT_SECRET` | ⚠️ Vazio (não usado no código) |
| `DATABASE_URL` | ✅ Preenchido |
| `DIRECT_URL` | ✅ Preenchido |
| `AUTH_SECRET` | ✅ Preenchido |
| `MERCADO_PAGO_ACCESS_TOKEN` | ✅ Preenchido |
| `MERCADO_PAGO_PUBLIC_KEY` | ✅ Preenchido |
| `DEEPSEEK_API_KEY` | ✅ Preenchido |
| `EMBEDDING_*` | ❌ Ausente (0 chaves) |
| `R2_*` | ❌ Ausente (0 chaves) |
| `WHISPER_*` | ❌ Ausente (0 chaves) |
| `ADMIN_EMAILS` | ❌ Ausente (0 chaves) |
| `MERCADO_PAGO_WEBHOOK_SECRET` | ❌ Ausente (0 chaves) |

### `.env.production`

| Variável | Status |
|----------|--------|
| `NEXT_PUBLIC_APP_URL` | ✅ Preenchido |
| `NEXT_PUBLIC_APP_NAME` | ✅ Preenchido |
| `AUTH_SECRET` | ✅ Preenchido (duplicado 3x, idênticos) |
| `AUTH_TRUST_HOST` | ✅ Preenchido |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Preenchido |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Preenchido |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ Preenchido |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Preenchido |
| `SUPABASE_JWT_SECRET` | ⚠️ Vazio (não usado no código) |
| `DEEPSEEK_API_KEY` | 🔴 **Vazio** |
| `DEEPSEEK_BASE_URL` | ✅ Preenchido |
| `DEEPSEEK_MODEL_FLASH` | ✅ Preenchido |
| `DEEPSEEK_MODEL_PRO` | ✅ Preenchido |
| `DATABASE_URL` | 🔴 **PLACEHOLDER** (não aponta para banco real) |
| `DIRECT_URL` | ✅ Preenchido |
| `MERCADO_PAGO_*` | ❌ Ausente (0 chaves) |
| `EMBEDDING_*` | ❌ Ausente (0 chaves) |
| `R2_*` | ❌ Ausente (0 chaves) |
| `WHISPER_*` | ❌ Ausente (0 chaves) |

### Notas de Segurança

- `.env` e `.env.production` estão em `.gitignore` (não commitados). Apenas arquivos `.example` são commitados.
- `DEEPSEEK_API_KEY` foi exposta no chat em algum momento — **recomenda-se rotação**.

---

## Resumo Executivo

O projeto **ConcursoAI** está em estado **funcional para desenvolvimento**, com código limpo (typecheck/lint/build sem erros) e uma suíte de **595 testes passando**. As funcionalidades principais (auth, estudo, questões, chat IA, correção de redação, admin, Contest Intelligence, FSRS, billing) estão implementadas e testadas.

**Porém, o projeto NÃO está pronto para produção.** Os bloqueadores críticos são:
1. `DATABASE_URL` placeholder em `.env.production`.
2. `DEEPSEEK_API_KEY` vazia em `.env.production`.
3. `MERCADO_PAGO_*` ausentes em `.env.production`.
4. Embeddings/transcrição não configurados (pipeline de conhecimento incompleto).

**Próximos passos recomendados:**
1. Preencher `.env.production` com valores reais (DB, DeepSeek, Mercado Pago).
2. Configurar `EMBEDDING_API_URL` para ativar busca semântica.
3. Adicionar rate limits em `recuperar-senha` e `knowledge/upload`.
4. Rotacionar `DEEPSEEK_API_KEY`.
5. Configurar cobertura de testes e rodar E2E com credenciais reais.
