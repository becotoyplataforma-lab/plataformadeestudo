# Banco de teste isolado: estado e procedimento minimo

> Estado: procedimento **documentado e nao executado**. Nesta rodada nenhuma
> conexao, migration, seed, DDL, DML, container ou projeto Supabase foi criado
> ou alterado. A ausencia de banco de teste e o motivo real pelo qual as suites
> de integracao continuam pulando.
>
> **FASE 1 (2026-10-11):** o gate perigoso de `plans.contract.test.ts` foi
> blindado e tem teste proprio. A decisao de projeto sobre banco isolado continua
> a mesma: sem destino comprovadamente de teste, nada roda e nada escreve.

## 1. Por que isto e um bloqueio de projeto (nao de codigo)

Desenvolvimento e producao apontam para o **mesmo** projeto Supabase enquanto nao
houver staging isolado. Toda escrita passa por `src/lib/db/env-guard.ts`:

- `assertNonProductionDatabaseUrl(target, url)` lanca
  `NON_PRODUCTION_DATABASE_REQUIRED` quando o destino nao e comprovadamente
  banco de teste (host localhost, ref em `SAFE_TEST_DATABASE_REFS`, ou nome de
  banco claramente de teste). `NODE_ENV=production` bloqueia fora do harness de
  teste; ref igual ao de producao bloqueia sempre.
- `isNonProductionDatabaseUrl(url)` e o gate booleano usado por
  `src/integration/helpers.ts` (`hasDb`) e pelos testes de integracao.
- `resolveDatabaseTestGate(target, url?, overrides?)` e o gate de suite: devolve
  `enabled` (para `describe.skipIf`), `reason` e `summary` log-safe. Desde a FASE 1 o
  contrato de planos usa esse gate e revalida com `assertNonProductionDatabaseUrl` no
  `beforeAll`.
- `describeDatabaseSafety(target)` loga sem senha, token, service-role nem string
  de conexao completa.
- Os comandos filhos que nao passam pelo guard Node (`supabase`, `drizzle-kit`)
  sao envolvidos por `scripts/db-guard.ts` + `src/lib/db/cli-db-guard.ts`, que
  recusa antes de iniciar o processo filho.

## 2. Estado verificado em 2026-10-03 (recolhido de novo em 2026-10-11)
| Checagem | Resultado real |
| --- | --- |
| `DATABASE_URL` / `DIRECT_URL` | presentes em `.env` e `.env.production`; mesma origem de producao (valores nao lidos nem copiados) |
| `SUPABASE_DB_URL` | ausente |
| `PROD_SUPABASE_PROJECT_REF` | ausente (so comentada em `.env.example`) |
| `SAFE_TEST_DATABASE_REFS` | ausente (so comentada em `.env.example`) |
| `supabase/config.toml` / diretorio `supabase/` | nao existe no repositorio |
| `docker-compose*.yml` | nao existe no repositorio |
| Portas locais 5432 / 5433 / 6432 | nada escutando |
| `psql` | ausente |
| CLI `supabase` (global ou `node_modules/supabase`) | **ausente** - `npm run db:push` e `npm run db:seed` falhariam mesmo com o guard destravado |
| `drizzle-kit` | instalado (`node_modules/.bin/drizzle-kit.cmd`) |
| `docker` CLI | instalado (nenhum container foi criado nesta rodada) |
| `drizzle.config.ts` | `url: process.env.DATABASE_URL!` - ou seja, migration usaria a URL de producao |
| Migracoes aplicaveis | 9 arquivos SQL em `drizzle/`: `0000_baseline.sql` ... `0008_reconcile_production_drift.sql` |
| Suites de integracao | 10 arquivos em `src/integration/` (25 testes) com `describe.skipIf(!hasDb)` + `src/integration/helpers.ts` - todos pulando |
| Suite de contrato de planos | `src/lib/billing/repositories/__tests__/plans.contract.test.ts` (4 testes) - pula por gate fail-closed desde a FASE 1 |
| Suite do gate de suite | `src/lib/db/__tests__/database-test-gate.test.ts` (15 testes) - roda sempre, nao precisa de banco |
| Testes em `src/` | 138 arquivos: 127 passando + 11 pulando; 1.484 testes passando, 6 esperado-falhar, 29 pulados, exit 0 |

Consequencia imediata: `npm run db:migrate` hoje esta correto em ser recusado, e
`db:push`/`db:seed` teriam dois problemas (guard + CLI ausente).

## 3. Gate da suite de planos: risco encontrado e blindado (FASE 1)

**Risco (2026-10-03):** `plans.contract.test.ts` usava
`const hasDb = Boolean(process.env.DATABASE_URL)` - gate de **presenca**, nao de
seguranca. A suite so pulava por acidente: `vitest.config.mts` nao carrega `.env`
(sem `dotenv`, sem `loadEnv`), entao `DATABASE_URL` chegava vazia ao Vitest. Basta
exportar a URL no shell, ou rodar por um runner que herda o ambiente do Next, para os
4 testes lerem o banco de producao (SELECT via `PlanRepository.listActive()`).

**Correcao (FASE 1, 2026-10-11):**
- `src/lib/db/env-guard.ts` ganhou `resolveDatabaseTestGate(target, rawUrl?, overrides?)`:
  devolve `enabled`, `reason` e `summary`, tudo calculado pelo mesmo
  `evaluateDatabaseSafety` que sustenta o `hasDb` da integracao.
- `isNonProductionDatabaseUrl` e `describeDatabaseSafety` passaram a aceitar `rawUrl` e
  `overrides` opcionais; as chamadas antigas (`src/integration/helpers.ts`,
  `scripts/db-guard.ts`, `tests/e2e/global-setup.ts`, CLI de ingestao) seguem iguais.
- O teste de contrato usa `describe.skipIf(!gate.enabled)` e revalida no `beforeAll` com
  `assertNonProductionDatabaseUrl("plans-contract")`: se o ambiente mudar entre a coleta
  e a execucao, o primeiro SELECT nao acontece - lanca `NON_PRODUCTION_DATABASE_REQUIRED`.
- O skip imprime uma justificativa log-safe:
  `db-safety target=plans-contract nodeEnv=test origin=vitest host=... database=postgres
  ref=... prodRef=... safe=false reason=mesmo projeto Supabase da producao`.

Detalhe que explica por que o gate de presenca era perigoso: o guard chama
`ensureProjectEnv()`, que le o `.env` do projeto quando o processo nao traz
`DATABASE_URL` (comportamento pensado para CLI). Em Vitest isso significa que a
decisao passou a ser sobre o **destino real**, nao sobre a ausencia da variavel. E
leitura de arquivo: nenhuma conexao e aberta para decidir o skip.

**Prova executada, sem banco:**
- `npx vitest run src/lib/db/__tests__/database-test-gate.test.ts
  src/lib/db/__tests__/env-guard.test.ts
  src/lib/billing/repositories/__tests__/plans.contract.test.ts` -> exit 0: 78 testes
  passando (15 do gate novo + 63 do guard) e 4 pulados.
- Com `DATABASE_URL` de producao **sintetica** exportada no shell (ref `a` x 20, sem
  credencial real): o `Boolean()` antigo liberaria a suite; o gate novo deixou os 4
  testes pulados e nenhuma conexao foi tentada.

**O que os 15 testes cobrem:** URL ausente, URL em branco, URL invalida, localhost
liberado, ref aprovado em `SAFE_TEST_DATABASE_REFS`, conexao direta e pooler de producao
bloqueadas, ref fora da allowlist, `NODE_ENV=production` fora do harness, ausencia de
credencial no resumo, acordo entre `isNonProductionDatabaseUrl` e
`resolveDatabaseTestGate`, e a regressao explicita do gate antigo.

**Tripwire e limite da prova:** o teste mocka `@/lib/db/drizzle` com um proxy que lanca
ao menor acesso; se alguem ligar o gate a uma query, a suite falha em vez de conectar.
Isso comprova a **decisao** do gate. Nao comprova sessao de Postgres, RLS, FTS nem
cotas: essas provas so acontecem quando o banco isolado das secoes 4 ou 5 existir.

## 4. Opcao A - PostgreSQL local com pgvector (mais rapido, custo zero)

Pre-requisitos: Docker instalado (ja esta) e permissao explicita do operador.
Comandos abaixo **nao foram executados** nesta rodada.

```powershell
# 1. Instancia descartavel em porta nao padrao, sem porta exposta ao host
$pg = 'concursoai-test-pg'
$pw = 'troque-esta-senha'
docker run -d --name $pg -e POSTGRES_PASSWORD=$pw -p 127.0.0.1:5433:5433 ankane/pgvector:latest
docker exec $pg createdb concursoai_test

# 2. URL local (host localhost ja e comprovado como nao-producao pelo guard)
$env:DATABASE_URL = 'postgresql://postgres:' + $pw + '@localhost:5433/concursoai_test'
$env:DIRECT_URL  = $env:DATABASE_URL
$env:SUPABASE_DB_URL = $env:DATABASE_URL

# 3. Schema + verificacoes
npm run db:migrate
npm run db:check
npm run test
```

Observacoes:

- `ankane/pgvector` e a imagem usual para `vector(1024)` + indice HNSW; se a
  equipe preferir a imagem oficial, o extension `vector` precisa ser criado antes
  das migrations que o usam (`0000_baseline.sql` ja assume pgvector).
- A coluna `document_chunks.fts_vector` e `GENERATED ALWAYS AS
  (to_tsvector('portuguese', content))` com indice GIN
  (`src/db/schema/knowledge.ts:189-193,207`, espelhado em
  `database/knowledge/schema.sql:85`) - o dicionario `portuguese` existe no
  PostgreSQL standard, entao FTS funciona em banco local sem servico externo.
- O schema de autenticacao (`auth.users`, `auth.uid()`) e do Supabase. Em Postgres
  puro as policies que dependem de `auth.uid()` nao tem como serem exercitadas.
  Para teste real de RLS, use a Opcao B.
## 5. Opcao B - projeto Supabase de staging (a unica que exercita RLS)

E a opcao correta para validar `auth.uid()`, policies e funcoes `SECURITY DEFINER`.
Pre-requisito que ainda nao existe: o CLI `supabase` **nao esta instalado** e a
instalacao de dependencias nao foi autorizada nesta rodada.

```powershell
# 1. (humano, fora do repo) criar projeto Supabase exclusivo de teste
#    - nao reaproveitar credenciais do projeto de producao
#    - guardar apenas o project ref de staging
npm install --no-save supabase            # exige autorizacao explicita
npx supabase login
npx supabase link --project-ref [REF-STAGING]

# 2. Variaveis de seguranca do guard (nomes; valores ficam no cofre)
$env:PROD_SUPABASE_PROJECT_REF = '[REF-PRODUCAO]'   # ref proibido sempre
$env:SAFE_TEST_DATABASE_REFS   = '[REF-STAGING]'    # allowlist de teste
$env:DATABASE_URL = '[pooler ou direta do staging]'
$env:DIRECT_URL   = '[direta do staging]'
$env:SUPABASE_DB_URL = $env:DIRECT_URL
$env:NEXT_PUBLIC_SUPABASE_URL = 'https://[REF-STAGING].supabase.co'

# 3. Schema + verificacoes
npm run db:migrate
npm run db:check
```

```powershell
# 4. RLS nao esta nas migrations do Drizzle: aplicar manualmente, na ordem de
#    docs/11-DEPLOYMENT.md:97,100
#    database/identity/rls.sql, knowledge/rls.sql, ai/rls.sql, study/rls.sql,
#    billing/rls.sql, analytics/rls.sql, administration/rls.sql, contest/rls.sql
npx vitest run src/integration
```

Ponto que decide o bloqueio: `src/lib/db/cli-db-guard.ts` combina a URL do
ambiente com o **project ref lido de `supabase link`**. Por isso o `link` tem que
apontar para staging; se apontar para producao, `db:push` e `db:seed` seguem
recusados (e devem ficar recusados).

## 6. Regras inegociaveis do guard

- Um banco e considerado de teste quando o host e `localhost`, ou o ref esta em
  `SAFE_TEST_DATABASE_REFS`, ou o nome do banco e claramente de teste.
- Ref igual ao de producao bloqueia **sempre**, mesmo com allowlist.
- `NODE_ENV=production` bloqueia qualquer escrita fora do harness de teste.
- `describeDatabaseSafety(target)` loga o destino sem senha, token, service-role
  ou string de conexao completa — usar sempre que precisar logar estado de DB.
- Enquanto nao houver staging, `db:push`, `db:migrate`, `db:seed`, cleanup de E2E
  e `ingest:apostilas --apply` estao **bloqueados por decisao de projeto**, nao por
  defeito de codigo. Isso e o guard funcionando, nao uma falha.

## 7. Matriz do que fica destravado com banco isolado

| Checagem | Comando | Evidencia esperada | Status hoje |
| --- | --- | --- | --- |
| Migracoes aplicam do zero | `npm run db:migrate` | 9 SQL de `drizzle/` aplicados sem erro | nunca executado |
| Schema coerente | `npm run db:check` | sem divergencia schema x migracoes | nunca executado |
| RLS efetivamente ativa | leitura de `pg_class.relrowsecurity` + `pg_policies` | ~39 tabelas com RLS e ~80 policies presentes | sem ferramenta no repo (bloqueador B4 do checklist) |
| FTS em banco real | `npx vitest run src/integration/knowledge.integration.test.ts` | `chunks[0].ftsVector` preenchido e a busca por texto acha o chunk | pulando (sem DB) |
| Deducacao por SHA-256 | mesma suite | segundo upload do mesmo conteudo nao duplica | pulando |
| Cotas e `ai_usage` | `npx vitest run src/integration/ai.integration.test.ts` | incremento por usuario+dia respeita `public.plans` | pulando |
| Gate do teste de contratos | `npx vitest run src/lib/db/__tests__/database-test-gate.test.ts` | **roda sempre** (15 testes), nao precisa de banco: prova que URL ausente, invalida ou de producao desliga a suite | roda sempre (15 testes, exit 0 em 2026-10-11) |
| Planos x limites | `npx vitest run src/lib/billing/repositories/__tests__/plans.contract.test.ts` | free/pro/intensivo com os limites do contrato | pulando |
| Fluxo E2E de negocio | `npx vitest run src/integration/e2e-flows.integration.test.ts` | cadastro → upload → estudo → quota | pulando |
| Ingestao em lote real | `npm run ingest:apostilas -- --source [pasta] --workspace [temp] --apply --limit 1 --actor-email [professor]` | 1 documento com chunks e `metadata.mcp` | nao executado (sem DB, sem storage, sem material) |

## 8. O que NAO foi feito nesta rodada (para ninguem deduzir o contrario)

- Nenhuma conexao de banco (nem leitura), nenhuma migration, nenhum seed, nenhum
  DDL/DML, nenhuma consulta em `pg_*`.
- Nenhum container criado ou removido; nenhuma imagem puxada; `docker` apenas
  confirmado como instalado.
- Nenhum projeto Supabase criado, nenhum `supabase link`, nenhuma instalacao de
  dependencia.
- Nenhum `.env` alterado: tudo que aparece aqui sao **nomes** de variavel; os
  refs e URLs de producao continuam sem inspecao.
- A FASE 1 (2026-10-11) mudou codigo de guard e de teste: `env-guard.ts`,
  `plans.contract.test.ts` e o novo `database-test-gate.test.ts`. Nem migration, nem seed,
  nem conexao, nem `.env` foram tocados.
- As duas opcoes acima sao procedimentos propostos, ainda nao validados.