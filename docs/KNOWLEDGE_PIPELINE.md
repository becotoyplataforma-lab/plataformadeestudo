# KNOWLEDGE PIPELINE - ConcursoAI

Pipeline: `UPLOAD -> MCP PLAN -> STORAGE -> EXTRACAO -> NORMALIZACAO -> CHUNKING -> EMBEDDING -> INDEXACAO -> READY`.

Estados de `documents.status`: `pending -> processing -> processed/chunked -> indexing -> indexed | failed`.

Sem credenciais de embedding o documento termina em **`chunked`** (conteudo pronto, busca vetorial pendente). Isso **nao e falha**: o metadata registra `embedding_skipped` e a busca segue funcionando por FTS (`websearch_to_tsquery` + ranking).

## Formatos aceitos e recusados

Fonte unica: `src/lib/knowledge/format-contract.ts`. O MCP de ingestao, o `IngestionService` e o `DocumentExtractionService` leem a mesma lista, entao o formato aceito no upload e o formato que o extrator decodifica nao podem divergir (um teste compara os tres conjuntos).

Aceitos, com extrator e MIME validado:

- `PDF`: `pdf-parse`, texto nativo
- `DOCX`: `mammoth`
- `TXT`: UTF-8
- `MD` / `markdown`: UTF-8
- `HTML` / `htm`: strip de tags

Recusados (binario ou ZIP sem extrator): `DOC`, `EPUB`, `RTF`, `ODT`, `PPT`, `PPTX`, `XLS`, `XLSX` e imagens (`JPG`, `PNG`, `WEBP`, `GIF`, `BMP`, `TIF`, `AVIF`).

A recusa acontece **antes** de gravar qualquer coisa: o plano MCP devolve `unsupported` e a rota responde 422 `MCP_REJECTED`. Se um desses formatos passasse, o binario seria decodificado como UTF-8 e indexado como texto lixo, isto e, conteudo que entra no indice do RAG e nao sai mais. OCR e extratores novos entram pelo contrato de formatos, nao por excecoes espalhadas.

A camada de extracao tambem guarda: `DocumentExtractionService.extract` lanca `UNSUPPORTED_FORMAT` para qualquer par `(type, mime)` sem extrator, inclusive para documentos ja registrados.


## Storage: backend explicito, sem fallback silencioso

`src/lib/knowledge/storage.service.ts` escolhe o backend por **`STORAGE_BACKEND`**. R2 nao ativa sozinho pela presenca de `R2_ACCESS_KEY_ID`: a decisao e sempre explicita, porque um bucket errado em silencio significa apostilas gravadas em lugar impossivel de auditar.

- `STORAGE_BACKEND=r2`: somente Cloudflare R2; sem credenciais falha com `R2_NOT_CONFIGURED`
- `STORAGE_BACKEND=supabase`: somente Supabase Storage (bucket privado `documents`)
- ausente em producao: fail-fast com `StorageBackendError`

Download e remove aceitam o backend gravado no documento (`documents.storage_backend`), o que permite o periodo hibrido da migracao: arquivos antigos continuam no Supabase enquanto os novos vao para o R2. A chave e sempre `{userId}/{documentId}/{arquivo-sanitizado}`, com nome saneado contra path traversal.

Componentes: `storage/backend.ts` (resolucao), `storage/r2-storage.service.ts` (cliente S3-compativel), `storage/migrate-classifier.ts` (classifica o que falta mover) e `scripts/migrate-storage-r2.mjs` (migracao real, exige credenciais e banco de teste).


## MCP de processamento (arquitetura multi-provedor)

O upload nao contem regra de conteudo: ele pergunta ao provedor. Em `src/lib/knowledge/mcp/` moram `contracts.ts` (contrato puro, sem banco e sem Next), `registry.ts` (registro, resolucao por id, `assertMcpCapability`, `mcpProviderCatalog`), `providers/apostila-mcp.ts` (provedor padrao), `providers/mock-mcp.ts` (prova de que a rota nao conhece regra) e `server.ts` (exposicao do mesmo registry como servidor MCP).

Capacidades declaradas: `ingest`, `transform`, `reprocess`, `search`. Upload individual e lote exigem `ingest`; reprocessar com um provedor que nao declara `reprocess` devolve 422 `MCP_CAPABILITY_UNAVAILABLE`, e nao executa nada. A checagem e feita no backend (`assertMcpCapability`), entao uma chamada feita direto na API nao consegue escolher um provedor que nao sabe ingerir.

Selecao e validacao sempre no backend:

- `GET /api/knowledge/mcp-providers` devolve o catalogo com capacidades, versoes e o id padrao
- `POST /api/knowledge/upload` e `POST /api/admin/apostilas/batch` aceitam `mcp_provider_id`; campo malformado vira 422 `INVALID_MCP_PROVIDER`, id inexistente vira 404
- `POST /api/knowledge/documents/[id]/process` aceita `mcp_provider_id` no corpo e herda o provedor gravado no documento quando o campo esta ausente
- UI: seletor **MCP de processamento** no formulario do professor, no de lote e no reprocessamento
- o plano e executado **antes** de gravar arquivo ou linha de banco: `unsupported` encerra em 422 `MCP_REJECTED`

## Transformacao editorial

`apostilaMcpProvider.transform` faz editoracao legitima e nada alem disso. Ele promove chamadas do tipo `Fase 01 - Tema` a cabecalho Markdown, remarca caixas `REGRA`, `ATENCAO`, `DICA`, `CUIDADO`, `IMPORTANTE` e `COMUM EM PROVAS` como blockquote (exigindo separador, para nao marcar prosa comum), ignora o que esta dentro de bloco de codigo e normaliza quebras e espacios.

Nao existe nenhuma regra de remocao de autoria: nome de plataforma, assinatura, URL, copyright e identificacao de origem permanecem no texto. Retirar isso nao e edicao, e ocultacao de titularidade de direitos.

O transform e idempotente: rodar duas vezes devolve o mesmo texto, sem duplicar avisos nem caixas. Isso e o que torna seguro reprocessar. Os avisos de adaptacao por IA e de direitos do autor original so entram quando o material nao esta marcado como nao adaptado (`aiAdapted`); declarar IA em texto que nao foi adaptado seria uma procedencia falsa.

## Versionamento do processamento

Cada documento carimba `documents.metadata` em merge JSONB, sem migracao:

- `mcp_provider_id`: qual provedor processou
- `mcp_version`: versao do provedor (`APOSTILA_MCP_VERSION`)
- `processing_version`: versao das regras editoriais (`APOSTILA_PROCESSING_VERSION`)
- `lesson_order`, `variant`, `indexed_by_default` e o bloco `mcp` completo

`processing_version` nunca e copia de `mcp_version`: sao duas dimensoes. Mudou a normalizacao sem trocar de provedor, muda `processing_version`, e o reprocessamento sabe o que refazer. A versao aceita cobertura por ambiente via `APOSTILA_PROCESSING_VERSION`, validada por `^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$`; valor malformado cai no padrao compilado em vez de entrar no metadado.

## Reprocessamento e idempotencia

`DocumentPipelineService.processDocument` e idempotente: remove logicamente os chunks antigos, reextrai, rechunka, reindexa e so depois marca `indexed`. Chamar de novo nao duplica conteudo no indice. Em erro, grava `status=failed` e `processing_error`.

A rota `POST /api/knowledge/documents/[id]/process` resolve o provedor (o do corpo, ou o herdado do documento), exige a capacidade `reprocess`, roda o pipeline e grava o carimbo novo com `reprocessedAt`, preservando a variante do upload original.

A deduplicacao do upload tambem e idempotente: `IngestionService` compara SHA-256 por usuario e responde 409 `DUPLICATE_FILE` antes de gravar qualquer byte.

## Variantes (aula grifada)

Uma copia grifada, comentada ou resumida de uma aula ja indexada nao e conteudo novo. O plano marca `variant` e `indexedByDefault=false`, grava `metadata.variant` e adiciona a tag `variante-<rotulo>`. O documento fica rastreavel e disponivel para estudo dirigido, mas nao polui o indice padrao do RAG com duplicacao semantica.

## CLI de apostilas

```bash
npm run ingest:apostilas -- --limit 13
npx tsx scripts/ingest-apostilas.ts --source DIR --workspace DIR --mcp apostila-mcp --subject PORTUGUES --actor-email professor@exemplo --apply
```

Opcoes: `--source`, `--workspace`, `--limit`, `--mcp`, `--subject`, `--actor-email`, `--apply` e `--dry-run`.

Os caminhos vem de ambiente: `APOSTILA_SOURCE_DIR` e `APOSTILA_WORK_DIR`. Sem `--source` e sem a variavel, o CLI imprime usage e sai com codigo 2. Nao existe mais caminho de maquina embutido no repositorio.

Padrao e **dry-run**: varre a arvore, classifica pelo MCP, calcula SHA-256, marca duplicados exatos e variantes e grava `manifest/apostilas.json` e `reports/apostilas.md` na area de trabalho. Nada toca banco, storage ou R2.

`--apply` so comeca depois de `assertNonProductionDatabaseUrl()` provar que `DATABASE_URL` e banco de teste isolado; sem prova o processo termina com `NON_PRODUCTION_DATABASE_REQUIRED` e codigo 3.

A origem e somente leitura: o CLI nao move, renomeia nem apaga arquivo. A area de trabalho `.apostilas-work/` esta no `.gitignore`, junto de `*.log` e dos binarios de material didatico (`/*.pdf`, `/*.docx`, `/*.epub`).

## Guarda de ambiente

`src/lib/db/env-guard.ts` e o portao de toda escrita vinda de Node. `src/lib/db/cli-db-guard.ts` e o mesmo portao para os processos filhos da CLI (`supabase db push`, `supabase db execute --file sql/seed.sql`, `drizzle-kit migrate`), que nao passam pelo guard do Node. Em `package.json`, `db:push`, `db:seed`, `db:migrate` e `drizzle:migrate` rodam atraves de `scripts/db-guard.ts`: se o destino nao e comprovadamente banco de teste, o comando filho nem e iniciado (codigo 3).

Sao aceitos como seguros: host local, nome de banco claramente de teste ou staging, e project ref diferente do de producao listado em `SAFE_TEST_DATABASE_REFS`. Qualquer duvida bloqueia. Nenhum log, erro ou saida contem senha, token, service-role ou a string de conexao completa.

Enquanto desenvolvimento e producao apontarem para o mesmo projeto Supabase, `db:push`, `db:seed`, seed, cleanup de E2E e `--apply` continuam **BLOCKED por decisao de projeto**, nao por falha de codigo.

## Embeddings e fallback FTS

`EmbeddingService` usa BAAI/bge-m3 (1024 dimensoes), batch de 20 e cache por `content_hash` em `embedding_cache`, com armazenamento pgvector/HNSW. A leitura de configuracao passa por `emptyToUndefined`: variavel presente mas vazia conta como nao configurada, exatamente como o deploy Vercel entrega.

Sem embedding configurado, `hybridConfigured` cai para busca textual pura (FTS `portuguese` + ranking) e o documento termina em `chunked`. Isso e degradacao planejada, nao erro: o estado aparece em `GET /api/health` e na visao administrativa.

As credenciais de producao de embedding sao configuracao externa. Nenhuma credencial pertence a este arquivo nem ao repositorio.

## MCP no VS Code

`.vscode/mcp.json` registra o servidor `concursoai-knowledge`, que executa `scripts/knowledge-mcp-server.ts` com `tsx`. O servidor nao reimplementa nada: chama o mesmo `registry`, o mesmo `format-contract` e os mesmos provedores do upload.

Ferramentas expostas, todas somente leitura:

- `knowledge_mcp_catalog`: provedores, capacidades, versoes e qual e o padrao
- `knowledge_format_contract`: o que e aceito, o que e recusado e por que
- `knowledge_plan_file`: dry-run do plano MCP de um arquivo
- `knowledge_transform_text`: normalizacao editorial de um texto

O servidor nao importa repositorio, storage, R2 nem credenciais: abrir o MCP no editor nao pode escrever em banco nem empurrar apostila para o indice. Para carregar: recarregar a janela do VS Code e iniciar o servidor em MCP (o arquivo `.vscode/mcp.json` mostra o botao Start).

## APIs do pipeline

- `POST /api/knowledge/upload`: upload individual (admin/professor), plano MCP antes de gravar, `mcp_provider_id` opcional, `transformar` opcional
- `GET /api/knowledge/mcp-providers`: catalogo de provedores para o seletor e coberto por `src/app/api/knowledge/mcp-providers/__tests__/api-mcp-providers.test.ts`: sem sessao nao existe catalogo nenhum, exatamente um provedor e marcado como padrao, `capabilities` sai como copia do registro e o teste confere que o payload diz o mesmo que `assertMcpCapability` aceita no backend
- `POST /api/admin/apostilas/batch`: lote de ate 20 arquivos com o mesmo MCP e o mesmo carimbo. Resposta `201` quando o lote inteiro passa e `207` quando ha falha parcial, sempre com uma linha por arquivo. Rejeicao do plano vira linha `failed` com `MCP_REJECTED` e o lote continua; erro nao-dominiado (storage, por exemplo) vira `PROCESSING_FAILED` com mensagem fixa e o texto original fica so no log. Coberto por `src/app/api/admin/apostilas/batch/__tests__/api-admin-apostilas-batch.test.ts`
- `GET /api/knowledge/documents`, `GET/DELETE /api/knowledge/documents/[id]`: lista, detalhe e soft delete
- `GET /api/knowledge/documents/[id]/download`: baixa o arquivo original (dono ou admin), pelo backend gravado no documento, sem fallback silencioso de storage. Backend nao configurado (`R2_NOT_CONFIGURED`) ou `STORAGE_BACKEND` ausente/invalido (`StorageBackendError`) devolve 503; objeto ausente devolve 404; a mensagem crua do storage nunca vai ao cliente
- **Download do original na UI**: `src/app/(dashboard)/apostilas/[id]/page.tsx` (dono) e `src/app/admin/apostilas/[id]/page.tsx` (admin) trazem o link "Baixar arquivo original", visivel quando o documento tem `storage_path`. E um link simples para a rota acima: quem decide dono/admin e a rota, nunca o componente, e o `Content-Disposition: attachment` vem do servidor
- `POST /api/knowledge/documents/[id]/process`: retry e reprocessamento com troca opcional de MCP
- `POST /api/knowledge/search`: busca hibrida (vetorial + FTS, com fallback declarado),
- `GET /api/health` e `GET /api/health/storage`: status de infraestrutura (backend de storage, R2, DeepSeek e embeddings configurados). Ambos declaram `force-dynamic`: pre-renderizados no build entregariam timestamp e booleans congelados. `STORAGE_BACKEND` nao resolvido aparece como `backend: null` + `backendError`, nunca como 500

## Migracao

Schema versionado em `drizzle/` (fonte de verdade para banco novo) e `database/legacy/2026-08-15-concursoai-e2e.sql` como historico. `documents.metadata` guarda o carimbo do MCP por merge JSONB, sem migracao: `mcp_provider_id`, `mcp_version`, `processing_version`, `lesson_order`, `variant` e `indexed_by_default`.


## Paginacao do conteudo (referencia de pagina no chunk)

O PDF e lido pagina a pagina: `DocumentExtractionService.extract` devolve `pages: string[]` (indice 0 = pagina 1) alem de `text` e `pageCount`. O pipeline normaliza **cada pagina isoladamente** e junta por `PAGE_JOIN`, que e dois newlines. So assim as fronteiras continuam validas no texto final: normalizar o texto inteiro de uma vez deslocaria os offsets e cada chunk citaria a pagina errada.

O chunk recebe em `metadata`:

- `page`: pagina onde o trecho comeca
- `page_end` e `pages`: quando o trecho atravessa mais de uma pagina

TXT, MD, HTML e DOCX nao tem pagina real, entao **nenhuma chave de pagina e escrita**: o pipeline nao inventa origem que nao existe. A busca hibrida ja lia `metadata.page` (`hybrid-search.service.ts`) e o DTO de busca (`knowledge.dto.ts`) ja expunha `page`. O contrato existia e estava descoberto; agora e preenchido. `documents.page_count` continua vindo do extrator.

Nao ha migration nisso: `document_chunks.metadata` e JSONB, e as colunas de pipeline (`page_count`, `chunk_count`, `embedding_count`, `processing_error`, `processed_at`) ja existem no schema.

## Estados honestos do pipeline

| Estado | O que afirma | Busca |
| --- | --- | --- |
| `pending` / `processing` | comecou, nao terminou | nao pesquisavel |
| `chunked` | texto extraido e trechos gravados, **vetorial pendente** | FTS funciona |
| `indexing` | gerando vetores | parcial |
| `indexed` | existe vetor registrado no banco | FTS + vetor |
| `failed` | erro registrado em `processing_error` | nao pesquisavel |

A regra corrigida nesta frente: `indexed` so e escrito quando **sobrou vetor**. Antes o `EmbeddingService` marcava `indexed` ate quando o servico de embeddings nao estava configurado e quando todos os lotes de geracao falhavam, e isso e uma conclusao falsa: indice vazio nao e indice. Sem `EMBEDDING_API_URL` o documento para em `chunked` com `metadata.embedding_skipped`; com falha total de batch fica em `chunked` e registra `metadata.embedding_failed`. Reprocessar depois de configurar o endpoint e o caminho de retomada, e o processamento e repetivel: os chunks antigos vao para soft delete antes dos novos.

## Como o operador inicia e consulta

1. **Iniciar pela UI**: `POST /api/knowledge/upload` (individual) ou `POST /api/admin/apostilas/batch` (ate 20 arquivos, materia obrigatoria).
2. **Iniciar por lote do disco**: `npm run ingest:apostilas` - dry-run por padrao, origem de `APOSTILA_SOURCE_DIR` ou `--source`, saidas na area de trabalho (`manifest/`, `reports/`, `logs/`). Tres modos de escrita, mutuamente exclusivos: `--stage` grava os bytes no backend escolhido (`.storage/staging`, enderecado por sha256) e coloca a apostila na fila de ingestao sem tocar em banco; `--apply` faz a ingestao completa; `--sync` consome a fila (entrada `staged` vira ingestao completa a partir dos bytes preservados, entrada `recorded` repete so a extracao). `--apply` e `--sync` exigem banco de teste isolado comprovado por `assertNonProductionDatabaseUrl`; `--stage` nao escreve em banco, entao nao passa por esse guard. O backend dos bytes da execucao vem de `STORAGE_BACKEND` ou de `--backend r2|supabase|local`.
3. **Reprocessar um documento**: `POST /api/knowledge/documents/[id]/process`.
4. **Ver o resultado do lote**: a resposta do batch traz `processing` por arquivo (`status` e, em falha, `code` com mensagem fixa) alem de `processingFailedCount` e `awaitingIndexingCount`. Criar o documento e converter o conteudo sao coisas distintas: material que entrou mas nao virou conteudo pesquisavel aparece aqui, nao como upload perdido.
5. **Ver a fila inteira**: `GET /api/admin/apostilas/pipeline` (somente admin, somente leitura) devolve contagem por estagio, `awaiting_indexing`, `failed` com `processing_error` cortado e `limit` (maximo 200). A resposta e um DTO estreito: `storage_path`, `file_hash` e `user_id` nao saem.

Seguranca: na resposta vao codigo de dominio e mensagem fixa; texto cru de driver (bucket, caminho, credencial) fica so no log do servidor. Na fila, `processing_error` e cortado a 300 caracteres e aparece apenas para admin.

## Limites atuais do pipeline

- **OCR**: nao existe. PDF escaneado vira `failed` com `EMPTY_TEXT` e `metadata.ocr_needed = true`; o codigo diz isso em vez de falha generica.
- **Audio e video**: `metadata.media_type` diferente de `text` produz `TRANSCRIPTION_NOT_CONFIGURED` e marca `transcription_needed`; nao ha servico de transcricao configurado.
- **Embeddings**: padrao BAAI/bge-m3 em 1024 dimensoes por `EMBEDDING_API_URL`. Sem ele o corpus segue pesquisavel por FTS e a busca vetorial fica pendente, nunca simulada. DeepSeek e modelo de chat e nao e usado como provedor de embeddings.
- **Formatos**: `pdf`, `docx`, `txt`, `md`, `html` e `htm`. `doc`, `epub`, `rtf`, `odt`, `ppt`, `pptx`, `xls`, `xlsx` e imagens sao recusados no plano e na extracao, pela fonte unica `src/lib/knowledge/format-contract.ts`.

## Ensaio de catalogo (R6.5) e o que ele prova

O SQL do ensaio esta em `sql/rehearsal/r65-probes.sql`, com rotulo obrigatorio em todo bloco: `[E]` entra no digest, `[P]` e prova de cobertura cujo resultado inesperado aborta o host, `[C]` e conceitual e **nao conta como coberto**. As classes `C8`, `C-ENUM`, `C-COLL`, `C-TS`, `C1V`, `pg_statistic_ext_data`, `pg_amop` / `pg_amproc` / `pg_opfamily`, membros de extensao, `pg_description` e ACLs globais ficam declaradas fora do escopo desta revisao: a assinatura e **parcial** e nao pode ser apresentada como equivalencia integral entre bancos.

Dois testes estaticos travam as correcoes sem abrir conexao com banco:

- `src/lib/db/__tests__/r65-rehearsal-sql.test.ts` proibe `pg_catalog.coalesce(...)` (COALESCE nao e funcao ordinaria, e expressao SQL), `HDL(...)` sem definicao, `ascii_chr` (inexistente no PG17), `sequence_last_value` e `sequence_concealed_value`, `indhasindex` (nao existe em `pg_index`), `unnest()` em `int2vector` e `oidvector`, `probin` como `bytea`, `proargdefaults` como array e qualquer hash dentro do SQL. Exige rotulo em todo bloco, `Esperado` e `Aborto` em todo bloco `[P]`, vocabulario de sentinela fechado e nenhum alias orfao.
- `src/lib/db/__tests__/drizzle-ledger-contract.test.ts` le o migrador **instalado** (`node_modules/drizzle-orm/pg-core/dialect.cjs`, versao 0.45.2) e trava a query literal `order by created_at desc limit 1` (sem `id DESC`, sem `NULLS FIRST`), a comparacao estrita `Number(created_at) < folderMillis`, a ausencia de guarda por hash e a transacao unica. Simula o journal real e prova que uma linha com `created_at` NULL faz `Number(null)` virar zero e re-executar **todo** o journal - o contrario do que a R6.5 afirmava.

Estado operacional: nenhuma conexao com banco, nenhuma migration executada, nenhum seed, nenhum container. `drizzle/0006`, `0007` e `0008` seguem como arquivos orfaos, sem entrada no journal e sem snapshot, e `scripts/stamp-migrations.sql` carimba apenas `0000` a `0004`, entao `0005` permanece pendente num banco carimbado por ele. `0000_baseline.sql` ja cria a enum `ai_model` com o rotulo `kimi`, e `0003_wide_molten_man.sql` faz `ALTER TYPE ... ADD VALUE` do mesmo `kimi` sem `IF NOT EXISTS`: replay limpo colide. Nada disso foi sincronizado de forma automatica - cada item e decisao aberta.

## Autorizacao de leitura e escopo de compartilhamento

O acesso a documento de conhecimento e decidido num unico modulo,
`src/lib/knowledge/security/document-access.ts`, usado por busca, listagens,
rotas e paginas - nao ha decisao de acesso duplicada em componente de UI.

Regra efetiva:

- o **dono** le sempre os proprios documentos, com ou sem escopo;
- **documento com escopo valido** (`documents.position_id` ou `documents.edital_id`)
e compartilhado com quem tem o mesmo cargo, ou o mesmo edital vigente quando nao
tem cargo;
- **documento sem escopo nao e publico**: fica com o dono e o admin; ninguem herda
  material apenas porque ele existe no banco;
- **admin** (allowlist resolvida no backend) le tudo;
- a busca so aceita documento `chunked` ou `indexed`.

`documentAccessCondition` entra na propria consulta SQL: documento nao autorizado
nunca sai do banco para a aplicacao. A decisao nao acontece depois, em memoria, nem
no navegador. `positionId`/`editalId` da busca vem de `resolveCourseScope(perfil)` e
`isStaff` da sessao administrativa; nenhum dos dois vem do cliente.

Mesma politica em: `HybridSearchService.search`, `DocumentRepository.listAccessible`
e `findByIdAccessible`, `GET /api/knowledge/documents`,
`GET /api/knowledge/documents/[id]`, `.../download`, `.../transformado`,
`(dashboard)/apostilas` (lista, detalhe e leitura) e no anexo de apostila do
`POST /api/chat`. Mutacoes continuam de dono ou admin: `DELETE`, `.../process`,
`.../transformar`, `.../favorite`. Em material compartilhado o aluno le e pergunta ao
Professor IA; o botao de gerar questoes so aparece para dono e admin.
### Escopo no upload (individual e em lote)

`src/lib/knowledge/security/document-scope.ts` valida `position_id` e `edital_id`
**antes de qualquer escrita**: UUID em formato valido, cargo/edital existindo com
`deleted_at IS NULL` e, quando os dois chegam juntos, o mesmo `contest_id`. Cargo
sem edital no pedido herda o edital do proprio cargo (`positions.edital_id`), que e
relacao ja gravada no banco - nada e inventado. A validacao roda uma vez por
requisicao, nao uma vez por arquivo. Codigos devolvidos com 400:
`INVALID_SCOPE_ID`, `SCOPE_NOT_FOUND`, `SCOPE_MISMATCH`.

As telas de admin (`apostila-upload-form.tsx`, `batch-upload-form.tsx`) ganharam o
seletor concurso -> cargo (`src/components/admin/scope-select.tsx`), usando as
rotas `/api/admin/contests` e `/api/admin/positions?contest_id=` que ja existiam.
Sem escolher cargo, o material sobe privado: compartilhar nao e padrao implicito.

### Projecao do apply no CLI e canonicidade de duplicado

O report do `ingest:apostilas` agora traz o que o `--apply` gravaria: `pendentes
para o apply`, `persistiriam com este limite` (respeitando `--limit`) e `bytes dos
pendentes`. O dry-run segue sem nenhuma escrita - extracao e chunking so rodam no
`--apply`, que exige banco de teste isolado comprovado pelo env-guard.

Duplicado exato passa a manter o arquivo canonico (nome mais curto; empate por
ordem lexicografica) como `pending` e marca a copia como `skipped_duplicate`. Antes
disso ganhava o primeiro caminho da caminhada ordenada, o que podia gravar "a copia"
no lugar da aula original e perder o titulo correto no catalogo.