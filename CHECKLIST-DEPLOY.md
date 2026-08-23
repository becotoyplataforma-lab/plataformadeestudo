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
