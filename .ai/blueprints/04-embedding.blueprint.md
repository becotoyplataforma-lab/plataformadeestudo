# 04 — EMBEDDING BLUEPRINT

## PURPOSE
Gerar vetores de representação semântica (embeddings) de dimensão 1024 para cada chunk de documento usando o modelo BAAI/bge-m3, com cache por hash de conteúdo e armazenamento em pgvector.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `document_id` | `UUID` | ✅ | Documento origem |
| `chunk_ids` | `UUID[]` | ❌ | Chunks específicos (default: todos os pendentes do documento) |
| `model` | `string` | ❌ | Modelo (default: `BAAI/bge-m3`) |

### Pré-condições
- Documento com status `chunked`
- Chunks existentes em `document_chunks` (com `content`)
- Modelo BAAI/bge-m3 disponível (self-hosted ou API)
- pgvector instalado no Supabase

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `results` | `EmbeddingResult[]` | Resultados por chunk |
| `cached_count` | `integer` | Chunks que usaram embedding do cache |
| `generated_count` | `integer` | Chunks com embedding novo gerado |
| `failed_count` | `integer` | Chunks que falharam |
| `model` | `string` | Modelo usado |

```
EmbeddingResult {
  chunk_id: UUID
  embedding_id: UUID?          // null se falhou
  from_cache: boolean
  status: 'success' | 'failed'
  error?: string
}
```

## DEPENDENCIES

### Serviços externos
- **BAAI/bge-m3:** Modelo de embedding self-hosted (GPU recomendada) ou API
- **Alternativa (fallback):** OpenAI text-embedding-3-small (emergência apenas)

### Módulos internos
- `src/lib/knowledge/pipeline/embedder.ts`
- `src/lib/knowledge/embedding/cache.ts`

### Bibliotecas
- `pgvector` — extensão PostgreSQL
- `@xenova/transformers` (ou similar) — inferência local (opcional)
- SDK do provedor de embedding

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `document_chunks` | `id`, `content`, `content_hash`, `document_id` | Obter chunks pendentes |
| `embeddings` | `chunk_id`, `model` | Verificar se chunk já tem embedding |

### Tabelas escritas
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `embeddings` | `id`, `chunk_id`, `model`, `embedding`, `created_at` | INSERT (batch) |

### Índice HNSW
```sql
-- Criar índice vetorial (executar uma vez na migration)
CREATE INDEX idx_embeddings_hnsw ON embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 200);
```

### Estrutura da tabela `embeddings`
```sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chunk_id UUID NOT NULL REFERENCES document_chunks(id) ON DELETE CASCADE,
  model VARCHAR(100) NOT NULL DEFAULT 'BAAI/bge-m3',
  embedding VECTOR(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (chunk_id)
);
```

### Política RLS
```sql
-- embeddings: acesso herdado do chunk → documento → user
CREATE POLICY "Users can access embeddings of own chunks" ON embeddings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM document_chunks dc
      JOIN documents d ON d.id = dc.document_id
      WHERE dc.id = embeddings.chunk_id
      AND d.user_id = auth.uid()
      AND d.deleted_at IS NULL
    )
  );
```

## REPOSITORIES

### EmbeddingRepository
| Método | Descrição |
| --- | --- |
| `createBatch(embeddings)` | Inserir múltiplos embeddings |
| `findByChunkId(chunkId)` | Buscar embedding existente |
| `deleteByDocumentId(docId)` | Remover embeddings de todos os chunks do documento |
| `findByChunkIds(chunkIds)` | Buscar embeddings por lista de chunk IDs |

### DocumentChunkRepository
| Método | Descrição |
| --- | --- |
| `getPendingChunks(documentId)` | Chunks sem embedding (LEFT JOIN embeddings) |
| `getByHash(contentHash)` | Buscar chunk por content_hash (cache hit) |

### DocumentRepository
| Método | Descrição |
| --- | --- |
| `updateStatus(docId, status)` | Atualizar status para `indexed` |

### EmbeddingCacheRepository (Redis ou tabela)
| Método | Descrição |
| --- | --- |
| `get(hash, model)` | Buscar embedding cachedo |
| `set(hash, model, embedding)` | Armazenar embedding |
| `invalidateByModel(model)` | Invalidar cache para um modelo (migration) |

## SERVICES

### EmbeddingService
| Método | Descrição |
| --- | --- |
| `embedDocument(documentId)` | Orquestrar embedding de todos os chunks pendentes |
| `embedChunks(chunks)` | Gerar embeddings para lista de chunks |
| `checkCache(contentHash, model)` | Verificar se embedding já existe no cache |
| `generateEmbedding(content)` | Chamar BAAI/bge-m3 para gerar vetor |
| `storeEmbeddings(results)` | Persistir embeddings no banco |

### Fluxo do método `embedDocument`
1. `DocumentChunkRepository.getPendingChunks(documentId)` → chunks sem embedding
2. Para cada chunk (em lotes de 20):
   a. `checkCache(chunk.content_hash, model)`
   b. Cache hit → reutilizar `embedding_id` existente
   c. Cache miss → `generateEmbedding(chunk.content)` → vetor 1024d
   d. Armazenar no cache: `EmbeddingCacheRepository.set(hash, model, embedding)`
3. `EmbeddingRepository.createBatch(results)` — INSERT em batch
4. `DocumentRepository.updateStatus(documentId, 'indexed')`
5. Emitir evento `EmbeddingsGenerated`

### Batch processing
- Enviar chunks em lotes de 20 para o modelo (otimização de GPU)
- Paralelizar lotes se houver múltiplas GPUs (V2)
- Timeout: 60s por lote

## DTO

### EmbeddingResultDto (output)
```typescript
{
  document_id: string,
  total_chunks: number,
  cached: number,
  generated: number,
  failed: number,
  model: string,
  duration_ms: number
}
```

### Mapper
- `toEmbeddingResultDto(documentId, results, model, duration): EmbeddingResultDto`
- ⚠️ Nunca expor o vetor `embedding` em DTOs públicos

## API

### Interna (não exposta ao cliente)
Embedding Engine é acionada automaticamente após Chunk Engine.

### Fluxo de chamada
1. `DocumentChunked` → dispara `EmbeddingService.embedDocument()`
2. Status do documento: `chunked` → `indexing`
3. Ao concluir: status → `indexed`

### Endpoint administrativo (admin only)
`POST /api/admin/documents/{documentId}/reindex` — Força reindexação de um documento

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `EmbeddingsGenerated` | `{ document_id, total_chunks, cached, generated, failed, model }` | Após todos os embeddings gerados |

### Consumidos
| Evento | Origem | Ação |
| --- | --- | --- |
| `DocumentChunked` | Chunk Engine | Dispara `EmbeddingService.embedDocument()` |

## CACHE

### Cache de embeddings

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `emb:cache:{sha256}:{model}` | `[1024 floats]` (JSON ou binário) | Infinito (até modelo mudar) | Evitar re-embedding do mesmo conteúdo |

### Estrutura da tabela de cache (alternativa a Redis)
```sql
CREATE TABLE embedding_cache (
  content_hash VARCHAR(64) NOT NULL,
  model VARCHAR(100) NOT NULL,
  embedding VECTOR(1024) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (content_hash, model)
);
```

### Invalidação
- Cache invalidado apenas em migration de modelo (`EmbeddingCacheRepository.invalidateByModel(oldModel)`)
- Novo modelo → novos embeddings para todos os chunks

## OBSERVABILITY

### Logs
```
[INFO] Embedding started: document={docId} chunks_pending={n}
[INFO] Embedding batch: document={docId} batch={i}/{total} size={n}
[INFO] Embedding completed: document={docId} cached={n} generated={n} failed={n} duration_ms={ms}
[ERROR] Embedding failed: document={docId} chunk={chunkId} error={msg}
[WARN] Embedding cache hit rate low: {pct}% (model may have changed)
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `embedding_chunks_total` | Counter | Chunks processados |
| `embedding_cache_hits_total` | Counter | Cache hits |
| `embedding_cache_misses_total` | Counter | Cache misses |
| `embedding_generation_duration_ms` | Histogram | Latência de geração por chunk |
| `embedding_batch_duration_ms` | Histogram | Latência por lote de 20 |
| `embedding_failures_total` | Counter | Falhas de geração |

### Alertas
- `embedding_cache_hit_rate < 50%` — cache pode estar inválido ou modelo mudou
- `embedding_failure_rate > 5%` — problema no modelo ou conexão
- `embedding_generation_duration_ms_p95 > 2000` — latência alta

## TESTS

### Unitários
- [ ] `generateEmbedding` retorna vetor de 1024 dimensões
- [ ] `checkCache` retorna embedding cachedo para hash conhecido
- [ ] `checkCache` retorna null para hash desconhecido
- [ ] Batch de 20 chunks é processado corretamente
- [ ] `toEmbeddingResultDto` não expõe vetor

### Integração
- [ ] Chunk com conteúdo "Direito Constitucional" gera embedding ≠ chunk com "Matemática Financeira"
- [ ] Mesmo conteúdo em dois chunks gera cache hit no segundo
- [ ] Chunks sem embedding são detectados por `getPendingChunks`
- [ ] `EmbeddingsGenerated` é emitido com contagens corretas
- [ ] Status do documento atualiza para `indexed`

### E2E
- [ ] Upload → Chunking → Embedding → documento status `indexed` → busca funciona

## ACCEPTANCE CRITERIA

1. ✅ Cada chunk gera 1 embedding de 1024 dimensões (BAAI/bge-m3)
2. ✅ Cache por `content_hash` evita re-embedding (cache hit rate > 60% esperado)
3. ✅ Batch de 20 chunks por requisição ao modelo
4. ✅ Índice HNSW criado sobre `embeddings.embedding` com cosine similarity
5. ✅ Documento status transita: `chunked` → `indexing` → `indexed`
6. ✅ Se modelo falhar para 1 chunk, continua com os demais (não bloqueante)
7. ✅ Chunks sem embedding são rastreados (`failed_count`)
8. ✅ Embedding antigo é substituído se rechunking ocorrer (reprocessar)
9. ✅ Embeddings não são expostos em DTOs públicos
10. ✅ Tempo total < 30s para documento de 50 chunks (MVP síncrono)

## IMPLEMENTATION ORDER

1. **Verificar pgvector** — Extensão instalada no Supabase
2. **Migration `embeddings`** — Criar/ajustar tabela com VECTOR(1024) + índice HNSW
3. **`EmbeddingCacheRepository`** — Redis ou tabela `embedding_cache`
4. **`src/lib/knowledge/pipeline/embedder.ts`** — Função `generateEmbedding()` com chamada ao BAAI/bge-m3
5. **`EmbeddingService`** — Orquestrador `embedDocument()` com batch + cache
6. **`EmbeddingRepository`** — `createBatch`, `findByChunkId`, `deleteByDocumentId`
7. **Integração com pipeline** — Conectar ao evento `DocumentChunked`
8. **Endpoint admin** — `POST /api/admin/documents/{id}/reindex`
9. **DTO + Mapper** — `EmbeddingResultDto`
10. **Testes**
