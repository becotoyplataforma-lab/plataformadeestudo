# 19 — Contest Intelligence Specification (Grupo D)

**Projeto:** ConcursoAI Platform
**Status:** Especificação — somente análise (sem código, sem SQL, sem migration)
**Data:** 2026-08-12
**Base:** `docs/12-CONTEST-DOMAIN-REVIEW.md` · `docs/04-DATABASE-LOGICAL.md` · `docs/08-DATABASE-PHYSICAL.md` · `docs/06-DOMAIN-DECISIONS.md`
**Checkpoint:** Grupo C (`d80d5bd`) fechado — esta spec prepara o **Grupo D+ (implementação futura)**.

---

## 1. Objetivo

Definir **como representar edital e peso de matéria** para a Contest Intelligence, de modo que:

1. O **planner adaptativo** (Grupos B + C) possa consumir os pesos do edital sem refazer o algoritmo.
2. A **migration** que vier depois **não precise ser refeita** (modelo à prova de mudanças).
3. A banca e as **provas anteriores** já usadas no Grupo C se encaixem no mesmo fluxo.

> **Decisão central em aberto:** edital e peso de matéria são o ponto que define o modelo — por isso esta spec existe antes de qualquer migration.

---

## 2. Fluxo de dados alvo

```mermaid
flowchart TD
  C[Concurso / contests] --> E[Edital / editais]
  E --> P[Cargo / positions]
  E --> NS[Disciplinas do edital / notice_subjects + peso]
  C --> B[Banca / boards]
  NS --> KS[knowledge_subjects / knowledge_topics]
  B --> Q[Provas anteriores / questions.banca+ano]
  KS --> PL[Planner adaptativo]
  Q --> PL
  NS --> PL
  PL --> T[Tarefas do cronograma / study_tasks]
```

**Fontes de verdade:**
- **Concurso** agrega edital + banca (via `board`).
- **Edital** é a fonte oficial do conteúdo programático (disciplinas + pesos).
- **Cargo** pode ter pesos próprios (edital por cargo).
- **Banca** identifica o estilo das provas anteriores.
- **Planner** combina: desempenho (B) + banca (C) + peso do edital (D, futuro).

---

## 3. Estado atual (levantamento)

| Item | Onde | Estado |
| --- | --- | --- |
| `knowledge_subjects` + `knowledge_topics` (catálogo em árvore) | `src/db/schema/knowledge.ts` | ✅ Existe |
| `study_subjects` + `study_tasks` (disciplina/tarefa do usuário) | `src/db/schema/study.ts` | ✅ Existe (planner B/C) |
| `profiles.banca_preferida` / `concurso_alvo` | `src/db/schema/identity.ts` | ✅ Existe (usado no C) |
| `questions.banca` / `ano` / `cargo` | `src/db/schema/study.ts` | ✅ Existe (usado no C) |
| Fator banca no planner (`bancaScore` aditivo) | `adaptive-planner.service.ts` | ✅ Commitado (C) |
| `LinkResolverService` (study_subject ↔ knowledge_subject) | `src/lib/study/services/link-resolver.service.ts` | ✅ Existe |
| Domínio Contest (`contest.ts`) | `src/db/schema/contest.ts` | ⚠️ **Vazio** (`export {}`) |
| `organs` / `boards` / `contests` / `editais` | Docs físico (`08-DATABASE-PHYSICAL.md`) | ⚠️ Só documento, sem tabela |
| `database/contest/` (schema.sql/rls.sql) | `database/` | ⚠️ Não existe (outros domínios têm) |

**Gaps identificados:**
1. Não há tabela de `contests`, `editais`, `boards`, `organs`.
2. Não há representação relacional de **disciplina do edital com peso**.
3. Não há vínculo **cargo → disciplinas**.
4. `profiles.concurso_alvo` é texto livre (não referenciado a um contest).

---

## 4. Decisão central: como representar edital e peso de matéria

### Opções avaliadas

| Opção | Descrição | Prós | Contras |
| --- | --- | --- | --- |
| **A — JSON em `editais.programmatic_content`** | Guardar o conteúdo programático como JSON (já previsto no modelo físico) | Flexível; sem tabelas novas; import rápido | Não-relacional; JOIN difícil; peso não consultável pelo planner; normalização frágil |
| **B — `notice_subjects` relacional (recomendada)** | Tabela associativa `edital → knowledge_subject` com `weight` | Consultável; JOIN direto com o planner; pesos auditáveis; única fonte por (edital, cargo, matéria) | Mais tabelas; exige migration |
| **C — `position_subjects` (peso por cargo)** | Peso de matéria **por cargo** (edital por cargo) | Concurso multi-cargo correto | Multiplica linhas; só faz sentido se cargo for modelado |
| **D — `notice_topics` (peso por tópico)** | Granularidade fina no `knowledge_topics` | "Estudar exatamente o que o edital pede" | Árvore complexa; esforço alto; não é necessário na 1ª versão |

### Recomendação (híbrida)

> **B (relacional) como fonte de verdade + A (JSON) como armazenamento bruto de importação.**

- `editais.programmatic_content` (JSON) = **documento bruto** extraído/importado (fonte para ETL e auditoria).
- `notice_subjects` (tabela relacional) = **fonte estruturada** consumida pelo planner, com `weight`.
- `positions` (cargo) e o peso por cargo (via `position_id` em `notice_subjects`, DD-020) = **evolução natural** quando o concurso for multi-cargo; pode nascer já no modelo para não migrar duas vezes.
- `notice_topics` = **fase posterior** (granularidade fina), não bloqueia a 1ª versão.

**Por quê:** o planner precisa de **JOIN e agregação por matéria** (peso, share, normalização). JSON não permite isso de forma robusta. O domínio Contest já tem `editais.programmatic_content` no físico — ele continua existindo como bruto, e o `notice_subjects` é a camada estruturada derivada.

> **Nota (pós-review):** o `12-CONTEST-DOMAIN-REVIEW.md` posicionava `positions` para V1.1. Esta spec **antecipa** `positions` com `position_id` **nullable** em `notice_subjects` (NULL = peso geral). O cargo é **opcional** — não força nada na V1 e evita refazer a migration.

---

## 5. Modelo de dados proposto (futura migration)

> ⚠️ **Nada disso será criado nesta fase (Grupo D é só spec).** Definição para a implementação futura.

### 5.1 Tabelas (domínio Contest)

| Tabela | Colunas-chave | FK | Observação |
| --- | --- | --- | --- |
| `organs` | id, name(uniq), slug(uniq), description, status | — | Catálogo (leitura autenticado / escrita admin) |
| `boards` | id, name(uniq), slug(uniq), description, status | — | Banca (catálogo) |
| `contests` | id, organ_id, board_id, title, slug(uniq), status, start_date, end_date | organs, boards | Agregado raiz |
| `editais` | id, contest_id, title, version, published_date, content_url, `programmatic_content` (JSON bruto), `is_current` (vigência explícita, DD-023), status | contests | Um edital vigente por concurso (`is_current` explícito) |
| `positions` | id, contest_id, edital_id (opcional), name, slug, description | contests, editais | Cargo (opcional na V1) |
| `notice_subjects` | id, edital_id, position_id (NULL = vale p/ todo o concurso), knowledge_subject_id, `weight` (INTEGER NOT NULL, 0–100), status | editais, positions, knowledge_subjects | **Matéria do edital com peso** — unique (edital_id, position_id, knowledge_subject_id) |
| `notice_topics` *(fase 2)* | id, notice_subject_id, knowledge_topic_id, weight | notice_subjects, knowledge_topics | Granularidade fina |
| `exam_phases` / `exams` *(fase 2)* | id, contest_id / exam_phase_id, title, date | contests | Provas (vinculação de questões) |

### 5.2 Normalização do peso

- `weight` armazenado **bruto** (ex.: 0–100, soma ≠ 100 no banco).
- **Normalização no consumo** pelo planner: `share = weight / soma(pesos do mesmo escopo)`.
- Escopo do peso: `(edital_id, position_id)` — `position_id IS NULL` = peso geral; preenchido = peso do cargo (sobrescreve para aquele cargo).

### 5.3 Regras de negócio

- Um edital vigente por concurso = **`publicado` + `is_current` explícito** (DD-023); ambiguidade → **fator neutro**.
- `notice_subjects` só referencia `knowledge_subjects` existentes (catálogo compartilhado — DD-001).
- Ao **vincular** a disciplina do usuário (`study_subjects`) ao `knowledge_subject`, o planner herda o peso do edital (mesmo `LinkResolverService` do Grupo B/C).
- Se não houver edital/`notice_subjects` para o usuário → fator neutro (comportamento do Grupo C preservado).

### 5.4 RLS

- Catálogo Contest (organs, boards, contests, editais, positions, notice_subjects): **leitura para autenticados; escrita para administrador** (mesmo padrão do físico).
- Nenhuma tabela Contest é do usuário (ao contrário de `study_subjects`).

### 5.5 Ingestão (ETL) — resumo

- **Manual/admin**: CRUD de edital + seleção de matérias com peso (UI admin).
- **IA assistida**: parse do PDF do edital → extração de disciplinas/tópicos → proposta de `notice_subjects` para revisão (Professor IA / pipeline).
- **Pipelines futuros**: pipelines de questões já previstos no backlog (#36–43) alimentam `questions.banca/ano` → base das "provas anteriores".

---

## 6. Impacto no planner (consumo futuro)

O `generateWeekPlan` (Grupo B/C) ganharia **um fator a mais**, sempre aditivo e neutro sem dados:

```
Grupo B:  acerto + volume + idle + tendência
Grupo C:  + bancaScore
Grupo D:  + editalWeight
```

- `editalWeight` por matéria = peso normalizado da `notice_subjects` do edital vigente do concurso alvo do usuário.
- Mesmo padrão do `bancaScore`: sem edital/`concurso_alvo` → fator neutro → **resultado idêntico ao Grupo C** (regressão por teste).
- O vínculo já existe (`study_subjects.name` → `knowledge_subjects.id` via `LinkResolverService`); o peso chega por essa chave.

**Escopo do usuário:** a partir de `profiles.concurso_alvo` (hoje texto livre) — na implementação D+, migrar para `profiles.contest_id` (FK) para o planner resolver o edital vigente. Decisão: manter `concurso_alvo` como fallback de texto até a UI de seleção de concurso existir.

---

## 7. Decisões arquiteturais

### 7.1 Fechadas

**D1 — Peso por edital × cargo — ✅ FECHADA (DD-020)**

Regras aprovadas:
- `notice_subjects`: `edital_id` (FK `editais`) · `knowledge_subject_id` · `position_id NULL` (peso geral) · `position_id` preenchido (peso específico do cargo).
- Peso específico do cargo **substitui** o geral (não soma).
- `weight NOT NULL`, faixa **0–100** (bruto; normalização como share **somente no consumo**).
- `UNIQUE (edital_id, position_id, knowledge_subject_id)`.
- Ausência de linha = matéria não prevista naquele escopo.
- Sem posição do usuário → usar apenas o peso geral.
- `notice_topics` → fase posterior.

**D2 — Escala e semântica do peso — ✅ FECHADA (DD-021)**

Regras aprovadas:
- `weight INTEGER NOT NULL`, domínio **0–100**.
- `0` é **explícito e distinto de ausência** (matéria declarada com peso zero).
- Ausência de `notice_subjects` = matéria **não declarada** naquele escopo.
- `share = weight / SUM(weight)` do escopo `(edital_id, position_id)` — **somente no consumo**.
- Soma zero → fator **neutro** (sem divisão por zero).
- `weight > 0` → participa do fator edital (share).
- `weight = 0` → peso de edital **zero**.
- Matéria **não listada** → fator de edital **neutro** (preserva desempenho e banca).
- **Nunca armazenar `share`**.

> Ex.: Edital X/Cargo Y — Português 20, Dir. Const. 30, Informática 0 → shares 0,40 / 0,60 / 0. Rac. Lógico não listado → **neutro** (não vira peso zero).

**D3 — Granularidade matéria × tópico — ✅ FECHADA (DD-022)**

Regras aprovadas:
- `notice_subjects` é a granularidade da **1ª versão**; `editalWeight` é por matéria.
- `notice_topics` será tabela **aditiva** (FK → `notice_subjects` + `knowledge_topic_id` + `weight`), sem alterar `notice_subjects`.
- Peso de tópico segue a semântica da DD-021; ausência de `notice_topics` não prejudica o modelo.
- **NÃO criar estrutura de tópico agora** (fase 2).

**D4 — Vínculo do usuário com concurso/cargo — ✅ FECHADA (DD-023)**

Regras aprovadas:
- `profiles.contest_id` (FK contests) nullable + `profiles.position_id` (FK positions) nullable.
- Posição escolhida **explicitamente** (não inferida); deve pertencer ao concurso selecionado; inconsistência → não aplica peso específico.
- `concurso_alvo` permanece como **legado/exibição**; o planner D+ usa só o relacionamento estruturado.
- Sem `user_contests` na V1.
- Edital deve ser **explicitamente vigente** (`is_current`/equivalente); **ambiguidade → fator neutro**, nunca escolha silenciosa por data.

**D5 — Origem dos dados — ✅ FECHADA (DD-024)**

Regras aprovadas:
- Fase 0: admin manual · Fase 1: IA assistida (gera **rascunho** p/ revisão) · Fase 2: ETL por banca.
- `is_current` definido **explicitamente pelo admin** (nunca automático por data).
- Origem **não altera o modelo relacional**.
- Planner consome somente edital **publicado + vigente**, independentemente da origem.

**D6 — Estratégia de migration — ✅ FECHADA (DD-025)**

Regras aprovadas:
- **SQL manual por domínio** como estratégia oficial (`database/contest/schema.sql` + `rls.sql` + `seeds.sql` + `functions.sql`).
- Aplicação via DIRECT_URL; scripts idempotentes e reexecutáveis.
- `profiles`: `ALTER TABLE ... IF NOT EXISTS`/guards.
- **Verificação read-only obrigatória antes da aplicação**.
- `contest.ts` espelha o schema (tipos/introspecção), **sem `drizzle:migrate`** e sem adoção de baseline Drizzle.

> ## ✅ **D1–D6 FECHADAS — Grupo D arquiteturalmente especificado.**
> Cadeia validada: `profiles.contest_id/position_id` → `contests` → edital **vigente** → `notice_subjects` (peso/share) → `editalWeight` no planner (neutro sem dados — regressão B/C preservada).

### 7.2 Em aberto

Nenhuma decisão em aberto — as 6 decisões (D1–D6) estão fechadas.

---

## 8. Riscos

- **Migration refeita**: mitigada pela decisão da seção 4 (relacional + JSON bruto + `position_id` flexível).
- **Conflito com `drizzle:migrate`**: tabelas Contest **não existem** → não haveria "already exists", mas o padrão seguro é SQL manual por domínio (como `database/study`, `database/knowledge`).
- **Peso sem fonte real**: sem ETL/admin, `notice_subjects` fica vazia → fator neutro (sem quebrar nada).
- **Multi-cargo**: adiar `position_subjects` só se o produto não tiver concurso multi-cargo na visão de 6 meses.

---

## 9. Próximos passos (fora desta fase)

1. Validar esta spec com stakeholders (decisões da seção 7).
2. **Fase 1 (D+):** schema Contest + `notice_subjects` + admin básico + fator `editalWeight` no planner (com regressão do Grupo C).
3. **Fase 2:** `positions`/`position_subjects`, `notice_topics`, `exam_phases`/`exams`, ingestão IA assistida.
4. **Fase 3:** ETL de editais e questões (backlog #36–43) + painel admin.

> **Checkpoint atual:** Grupo C `d80d5bd` permanece intacto. Nenhum código/banco foi alterado por esta especificação.
