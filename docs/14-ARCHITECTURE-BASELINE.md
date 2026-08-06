# 14 — ARCHITECTURE BASELINE

> Baseline arquitetural oficial do ConcursoAI (FASE 10).
> Registro dos conflitos arquiteturais resolvidos, arquivos alterados,
> decisões utilizadas, validação executada e congelamento da arquitetura.
> Documento de referência para todas as implementações futuras.

---

## 1. CONTEXTO

A FASE 10 resolveu os conflitos arquiteturais bloqueantes identificados na
FASE 9.1 (consolidação do domínio Knowledge), deixando a base pronta para
continuar a implementação dos demais domínios sem novas interrupções.

**Regra aplicada:** nenhuma nova decisão arquitetural foi criada. Todas as
correções usam decisões já existentes e aprovadas (ADR-001, DOMAIN DECISIONS,
ENTITY STANDARDS, DATABASE PHYSICAL, ENGINE ARCHITECTURE, BLUEPRINTS).

---

## 2. CONFLITOS RESOLVIDOS

### 2.1. Infraestrutura de lint quebrada (bloqueava todos os gates)

- **Problema:** `npm run lint` falhava (exit 1) — `next lint` foi removido no
  Next.js 16; ESLint 9 exige Flat Config, mas o projeto usava `.eslintrc.json` legado.
- **Solução:** migração completa para ESLint 9 Flat Config.
- **Status:** ✅ Resolvido.

### 2.2. Identity divergente do ADR-001 (SQL manual pré-ADR-001)

- **Problema:** `database/identity/*.sql` (FASE 4) continha `public.users`,
  contrariando o ADR-001 (auth.users como única fonte de identidade).
- **Solução:** alinhamento total ao ADR-001:
  - `public.users` removido de schema/functions/rls/seeds.
  - `profiles` e `sessions` passam a referenciar `auth.users(id)`.
  - Trigger de criação de perfil movido para `auth.users`.
  - Seeds criam apenas `profiles` (identidade criada via Supabase Auth).
- **Status:** ✅ Resolvido.

### 2.3. Migrations Drizzle criando `auth.users`

- **Problema:** a migration baseline gerada continha `CREATE TABLE "auth"."users"`,
  que conflita com o Supabase Auth (tabela já gerenciada pelo provedor).
- **Solução:** regeneradas todas as migrations com o schema Drizzle; o bloco
  `auth.users` foi removido do `.sql` (o snapshot `drizzle/meta` mantém
  `auth.users` como tabela existente — referência externa, sem criação).
- **Nota:** `schemaFilter: ["public"]` permanece no `drizzle.config.ts`
  (aplica-se a introspect/push; para `generate`, a remoção do bloco é manual e determinística).
- **Status:** ✅ Resolvido.

---

## 3. ARQUIVOS ALTERADOS

### Infraestrutura (lint)

| Arquivo | Alteração |
| --- | --- |
| `eslint.config.mjs` | **Criado** — ESLint 9 Flat Config (next/core-web-vitals + next/typescript + ignores) |
| `.eslintrc.json` | **Removido** — config legada |
| `package.json` | Script `lint` alterado de `next lint` → `eslint .` |

### Correções de lint (código legado — sem alterar regras de negócio)

| Arquivo | Correção |
| --- | --- |
| `src/hooks/use-mobile.ts` | Refatorado para `useSyncExternalStore` (remove setState síncrono em effect) |
| `src/components/questoes/question-card.tsx` | `Date.now()` removido do render; medição movida para o event handler; disables justificados para `react-hooks/purity` |
| `src/components/questoes/question-browser.tsx` | Disable justificado `react-hooks/set-state-in-effect` (padrão legítimo de fetch em filtros) |
| `src/lib/db/repositories/analises.ts` | `any` removido; tipo tipado do nested select |

### Domínio Identity (alinhamento ADR-001)

| Arquivo | Alteração |
| --- | --- |
| `database/identity/schema.sql` | `public.users` removido; `profiles`/`sessions` → FK `auth.users` |
| `database/identity/functions.sql` | Trigger de `public.users` removido; `handle_new_user` em `auth.users`; `SET search_path=''` + qualificação |
| `database/identity/rls.sql` | Políticas de `public.users` removidas; apenas `profiles` e `sessions` |
| `database/identity/seeds.sql` | Seeds de `public.users` removidos; apenas `profiles` |
| `src/db/schema/identity.ts` | Comentário de divergência atualizado (resolvida) |

### Migrations

| Arquivo | Alteração |
| --- | --- |
| `drizzle/0000_baseline.sql` | **Regenerada** — 12 tabelas public; sem `CREATE auth.users`; corrigido `$1` → `"content"` no `fts_vector` gerado |
| `drizzle/meta/0000_snapshot.json` | Regenerado (auth.users como referência externa existente) |
| `drizzle/meta/_journal.json` | Regenerado |

---

## 4. DECISÕES UTILIZADAS

| Decisão | Fonte | Aplicação |
| --- | --- | --- |
| ADR-001 — auth.users única fonte de identidade | `.ai/adr/ADR-001-SUPABASE-AUTH.md` | Identity alinhado; sem `public.users` |
| DD-004 — Repository Pattern | `docs/06-DOMAIN-DECISIONS.md` | Consultas via Repository |
| DD-005 — Service Layer | `docs/06-DOMAIN-DECISIONS.md` | Regras em Services |
| DD-006/007 — DTO + Zod | `docs/06-DOMAIN-DECISIONS.md` | Contratos de fronteira |
| DD-008/009/010 — RLS, Soft Delete, UUID | `docs/06-DOMAIN-DECISIONS.md` | Padrões de persistência |
| 07-ENTITY-STANDARDS | `docs/07-ENTITY-STANDARDS.md` | Naming, auditoria, lifecycle |
| 08-DATABASE-PHYSICAL | `docs/08-DATABASE-PHYSICAL.md` | Modelo físico oficial |
| 10-EMBEDDING-STANDARD | `docs/10-EMBEDDING-STANDARD.md` | BAAI/bge-m3, 1024d, HNSW, Hybrid Search |
| ENGINE ARCHITECTURE + BLUEPRINTS | `docs/ENGINE-ARCHITECTURE.md`, `.ai/blueprints/` | Contratos das Engines |
| ESLint 9 Flat Config | Ferramenta oficial ESLint | Infraestrutura de lint |

---

## 5. VALIDAÇÃO EXECUTADA

| Comando | Resultado |
| --- | --- |
| `npm run lint` | ✅ EXIT 0 (0 erros, 22 warnings não-bloqueantes) |
| `npm run typecheck` | ✅ EXIT 0 |
| `npm test` | ✅ EXIT 0 (30/30 testes) |
| `npm run build` | ✅ EXIT 0 (30 rotas, incluindo 5 de Knowledge) |
| `drizzle-kit generate` | ✅ Migration baseline gerada e validada |

---

## 6. ARQUITETURA OFICIALMENTE CONGELADA

A partir desta baseline, a arquitetura é considerada **congelada**:

- **Documentos de referência (fonte da verdade, não alterar sem autorização):**
  - ADRs: `.ai/adr/ADR-001-SUPABASE-AUTH.md`
  - Decisões: `docs/06-DOMAIN-DECISIONS.md`
  - Padrões: `docs/07-ENTITY-STANDARDS.md`, `docs/08-DATABASE-PHYSICAL.md`,
    `docs/10-EMBEDDING-STANDARD.md`
  - Engines: `docs/ENGINE-ARCHITECTURE.md`, `.ai/blueprints/*`
  - Este documento: `docs/14-ARCHITECTURE-BASELINE.md`

- **Ordem de implementação dos domínios restantes (MVP):**
  1. Identity ✅ (resolvido)
  2. Knowledge ✅ (implementado e consolidado — FASE 9/9.1)
  3. RAG Engine
  4. AI Professor
  5. Study
  6. Billing
  7. Analytics
  8. Administration

- **Gates obrigatórios por domínio:** `npm run lint`, `npm run typecheck`,
  `npm test`, `npm run build` — todos devem passar antes de avançar.

---

## 7. CONFLITOS RESTANTES / OBSERVAÇÕES

| Item | Tipo | Descrição |
| --- | --- | --- |
| Decisões OPEN-002..007 | Arquitetural | Continuam abertas (`docs/06`): dono do cronograma, fronteira AiUsage, eventos Analytics, materialização DailySummary, divisão Study. **Devem ser resolvidas antes de implementar Study/Billing/Analytics.** |
| `status` de knowledge_subjects/topics | docs × código | docs/08 indica ENUM `lifecycle_status`; implementação usa TEXT (Drizzle e SQL consistentes entre si). **Requeria decisão — mantido como está.** |
| Warnings de lint (22) | Qualidade | Unused imports em código legado e em Knowledge. Não-bloqueantes (EXIT 0). **Knowledge não foi alterado (regra da FASE 10).** |
| `auth.users` no snapshot | Referência externa | Snapshot mantém `auth.users` como existente (correto — Supabase gerencia). Migrations não o criam. |

---

> **Documento criado em:** FASE 10 — Resolução dos Conflitos Arquiteturais.
> **Status:** Baseline congelada. Pronto para continuar RAG Engine e demais domínios.
