# Guia de ingestao de apostilas

> Estado: referencia de preparo de acervo e execucao de dry-run. Escrito a partir
> de evidencia lida no repositorio em 2026-10-03. Nada neste arquivo autoriza
> escrita em banco, storage ou R2: `--apply`, migrations e seed continuam
> bloqueados enquanto nao existir banco de teste isolado
> (ver `docs/BANCO-TESTE-ISOLADO.md`).

## 1. Duas vias de ingestao (e o que cada uma resolve)

| Via | Entrada | Escopo de corpus | Servir para |
| --- | --- | --- | --- |
| UI/API (via oficial do piloto) | `POST /api/knowledge/upload`, lote em `POST /api/admin/apostilas/batch` | campos `subject_id`, `edital_id`, `position_id`, `mcp_provider_id`, `transformar` (`src/app/api/knowledge/upload/route.ts:85-97`; lote em `src/app/api/admin/apostilas/batch/route.ts:52-59`) | publicacao real de material amarrado a cargo/edital |
| CLI em lote | `npm run ingest:apostilas` | apenas `--subject NOME` (`scripts/ingest-apostilas.ts:68`); o caminho `--apply` chama `IngestionService.ingest({ userId, file, sourceType: "upload" })` **sem** `positionId` nem `editalId` (`scripts/ingest-apostilas.ts:411`) | triagem de acervo: plano por arquivo, duplicados, variantes, projecao de volume |

Limitacao verificada no codigo: o CLI **nao le cargo nem edital a partir da
arvore de diretorios**. A arvore e organizacao humana; o escopo efetivo do corpus
existe so na via UI/API. Por isso o piloto usa upload pela interface, e o CLI
fica como ferramenta de diagnostico de acervo.

Regras de gate da via UI/API (lidas em `src/app/api/knowledge/upload/route.ts`):

- Sessao obrigatoria: sem `session.user.id` devolve 401 (linhas 45-48).
- Upload e exclusivo de admin/professor (`PROFESSOR_EMAILS`): aluno recebe 403
  com `error: "FORBIDDEN"` (linhas 52-66).
- Rate limit por plano em uploads/hora: `free: 10`, `pro: 50`, `intensivo: 100`
  (linhas 34-40); estouro devolve 429 `RATE_LIMIT_EXCEEDED` (linhas 73-79).
  O contador e em memoria, portanto vale por instancia do processo.
- Escopo validado no backend por `validateDocumentScope`
  (`src/lib/knowledge/security/document-scope.ts`), importado na linha 30 do
  upload: o cliente nao escolhe `positionId`/`editalId` livremente.
- Tamanho maximo de arquivo: `MAX_FILE_SIZE_FREE = 25 MB`, aplicado sem
  distinção por plano (`src/lib/knowledge/services/ingestion.service.ts:51,168`).

## 2. Formatos aceitos e recusados

Fonte unica: `src/lib/knowledge/format-contract.ts` (lida pelo MCP, pelo
`IngestionService` e pelo extrator).

- Aceitos: `pdf`, `docx`, `txt`, `md`/`markdown`, `html`/`htm` (linhas 18-33).
- Recusados no plano (sem extrator; virariam texto lixo indexado): `doc`,
  `epub`, `rtf`, `odt`, `ppt`, `pptx`, `xls`, `xlsx` (linhas 35-44).
- Imagens recusadas: `jpg`, `jpeg`, `png`, `webp`, `gif`, `bmp`, `tif`, `tiff`,
  `avif` (linhas 46-51). **Nao ha OCR**: PDF escaneado (imagem sem camada de
  texto) e aceito pelo formato e rejeitado pela extracao, entao so entre no
  acervo material com texto extraivel.

## 3. Como nomear os arquivos (regras realmente implementadas)

Fonte: `src/lib/knowledge/mcp/providers/apostila-mcp.ts`.

- Ordem de aula: padrao `aula[-_.\s]*0*(\d{1,3})` (case-insensitive) no nome do
  arquivo. Fora disso, `lessonOrder` fica `null` e o arquivo entra sem posicao.
- Variantes reconhecidas: `grifado`/`grifada`, `comentado`/`comentada`,
  `resumido`/`resumida`, `rascunho`. Variante **nao entra no indice padrao** e
  recebe tag `variante-*` - e o caminho para apostilas coloridas sem duplicar o
  corpus consultado pelo RAG.
- Conteudo invalido: arquivo de 0 bytes, ou arquivo cujo probe inicial (64 KiB)
  e so byte zero, e classificado como `invalid` e pulado.
- Duplicado exato: mesmo SHA-256 vira `skipped_duplicate`; fica pendente apenas
  o arquivo mais canonico do par. Deduplicacao nao depende de nome.

Convencao de arvore recomendada (uma pasta por cargo, dentro dela uma por edital,
dentro dela uma por materia):

```
materiais/
  PME-RJ - Soldado/
    PMERJ-2024/
      Lingua-Portuguesa/
        aula-01 - Interpretacao de Texto.pdf
        aula-02 - Tipologia Textual.pdf
        aula-02 - Tipologia Textual - grifado.pdf   (variante, fora do indice)
      Direito-Constitucional/
        aula-01 - Direitos Fundamentais.docx
```

Observacoes operative:

- `materiais/` esta no `.gitignore` (linha 60: `/materiais/`) e
  `.apostilas-work/` tambem (linha 80). O repositorio nunca guarda apostila nem
  saida de CLI; `git ls-files materiais` hoje retorna **0 arquivos**.
- Estados atuais da area de trabalho: `materiais/` contem **15 diretorios e 0
  arquivos** (skeleton `PME-RJ (Soldado) Língua Portuguesa/01-Interpretacao-de-Texto`
  ... `14-Redacao`, 14 topicos + 1 pasta-mae). Ou seja: ha organizacao de pastas, mas **nenhum material para
  extrair** - a ingestão real continua sem insumo.
## 4. Pre-condicoes antes de qualquer execucao

Variáveis de ambiente envolvidas (nomes; valores nunca sao registrados aqui):

| Variavel | Onde e lida | E obrigatoria para |
| --- | --- | --- |
| `APOSTILA_SOURCE_DIR` | `scripts/ingest-apostilas.ts:26` (ou flag `--source`) | qualquer execucao: sem origem o CLI imprime usage e sai com codigo 2 (linhas 451-456) |
| `APOSTILA_WORK_DIR` | `scripts/ingest-apostilas.ts:27-28` (ou flag `--workspace`) | saida do manifest/report; padrao `.apostilas-work` dentro do repositorio |
| `DATABASE_URL` | `applyIngestion` -> `assertNonProductionDatabaseUrl("apostila-cli", ...)` (linha 369) | `--apply` somente; sem prova de banco de teste, falha `NON_PRODUCTION_DATABASE_REQUIRED` |
| `PROD_SUPABASE_PROJECT_REF` / `SAFE_TEST_DATABASE_REFS` | `src/lib/db/env-guard.ts` | destravar escrita em ref de teste (hoje ausentes no `.env`) |
| `STORAGE_BACKEND` (+ `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`) | `src/lib/knowledge/storage/backend.ts:36-58` | o passo de upload do `--apply`; hoje `STORAGE_BACKEND` nao esta definido |
| `--actor-email` | `scripts/ingest-apostilas.ts:370-390` | precisa ser professor/admin **existente em `auth.users`** |

Fora do alcance do CLI: extracao de texto depende do servico de extracao e o
passo de embedding depende de `EMBEDDING_API_URL`/`EMBEDDING_API_KEY`. Sem
eles o documento termina em `chunked` (sem embeddings), que e o comportamento
degradado esperado e ja coberto por teste unitario.

## 5. Dry-run em lote e o modo `--stage` (executaveis sem banco)

Comando (PowerShell, saida fora do repositorio):

```powershell
$ws = Join-Path $env:TEMP 'concursoai-dryrun'
npm run ingest:apostilas -- --source materiais --workspace $ws
```

O que o dry-run faz: varre a origem (somente leitura), classifica cada arquivo
via `plan()` do MCP, calcula SHA-256, resolve duplicados e variantes, grava
`manifest/apostilas.json` e `reports/apostilas.md` na area de trabalho e encerra
com `dry-run: nenhuma escrita em banco, storage ou R2`
(`scripts/ingest-apostilas.ts:479-482`).

O que ele **nao** faz: nao conecta no banco, nao grava arquivo em storage, nao
move/renomeia/apaga nada da origem, nao invoca provedor pago de IA.

Execucao desta rodada (2026-10-03, `--source materiais`, workspace em
`%TEMP%\concursoai-dryrun-a`, sem `--apply`):

```text
[cli] provedor MCP: apostila-mcp v1.1.0
[cli] origem: C:\Users\dev\plataforma de estudo\materiais
[cli] modo: dry-run (padrao)
[cli] encontrados=0 suportados=0 invalidos=0 nao_suportados=0 duplicados=0 variantes=0
[cli] manifest e report gravados em C:\Users\dev\AppData\Local\Temp\concursoai-dryrun-a
[cli] dry-run: nenhuma escrita em banco, storage ou R2.
```

Numeros reais do relatorio gerado: `achados: 0`, `suportados: 0`, `invalidos: 0`,
`nao suportados: 0`, `duplicados: 0`, `variantes fora do indice: 0`,
`total de bytes: 0`, `pendentes para o apply: 0`, `bytes dos pendentes: 0`.
Provider/MCP registrados no artifacts: `apostila-mcp`, `mcpVersion 1.1.0`,
`processingVersion 2026-09-13.1`. Verificacao de higiene: `git status` nao
apresenta `.apostilas-work`, e a arvore do workspace contêm os 7 diretorios
padrao (`source`, `manifest`, `processed`, `failed`, `logs`, `exports`,
`reports`) com apenas 2 arquivos gravados.

Interpretacao honesta: este resultado **exercita apenas o caminho de origem
vazia**. Ele prova que o CLI roda, que o guard nao e violado e que a saida vai
para fora do repositorio; nao prova extracao, chunking, dedup em corpus real
nem volume.

### 5.1 Modo `--stage` e modo `--sync` (evidencia de 2026-10-17)

`--stage` e o segundo modo executavel neste posto, sem banco: grava os bytes em
`.storage/staging` (arquivo `sha256.ext`, escrito por rename e conferido pelo
hash) e registra a apostila na fila `.storage/pending-ingest.json` como `staged`.
Escreve so em storage — nenhuma linha de banco, nenhuma credencial de IA, nenhum
`--actor-email`:

```powershell
$ws = Join-Path $env:TEMP 'concursoai-stage'
npm run ingest:apostilas -- --source materiais --workspace $ws --backend local --stage
```

Saida desta rodada (2 arquivos de teste, backend `local`): `staged: novos=2
reutilizados=0` e fila `{"recorded":0,"staged":2,"synced":0,"error":0}`. O mesmo
comando repetido devolveu `novos=0 reutilizados=2` com `staged:2`: a fila e
idempotente por sha256. `--backend` aceita `r2|supabase|local`; sem a flag vale
`STORAGE_BACKEND`, e nao existe escolha de backend por documento.

Com banco de teste isolado, `--sync` consome a fila:

```powershell
npm run ingest:apostilas -- --sync --actor-email [professor] --limit 1
```

Entrada `staged` vira ingestao completa a partir dos bytes preservados (o hash e
reconferido na leitura, entao o que se sincroniza e o que foi gravado); entrada
`recorded` — bytes ja no backend canonico e linha em `documents` — repete apenas
a extracao, porque ingerir de novo daria `DUPLICATE_FILE` e deixaria o conteudo
sem chunks. Sem `DATABASE_URL` de teste o comando para antes de qualquer escrita
(`[cli] BLOCKED NON_PRODUCTION_DATABASE_REQUIRED`, codigo de saida 3).

Os tres modos de escrita sao mutuamente exclusivos (`Modos exclusivos: --apply e
--stage. Escolha um.`), e `.storage/` esta no `.gitignore` (linha 130): acervo,
staging e fila continuam fora do repositorio. Referencias de linha das secoes 1
a 5 acima foram lidas na versao anterior do CLI e nao incluem `--stage`/`--sync`.

## 6. Ler as saidas

`reports/apostilas.md` traca por arquivo `aula | arquivo | bytes | status | acao`
e, acima da tabela, a projecao do apply (`pendentes para o apply`, `persistiriam
com este limite`, `bytes dos pendentes`), calculada so sobre linhas `pending` e
truncada por `--limit` (`scripts/ingest-apostilas.ts:336-346`).

`manifest/apostilas.json` traz `relPath`, `sha256`, `classification`, `reason`,
`title`, `lessonOrder`, `variant`, `indexedByDefault`, `tags` e `action` por
arquivo. Acoes possiveis: `pending`, `skipped_duplicate`, `skipped_unsupported`,
`skipped_invalid` (linhas 58).

Uso recomendado: `--limit 3` no dry-run para ler a projecao do primeiro lote e
so entao falar em apply autorizado.

## 7. Preparacao antes de um apply (mesmo autorizado)

1. Colocar material real em `materiais/` (ou apontar `APOSTILA_SOURCE_DIR`) e
   conferir `Get-ChildItem materiais -Recurse -File` - hoje sao 0 arquivos.
2. Rodar dry-run com `--limit 3` e ler `achados`, `suportados`, `duplicados`.
3. Confirmar que `--subject` corresponde a materia existente no catalogo
   `knowledge_subjects` (senao o documento nasce sem materia).
4. Ter banco de teste isolado provado pelo guard (ver `docs/BANCO-TESTE-ISOLADO.md`).
5. Ter `STORAGE_BACKEND` e credenciais do backend escolhidos configurados, ou o
   upload do apply falha.
6. Escolher `--actor-email` de professor/admin que exista em `auth.users` do
   banco de teste.
7. Executar com `--limit 1`, conferir o documento resultante e so entao ampliar.

## 8. Lacunas conhecidas da via em lote

- Sem OCR: PDF digitalizado entra como arquivo valido e falha na extracao.
- Sem escopo: o `--apply` do CLI nao define `position_id`/`edital_id`, entao o
  material ingerido por CLI nao e publicavel para um cargo especifico. Para o
  piloto, usar a UI.
- Limite de arquivo unico de 25 MB vale para qualquer plano
  (`ingestion.service.ts:51,168`), enquanto a cota de documentos por plano
  (`free: 3`, `pro: 20`, `intensivo: 100`) vem da tabela `plans`.
- Nenhum apply foi executado ate hoje; nao existe evidencia de ingestao em lote
  com persistencia.