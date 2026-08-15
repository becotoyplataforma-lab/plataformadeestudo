# KNOWLEDGE PIPELINE — ConcursoAI

Pipeline de ingestão e processamento de apostilas:

```
UPLOAD → STORAGE → DOCUMENT → EXTRAÇÃO → NORMALIZAÇÃO → CHUNKING → EMBEDDING → INDEXAÇÃO → READY
```

## Estados (`document_status`)
`pending → processing → processed/chunked → indexing → indexed | failed`

- Sem `EMBEDDING_API_URL`, o documento termina em **`chunked`** (conteúdo pronto, busca
  vetorial pendente) — **não é falha**; o metadata registra `embedding_skipped`.

## Componentes
- **`DocumentStorageService`** (`src/lib/knowledge/storage.service.ts`): Supabase Storage
  (bucket privado `documents`, service role server-side). Caminho `{userId}/{documentId}/{file}`.
- **`DocumentExtractionService`** (`services/extraction.service.ts`): PDF (`pdf-parse`),
  DOCX (`mammoth`), TXT/Markdown (UTF-8), HTML (strip). Retorna `{ text, pageCount }`.
- **`ChunkService`**: chunking fixo (1000/200) ou estrutural (headings Markdown), breakpoints
  por parágrafo/frase, persistência em `document_chunks` + FTS `portuguese`.
- **`EmbeddingService`**: BAAI/bge-m3 1024d, batch 20, cache por `content_hash`
  (`embedding_cache`), armazenamento pgvector/HNSW.
- **`DocumentPipelineService`**: orquestra storage → extração → chunk → embedding,
  transiciona status, grava `chunk_count`/`embedding_count`/`page_count`/`processing_error`.

## APIs
- `POST /api/knowledge/upload` — upload (multipart) + processamento síncrono. Campos opcionais
  (admin): `subject_id`, `edital_id`, `position_id`.
- `GET /api/knowledge/documents` — lista documentos do aluno.
- `GET/DELETE /api/knowledge/documents/[id]` — detalhe / soft delete (dono ou admin).
- `POST /api/knowledge/documents/[id]/process` — retry seguro (dono ou admin).
- `POST /api/knowledge/search` — busca híbrida (vetorial + FTS).

## Retry
`DocumentPipelineService.processDocument` é idempotente (soft-delete dos chunks antigos e
reinserção). Em erro, grava `status=failed` + `processing_error`.

## Migration
`database/migrations/2026-08-15-concursoai-e2e.sql` (idempotente) — aplicar com
`node scripts/apply-migration.mjs database/migrations/2026-08-15-concursoai-e2e.sql`.
