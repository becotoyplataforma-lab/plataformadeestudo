# 03 — CHUNK BLUEPRINT

## PURPOSE
Dividir texto extraído e normalizado de documentos em chunks (trechos) de tamanho controlado com sobreposição, preservando estrutura semântica quando possível. Cada chunk é a unidade atômica para embedding e busca.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `document_id` | `UUID` | ✅ | Documento origem |
| `text` | `string` | ✅ | Texto normalizado completo |
| `document_type` | `enum` | ✅ | Tipo do documento (define estratégia) |
| `options` | `ChunkOptions` | ❌ | Override de parâmetros |

```
ChunkOptions {
  chunk_size?: number        // default: 1000
  overlap?: number           // default: 200
  strategy?: 'fixed' | 'structural' | 'semantic'
}
```

### Estratégias de chunking por document_type

| document_type | Estratégia | Descrição |
| --- | --- | --- |
| `txt` | `fixed` | Tamanho fixo com overlap, quebra em parágrafo |
| `markdown` | `structural` | Divide por headings (##, ###) |
| `html` | `structural` | Divide por tags de seção (h1-h6, section, article) |
| `pdf` | `fixed` | Tamanho fixo, preserva limite de página |
| `docx` | `structural` | Divide por headings do Word |
| `edital` | `structural` | Divide por seções do edital (capítulo, anexo) |

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `chunks` | `Chunk[]` | Array de chunks gerados |
| `chunk_count` | `integer` | Total de chunks |
| `strategy_used` | `string` | Estratégia aplicada |

```
Chunk {
  document_id: UUID
  seq: number                    // 0-based, ordem no documento
  content: string                // Texto do chunk (até chunk_size chars)
  content_hash: string           // SHA-256 do conteúdo normalizado
  metadata: {
    char_start: number           // Posição inicial no texto original
    char_end: number             // Posição final
    page?: number                // Página (se PDF)
    section_title?: string       // Título da seção (se structural)
    heading_level?: number       // Nível do heading (1-6)
  }
}
```

### Regras de chunking
- Nenhum chunk deve exceder `chunk_size` + `overlap` caracteres
- Overlap de `overlap` caracteres entre chunks consecutivos (default: 200)
- Não quebrar no meio de uma palavra
- Preferir quebrar em fim de parágrafo (`\n\n`) ou fim de frase (`. `)
- Preservar heading como `section_title` no metadata (se structural)

## DEPENDENCIES

### Serviços externos
- Nenhum (algorítmico puro)

### Módulos internos
- `src/lib/knowledge/pipeline/chunker.ts`
- `src/lib/knowledge/pipeline/strategies/fixed.ts`
- `src/lib/knowledge/pipeline/strategies/structural.ts`

### Bibliotecas
- `crypto` (Node.js nativo) — SHA-256 para content_hash

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `documents` | `id`, `type`, `status` | Obter tipo do documento |
| `embeddings` | `chunk_id` | Verificar se chunk já tem embedding (via JOIN) |

### Tabelas escritas
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `document_chunks` | `id`, `document_id`, `seq`, `content`, `content_hash`, `metadata`, `created_at` | INSERT (batch) |

### Limpeza prévia
- DELETE de `document_chunks` antigos do mesmo `document_id` (soft delete via `deleted_at`) se for rechunking

### Política RLS
```sql
-- document_chunks: acesso herdado do documento pai
CREATE POLICY "Users can access chunks of own documents" ON document_chunks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM documents
      WHERE documents.id = document_chunks.document_id
      AND documents.user_id = auth.uid()
      AND documents.deleted_at IS NULL
    )
  );
```

### Índice FTS
```sql
-- Coluna gerada para Full Text Search
ALTER TABLE document_chunks ADD COLUMN fts_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', content)) STORED;

CREATE INDEX idx_document_chunks_fts ON document_chunks USING GIN (fts_vector);
```

## REPOSITORIES

### DocumentChunkRepository
| Método | Descrição |
| --- | --- |
| `createBatch(chunks)` | Inserir múltiplos chunks em uma transação |
| `deleteByDocument(documentId)` | Soft delete de todos os chunks de um documento |
| `getByDocument(documentId)` | Listar chunks de um documento (ordenado por seq) |
| `findByHash(contentHash)` | Buscar chunk existente por hash (cache de embedding) |

### DocumentRepository
| Método | Descrição |
| --- | --- |
| `getById(docId)` | Obter documento (type, status) |
| `updateStatus(docId, status)` | Atualizar status do documento |

## SERVICES

### ChunkService
| Método | Descrição |
| --- | --- |
| `chunk(documentId, text, options?)` | Orquestrar chunking completo |
| `selectStrategy(documentType)` | Escolher estratégia baseada no tipo |
| `fixedChunk(text, options)` | Estratégia de tamanho fixo |
| `structuralChunk(text, options)` | Estratégia estrutural (headings/seções) |
| `computeHash(content)` | SHA-256 do conteúdo normalizado |
| `buildMetadata(chunk, docType, options)` | Construir metadata do chunk |

### Fluxo do método `chunk`
1. `DocumentRepository.getById(documentId)` → obter `document.type`
2. `selectStrategy(document.type)` → escolher fixed ou structural
3. Executar estratégia → array de `{ content, char_start, char_end, ... }`
4. Para cada chunk: `computeHash(content)` → `content_hash`
5. `DocumentChunkRepository.deleteByDocument(documentId)` — limpar chunks antigos
6. `DocumentChunkRepository.createBatch(chunks)` — inserir novos
7. Emitir evento `DocumentChunked`
8. Retornar chunks (sem o campo content para reduzir payload)

### Algoritmo de chunking fixo
```
cursor = 0
seq = 0
chunks = []

while cursor < text.length:
    end = min(cursor + chunk_size, text.length)
    if end < text.length:
        // Procurar ponto de quebra natural (parágrafo, frase)
        breakpoint = findBreakpoint(text, end - overlap, end)
        end = breakpoint
    
    chunk_content = text.substring(cursor, end)
    chunks.push({ seq, content: chunk_content, char_start: cursor, char_end: end })
    
    cursor = end - overlap  // Sobreposição
    seq++

return chunks
```

## DTO

### ChunkResultDto (output)
```typescript
{
  document_id: string,
  chunks: {
    id: string,
    seq: number,
    content_hash: string,
    char_start: number,
    char_end: number,
    page?: number,
    section_title?: string
  }[],
  chunk_count: number,
  strategy: string
}
```

### Mapper
- `toChunkResultDto(documentId, chunks, strategy): ChunkResultDto`
- ⚠️ Não incluir `content` no DTO externo (payload grande, sensível)

## API

### Interna (não exposta ao cliente)
Chunk Engine é acionada automaticamente após Metadata Engine, sem endpoint público.

### Fluxo de chamada
1. `MetadataExtracted` → dispara `ChunkService.chunk()`
2. Pipeline interno
3. Status do documento: `processing` → `chunking`
4. Ao concluir: status → `chunked`, emite `DocumentChunked` (que dispara Embedding Engine)

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `DocumentChunked` | `{ document_id, chunk_count, strategy }` | Após chunks criados com sucesso |

### Consumidos
| Evento | Origem | Ação |
| --- | --- | --- |
| `MetadataExtracted` | Metadata Engine | Dispara `ChunkService.chunk()` |

## CACHE

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `chunk:hash:{sha256}` | `chunk_id` | Permanente | Cache para deduplicação de embedding (usado pelo Embedding Engine) |

### Invalidação
- `chunk:hash:{sha256}` invalidado apenas se chunk for deletado

## OBSERVABILITY

### Logs
```
[INFO] Chunking started: document={docId} type={docType} text_length={chars} strategy={strategy}
[INFO] Chunking completed: document={docId} chunk_count={n} avg_size={bytes} duration_ms={ms}
[WARN] Large chunk detected: document={docId} seq={n} size={chars} (exceeds chunk_size)
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `chunking_documents_total` | Counter | Documentos chunked |
| `chunking_chunks_total` | Counter | Total de chunks gerados |
| `chunking_avg_chunk_size` | Gauge | Tamanho médio dos chunks |
| `chunking_duration_ms` | Histogram | Latência do chunking |
| `chunking_strategy_usage` | Counter | Distribuição por estratégia |

### Alertas
- `chunking_avg_chunk_size > 1500` — chunks muito grandes
- `chunking_avg_chunk_size < 200` — chunks muito pequenos (documento mal formatado)

## TESTS

### Unitários
- [ ] `fixedChunk` divide texto de 3000 chars em 3 chunks (1000 + overlap)
- [ ] `fixedChunk` não quebra no meio de palavra
- [ ] `fixedChunk` preserva overlap de 200 chars entre chunk 0 e chunk 1
- [ ] `structuralChunk` divide Markdown por headings (##)
- [ ] `structuralChunk` preserva `section_title` no metadata
- [ ] `computeHash` gera SHA-256 consistente
- [ ] `selectStrategy` retorna `structural` para Markdown, `fixed` para TXT

### Integração
- [ ] Documento PDF de 10 páginas gera chunks com `page` no metadata
- [ ] Chunks são ordenados por `seq` crescente
- [ ] `content_hash` é único por conteúdo (mesmo conteúdo = mesmo hash)
- [ ] Soft delete de chunks antigos antes de inserir novos
- [ ] Evento `DocumentChunked` é emitido com `chunk_count` correto

### E2E
- [ ] Upload → Metadata → Chunking → chunks visíveis no debug panel (admin)

## ACCEPTANCE CRITERIA

1. ✅ Documento é dividido em chunks de ~1000 caracteres com overlap de 200
2. ✅ Nenhum chunk quebra no meio de uma palavra
3. ✅ Chunks preservam parágrafos e frases (quebra em limites naturais)
4. ✅ Documentos Markdown/HTML usam estratégia estrutural (headings)
5. ✅ Metadados do chunk incluem `char_start`, `char_end`, e `page`/`section_title` quando aplicável
6. ✅ `content_hash` (SHA-256) é único por conteúdo
7. ✅ Chunks antigos são removidos (soft delete) antes de criar novos (rechunking)
8. ✅ Documento com texto vazio gera 0 chunks (não falha)
9. ✅ Documento com texto menor que chunk_size gera 1 chunk
10. ✅ Índice GIN (`fts_vector`) é criado e populado automaticamente

## IMPLEMENTATION ORDER

1. **Expansão `document_chunks`** — Adicionar coluna `fts_vector` (GENERATED, tsvector)
2. **`src/lib/knowledge/pipeline/chunker.ts`** — Função `fixedChunk()`
3. **`src/lib/knowledge/pipeline/strategies/structural.ts`** — Função `structuralChunk()`
4. **`ChunkService`** — Orquestrador `chunk()` com seleção de estratégia
5. **`DocumentChunkRepository`** — `createBatch`, `deleteByDocument`, `findByHash`
6. **Integração com pipeline** — Conectar ao evento `MetadataExtracted`
7. **Índice GIN** — Migration para `fts_vector`
8. **DTO + Mapper** — `ChunkResultDto`
9. **Testes**
