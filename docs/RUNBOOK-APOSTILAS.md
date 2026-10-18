# Runbook operacional de ingestao e sync de apostilas

> Sequencia validada em engenharia (8 passos) para levar apostilas do acervo local
> ate o banco, com pre-voo de leitura antes do passo 1, backup previo, simulacao
> obrigatoria no passo 5 antes do primeiro `--apply --limit 1` e conferencia antes
> de ampliar.
> Este runbook **nao contem** valores de credencial. Ele descreve **quais** variaveis
> precisam existir, nunca o conteudo delas.
>
> Complementa `docs/GUIA-INGESTAO-APOSTILAS.md` (que explica *por que* cada
> restricao existe). Aqui esta *o que rodar, em que ordem*.

---

## Pre-requisitos (verificar antes do passo 1)

| Item | Origem da exigencia |
| --- | --- |
| `.env.local` presente na raiz do repositorio | passos 2 e 3 dependem dele |
| `DATABASE_URL` de **ambiente de teste**, nunca de producao | guard `assertNonProductionDatabaseUrl` aborta o `--apply` com `NON_PRODUCTION_DATABASE_REQUIRED` (codigo de saida 3) |
| `PROD_SUPABASE_PROJECT_REF` / `SAFE_TEST_DATABASE_REFS` configurados | `src/lib/db/env-guard.ts` usa isso para distinguir teste de producao |
| `STORAGE_BACKEND` definido (`local`, `r2` ou `supabase`) + credenciais do backend | o passo de upload do `--apply` falha sem isso |
| Material real e `--source DIR` (ou `APOSTILA_SOURCE_DIR`) apontando para ele | o CLI **nao** tem diretorio padrao: sem `--source` nem `APOSTILA_SOURCE_DIR` ele sai com codigo 2 antes de processar lote algum |
| `--actor-email` apontando para e-mail de professor/admin **existente** em `auth.users` | o documento nasce orfao se o usuario nao existir |

Formatos aceitos: `pdf`, `docx`, `txt`, `md`, `html`. Recusados: `doc`, `epub`,
`rtf`, `odt`, `ppt(x)`, `xls(x)` e todas as imagens. **Nao ha OCR**: PDF
escaneado passa no formato e falha na extracao.

---

## Pre-voo (so leitura, antes do passo 1)

Quatro verificacoes que nao escrevem em lugar nenhum e que dizem, com
antecedencia, se os passos 3, 4, 6 e 8 vao rodar. Ordem: destino do banco,
origem do lote, camada de texto dos PDFs, ator do apply.

### 1. Destino do banco — o gate

```bash
npx tsx --conditions=react-server scripts/db-guard.ts -- node -p "'ok'"
```

O `db-guard` imprime primeiro a avaliacao (`db-cli-safety target=... host=...
ref=... prodRef=... safe=... reason=...`) e so depois executa o comando apos o
`--`. Usar `node -p` como alvo torna a prova inofensiva: se o guard deixar
passar, nao acontece nada alem de um `ok` no stdout.

- `safe=true` — os quatro passos de escrita podem rodar.
- `safe=false` e `[db-guard] BLOCKED NON_PRODUCTION_DATABASE_REQUIRED` (saida 3)
  — **parar aqui**. Passos 3, 4, 6 e 8 abortam exatamente pelo mesmo motivo, e o
  passo 5 passa a ser o unico util (ele nem abre conexao).

O isolamento exige **as duas** condicoes em simultaneo: `DATABASE_URL` com
project ref distinto do de producao **e** esse ref listado em
`SAFE_TEST_DATABASE_REFS`. Nao ha atalho: `env-guard.ts` compara o ref com
`PROD_SUPABASE_PROJECT_REF` *antes* de consultar a allowlist, entao listas que
incluam o ref de producao continuam `safe=false` com o motivo "mesmo projeto
Supabase da producao". A unica prova aceita e a comparacao de ref — o nome do
banco nao libera escrita, nem para libertar nem para bloquear.

### 2. Origem do lote

```powershell
$p = 'H:\Meu Drive\plataforma de estudo'   # ou 'materiais'
$f = @(Get-ChildItem $p -Recurse -File)
$m = @($f | Where-Object Extension -eq '.pdf' | Sort-Object Length -Descending)
'extensoes: ' + (($f | Group-Object Extension | Sort-Object Count -Descending |
  ForEach-Object { $_.Name + ':' + $_.Count }) -join '  ')
'{0} PDF, {1} MB, maior {2} MB, acima de 25 MB: {3}' -f $m.Count,
  [Math]::Round(($m | Measure-Object Length -Sum).Sum / 1MB, 1),
  [Math]::Round($m[0].Length / 1MB, 2), @($m | Where-Object Length -gt 25MB).Count
'placeholders no Drive: ' + @($f | Where-Object { $_.Attributes -match 'ReparsePoint' }).Count
```

Leitura correta destes numeros:

- extensao fora de `pdf|docx|txt|md|html` vira `skipped_unsupported` — nao e
  erro, e o lote que sobra; o formato e aceito ou recusado por extensao, antes
  de qualquer leitura de conteudo;
- `walk()` e recursivo, logo `--source` pode apontar para a arvore do Drive sem
  copiar nada; `placeholders` deve ser `0`, porque arquivo ainda nao hidratado e
  baixado sob demanda e um cliente em pausa rebenta no meio do lote — fixar
  "sempre neste dispositivo" ou copiar para `materiais/`;
- PDF encostado ao teto de 25 MB passa com margem minima; dar-lhe um `--limit 1`
  proprio no passo 6 para nao contaminar a leitura do resto do lote.

Medida real (2026-10-17) em `H:\Meu Drive\plataforma de estudo`: 28 arquivos em
5 subpastas — 20 PDF (99,1 MB, maior 24,85 MB, nenhum acima do teto) e 8 JSON
(esses 8 caem como `skipped_unsupported`), zero placeholders.

### 3. Extracao com camada de texto

O inventario acima decide **formato e tamanho**. Nao decide se o PDF tem camada
de texto, porque `provider.plan()` e chamado so com metadados — `fileName`,
`mimeType`, `sizeBytes`, `sha256`, `relativePath`, `allZeroContent`
(`scripts/ingest-apostilas.ts` L278-286). Um PDF escaneado sai como `pending` no
passo 5 e falha na extracao, durante o `--apply`. Para nao descobrir isso no meio
da escrita, corre-se o probe do repositorio, que usa o `pdf-parse` do proprio
repositorio e nao abre banco nem storage:

```bash
node scripts/probe-pdf-text.mjs "H:\Meu Drive\plataforma de estudo"
```

```text
COM_TEXTO | pg=53 | chars=76973 | mb=2.11 | cbm-rj\matematica\curso-384822-aula-00-0b26-completo.pdf
...
RESUMO origem=H:\Meu Drive\plataforma de estudo pdf=20 sem_texto=0 chars_totais=5126505 limiar=200
```

- `sem_texto=0` e o unico resultado com saida 0; `SEM_TEXTO` (linha com texto
  abaixo de `--min-chars`, padrao 200) da saida 1 e resolve-se **fora** do lote,
  porque nao ha OCR;
- origem inexistente da saida 2 — o probe nunca cria diretorio;
- `Warning: TT: undefined function` no stderr e do pdf.js (fontes TrueType nao
  embutidas), nao e falha;
- limite do metodo: quem extrai no `--apply` e o MCP `apostila-mcp`, que pode
  usar outro parser. Texto presente aqui e forte indicio, nao a mesma byte-code
  do provedor — a prova definitiva continua sendo o passo 6 com `--limit 1`.

Medida real (2026-10-17) nessa origem: 20 PDF, zero sem texto, 5.126.505
caracteres, densidade de 1.042 a 2.270 chars por pagina. O mais pesado do corpus
e `curso-384118-aula-14-somente-em-pdf-089a-completo.pdf`: 862 paginas,
1.912.846 caracteres (37% de todo o texto) em 24,85 MB — motivo a mais para o
`--limit 1` proprio do passo 6.

### 4. Ator do apply

`--actor-email` tem de existir em `auth.users` **e** passar em
`AdminGuardService.isProfessorOrAdmin`; `requireActor` corre antes de qualquer
upload e falha com "Ator sem registro em auth.users" ou "E-mail sem privilegio de
upload". Num banco de teste recem-criado isso falha sempre: semear com
`scripts/create-mp-test-user.ts` / `scripts/seed-superadmins.mjs` (ou pela UI)
antes de chegar ao passo 6.

---

## Passo 1 — Backup do `.env.local`

Copiar o arquivo antes de qualquer mudanca. E o unico ponto de reversao de todo
este runbook: os passos 3, 4, 6 e 8 alteram estado de banco e de storage (o
passo 5 grava apenas artefatos de planejamento no workspace), e nao ha rollback
automatico para o acervo.

```bash
cp .env.local .env.local.bak-$(date +%Y%m%d-%H%M%S)
```

Se o backup nao existir, **parar**. Nao seguir para o passo 2.

## Passo 2 — Apontar a `DATABASE_URL` de teste

Editar `.env.local` e trocar `DATABASE_URL` pela conexao do ambiente de teste.
Nunca a de producao.

```bash
DATABASE_URL="postgresql://<user>:<senha>@<host-ref-de-teste>:5432/postgres"
```

Conferir antes de seguir:

- o host **nao** e o `project_ref` de producao;
- `PROD_SUPABASE_PROJECT_REF` (quando definido) aponta para o host de producao, e
  nao para o que acabou de ser colado;
- se `SAFE_TEST_DATABASE_REFS` existir, o ref usado esta na lista.

Qualquer duvida aqui invalida todo o resto: o `--apply` e o `db:seed` escrevem
no banco que estiver em `DATABASE_URL`.

## Passo 3 — Schema no banco de teste (via guard)

Via npm, que ja passa por `scripts/db-guard.ts` (preferida; respeita o journal
de migracoes em `drizzle/`):

```bash
npm run db:migrate
```

Via drizzle-kit direto, quando for preciso alinhar o schema sem o journal:

```bash
node --env-file=.env.local node_modules/drizzle-kit/bin.cjs push
```

Atencao com a flag: `--env-file` e opcao do **node**, nao do drizzle-kit. Na
forma `npx drizzle-kit push --env-file=.env.local` ela chega ao drizzle-kit e e
ignorada. O que protege este passo e o `drizzle.config.ts`, que importa o
env-guard: `evaluateDatabaseSafety()` chama `ensureProjectEnv()` (que carrega o
`.env.local` via `@next/env`) e so depois corre
`assertNonProductionDatabaseUrl()`. Em destino que nao seja comprovadamente de
teste, o `push` aborta com `NON_PRODUCTION_DATABASE_REQUIRED` antes de abrir
conexao — a seguranca vem do guard, nao da flag. Esse passo cria tabelas,
indices e constraints do schema.

Se o push pedir confirmacao interativa para operacao destrutiva, a resposta
correta e **nao**: revisar o diff proposto antes. destructive significa perda de
dados, nao apenas criacao de tabela.

## Passo 4 — `npm run db:seed`

```bash
npm run db:seed
```

Rode **depois** do passo 3 e nunca antes: o seed executa `sql/seed.sql` via
`supabase db execute`, que falha se as tabelas ainda nao existem.

O comando nao chama o drizzle-kit — ele passa por `scripts/db-guard.ts`, que
aplica o mesmo guard `NON_PRODUCTION_DATABASE_REQUIRED`. Logo a `DATABASE_URL`
do passo 2 precisa estar correta aqui tambem.

Popula o catalogo minimo (planos, knowledge_subjects, e o que mais o seed
requer). Sem o seed, o `--apply` cria documento sem materia — a materia do
documento precisa existir em `knowledge_subjects` **antes** da ingestao, e nao ha
criacao automatica.

## Passo 5 — Simulacao com `--dry-run`

```bash
npm run ingest:apostilas -- --source "materiais" --dry-run
```

Primeira leitura do lote com **nenhuma escrita em banco, storage ou R2**. E o
passo que mostra o que o `--apply` faria antes de qualquer efeito. O modo seco e
tambem o padrao do CLI (omiter `--apply` ja simula), e `--dry-run` alem disso
zera `--stage` e `--sync` — por isso ele e escrito explicito aqui, como trava.
O que o passo grava e somente o plano de trabalho no workspace:
`.apostilas-work/manifest/apostilas.json` e
`.apostilas-work/reports/apostilas.md` (trocar por `--workspace DIR` ou
`APOSTILA_WORK_DIR`). O guard de banco so e chamado no caminho do `--apply`,
entao esta etapa roda mesmo sem `DATABASE_URL` de teste configurada.

O que conferir na saida:

- o lote foi montado a partir de `--source`, com o numero de arquivos esperado;
  `encontrados=0` significa acervo vazio na origem — nao ha o que aplicar;
- o modo impresso e `dry-run (padrao)`;
- `reports/apostilas.md` e `manifest/apostilas.json` listam as acoes propostas
  (`pending`, `skipped_duplicate`, `skipped_unsupported`, `skipped_invalid`);
- as linhas de projecao do apply estao coerentes: `pendentes para o apply`,
  `persistiriam com este limite` e `bytes dos pendentes` dizem quantos
  documentos e quantos bytes entrariam com o `--limit` do passo 6;
- nenhum arquivo aparece com classificacao inesperada.

Saida real de um lote em acervo ainda sem arquivos (repo `<repo>`):

```text
[cli] provedor MCP: apostila-mcp v1.1.0
[cli] origem: <repo>\materiais
[cli] modo: dry-run (padrao)
[cli] encontrados=0 suportados=0 invalidos=0 nao_suportados=0 duplicados=0 variantes=0
[cli] manifest e report gravados em <repo>\.apostilas-work
[cli] dry-run: nenhuma escrita em banco, storage ou R2.
```

Codigo de saida do CLI: `0` ok, `2` sem `--source` nem `APOSTILA_SOURCE_DIR`,
`3` `NON_PRODUCTION_DATABASE_REQUIRED` (so nos modos de escrita), `4` erro de
MCP, `1` demais falhas.

Se o lote vier vazio, ou com tudo em `skipped_*`, **parar** aqui: o problema e
de origem de material ou de formato, e rodar `--apply` adiante apenas repete o
erro em escala maior. Corrigir a origem e repetir este passo.

## Passo 6 — Ingestao com `--apply`, `--actor-email` e `--limit 1`

```bash
npm run ingest:apostilas -- --source "materiais" --apply --actor-email "<email-professor-ou-admin>" --limit 1
```

Pontos que mudam o resultado:

- **A flag e `--actor-email`, nao `--usuario`.** O nome importa: `--usuario` nao
  existe no parser e aborta com erro de opcao desconhecida, sem escrever nada.
- **`--actor-email` vai entre aspas.** O valor e um e-mail com caractere `@` e ponto;
  sem aspas o shell faz split em varios argumentos e o comando falha com erro
  de flag desconhecida ou ingere com `userId` vazio, o que cria documento sem
  vinculo de autor. O e-mail precisa existir em `auth.users`: o CLI consulta a
  tabela e aborta se nao achar.
- **`--limit 1` e intencional nesta rodada.** Limita a escrita a um unico
  documento. E o unico jeito de validar schema, extracao e chunking sem sujar
  o acervo de teste com centenas de linhas possivelmente erradas.
- Se faltar `DATABASE_URL` valida, o comando **para antes de qualquer escrita**
  (`[cli] BLOCKED NON_PRODUCTION_DATABASE_REQUIRED`, saida 3). Isso e o guard
  funcionando, nao um bug.
- **`--apply`, `--stage`, `--sync` e `--reprocess` sao mutuamente exclusivos.**
  `--stage` so grava bytes no storage e enfileira (nao exige `--actor-email` nem
  banco); `--apply` sobe o ciclo completo ate o banco; `--sync` consome a fila e
  **tambem** exige banco de teste e `--actor-email`; `--reprocess <uuid>` refaz
  extracao+transform+chunks de um documento ja ingerido, lendo os bytes do storage
  (exige banco de teste, nao exige `--source`). `--dry-run` zera os quatro.

## Passo 6b — Conferir a transformacao editorial

O pipeline aplica `sanitize-only` por padrao entre a extracao e o chunking: redige
PII do aluno e normaliza fases/caixas, **sem** tocar autoria.

```bash
npm run ingest:apostilas -- --source "materiais" --apply --actor-email "<email>" --limit 1
# depois:
Get-Content ".apostilas-work\reports\<documentId>.transform.json"
```

O que tem de estar certo no JSON:

- `modo_usado`: `sanitize-only` (ou o modo pedido, se `APOSTILA_TRANSFORM_MODE`
  estava setado); `modo_pedido` diferente de `modo_usado` significa fallback;
- `fallback_ativado` + `fallback_motivo`: se a IA foi pedida e reprovou nos
  portoes, o documento foi indexado pelo caminho offline. Isso **nao** e erro de
  ingestao, mas nao pode virar rotina silenciosa;
- `pii_removidos` e `pii_por_tipo`: contagem. O valor removido nunca aparece aqui;
- `procedencia_preservada` e o texto real no banco: nome da plataforma,
  assinatura do professor e URL **continuam no conteudo indexado**. Se sumiram, a
  regra foi violada e o lote deve ser reprocessado, nao aceito;
- `regras_fonte`: `arquivo` quando as regras vieram de
  `src/lib/knowledge/config/apostila-rules.md`. `compilado` quer dizer que o
  arquivo nao foi lido (deploy empacotado sem `APOSTILA_RULES_PATH`) e o lote
  rodou com a regra embutida;
- `fronteiras_pagina`: `preservadas` no modo offline. `descartadas` aparece quando
  um modo com IA reestruturou o documento inteiro — os chunks nesse caso perdem a
  citacao de pagina, e e preciso saber disso antes de confiar na fonte.

Sem edicao nenhuma, para comparar: `--no-transform` (equivale a
`APOSTILA_TRANSFORM_DISABLED=1`).

## Passo 7 — Conferir o documento no banco

Antes de ampliar, verificar o resultado do passo 6:

- o documento existe e o `user_id` corresponde ao `--actor-email` usado;
- `classification`/`reason` do arquivo estao como esperado;
- ha chunks gerados e eles tem texto nao vazio (extrair **ou** Embedding nao
  configurados deixam o documento em `chunked` sem embeddings — comportamento
  degradado aceitavel, mas precisa ser reconhecido como tal);
- o arquivo foi gravado no backend de storage configurado no passo 2;
- `documents.metadata` carimba `mcp_provider_id`, `processing_version` e
  `transform_report` (o passo 6b acima explica o que ler dentro dele);
- `reports/apostilas.md` e `manifest/apostilas.json` mostram a acao esperada
  (`pending` -> aplicado; `skipped_duplicate`, `skipped_unsupported`,
  `skipped_invalid` nao escrevem nada).

Se **qualquer** item estiver errado: **nao seguir para o passo 8**. Corrigir e
repetir a partir do passo 6 com `--limit 1`.

## Passo 8 — Ampliar o limite e commitar

```bash
npm run ingest:apostilas -- --source "materiais" --apply --actor-email "<email-professor-ou-admin>" --limit 50
```

Ampliar em lotes pequenos e graduais, nao de uma vez: repetir `--limit 50` ate
esgotar o acervo e conferir o relatorio entre lotes. O CLI e idempotente por
sha256, entao reexecutar nao duplica documento, mas o custo de embedding e
real.

Ao final:

```bash
git status
git add -A
git commit -m "chore(acervo): registrar ingestao de apostilas"
```

O `git add -A` acima e seguro por construcao: os tres diretorios acima estao no
`.gitignore`, entao nenhum byte de apostila entra no commit por acidente. Ainda
assim, confira `git status` antes de commitar — e use `git add` nomeado quando a
intencao for commitar apenas um caminho especifico.

O commit registra apenas mudanca de config/schema/seed, nunca a apostila nem o
relatorio de ingestao com metadados de acervo.

---

## Notas de operacao

1. **Ordem e sacrosancta.** Backup -> env -> push -> seed -> dry-run -> apply.
   Pular o passo 1 torna o runbook irreversivel; pular o passo 4 cria documentos
   sem materia; pular o passo 5 troca uma verificacao de um segundo por uma
   descoberta no meio da escrita.
2. **Simular antes de escrever.** O passo 5 custa segundos, roda sem banco e nao
   escreve em banco nem storage — apenas nos artefatos do workspace. E o unico
   lugar onde o lote inteiro e visivel antes do primeiro commit de dados, e por
   isso ele precede o `--apply --limit 1` do passo 6.
3. **Um documento por vez, na primeira rodada.** `--limit 1` seguido de
   `--limit N` e o unico caminho que valida o caminho feliz sem desperdicar
   volume.
4. **`--actor-email` sempre entre aspas.** E-mail nao quotado quebra o parse de
   argumentos. E nao troque por `--usuario`: a flag nao existe.
5. **`--env-file` e flag do node, nao do drizzle-kit.** `npx drizzle-kit push
   --env-file=.env.local` nao surte efeito: a flag chega ao drizzle-kit e e
   ignorada. Use `npm run db:migrate` (passa pelo `scripts/db-guard.ts`) ou
   `node --env-file=.env.local node_modules/drizzle-kit/bin.cjs push`. O que
   impede aplicar schema no banco errado e o guard do `drizzle.config.ts`, que
   carrega o `.env.local` e aborta em destino nao comprovadamente de teste.
6. **Guardas sao comportamento esperado.** `NON_PRODUCTION_DATABASE_REQUIRED`,
   modos de escrita exclusivos e ausencia de `--actor-email` devem ser tratadas como
   falha de pre-condicao, nunca contornadas com flag de forca.
7. **Sem OCR.** PDF escaneado e invalido por extracao mesmo sendo aceito por
   formato; nao adianta tentar reprocessar o mesmo arquivo.
8. **Limite de 25 MB por arquivo** vale para qualquer plano. Acima disso a
   ingestao falha no upload.
9. **Material e staging fora do git.** `materiais/`, `.apostilas-work/` e
   `.storage/` no `.gitignore` por desenho; a arvore de pastas serve para
   organizacao humana, o escopo efetivo do corpus (cargo/edital) existe apenas
   na via UI/API, nao no CLI.
10. **Rollback.** Nao ha comando de reversao. O unico caminho e restaurar
   `.env.local` do passo 1 e trabalhar em um banco de teste descartavel — mais um
   motivo para o passo 6 rodar com `--limit 1`.

---

## Sequencia resumida

```bash
# 0 (pre-vo): o gate do guard — tem de imprimir safe=true antes de qualquer escrita
npx tsx --conditions=react-server scripts/db-guard.ts -- node -p "'ok'"
node scripts/probe-pdf-text.mjs "materiais"        # 0 (pre-vo): tem de sair sem_texto=0
cp .env.local .env.local.bak-$(date +%Y%m%d-%H%M%S)                # 1
# 2: editar DATABASE_URL no .env.local para o ambiente de teste
npm run db:migrate                                                  # 3
npm run db:seed                                                     # 4
npm run ingest:apostilas -- --source "materiais" --dry-run          # 5  (so artefatos no workspace; exit 0)
npm run ingest:apostilas -- --source "materiais" --apply --actor-email "<email>" --limit 1   # 6
# 7: conferir documento, chunks e relatorio no banco
npm run ingest:apostilas -- --source "materiais" --apply --actor-email "<email>" --limit 50  # 8
git add -A && git commit -m "chore(acervo): registrar ingestao de apostilas"   # 8 (commit)
```

Os passos 5, 6 e 8 aceitam `--source "H:\Meu Drive\<arvore>"` no lugar de
`materiais`: `walk()` e recursivo e a origem so e aberta para leitura. O que
decide se o lote pode avancar e o pre-voo acima, nao a presenca dos arquivos.

Alternativa via fila, quando os bytes ja estao no storage: trocar `--apply` por
`--sync` no passo 6, sem `--source`. `--sync` consome as entradas `staged` e
repete so a extracao das `recorded`.
