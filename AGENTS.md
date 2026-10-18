<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Seguranca de banco de dados (obrigatorio ler antes de escrever teste ou CLI)

Desenvolvimento e producao apontam para o MESMO projeto Supabase enquanto nao
existir staging isolado. Por isso toda escrita precisa passar por
`src/lib/db/env-guard.ts`:

- `assertNonProductionDatabaseUrl(target, url?)` lanca
  `NON_PRODUCTION_DATABASE_REQUIRED` quando o destino nao e comprovadamente
  um banco de teste (localhost, ref explicito em SAFE_TEST_DATABASE_REFS ou
  nome de banco claramente de teste). NODE_ENV=production bloqueia fora do
  harness de teste. Ref igual ao de producao bloqueia sempre.
- `isNonProductionDatabaseUrl(url)` e o gate booleano usado por
  `src/integration/helpers.ts` (hasDb) e pelos testes de integracao.
- `resolveDatabaseTestGate(target, url?, overrides?)` e o gate de suite: devolve `enabled`
  (para `describe.skipIf`), `reason` e `summary` log-safe para justificar o skip. Desde a
  FASE 1 `plans.contract.test.ts` usa esse gate e revalida com
  `assertNonProductionDatabaseUrl` no `beforeAll`, em vez de `Boolean(DATABASE_URL)`;
  cobertura em `src/lib/db/__tests__/database-test-gate.test.ts` (15 testes, sem banco).
- `describeDatabaseSafety(target)` produz log seguro: nunca imprime senha,
  token, service-role nem a string de conexao completa.

Nunca conecte `db:push`, `db:migrate`, seed, cleanup E2E ou CLI de ingestao
a um projeto de producao. Enquanto nao houver banco isolado, essas operacoes
estao BLOCKED por decisao de projeto, nao por falha de codigo.

## MCP de conhecimento (arquitetura multi-provedor)

Ingestao de conteudo e delegada a provedores MCP registrados em
`src/lib/knowledge/mcp/registry.ts`, conforme o contrato de
`src/lib/knowledge/mcp/contracts.ts`:

- `plan(input)` classifica um arquivo (supported / unsupported / invalid),
  deriva titulo, ordem de aula, variante e se entra no indice padrao.
- `transform(input)` aplica normalizacao editorial. Provedores NAO removem
  autoria, marca de plataforma ou identificacao de direitos: isso nao e
  edicao, e ocultacao de titularidade.
- Capacidades (`ingest`, `transform`, `reprocess`, `search`) sao checadas por
  `assertMcpCapability` no backend, nunca so no seletor da UI: upload e lote
  exigem `ingest` (422 `MCP_CAPABILITY_UNAVAILABLE` quando o provedor nao declara)
  e o reprocessamento exige `reprocess`.
- Erro nao-dominiado do lote (falha de storage, por exemplo) vira linha `failed`
  com codigo `PROCESSING_FAILED` e mensagem fixa: o texto cru do driver pode
  conter bucket, caminho ou credencial e fica apenas no log. O lote segue com
  os demais arquivos.
- O upload aceita `mcp_provider_id` e grava `documents.metadata.mcp` via merge
  JSONB (sem migracao). O catalogo aparece em `GET /api/knowledge/mcp-providers`
  e no seletor "MCP de processamento" do formulario do professor.
- Batch de apostilas: `npm run ingest:apostilas` (dry-run por padrao; use
  `--limit`, `--mcp`, e `--apply` somente com banco de teste isolado).
  `--reprocess <uuid>` refaz extracao+transform+chunks de documentos ja ingeridos
  (mesmo guard do `--apply`, sem `--source`); `--no-transform` desliga a edicao
  editorial e `--mode` escolhe sanitize-only, structure ou full.
- Transformacao editorial roda num ponto so: `DocumentPipelineService` chama
  `apostila-transformer.service.ts` entre a extracao e o chunking. Upload web,
  `--apply`, `--sync`, `--reprocess` e o reprocessar da UI passam todos por la,
  entao nenhum canal pula a regra. O vocabulario editavel mora em
  `src/lib/knowledge/config/apostila-rules.md` (Zod em `.schema.ts`, leitura
  cacheada por mtime, `APOSTILA_RULES_PATH` cobre o caminho no bundle).
- Remocao de PII (CPF com checksum valido, matricula, RG, conselho, CNH, nome do
  comprador em linha de rotulo) e permitida e sempre aplicada, antes de qualquer
  chamada de IA, porque e dado pessoal de terceiro sob LGPD. Nao e a mesma regra
  de remover autoria: plataforma, assinatura, URL e copyright ficam. O relatorio
  so registra contagem por tipo, nunca o valor removido.
- A saida da IA e gateada: menos marcadores de questao que a entrada, ou token de
  procedencia que sumiu, ou resposta curta demais = saida rejeitada e o documento
  cai em `sanitize-only` com `fallback_motivo`. IA nao expande nem inventa conteudo.
- `APOSTILA_TRANSFORM_MODE` (default `sanitize-only`) e `APOSTILA_TRANSFORM_DISABLED=1`
  controlam o modo e o kill-switch. Cada processamento grava `transform_report` em
  `documents.metadata` e o CLI escreve `reports/<documentId>.transform.json`.

- Formatos aceitos sao definidos em `src/lib/knowledge/format-contract.ts` (fonte unica lida pelo MCP,
  pelo `IngestionService` e pelo extrator): `pdf`, `docx`, `txt`, `md`/`markdown`,
  `html`/`htm`. `doc`, `epub`, `rtf`, `odt`, `ppt`, `pptx`, `xls`, `xlsx` e imagens
  sao recusados no plano, porque nao ha extrator e virariam texto lixo indexado.
- `documents.metadata.processing_version` e dimensao propria de `mcp_version` e nunca
  copia dela; a versao editorial pode ser coberta por `APOSTILA_PROCESSING_VERSION`.
- O mesmo registry e exposto ao VS Code por `src/lib/knowledge/mcp/server.ts` +
  `scripts/knowledge-mcp-server.ts` (config em `.vscode/mcp.json`): somente leitura, sem
  banco, sem storage e sem credenciais.
- CLI de apostilas nao tem caminho de maquina: origem e area de trabalho vem de
  `APOSTILA_SOURCE_DIR` / `APOSTILA_WORK_DIR` (ou `--source` / `--workspace`); sem
  origem o processo imprime usage e sai com codigo 2.
- Download do arquivo original: `GET /api/knowledge/documents/[id]/download` pede sempre o
  backend gravado no documento (`documents.storage_backend`), sem fallback entre Supabase e
  R2. Backend nao configurado (`R2_NOT_CONFIGURED`) ou `STORAGE_BACKEND` ausente ou
  invalido (`StorageBackendError`) devolve 503; objeto ausente no storage devolve 404;
  e a mensagem crua do storage nunca e ecoada ao cliente (fica no log).
- O catalogo `GET /api/knowledge/mcp-providers` tem teste de rota que compara as
  capacidades exibidas com `assertMcpCapability`: a UI so pode oferecer o que o
  backend aceita. O link "Baixar arquivo original" nas paginas de detalhe
  (`src/app/(dashboard)/apostilas/[id]/page.tsx` e
  `src/app/admin/apostilas/[id]/page.tsx`) aponta para a rota de download; dono/admin
  e decidido na rota, nunca no componente.
- Rotas de health (`/api/health`, `/api/health/storage`) declaram
  `export const dynamic = "force-dynamic"`: sem isso o Next pre-rendera o JSON no
  build e o monitoramento passa a ler timestamp e booleans congelados de build.
- Variaveis que destravam escrita em banco de teste: `PROD_SUPABASE_PROJECT_REF` (ref de
  producao) e `SAFE_TEST_DATABASE_REFS` (allowlist de refs de teste). Sem uma delas, ou sem
  host local, `db:push`, `db:seed`, `db:migrate` e `ingest:apostilas --apply` continuam
  bloqueados. Em CSP: producao aplica o header de bloqueio por padrao; `CSP_REPORT_ONLY=true` volta a modo observacao e `CSP_ENFORCE=true` força bloqueio fora de producao.

## MCP de linha de comando no VS Code

`.vscode/mcp.json` registra `concursoai-knowledge` (`npx tsx --conditions=react-server
scripts/knowledge-mcp-server.ts`). Ferramentas: `knowledge_mcp_catalog`,
`knowledge_format_contract`, `knowledge_plan_file`, `knowledge_transform_text`.

## Scripts de escrita no banco (db:push, db:seed, migrate)

`supabase` e `drizzle-kit` sao processos filhos e nao passam pelo guard do Node, entao
`db:push`, `db:seed`, `db:migrate` e `drizzle:migrate` rodam por
`scripts/db-guard.ts`, que usa `src/lib/db/cli-db-guard.ts` para decidir o destino
(URL do ambiente + project ref do `supabase link`) e recusa antes de iniciar o
comando filho. `db:check` e `db:generate` continuam direto porque nao escrevem.
