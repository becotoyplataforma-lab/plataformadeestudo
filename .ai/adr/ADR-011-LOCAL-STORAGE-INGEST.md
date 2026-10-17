# ADR-011 - Backend de storage local e fila de ingestão pendente

## Status
Accepted

## Context
- `DocumentStorageService` decidia o backend por `if/else` sobre `"r2" | "supabase"`,
  e cada operação repetia a regra "sem fallback silencioso entre backends".
- Desenvolver a ingestão de apostila exigia credenciais de storage e, para o
  registro (`documents` + chunks + embeddings), um banco de teste isolado — que
  neste posto não está acessível (TCP 5432 do Neon bloqueado).
- Perder o resultado de uma ingestão de vários minutos por falta de banco é
  inaceitável: a metade que já terminou (bytes) precisa sobreviver.

## Decision
- Criar `src/lib/knowledge/storage/contract.ts` como contrato único de adaptador
  (`DocumentStorageAdapter`), com a chave de objeto canônica
  `{userId}/{documentId}/{fileName}` e o `sha256Hex` compartilhados.
- Criar `LocalStorageService` (`STORAGE_BACKEND=local`): escrita atômica
  (`.tmp` + rename) com verificação do sha256 antes de publicar o objeto,
  sidecar `{objeto}.meta.json` com contentType/sha256/tamanho (o filesystem não
  guarda MIME), e contenção de path traversal por chave.
- `local` é recusado em produção com `LOCAL_BACKEND_FORBIDDEN`; o default
  (`supabase` fora de produção, fail-fast dentro) continua intacto.
- A raiz (`STORAGE_LOCAL_DIR`, default `.storage/documents`) nunca pode ser a
  raiz do filesystem nem a raiz do repositório; `.storage/` está no `.gitignore`.
- Criar `src/lib/knowledge/pending-ingest.ts`: fila JSON com escrita atômica,
  `schema_version`, idempotência por `sha256` e estados
  `staged → recorded → synced` (+ `error`); `synced` é terminal e `recorded` não
  é rebaixado por um novo `staged` do mesmo hash.

## Consequences
- Ingestão e desenvolvimento funcionam sem credenciais de storage.
- Migrar `local → r2/supabase` é cópia de chave para chave;
  `documents.storage_path` permanece válido, pois os três backends usam a mesma
  chave canônica.
- O sidecar é um segundo artefato por objeto: `remove` apaga os dois, e um objeto
  copiado à mão sem sidecar cai no MIME inferido pela extensão em `head()`.
- A fila é o único registro do que ainda não virou `documents`; sincronizar é
  responsabilidade do CLI (`--stage` grava bytes e enfileira; `--sync` consome a
  fila), nunca de uma rota pública.
- `local` em produção falha no boot da operação, não silenciosamente — um
  serviço serverless tem disco efêmero e serviríamos 404 no próximo cold start.

## Alternatives Considered
- Usar o Supabase Storage local (docker) como ambiente de desenvolvimento
  (rejeitada — exige subir stack completa e ainda precisa de banco).
- Guardar bytes em base64 dentro de um JSON de trabalho (rejeitada — duplica o
  material didático, infla a fila e esconde o hash de integridade).
- Fila em SQLite/JSONL (rejeitada — o projeto só introduz SQLite quando o fluxo
  precisa consultar com SQL; aqui a leitura é do arquivo inteiro).

## Migration Strategy
- Nenhuma migração SQL. Nenhum dado existente muda de lugar: backends `r2` e
  `supabase` continuam com o mesmo comportamento e as mesmas chaves.
- `documents.storage_backend` aceita o valor `"local"` apenas fora de produção.
- A sincronização da fila (`status: synced`) acontece quando houver banco de
  teste isolado, sempre atrás de `assertNonProductionDatabaseUrl`.

## References
- `src/lib/knowledge/storage/contract.ts`
- `src/lib/knowledge/storage/local-storage.service.ts`
- `src/lib/knowledge/storage/backend.ts`
- `src/lib/knowledge/pending-ingest.ts`
- `scripts/ingest-apostilas.ts` (`--stage`, `--sync`, `--backend`)
- `docs/GUIA-INGESTAO-APOSTILAS.md`
- `.ai/adr/ADR-001-SUPABASE-AUTH.md` (formato)
