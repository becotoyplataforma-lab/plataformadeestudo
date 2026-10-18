# Runbook operacional de ingestao e sync de apostilas

> Sequencia validada em engenharia (7 passos) para levar apostilas do acervo local
> ate o banco, com backup previo, unico por documento e conferencia antes de ampliar.
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
| Material real em `materiais/` (ou `APOSTILA_SOURCE_DIR`) | hoje `materiais/` so tem pastas, zero arquivos |
| `--usuario` apontando para e-mail de professor/admin **existente** em `auth.users` | o documento nasce orfao se o usuario nao existir |

Formatos aceitos: `pdf`, `docx`, `txt`, `md`, `html`. Recusados: `doc`, `epub`,
`rtf`, `odt`, `ppt(x)`, `xls(x)` e todas as imagens. **Nao ha OCR**: PDF
escaneado passa no formato e falha na extracao.

---

## Passo 1 — Backup do `.env.local`

Copiar o arquivo antes de qualquer mudanca. E o unico ponto de reversao de todo
este runbook: os passos 2 a 7 alteram estado de banco e de storage, e nao ha
rollback automatico para o acervo.

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

## Passo 3 — `drizzle-kit push` com `--env-file=.env.local`

```bash
npx drizzle-kit push --env-file=.env.local
```

A flag `--env-file=.env.local` e obrigatoria. Sem ela o drizzle-kit le o `.env`
(ou nada) e pode aplicar o schema no banco errado, ou falhar com erro de
variavel ausente. Esse passo cria tabelas, indices e constraints do schema.

Se o push pedir confirmacao interativa para operacao destrutiva, a resposta
correta e **nao**: revisar o diff proposto antes. destructive significa perda de
dados, nao apenas criacao de tabela.

## Passo 4 — `npm run db:seed`

```bash
npm run db:seed
```

Popula o catalogo minimo (planos, knowledge_subjects, e o que mais o seed
requer). Sem o seed, o `--apply` cria documento sem materia — a materia do
documento precisa existir em `knowledge_subjects` **antes** da ingestao, e nao ha
criacao automatica.

## Passo 5 — Ingestao com `--apply`, `--usuario` e `--limit 1`

```bash
npm run ingest:apostilas -- --apply --usuario "<email-professor-ou-admin>" --limit 1
```

Pontos que mudam o resultado:

- **`--usuario` vai entre aspas.** O valor e um e-mail com caractere `@` e ponto;
  sem aspas o shell faz split em varios argumentos e o comando falha com erro
  de flag desconhecida ou ingere com `userId` vazio, o que cria documento sem
  vinculo de autor.
- **`--limit 1` e intencional nesta rodada.** Limita a escrita a um unico
  documento. E o unico jeito de validar schema, extracao e chunking sem sujar
  o acervo de teste com centenas de linhas possivelmente erradas.
- Se faltar `DATABASE_URL` valida, o comando **para antes de qualquer escrita**
  (`[cli] BLOCKED NON_PRODUCTION_DATABASE_REQUIRED`, saida 3). Isso e o guard
  funcionando, nao um bug.
- `--apply` e `--stage` sao mutuamente exclusivos. `--stage` so grava bytes em
  storage local e enfileira; `--apply` sobe o ciclo completo ate o banco.

## Passo 6 — Conferir o documento no banco

Antes de ampliar, verificar o resultado do passo 5:

- o documento existe e o `user_id` corresponde ao `--usuario` usado;
- `classification`/`reason` do arquivo estao como esperado;
- ha chunks gerados e eles tem texto nao vazio (extrair **ou** Embedding nao
  configurados deixam o documento em `chunked` sem embeddings — comportamento
  degradado aceitavel, mas precisa ser reconhecido como tal);
- o arquivo foi gravado no backend de storage configurado no passo 2;
- `reports/apostilas.md` e `manifest/apostilas.json` mostram a acao esperada
  (`pending` -> aplicado; `skipped_duplicate`, `skipped_unsupported`,
  `skipped_invalid` nao escrevem nada).

Se **qualquer** item estiver errado: **nao seguir para o passo 7**. Corrigir e
repetir a partir do passo 5 com `--limit 1`.

## Passo 7 — Ampliar o limite e commitar

```bash
npm run ingest:apostilas -- --apply --usuario "<email-professor-ou-admin>" --limit 50
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

O repositorio **nao** guarda material: `materiais/`, `.apostilas-work/` e
`.storage/` estao no `.gitignore`. O commit registra apenas mudanca de
config/schema/seed, nunca a apostila nem o relatorio de ingestao com metadados
de acervo.

---

## Notas de operacao

1. **Ordem e sacrosancta.** Backup -> env -> push -> seed -> apply. Pular o
   passo 1 torna o runbook irreversivel; pular o passo 4 cria documentos sem
   materia.
2. **Um documento por vez, na primeira rodada.** `--limit 1` followed de
   `--limit N` e o unico caminho que valida o caminho feliz sem desperdicar
   volume.
3. **`--usuario` sempre entre aspas.** E-mail nao quotado quebra o parse de
   argumentos.
4. **`--env-file=.env.local` sempre explicito no drizzle-kit.** Confiar no
   `.env` implicito e o caminho mais curto para aplicar schema no banco errado.
5. **Guardas sao comportamento esperado.** `NON_PRODUCTION_DATABASE_REQUIRED`,
   modos de escrita exclusivos e ausencia de `--usuario` devem ser tratadas como
   falha de pre-condicao, nunca contornadas com flag de forca.
6. **Sem OCR.** PDF escaneado e invalido por extracao mesmo sendo aceito por
   formato; nao adianta tentar reprocessar o mesmo arquivo.
7. **Limite de 25 MB por arquivo** vale para qualquer plano. Acima disso a
   ingestao falha no upload.
8. **Material e staging fora do git.** `materiais/`, `.apostilas-work/` e
   `.storage/` no `.gitignore` por desenho; a arvore de pastas serve para
   organizacao humana, o escopo efetivo do corpus (cargo/edital) existe apenas
   na via UI/API, nao no CLI.
9. **Rollback.** Nao ha comando de reversao. O unico caminho e restaurar
   `.env.local` do passo 1 e trabalhar em um banco de teste descartavel — mais um
   motivo para o passo 5 rodar com `--limit 1`.

---

## Sequencia resumida

```bash
cp .env.local .env.local.bak-$(date +%Y%m%d-%H%M%S)          # 1
# 2: editar DATABASE_URL no .env.local para o ambiente de teste
npx drizzle-kit push --env-file=.env.local                    # 3
npm run db:seed                                              # 4
npm run ingest:apostilas -- --apply --usuario "<email>" --limit 1   # 5
# 6: conferir documento, chunks e relatorio no banco
npm run ingest:apostilas -- --apply --usuario "<email>" --limit 50  # 7
git add -A && git commit -m "chore(acervo): registrar ingestao de apostilas"  # 7
```
