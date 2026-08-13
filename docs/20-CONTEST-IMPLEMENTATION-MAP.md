# 20 — Contest Implementation Map (Revisão D6)

**Projeto:** ConcursoAI Platform
**Status:** Mapa técnico — **somente leitura**. Nenhum SQL, `ALTER TABLE` ou alteração de `contest.ts` foi feito. Base para decidir a implementação.
**Data:** 2026-08-12
**Base:** `docs/19-CONTEST-INTELLIGENCE-SPEC.md` (D1–D6) · DD-020→DD-025 (`docs/06-DOMAIN-DECISIONS.md`) · `docs/08-DATABASE-PHYSICAL.md`
**Fatos levantados do código:** `src/db/schema/*.ts` + `database/*/rls.sql` + `database/*/functions.sql`.

---

## 1. Schema existente (fatos reais)

### 1.1 `profiles` (`src/db/schema/identity.ts`)
- **Colunas:** `id` (PK, FK `auth.users`, on delete cascade) · `full_name` · `avatar_url` · `level` (enum `user_level`) · `concurso_alvo` (text) · `banca_preferida` (text) · `meta_diaria_min` (int, CHECK 15..720) · `modelo_ia_padrao` (enum `ai_model`) · `created_at` · `updated_at`.
- **Sem colunas de Contest** — `contest_id`/`position_id` serão **adicionadas** (nullable).
- **RLS (database/identity/rls.sql):** próprio usuário (`id = auth.uid()`) + admin (`public.is_admin()`). O isolamento já existe — as colunas novas caem dentro dele.

### 1.2 `knowledge_subjects` / `knowledge_topics` (`src/db/schema/knowledge.ts`)
- `knowledge_subjects`: `id` (PK) · `name` (uniq) · `slug` (uniq) · `description` · `color` · `keywords` (jsonb) · `status` · `created_at/updated_at/deleted_at`.
- `knowledge_topics`: `subject_id` (FK) · `parent_topic_id` (self-FK) · `name` · `slug` (uniq por subject) · `status` · timestamps.
- **RLS:** catálogo público (SELECT autenticado) + admin (via `raw_app_meta_data->>'is_admin'='true'`).

### 1.3 `questions` (`src/db/schema/study.ts`)
- `id` (PK) · `knowledge_subject_id` (FK, restrict) · `banca` · `cargo` · `ano` · `nivel` (enum) · `enunciado` · `gabarito` · `explicacao` · `tipo` · `fonte` · `is_public` · `content_hash` (uniq onde não deletado) · `status` (enum `question_status`) · timestamps.
- **RLS:** leitura pública (`is_public = true AND status = 'publicada' AND deleted_at IS NULL`) + admin (select/manage via `is_admin()`).

### 1.4 Admin e padrões
- **`public.is_admin()`** (`database/identity/functions.sql`): lê claim `app_metadata.is_admin` do JWT.
- **Padrão catálogo** (knowledge/questions): `FOR SELECT` autenticado + `FOR ALL`/manage admin.
- **Padrão usuário** (study_subjects/tasks, profiles): `user_id = auth.uid()` / `id = auth.uid()`.
- **Migrations:** `drizzle/0000+0001` = **29 tabelas**, nenhuma do domínio Contest (confirmado — `contest.ts` é `export {}`).

---

## 2. Domínio Contest proposto (tabelas novas)

| Tabela | Colunas | FKs |
|---|---|---|
| `organs` | id · name(uniq) · slug(uniq) · description · status · timestamps | — |
| `boards` | id · name(uniq) · slug(uniq) · description · status · timestamps | — |
| `contests` | id · organ_id · board_id · title · slug(uniq) · description · status · start_date · end_date · timestamps | organs, boards |
| `editais` | id · contest_id · title · version · published_date · content_url · `programmatic_content` (jsonb, bruto) · **`is_current`** · status (rascunho/publicado/arquivado) · timestamps | contests |
| `positions` | id · contest_id · edital_id (opcional) · name · slug · description · status · timestamps | contests, editais |
| `notice_subjects` | id · edital_id · position_id (**NULL**=geral) · knowledge_subject_id · **`weight` (int, 0–100)** · status · timestamps | editais, positions, knowledge_subjects |
| `profiles` (ALTER) | + `contest_id` (nullable) · + `position_id` (nullable) | contests, positions |

---

## 3. PK / FK / UNIQUE / CHECK / índices (segundo DD-020→DD-025)

### 3.1 Constraint-chave
- `notice_subjects`: **`UNIQUE (edital_id, position_id, knowledge_subject_id)`** (DD-020) — permite peso geral (position_id NULL) e por cargo no mesmo edital.
- `notice_subjects.weight`: **`CHECK (weight BETWEEN 0 AND 100)`** + **`NOT NULL`** (DD-021).
- `editais`: **vigência explícita** → `is_current boolean NOT NULL DEFAULT false` + **`UNIQUE (contest_id) WHERE is_current`** (índice parcial — no máx. um vigente por concurso, DD-023).
- `positions`: **`UNIQUE (contest_id, id)`** — habilita a FK composta abaixo.

### 3.2 FKs (com a proteção do DD-023 4b)
- `contests.organ_id → organs.id` · `contests.board_id → boards.id`.
- `editais.contest_id → contests.id` (on delete cascade).
- `positions.contest_id → contests.id` · `positions.edital_id → editais.id` (opcional).
- `notice_subjects.edital_id → editais.id` · `notice_subjects.position_id → positions.id` (nullable) · `notice_subjects.knowledge_subject_id → knowledge_subjects.id`.
- **`profiles.contest_id → contests.id`** e **`profiles.position_id → positions.id`** — ambos **nullable** (DD-023).
  - **Reforço de consistência (DD-023 4b):** usar **FK composta** `FOREIGN KEY (contest_id, position_id) REFERENCES positions (contest_id, id)`. Assim o banco garante que `position_id` pertence ao `contest_id` do usuário (evita escolha silenciosa/incorreta). Sem a composta, a validação cai no service.
  - `ON DELETE SET NULL` (remover concurso/cargo não apaga a escolha do usuário nem o restante).

### 3.3 Índices
- `contests`: idx por `status` · `organ_id` · `board_id`.
- `editais`: idx por `contest_id` · `status`; parcial único por `is_current`.
- `positions`: idx por `contest_id`.
- `notice_subjects`: idx por `edital_id` · `knowledge_subject_id` · `position_id`.
- CHECK extra: `contests.end_date >= contests.start_date` (quando ambos informados) — padrão do físico.

---

## 4. RLS (mapeado no padrão atual)

| Tabela | Política | Padrão seguido |
|---|---|---|
| `organs`, `boards`, `contests`, `positions` | SELECT autenticado (catálogo) + admin manage | `knowledge_subjects` (público/admin) |
| `editais` | SELECT autenticado **somente publicado + `is_current`** (o resto não vaza) + admin manage | `questions` (leitura pública filtrada) |
| `notice_subjects` | SELECT autenticado via edital publicado + admin manage | herança de `editais` |
| `profiles.contest_id/position_id` | Já isolado pela política `profiles_*_own` (id = auth.uid()) | `identity/rls.sql` (nada a mudar além do ALTER) |

> **Detalhe:** a leitura do catálogo Contest deve filtrar **apenas o que é público** (publicado/vigente), senão `rascunho` (propostas da IA, DD-024) vaza para usuários comuns. Admin vê tudo.

---

## 5. Compatibilidade com o Drizzle

- `src/db/schema/contest.ts` (hoje `export {}`) passa a **espelhar** as tabelas (tipos/introspecção) — **sem `drizzle:migrate`** (DD-025).
- `src/db/schema/identity.ts` ganha `contest_id`/`position_id` no `profiles` (espelho das colunas novas).
- **Risco de drift:** SQL manual ≠ schema Drizzle → o app pode tipar algo que não existe. Mitigação: **script read-only de verificação** (comparar colunas do banco × snapshot) antes e depois da aplicação — mesmo padrão já usado na validação do E2E.
- RLS/índices/CHECK ficam **no SQL**, não no Drizzle (como no resto do projeto).

---

## 6. Impacto no planner (cadeia D+)

```
profiles.contest_id / position_id   (DD-023; nullable → neutro se vazio)
   → contests → edital publicado + is_current   (DD-023; ambiguidade → neutro)
   → notice_subjects  escopo (edital_id, position_id OU NULL)   (DD-020)
   → weight → share = weight / SUM(weight)   (DD-021; soma 0 → neutro)
   → editalWeight (fator aditivo, por matéria via LinkResolver)   (DD-022)
   → P1–P5 (regressão B/C preservada sem dados)
```
- Sem `contest_id`/edital vigente/`notice_subjects` → **fator neutro** (o planner atual não muda).

---

## 7. Relatório de risco

| # | Risco | Impacto | Mitigação |
|---|---|---|---|
| 1 | **FKs em `profiles`** (contest_id/position_id) | Quebrar perfis existentes ou a escolha do usuário | Colunas **nullable** + `ON DELETE SET NULL`; FK composta `(contest_id, position_id) → positions(contest_id, id)` garante DD-023 4b |
| 2 | **RLS — vazamento de rascunho** | IA/publicação parcial exposta | SELECT de catálogo filtra `publicado + is_current`; admin vê tudo |
| 3 | **Edital vigente/ambíguo** | 2 editais `is_current` por concurso | Índice parcial único `WHERE is_current`; toggle transacional ao publicar (todos false → um true); planner neutro na dúvida (DD-023) |
| 4 | **`position_id` fora do concurso** | Peso de cargo errado | FK composta no banco + validação no service (DD-023) |
| 5 | **Compatibilidade com dados existentes** | Backfill/ruptura | Só colunas novas nullable em `profiles`; `concurso_alvo` segue como legado; sem backfill obrigatório |
| 6 | **Idempotência do SQL** | Re-executar erro | `CREATE TABLE IF NOT EXISTS` · `ADD COLUMN IF NOT EXISTS` · `DROP POLICY IF EXISTS / CREATE POLICY` · `CREATE UNIQUE INDEX IF NOT EXISTS` |
| 7 | **Rollback** | Sem trilha, não reverte | Script reverso versionado no repo (DROP TABLE / DROP COLUMN / DROP POLICY); SQL versionado em `database/contest/` |
| 8 | **Drift Drizzle × SQL** | Tipo do app ≠ banco | `contest.ts`/`identity.ts` espelham + script read-only de verificação antes/depois |
| 9 | **`drizzle:migrate` acidental** | Estado não rastreável | DD-025: proibido nesta etapa; só SQL manual por domínio |

---

## 8. Conclusão (mapa pronto — aguardando autorização)

- **Tabelas:** 6 novas (`organs`, `boards`, `contests`, `editais`, `positions`, `notice_subjects`) + 2 colunas em `profiles`.
- **Ponto de maior cuidado:** FK composta `profiles(contest_id, position_id) → positions(contest_id, id)` + filtro de RLS "só publicado/vigente" + `is_current` com índice parcial único.
- **Nenhum SQL/`ALTER`/`contest.ts` foi criado ou executado.** A decisão de implementar é sua; quando autorizar, a ordem sugerida é: verificação read-only → `database/contest/schema.sql` → `rls.sql` → espelhos Drizzle → verificação pós → teste do planner (fator `editalWeight` neutro sem dados).
