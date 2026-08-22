# RETOMADA DO PROJETO — ConcursoAI

> **Data:** 2026-08-22
> **Tipo:** Auditoria read-only de retomada (Fases 1–20)
> **Regra:** nenhuma alteração de código, banco, `.env`, migrations, seed, commit, push ou deploy.
> Apenas inspeção, testes seguros, documentação e planejamento.

---

## 1. Checkpoint Git (Fase 1)

| Item | Valor |
|------|-------|
| Branch | `main` |
| HEAD | `957f8d5` |
| `origin/main` | `5d3f029` |
| Commits à frente | **45** |
| Commits atrás | 0 |
| Arquivos modificados | 2 (`src/components/professor/chat-client.tsx`, `src/lib/ai/deepseek.ts`) |
| Não rastreados | `AGENTS.md`, `CLAUDE.md`, `docs/screenshots-telas/`, `planner-p1p5-minimal.sql`, `tmp-contest-check.mjs`, `tmp-visual-audit.mjs` |

> **Nota:** os 2 arquivos modificados são as correções de integração DeepSeek feitas na sessão anterior
> (labels "DeepSeek V4 Flash/Pro" no seletor e `apiKey()`/`stream_options` no cliente). Não commitados.

---

## 2. Stack e Arquitetura (Fase 2)

- **Next.js 16.3.0** (App Router, Turbopack) + **React 19** + **TypeScript strict**
- **Drizzle ORM** (PostgreSQL via Supabase, schema `public` + `auth`)
- **Supabase** (Auth, banco, Storage) — dados de usuário via **Drizzle** (bypassa RLS, nunca REST anon)
- **Auth.js v5** (credentials via `createAdminClient`)
- **DeepSeek** (`deepseek-chat` = flash, `deepseek-reasoner` = pro) para texto
- **BAAI/bge-m3** (1024d) para embeddings (configuração pendente)
- **Mercado Pago** (sandbox) para cobrança
- **Cloudflare R2** (S3) para storage de documentos, com fallback Supabase Storage
- **Playwright** (E2E) + **Vitest** (unitário)

### Estrutura de módulos
```
src/
  app/            rotas (aluno, admin, api)
  components/     UI (dashboard, professor, admin, study, ui)
  db/schema/      schema Drizzle por domínio
  lib/
    ai/           provedores e serviços de IA (chat, rag, geração, validação)
    knowledge/    pipeline de conhecimento (storage, extração, chunk, embedding, busca)
    study/        planner, flashcards, questões, weakness, lessons
    administration/  guard admin (allowlist), moderação, repositórios admin
    billing/      planos, entitlement, limites
    supabase/     createAdminClient (service role, server-only)
```

### Regras de arquitetura (documentadas em `docs/ARCHITECTURE.md`)
1. Dados de usuário **sempre via Drizzle** (nunca REST anon do Supabase).
2. `server-only` em todo módulo de servidor.
3. Admin é allowlist (`ADMIN_EMAILS` + `system_settings`) — nunca coluna solta.
4. APIs novas validam `auth()`; APIs admin validam `AdminGuardService.requireAdmin`.
5. Questões geradas por IA **nunca** publicadas automaticamente (status `em_revisao`).
6. Sem personagens protegidos por copyright — avatares são originais.

---

## 3. Páginas e Rotas (Fase 3)

### Páginas (37)
- **Públicas:** `/`, `/login`, `/cadastro`, `/recuperar-senha`
- **Dashboard (aluno):** `/dashboard`, `/cronograma`, `/questoes`, `/flashcards`, `/aulas`, `/aulas/[id]`,
  `/apostilas`, `/apostilas/[id]`, `/professor`, `/redacao`, `/analises`, `/perfil`, `/configuracoes`, `/sessao`
- **Admin:** `/admin`, `/admin/alunos`, `/admin/concursos`, `/admin/apostilas`, `/admin/apostilas/[id]`,
  `/admin/questoes`, `/admin/questoes/gerar`, `/admin/questoes/revisao`, `/admin/questoes/importar`,
  `/admin/aulas`, `/admin/avatares`, `/admin/ia`, `/admin/materias`, `/admin/importar`, `/admin/fontes`,
  `/admin/contest-intelligence`

### Rotas de API (80)
- **Auth:** `/api/auth/*` (Auth.js)
- **Study:** `/api/study/subjects`, `/api/study/tasks`, `/api/study/questions`, `/api/study/questions/[id]/answer`
- **Knowledge:** `/api/knowledge/upload`, `/api/knowledge/documents`, `/api/knowledge/documents/[id]`,
  `/api/knowledge/documents/[id]/process`, `/api/knowledge/search`
- **AI:** `/api/chat`, `/api/essay/correct`
- **Lessons:** `/api/lessons`, `/api/lessons/[id]`, `/api/lessons/[id]/progress`
- **Billing:** `/api/billing/*` (checkout, webhook)
- **Admin:** `/api/admin/*` (dashboard, alunos, concursos, apostilas, questões, aulas, avatares, IA,
  lessons/generate, questions/generate, questions/[id]/review, contest-intelligence, materias, importar, fontes)

---

## 4. Estado do Banco de Dados (Fase 4 — dados reais, read-only)

### Contagens por tabela
| Tabela | Registros |
|--------|-----------|
| `contests` | 2 |
| `editais` | 1 |
| `positions` | 2 |
| `notice_subjects` | 4 |
| `documents` | 8 |
| `document_chunks` | 8 |
| `questions` | 47 |
| `question_attempts` | 111 |
| `flashcards` | 1 |
| `lessons` | 1 |
| `avatars` | 1 |
| `plans` | 3 |
| `subscriptions` | 0 |
| `payments` | 0 |
| `profiles` | 2 |
| `study_subjects` | 11 |
| `study_tasks` | 57 |
| `chat_sessions` | 3 |
| `ai_usage` | 0 |

### Detalhes relevantes
- **Concursos:** "Concurso Público MPF 2026" [publicado] e "Concurso PMERJ — Soldado PM (REAL)" [publicado].
- **Questões:** 40 `publicada` + 9 `em_revisao`; origem: 40 `manual` + 9 `ia`.
- **Documentos:** todos em status `chunked` (chunks=1, emb=0) — **sem embeddings** (ver §7).
- **Planos:** Gratuito (0), Pro (1990, promo 990), Intensivo (4990).
- **Profiles:** 2 usuários de teste (`layout-teste-*`, `Teste Planner`), ambos `modelo_ia_padrao=flash`.
- **Study tasks:** 51 `pendente` + 6 `concluida`.
- **Question attempts:** 48 corretas / 63 incorretas.
- **Migrations aplicadas:** 2 (`drizzle.__drizzle_migrations`).
- **Extensões:** `pg_stat_statements`, `pgcrypto`, `plpgsql`, `supabase_vault`, `uuid-ossp`, **`vector`** (pgvector disponível).
- **RLS:** habilitada em todas as tabelas principais (39 tabelas).

---

## 5. Estado das Variáveis de Ambiente (Fase 5 — apenas nomes)

Configuradas no `.env`:
`OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`,
`DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_PUBLIC_KEY`,
`DEEPSEEK_API_KEY`.

**Ausentes (bloqueios conhecidos):**
- `EMBEDDING_API_URL` / `EMBEDDING_API_KEY` / `EMBEDDING_MODEL` / `EMBEDDING_DIMENSION` → busca vetorial/RAG pendente.
- `ADMIN_EMAILS` → testes E2E de admin são pulados.
- `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` → storage cai no fallback Supabase.

> **⚠️ Segurança:** a `DEEPSEEK_API_KEY` foi exposta em chat anterior. **Recomenda-se rotacionar.**

---

## 6. Conexão dos Serviços de IA (Fase 6)

| Serviço | Exportado no barrel | Usado em rota | Status |
|---------|:---:|:---:|--------|
| `ChatService` | ✅ | `/api/chat` | 🟢 conectado |
| `ProfessorService` | ✅ | `/api/chat` | 🟢 conectado |
| `RagService` | ✅ | via ProfessorService | 🟢 conectado (FTS) |
| `QuestionGenerationService` | ✅ | `/api/admin/questions/generate`, `/api/questions/generate` | 🟢 conectado |
| `QuestionValidationService` | ✅ | via geração | 🟢 conectado |
| `LessonGenerationService` | ✅ | `/api/admin/lessons/generate` | 🟢 conectado |
| `EssayCorrectionService` | ✅ | `/api/essay/correct` | 🟢 conectado |
| `FlashcardGenerationService` | ❌ | — | 🟠 **desconectado** (não exportado, sem rota) |
| `ExerciseGenerationService` | ❌ | — | 🟠 **desconectado** (não exportado, sem rota) |

> **Achado:** `FlashcardGenerationService` e `ExerciseGenerationService` existem no código mas **não são
> exportados do barrel** (`src/lib/ai/services/index.ts`) e **não têm rota de API**. São código morto
> (arquitetura pronta, sem integração).

---

## 7. Knowledge Engine / RAG (Fase 7)

- **Pipeline:** `UPLOAD → STORAGE → DOCUMENT → EXTRAÇÃO → NORMALIZAÇÃO → CHUNKING → EMBEDDING → INDEXAÇÃO → READY`.
- **Estados:** `pending → processing → processed/chunked → indexing → indexed | failed`.
- **Sem `EMBEDDING_API_URL`**, o documento termina em **`chunked`** (conteúdo pronto, busca vetorial pendente) — **não é falha**; metadata registra `embedding_skipped`.
- **Storage:** Cloudflare R2 (preferencial) ou Supabase Storage (fallback). R2 ativa quando `R2_ACCESS_KEY_ID` configurado.
- **Extração:** PDF (`pdf-parse`), DOCX (`mammoth`), TXT/Markdown, HTML.
- **Chunking:** fixo (1000/200) ou estrutural (headings), persistência em `document_chunks` + FTS `portuguese`.
- **Embedding:** BAAI/bge-m3 1024d, batch 20, cache por `content_hash`, pgvector/HNSW.
- **HybridSearch:** no MVP usa **apenas FTS** (`ts_rank`); busca vetorial marcada como "V1.1" no código.
- **RAG:** `RagService` monta prompt + citações + score de confiança via DeepSeek.

> **Estado real:** 8 documentos em `chunked` (sem embeddings). RAG funciona parcialmente via FTS,
> mas a busca vetorial está bloqueada até configurar `EMBEDDING_API_URL`.

---

## 8. Professor IA e DeepSeek (Fase 8)

- **Cliente:** `src/lib/ai/deepseek.ts` — `chatCompletion` (não-stream) e `streamChatCompletion` (SSE).
- **Models:** `flash` → `deepseek-chat`, `pro` → `deepseek-reasoner`.
- **Correções aplicadas (não commitadas):**
  - `apiKey()` lê `process.env.DEEPSEEK_API_KEY` diretamente (evita descarte pela validação do `env.ts`).
  - `stream_options: { include_usage: true }` no streaming (para contabilizar tokens).
  - Labels no seletor: "DeepSeek V4 Flash" / "DeepSeek V4 Pro".
- **Limites:** Free = 5 msgs IA/dia (era 50). Enforcement de tokens no `/api/chat` (429 com mensagem educada).
- **RAG no chat:** path RAG delega ao `RagService` e registra consumo.

---

## 9. Billing (Fase 9)

- **Planos:** Gratuito (0), Pro (1990, promo 990 no 1º mês), Intensivo (4990).
- **Checkout:** decide preço pela existência de assinatura anterior (`subscriptions.hasAnyByUser`).
- **Limitação honesta:** não há débito automático mensal (gateway one-time). "Renovação" = novo checkout que já cobra R$ 19,90.
- **Dívida técnica:** migrar para assinaturas recorrentes do Mercado Pago se quiser débito automático real.
- **Estado real:** 0 subscriptions, 0 payments (nada cobrado ainda).

---

## 10. Contest Intelligence (Fase 10)

- `GET /api/admin/contest-intelligence?edital_id=` + página `/admin/contest-intelligence`.
- Mostra **peso por matéria** (`notice_subjects`) e **histórico da banca** (questões publicadas por matéria).
- Sem banca confirmada ou histórico < 5 questões → aviso honesto, nunca número inventado.
- **Estado real:** 4 `notice_subjects`, 40 questões publicadas (mas origem manual, sem banca preenchida em massa).

---

## 11. Segurança (Fase 11)

- **RLS:** habilitada em todas as 39 tabelas principais.
- **Admin:** allowlist `ADMIN_EMAILS` + `system_settings`; `AdminGuardService.requireAdmin`.
- **`server-only`:** em todos os módulos de servidor (service role, IA, repositórios de escrita).
- **Zod:** validação em APIs novas.
- **Ownership:** por `user_id` em documentos, questões, sessões.
- **Scan de segredos (tracked):** 0 ocorrências (relatório de implementação).
- **⚠️ Risco:** `DEEPSEEK_API_KEY` exposta em chat anterior — **rotacionar**.

---

## 12. Testes (Fase 14 — executados nesta auditoria)

| Suíte | Resultado |
|-------|-----------|
| `npm run typecheck` | ✅ **0 erros** |
| `npm run lint` | ✅ **0 erros** (1 warning de script temporário removido) |
| `npx vitest run --exclude "src/integration/**"` | ✅ **457 passed / 0 failed** (54 arquivos) |
| `npm test` (com integração) | ⚠️ 3 falhas em `src/integration/` (exigem banco real limpo: duplicate key + timeout) |
| `npm run build` | ✅ **exit 0** (todas as rotas compilam) |
| E2E (Playwright) | Não executado (exige servidor + credenciais E2E); baseline histórico: 22 passed / 3 skipped |

> **Nota:** os 3 testes de integração falham porque usam o banco dev real (com dados de teste já
> presentes), causando `duplicate key` e timeout. Não é regressão de código — é falta de banco de
> teste isolado. Recomenda-se um banco de integração dedicado.

---

## 13. Classificação dos Módulos (Fase 16)

| Módulo | Status | Observação |
|--------|:---:|------------|
| Auth (Auth.js v5 + Supabase) | 🟢 | Funcional, 2 profiles |
| Dashboard | 🟢 | Métricas reais, gráficos, fraquezas |
| Cronograma (disciplinas/tarefas) | 🟢 | 11 matérias, 57 tarefas |
| Questões (banco + resolução) | 🟢 | 47 questões, 111 tentativas |
| Flashcards + SRS (FSRS) | 🟢 | FSRS simplificado implementado |
| Professor IA (chat streaming) | 🟢 | DeepSeek integrado e validado |
| Redação (correção ENEM) | 🟢 | `/redacao` + `/api/essay/correct` |
| Aulas (geração + player) | 🟢 | 1 aula publicada |
| Apostilas (upload + pipeline) | 🟡 | 8 docs em `chunked` (sem embeddings) |
| Knowledge Engine / RAG | 🟠 | Bloqueado por `EMBEDDING_API_URL` ausente |
| Contest Intelligence | 🟡 | v1 funcional, depende de dados de banca |
| Billing (planos/checkout) | 🟡 | Sem débito recorrente; 0 pagamentos |
| Admin (área completa) | 🟢 | Dashboard, alunos, concursos, apostilas, questões, aulas, avatares, IA |
| Importador de conteúdo | 🟢 | URL, CSV/XLSX/JSON, fontes externas |
| FlashcardGenerationService | 🟠 | Código pronto, **desconectado** |
| ExerciseGenerationService | 🟠 | Código pronto, **desconectado** |
| Embeddings / busca vetorial | 🔴 | Bloqueado (env ausente) |
| OCR / transcrição | 🟠 | Apenas detecção/hook, sem serviço externo |
| Avatar (vídeo/voz) | 🟡 | Arquitetura pronta, sem serviço externo |

---

## 14. Pendências e Bloqueios (Fase 17)

### 🔴 Bloqueios (impedem funcionalidade)
1. **`EMBEDDING_API_URL` ausente** → busca vetorial/RAG completo indisponível; documentos ficam em `chunked`.
2. **`ADMIN_EMAILS` ausente** → testes E2E de admin pulados; sem acesso admin em produção.
3. **`R2_ACCESS_KEY_ID` ausente** → storage cai no fallback Supabase (funciona, mas sem R2).

### 🟠 Dívidas técnicas
4. **Billing sem débito recorrente** — gateway one-time; "renovação" é novo checkout.
5. **FSRS simplificado** — sem pesos w0..w17 completos nem otimização de parâmetros.
6. **`FlashcardGenerationService` / `ExerciseGenerationService` desconectados** — código morto.
7. **OCR/transcrição** — apenas detecção/hook, sem serviço externo.
8. **Avatar vídeo/voz** — arquitetura pronta, sem serviço externo.
9. **Testes de integração** — precisam de banco de teste isolado (falham no banco dev).

### ⚠️ Segurança
10. **`DEEPSEEK_API_KEY` exposta em chat** — **rotacionar**.

---

## 15. Plano de Retomada Sugerido (Fase 18)

### Prioridade 1 — Desbloquear funcionalidades críticas
1. **Configurar `EMBEDDING_API_URL`** (BAAI/bge-m3) → destrava busca vetorial + RAG completo.
2. **Configurar `ADMIN_EMAILS`** → destrava área admin e testes E2E de admin.
3. **Rotacionar `DEEPSEEK_API_KEY`** (segurança).

### Prioridade 2 — Conectar código morto
4. **Exportar e conectar `FlashcardGenerationService`** (rota `/api/flashcards/generate` + UI).
5. **Exportar e conectar `ExerciseGenerationService`** (rota de reforço por fraqueza + UI).

### Prioridade 3 — Qualidade e testes
6. **Criar banco de integração isolado** para os 3 testes de integração que falham.
7. **Rodar E2E completo** com credenciais de teste configuradas.

### Prioridade 4 — Produto
8. **Decidir sobre débito recorrente** (migrar para assinaturas Mercado Pago) ou manter one-time.
9. **Evoluir FSRS** para o conjunto completo de pesos (ou `ts-fsrs`).
10. **Alimentar conteúdo real** (questões por banca, editais, apostilas) para destravar Contest Intelligence.

---

## 16. Conclusão (Fase 20)

O projeto **ConcursoAI** está em estado **saudável e funcional** para o MVP: 457 testes unitários passam,
typecheck/lint/build limpos, 37 páginas e 80 rotas de API compilam, e o fluxo apostila → conteúdo → IA →
aulas → questões → desempenho está implementado de ponta a ponta.

Os principais **gargalos** são de **configuração externa** (`EMBEDDING_API_URL`, `ADMIN_EMAILS`, R2) e
**código desconectado** (`FlashcardGenerationService`, `ExerciseGenerationService`). Nenhum deles é
regressão de código — são itens de configuração e integração pendentes.

**Nenhuma alteração foi feita** em código, banco, `.env`, migrations, seed, commit, push ou deploy
durante esta auditoria. O único arquivo criado foi este documento (`docs/RETOMADA_PROJETO.md`).
