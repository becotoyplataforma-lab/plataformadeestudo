# CHECKLIST-DEPLOY — ConcursoAI Platform

> Checklist operacional de deploy para produção. Complementa `docs/11-DEPLOYMENT.md`
> e `docs/09-INFRASTRUCTURE.md`. Preencha cada item antes de promover para produção.

**Base:** commit `c8dd4aa` (segurança) + fases de finalização até `c234a26` (FSRS-6).
**Data de referência:** 2026-08-22

---

## 1. Variáveis de Ambiente

Copie `infra/.env.production.example` → `.env.production` (na RAIZ do projeto) e preencha.
**NUNCA commitar o `.env.production` preenchido.**

| Variável | Obrigatória? | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | ✅ | URL pública de produção |
| `NEXT_PUBLIC_APP_NAME` | ✅ | Nome do app |
| `AUTH_SECRET` | ✅ | Gerar com `npx auth secret` |
| `AUTH_TRUST_HOST` | ✅ | `true` em produção |
| `ADMIN_EMAILS` | ✅ | Allowlist de admins (vírgula) |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | URL do projeto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Chave anon (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | **Servidor apenas** |
| `SUPABASE_JWT_SECRET` | ✅ | Para verificar tokens NextAuth |
| `DEEPSEEK_API_KEY` | ✅ | LLM principal |
| `DEEPSEEK_BASE_URL` | ✅ | `https://api.deepseek.com` |
| `DEEPSEEK_MODEL_FLASH` | ✅ | `deepseek-chat` |
| `DEEPSEEK_MODEL_PRO` | ✅ | `deepseek-reasoner` |
| `KIMI_API_KEY` | ⬜ | Chave Moonshot para descoberta de modelos |
| `KIMI_BASE_URL` | ✅ | `https://api.moonshot.ai/v1` |
| `EMBEDDING_API_URL` | ✅ | Ativa busca vetorial (RAG) |
| `EMBEDDING_API_KEY` | ⬜ | Se o serviço exigir Bearer |
| `EMBEDDING_MODEL` | ✅ | `BAAI/bge-m3` |
| `EMBEDDING_DIMENSION` | ✅ | `1024` |
| `MERCADO_PAGO_ACCESS_TOKEN` | ✅ | Cobrança de assinaturas |
| `MERCADO_PAGO_PUBLIC_KEY` | ✅ | Checkout |
| `MERCADO_PAGO_WEBHOOK_SECRET` | ✅ | Validação de webhooks |
| `MERCADO_PAGO_SUCCESS_URL` | ✅ | URL de retorno |
| `MERCADO_PAGO_FAILURE_URL` | ✅ | URL de retorno |
| `DATABASE_URL` | ✅ | Pooler/Transaction do Supabase |
| `DIRECT_URL` | ✅ | Conexão direta p/ migrações |
| `WHISPER_API_URL` | ⬜ | Transcrição de mídia (opcional) |
| `R2_ACCOUNT_ID` | ⬜ | Storage S3 (opcional) |
| `R2_ACCESS_KEY_ID` | ⬜ | Storage S3 (opcional) |
| `R2_SECRET_ACCESS_KEY` | ⬜ | Storage S3 (opcional) |
| `R2_BUCKET` | ⬜ | Storage S3 (opcional) |
| `R2_ENDPOINT` | ⬜ | Storage S3 (opcional) |
| `STORAGE_BACKEND` | ⬜ | `r2` ativa storage S3/R2 (B8); ausente/invalido → download do original devolve 503 (sem fallback silencioso) |
| `CSP_ENFORCE` | ⬜ | `true` força bloqueio CSP fora de produção; produção já enforce por padrão (B7) |
| `CSP_REPORT_ONLY` | ⬜ | `true` volta CSP a modo observação (fuga de emergência) (B7) |
| `PROD_SUPABASE_PROJECT_REF` | ⬜ | Ref de produção; trava o guard para escrita só em banco de teste (B9) |
| `SAFE_TEST_DATABASE_REFS` | ⬜ | Allowlist de refs de teste que destravam `db:push`/`db:seed`/`db:migrate`/`ingest:apostilas --apply` (B9) |

> **Removidas (órfãs):** `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `AI_PROVIDER` — não usadas no código.

---

## 2. Banco de Dados (Supabase PostgreSQL 17)

- [ ] **pgvector habilitado** (extensão `vector`) — necessário para busca vetorial (Fase 2).
- [ ] **Migrações aplicadas** na ordem: `schema.sql → indexes.sql → policies.sql`.
- [ ] **Migração `0002_preapproval.sql`** (auto-renewal Mercado Pago) aplicada manualmente
      (o diretório `drizzle/` é gitignored; aplicar via Docker migrator ou Supabase CLI).
- [ ] **Backup** do banco antes de qualquer migração destrutiva (`infra/backup.sh`).
- [ ] **Índices** de performance criados (`sql/indexes.sql`).

---

## 3. Segurança

- [ ] **Rotacionar credenciais** expostas no chat (2026-08-06): senha do banco Supabase,
      Service Role Key, chaves anon/publishable/secret, chave DeepSeek, `OPENAI_API_KEY`
      (`.env` local) — tratar como comprometidas (`docs/INFRASTRUCTURE.md` §86).
- [ ] **`ADMIN_EMAILS`** configurado com e-mails reais de administradores.
- [ ] **`MERCADO_PAGO_WEBHOOK_SECRET`** definido e validado nos webhooks.
- [ ] **Rate limiting** ativo nas rotas de API (Fase 1).
- [ ] **Autorização de admin** ativa nas 16 rotas admin (commit `c8dd4aa`).
- [ ] **HTTPS** configurado (nginx / Vercel).

---

## 4. Build & Deploy

- [ ] `npm ci`
- [ ] `npm run lint` → 0 erros
- [ ] `npm run typecheck` → 0 erros
- [ ] `npm run build` → sucesso
- [ ] `npm test` → todos passam (integração com `DATABASE_URL` opcional)
- [ ] `npm run test:e2e` → com `E2E_USER_EMAIL`/`DATABASE_URL` configurados
- [ ] `infra/deploy.sh` (ou Vercel) → healthcheck OK em `/api/health`

---

## 5. Pós-Deploy (verificação)

- [ ] `/api/health` responde `ok`.
- [ ] `/api/health/storage` mostra `deepseekConfigured` e `embeddingConfigured` corretos.
- [ ] Login + acesso admin funcionam.
- [ ] Assinatura Mercado Pago: checkout + webhook + auto-renewal (Preapproval).
- [ ] Busca vetorial (RAG) retorna resultados com embeddings.
- [ ] Revisão de flashcards (FSRS-6) atualiza `review_schedules` corretamente.

---

## 6. Itens pendentes conhecidos

- [ ] **Transcrição de áudio/vídeo** (Whisper) — arquitetura pronta, serviço externo pendente.
- [ ] **Geração de vídeo/avatar** — arquitetura pronta, serviço externo pendente.
- [ ] **Rotação de credenciais** (ver §3).
- [ ] **Cobertura de testes** — ver relatório de cobertura (Fase 7).

---

## 7. Status da entrega de codigo (revalidado em 2026-09-16)

Evidencia desta execucao, no estado atual do repositorio:

- `npx tsc --noEmit` -> 0 erros (`--incremental false`, sem cache)
- `npx eslint .` -> 0 erros e 0 avisos
- `npx vitest run` -> 938 passed, 29 skipped, 0 failed (99 arquivos: 88 executados, 11 pulados por ausencia de credenciais reais)
- `npx vitest run src/app/api/admin/apostilas/batch` -> 23 testes da rota em lote
- `npx vitest run "src/app/api/knowledge/documents/[id]/download"` -> 12 testes do download do original
- `npx vitest run src/app/api/health` -> 5 testes do payload de health (sem vazamento, force-dynamic)
- `npx vitest run src/app/api/knowledge/mcp-providers` -> 7 testes do catalogo MCP (401 sem sessao, um unico padrao, capacidades espelham o registry e o payload nao contem credencial)
- `npm run build` -> sucesso (Compiled successfully + Finished TypeScript), 91 paginas estaticas geradas. Eram 93: as duas rotas de health deixaram de ser pre-renderadas (ver 7.1), entao a queda e esperada e nao e regressao de paginas
- `npx tsx scripts/ingest-apostilas.ts` sem origem -> usage + codigo 2
- dry-run do lote de apostilas -> 14 achados, 13 suportados, 1 invalido, 1 variante, nenhuma escrita
- `npx tsx scripts/db-guard.ts -- node --version` -> BLOCKED `NON_PRODUCTION_DATABASE_REQUIRED`, codigo de saida 3, log sem credencial
- `git --no-pager diff --check` -> limpo (apenas avisos de conversao CRLF do checkout, sem erro de espaco)
- varredura de segredos no diff e nos arquivos novos -> nenhuma chave, token, JWT, string de conexao ou binario

### 7.1 Codigo pronto

- MCP multi-provedor: contrato, registry, capacidades, catalogo em `GET /api/knowledge/mcp-providers`, seletor no upload individual, no lote e no reprocessamento
- Apostila MCP alinhado ao extrator real: `pdf`, `docx`, `txt`, `md`/`markdown`, `html`/`htm`; recusados `doc`, `epub`, `rtf`, `odt`, `ppt`, `pptx`, `xls`, `xlsx` e imagens
- `processing_version` separada de `mcp_version` no contrato, no upload, no lote, no reprocessamento e no CLI; teste que falha se as duas voltarem a coincidir
- Trava de divergencia entre MCP, `IngestionService` e extrator (`src/lib/knowledge/mcp/__tests__/mcp-format-contract.test.ts`)
- Extrator passa a recusar formato sem extrator com `UNSUPPORTED_FORMAT`
- Servidor MCP para o VS Code (`.vscode/mcp.json` + `scripts/knowledge-mcp-server.ts`), somente leitura
- `env-guard` estendido aos processos filhos: `db:push`, `db:seed`, `db:migrate` e `drizzle:migrate` so executam com banco comprovadamente de teste
- `GET /api/knowledge/documents/[id]/download`: baixa o original pelo backend gravado no documento, com 503 explicito quando o backend nao esta configurado (sem fallback silencioso)
- CSP e headers de seguranca no proprio app (`src/lib/security/csp.ts` + `next.config.ts`): Report-Only em desenvolvimento, enforce por padrao em producao (`CSP_ENFORCE=true` força; `CSP_REPORT_ONLY=true` volta a reportar). Verificado em servidor local de producao (`next start`): `Content-Security-Policy` real com `object-src 'none'; base-uri 'self'; frame-ancestors 'self'; upgrade-insecure-requests`, mais `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` e `Permissions-Policy: camera=(), microphone=(), geolocation=()`. A rota de download sem sessao devolveu `401 {"error":"Não autorizado"}` por HTTP real, antes de qualquer acesso a banco ou storage

- Rota em lote com o mesmo contrato da individual: capacidade `ingest` checada no backend (`assertMcpCapability`) no upload e no lote, `McpError.status` respeitado (404 provedor inexistente, 422 capacidade ausente) e teste dedicado de rota com 23 casos
- Download do original: `StorageBackendError` (STORAGE_BACKEND ausente ou invalido) devolve 503 em vez de 500, e a mensagem do storage nao e mais echoada ao cliente (codigo no corpo, texto cru no log)
- `/api/health` e `/api/health/storage` agora sao `force-dynamic`: sem isso o Next pre-renderava o JSON no build e o monitoramento lia timestamp/booleans congelados. Backend nao resolvido vira `backend: null` + `backendError` (nunca 500) e variavel de ambiente com espaco conta como nao configurada
- Paginas de detalhe de apostila (`src/app/(dashboard)/apostilas/[id]/page.tsx` para o dono e `src/app/admin/apostilas/[id]/page.tsx` para admin) ganharam o link **Baixar arquivo original**, apontando direto para a rota de download; so aparece quando existe `doc.storagePath`, e a decisao de dono/admin continua sendo da rota, nao do componente. Sem teste de componente porque a suíte roda em ambiente `node` (sem jsdom): validado por `tsc`, `eslint` e build.
- Catalogo MCP ganhou teste de rota proprio (`src/app/api/knowledge/mcp-providers/__tests__/api-mcp-providers.test.ts`), inclusive comparando o payload com `assertMcpCapability` no mesmo provedor registrado: o que a UI oferece e exatamente o que o backend aceita.
- `deploy.yml` agora observa `drizzle/**`, `sql/**` e `scripts/**`: migracao commitada sozinha nao disparava CI nem deploy, e esses tres caminhos vao dentro da imagem (estagio migrator) - o schema da VPS divergiria do codigo silenciosamente

### 7.2 Configuracao pendente (externa, nao e defeito de codigo)

- [ ] Banco de teste/staging isolado: definir `DATABASE_URL` de staging ou `PROD_SUPABASE_PROJECT_REF` + `SAFE_TEST_DATABASE_REFS`. Sem isso, `db:push`, `db:seed`, `db:migrate`, seed, cleanup de E2E e `ingest:apostilas --apply` continuam bloqueados pelo guard (comportamento esperado).
- [ ] Credenciais de Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) e `STORAGE_BACKEND=r2` explicito em producao.
- [ ] Credenciais de embedding em producao (Workers AI / endpoint). Sem elas o sistema degrada para FTS e o documento para em `chunked`.
- [ ] Credenciais de Google OAuth de producao.
- [ ] `DEEPSEEK_API_KEY` / `KIMI_API_KEY` de producao para redacao e professor IA.
- [ ] Segredos de CI/CD do deploy e `MERCADO_PAGO_WEBHOOK_SECRET`.

### 7.3 Infraestrutura pendente

- [ ] Provisionar o projeto Supabase de staging (mesma schema via `drizzle/`).
- [ ] Bucket R2 + politica privada; rodar `scripts/migrate-storage-r2.mjs` contra staging, nunca contra producao sem backup.
- [ ] DNS, certificado e `NEXT_PUBLIC_APP_URL`.
- [ ] Rodar `npm run db:push`/`db:seed` no staging depois de liberar o guard.

### 7.4 Validacao pendente

- [ ] Playwright completo: **BLOCKED** enquanto desenvolvimento e producao compartilharem o mesmo banco. A suíte já está preparada para o guard: roda automaticamente quando `DATABASE_URL` apontar para banco comprovadamente de teste.
- [x] Header CSP verificado em servidor local de producao (`next start`, porta 3111): `Content-Security-Policy` real (em producao o enforce e o padrao, sem precisar de `CSP_ENFORCE=true`) com `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'` e `upgrade-insecure-requests`, mais `X-Content-Type-Options: nosniff`, `Referrer-Policy` e `Permissions-Policy`. `/` e `/login` responderam 200 com o header presente; `GET /api/knowledge/documents/[id]/download` sem sessao respondeu 401 antes de tocar banco ou storage.
- [ ] Confirmacao manual em navegador do comportamento sob enforce (login, checkout, iframe do visualizador de apostila, upload com XHR): os headers ja estao ativos em producao, entao qualquer recurso bloqueado vira falha visivel. Se aparecer bloqueio, usar `CSP_REPORT_ONLY=true` como fuga de emergencia enquanto a diretiva e corrigida.
- [ ] Ingestao real das 13 apostilas com `--apply` em banco isolado, conferindo `mcp_version` e `processing_version` por documento.
