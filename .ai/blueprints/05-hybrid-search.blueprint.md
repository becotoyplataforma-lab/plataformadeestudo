# 05 — HYBRID SEARCH BLUEPRINT

## PURPOSE
Realizar busca combinada (vetorial + Full Text Search) sobre os documentos do usuário, retornando os chunks mais relevantes ranqueados por um score híbrido (70% vetorial + 30% textual), com filtros por matéria, tópico e tags.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `query` | `string` | ✅ | Texto da busca (1-500 caracteres) |
| `user_id` | `UUID` | ✅ | Usuário (escopo de busca) |
| `filters` | `SearchFilters` | ❌ | Refinamento opcional |
| `top_k` | `integer` | ❌ | Limite de resultados (default: 10, max: 50) |
| `weights` | `{ vector: number, fts: number }` | ❌ | Pesos (default: 0.7, 0.3) |

```
SearchFilters {
  subject_id?: UUID           // Filtrar por matéria
  topic_id?: UUID             // Filtrar por tópico
  document_id?: UUID          // Filtrar por documento específico
  tag_ids?: UUID[]            // Filtrar por tags
  date_from?: ISO8601         // Documentos enviados a partir de
  date_to?: ISO8601           // Documentos enviados até
}
```

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `results` | `SearchResult[]` | Resultados ranqueados |
| `total_hits` | `integer` | Total de resultados (antes do top_k) |
| `query_time_ms` | `integer` | Tempo total da query |
| `search_breakdown` | `SearchBreakdown` | Detalhamento dos scores |

```
SearchResult {
  chunk_id: UUID
  document_id: UUID
  document_title: string
  content: string              // Trecho do chunk (truncado a 300 chars)
  score: number                // Score híbrido combinado (0-1)
  vector_score: number         // Score vetorial puro
  fts_score: number            // Score FTS puro
  page?: number
  section_title?: string
  subject_name?: string
  highlights: string[]         // Trechos com match destacado
}

SearchBreakdown {
  vector_hits: number
  fts_hits: number
  combined_hits: number        // Intersecção
  vector_only: number          // Só na busca vetorial
  fts_only: number             // Só na busca FTS
}
```

## DEPENDENCIES

### Serviços externos
- **BAAI/bge-m3:** Embedding da query de busca

### Módulos internos
- `src/lib/knowledge/retrieval/hybrid-search.ts`
- `src/lib/knowledge/retrieval/query-builder.ts`

### Bibliotecas
- `pgvector` — busca vetorial (cosine_distance)
- PostgreSQL FTS — `ts_rank`, `tsquery`, `to_tsvector('portuguese', ...)`

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `embeddings` | `chunk_id`, `embedding` | Busca vetorial |
| `document_chunks` | `id`, `document_id`, `content`, `fts_vector`, `metadata`, `seq` | FTS + metadados |
| `documents` | `id`, `user_id`, `title`, `status` | Filtro de ownership + título |
| `document_subjects` | `document_id`, `subject_id` | Filtro por matéria |
| `document_topics` | `document_id`, `topic_id` | Filtro por tópico |
| `document_tags` | `document_id`, `tag_id` | Filtro por tags |
| `knowledge_subjects` | `id`, `name` | Nome da matéria no resultado |

### Query SQL (conceitual — implementar via Repository)
```sql
-- 1. Embedding da query (gerado pelo serviço)
-- query_embedding = [1024 floats]

-- 2. Busca vetorial
WITH vector_results AS (
  SELECT
    e.chunk_id,
    1 - cosine_distance(e.embedding, $query_embedding) AS score
  FROM embeddings e
  JOIN document_chunks dc ON dc.id = e.chunk_id
  JOIN documents d ON d.id = dc.document_id
  WHERE d.user_id = $user_id
    AND d.deleted_at IS NULL
    AND dc.deleted_at IS NULL
    -- Filtros opcionais
    AND ($subject_id IS NULL OR EXISTS (
      SELECT 1 FROM document_subjects ds WHERE ds.document_id = d.id AND ds.subject_id = $subject_id
    ))
  ORDER BY score DESC
  LIMIT 20
),

-- 3. Busca FTS
fts_results AS (
  SELECT
    dc.id AS chunk_id,
    ts_rank(dc.fts_vector, plainto_tsquery('portuguese', $query)) AS score
  FROM document_chunks dc
  JOIN documents d ON d.id = dc.document_id
  WHERE d.user_id = $user_id
    AND d.deleted_at IS NULL
    AND dc.deleted_at IS NULL
    AND dc.fts_vector @@ plainto_tsquery('portuguese', $query)
    -- Filtros opcionais
  ORDER BY score DESC
  LIMIT 20
),

-- 4. Combinação híbrida
combined AS (
  SELECT
    COALESCE(v.chunk_id, f.chunk_id) AS chunk_id,
    COALESCE(v.score, 0) * $vector_weight + COALESCE(f.score, 0) * $fts_weight AS hybrid_score,
    COALESCE(v.score, 0) AS vector_score,
    COALESCE(f.score, 0) AS fts_score
  FROM vector_results v
  FULL OUTER JOIN fts_results f ON v.chunk_id = f.chunk_id
  ORDER BY hybrid_score DESC
  LIMIT $top_k
)

SELECT
  c.*,
  dc.document_id,
  d.title AS document_title,
  LEFT(dc.content, 300) AS content,
  dc.metadata,
  ks.name AS subject_name
FROM combined c
JOIN document_chunks dc ON dc.id = c.chunk_id
JOIN documents d ON d.id = dc.document_id
LEFT JOIN document_subjects ds ON ds.document_id = d.id
LEFT JOIN knowledge_subjects ks ON ks.id = ds.subject_id
ORDER BY c.hybrid_score DESC;
```

## REPOSITORIES

### HybridSearchRepository
| Método | Descrição |
| --- | --- |
| `search(userId, queryEmbedding, queryText, filters, topK, weights)` | Executar busca híbrida completa |
| `vectorSearch(userId, embedding, filters, limit)` | Busca apenas vetorial |
| `ftsSearch(userId, query, filters, limit)` | Busca apenas FTS |
| `getUserDocumentIds(userId)` | Listar IDs de documentos ativos do usuário |

## SERVICES

### HybridSearchService
| Método | Descrição |
| --- | --- |
| `search(userId, query, filters?, topK?, weights?)` | Orquestrar busca híbrida |
| `generateQueryEmbedding(query)` | Gerar embedding da query |
| `applyFilters(query, filters)` | Adicionar cláusulas WHERE condicionais |
| `combineScores(vectorResults, ftsResults, weights)` | Combinar scores |
| `buildResults(combined, topK)` | Construir DTO de resultado |

### Fluxo do método `search`
1. Validar `query` (Zod: 1-500 chars)
2. `generateQueryEmbedding(query)` → vetor 1024d
3. `HybridSearchRepository.search(userId, queryEmbedding, query, filters, topK, weights)`
4. `buildResults(combined, topK)` → `SearchResult[]`
5. Emitir evento `SearchPerformed`
6. Retornar `SearchResultDto`

### Tratamento de query vazia ou curta
- Query com < 3 caracteres: apenas FTS (vetorial ineficaz)
- Query sem resultados: retornar array vazio, não erro

## DTO

### SearchRequestDto (input)
```typescript
{
  query: string,               // 1-500 chars
  subject_id?: string,         // UUID
  topic_id?: string,           // UUID
  document_id?: string,        // UUID
  tags?: string[],             // tag slugs
  top_k?: number,              // 1-50, default 10
}
```

### SearchResultDto (output)
```typescript
{
  results: {
    chunk_id: string,
    document_id: string,
    document_title: string,
    content: string,           // Truncado a 300 chars
    score: number,
    page?: number,
    section_title?: string,
    subject_name?: string,
    highlights: string[]
  }[],
  total_hits: number,
  query_time_ms: number
}
```

### Mapper
- `toSearchResultDto(results, totalHits, queryTime): SearchResultDto`

## API

### `POST /api/knowledge/search`

- **Auth:** Obrigatória
- **Rate Limit:** 30/min (Free), 100/min (Pro)

**Request:**
```json
{
  "query": "direitos fundamentais artigo 5",
  "subject_id": "uuid-opcional",
  "top_k": 10
}
```

**Response 200:**
```json
{
  "results": [
    {
      "chunk_id": "uuid",
      "document_id": "uuid",
      "document_title": "CF88 - Título II.pdf",
      "content": "Art. 5º Todos são iguais perante a lei...",
      "score": 0.92,
      "page": 3,
      "section_title": "Dos Direitos e Deveres Individuais e Coletivos",
      "subject_name": "Direito Constitucional",
      "highlights": ["<mark>Art. 5º</mark> Todos são iguais..."]
    }
  ],
  "total_hits": 42,
  "query_time_ms": 187
}
```

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `SearchPerformed` | `{ user_id, query_hash, filters, result_count, query_time_ms }` | Após cada busca |

### Consumidos
- Nenhum (sob demanda)

## CACHE

### Cache de query embedding

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `query:emb:{sha256}` | `[1024 floats]` | 24h | Reuso do embedding da query |
| `search:{userId}:{queryHash}:{filtersHash}:{topK}` | `SearchResult[]` (serializado) | 1h | Cache de resultados |

### Invalidação
- `query:emb:*` — TTL fixo, sem invalidação
- `search:*` — Invalidar quando documentos do usuário são alterados (upload, reindex, delete)

## OBSERVABILITY

### Logs
```
[INFO] Search performed: user={userId} query_hash={hash} results={n} time_ms={ms}
[WARN] Slow search: user={userId} query_hash={hash} time_ms={ms} (threshold: 1000ms)
[INFO] Search empty: user={userId} query_hash={hash} (no results)
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `search_requests_total` | Counter | Total de buscas |
| `search_empty_results_total` | Counter | Buscas sem resultados |
| `search_results_count` | Histogram | Distribuição de hits |
| `search_duration_ms` | Histogram | Latência da busca |
| `search_cache_hit_rate` | Gauge | Taxa de cache hit |

### Alertas
- `search_duration_ms_p95 > 1000` — latência alta
- `search_empty_results_rate > 30%` — possível problema no índice ou query mal formatada

## TESTS

### Unitários
- [ ] `combineScores` aplica pesos corretamente (0.7, 0.3)
- [ ] `combineScores` lida com resultados de apenas uma fonte (vetorial-only, FTS-only)
- [ ] `applyFilters` gera SQL condicional correto
- [ ] `generateQueryEmbedding` retorna vetor 1024d
- [ ] `toSearchResultDto` trunca content a 300 chars

### Integração
- [ ] Busca "direito constitucional" retorna chunks relevantes
- [ ] Busca com `subject_id` filtra corretamente
- [ ] Busca com `document_id` limita a um documento
- [ ] Query com < 3 caracteres usa apenas FTS
- [ ] Resultados pertencem apenas ao `user_id` da busca
- [ ] `SearchPerformed` é emitido

### E2E
- [ ] Usuário faz upload de PDF → busca texto do PDF → resultados aparecem

## ACCEPTANCE CRITERIA

1. ✅ Busca retorna resultados combinados (vetorial + FTS) ordenados por score híbrido
2. ✅ Score híbrido = 70% vetorial + 30% FTS (configurável)
3. ✅ Resultados filtrados por `user_id` (RLS)
4. ✅ Filtros opcionais funcionam: subject_id, topic_id, document_id, tags
5. ✅ Top-K configurável (default 10, max 50)
6. ✅ Latência < 500ms (p95) para query típica
7. ✅ Cache de query embedding (24h) e resultados (1h)
8. ✅ Query vazia ou muito curta não quebra
9. ✅ Content truncado a 300 caracteres no resultado
10. ✅ Highlights indicam termos match (via ts_headline)

## IMPLEMENTATION ORDER

1. **Índices** — Confirmar HNSW em `embeddings` + GIN em `document_chunks.fts_vector`
2. **`HybridSearchRepository`** — Query SQL combinada com CTEs
3. **`src/lib/knowledge/retrieval/hybrid-search.ts`** — `HybridSearchService.search()`
4. **`src/lib/knowledge/retrieval/query-builder.ts`** — Filtros condicionais
5. **Cache** — Redis keys para query embedding + resultados
6. **`POST /api/knowledge/search`** — Route handler
7. **DTO + Mapper** — `SearchRequestDto`, `SearchResultDto`
8. **Testes**
