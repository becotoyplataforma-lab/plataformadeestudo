# 10 — SUMMARY BLUEPRINT

## PURPOSE
Gerar resumos concisos e estruturados a partir de documentos ou tópicos de estudo, com extração de ideias principais, tópicos-chave e taxa de compressão. Os resumos são persistidos para acesso rápido e indexados para busca.

> **Fase:** V1.1 — No MVP, resumos são gerados sob demanda no chat (Professor IA), sem persistência.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `source` | `GenerationSource` | ✅ | Origem do conteúdo |
| `style` | `SummaryStyle` | ❌ | Estilo do resumo |
| `max_length` | `integer` | ❌ | Tamanho máximo em caracteres (default: 1500) |
| `language` | `string` | ❌ | Idioma de saída (default: pt-BR) |

```
GenerationSource {
  type: 'document' | 'topic' | 'chunks'
  document_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
  chunk_ids?: UUID[]
}

SummaryStyle: 'concise' | 'detailed' | 'bullet_points' | 'topics'
```

### Estilos de resumo
| Estilo | Descrição | Tamanho típico |
| --- | --- | --- |
| `concise` | Resumo enxuto, 1-2 parágrafos | ~15% do original |
| `detailed` | Resumo completo, 3-5 parágrafos | ~30% do original |
| `bullet_points` | Tópicos em bullet list | ~10% do original |
| `topics` | Apenas tópicos-chave (5-10 itens) | ~5% do original |

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `summary` | `GeneratedSummary` | Resumo gerado |
| `tokens_used` | `integer` | Tokens consumidos |
| `source_info` | `SourceInfo` | Resumo da origem |

```
GeneratedSummary {
  id: UUID
  document_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
  title: string                // Título do resumo
  content: string              // Texto do resumo (markdown)
  key_topics: string[]         // Tópicos-chave extraídos
  style: SummaryStyle
  compression_ratio: number    // tamanho_resumo / tamanho_original
  original_length: number      // Caracteres do texto original
  summary_length: number       // Caracteres do resumo
  status: 'draft'              // Sempre começa como draft
  tokens_used: integer
  created_at: ISO8601
}
```

## DEPENDENCIES

### Engines
- **Hybrid Search Engine:** Recuperar chunks quando `source.type = 'topic'`

### Serviços externos
- **DeepSeek API:** `deepseek-chat` para sumarização

### Módulos internos
- `src/lib/engines/generation/summary-engine.ts`
- `src/lib/engines/generation/prompts/summary-prompts.ts`

### Bibliotecas
- `zod` — validação

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `documents` | `id`, `title`, `user_id`, `metadata` | Validar origem, obter título |
| `knowledge_subjects` | `id`, `name` | Nome da matéria |
| `knowledge_topics` | `id`, `name` | Nome do tópico |

### Tabelas escritas (V1.1)
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `summaries` | `id`, `document_id`, `subject_id`, `topic_id`, `title`, `content`, `key_topics`, `style`, `compression_ratio`, `original_length`, `summary_length`, `status`, `tokens_used`, `created_at` | INSERT |

### Estrutura de `summaries` (V1.1)
```sql
CREATE TABLE summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  subject_id UUID REFERENCES knowledge_subjects(id),
  topic_id UUID REFERENCES knowledge_topics(id),
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  key_topics JSONB NOT NULL DEFAULT '[]',
  style VARCHAR(30) NOT NULL DEFAULT 'concise',
  compression_ratio DECIMAL(5,2),
  original_length INTEGER,
  summary_length INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  user_id UUID REFERENCES auth.users(id),
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_summaries_document ON summaries(document_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_summaries_subject ON summaries(subject_id) WHERE deleted_at IS NULL;
```

### Política RLS
- `summaries`: usuário acessa resumos de documentos próprios ou resumos de tópicos (públicos)

```sql
CREATE POLICY "Users can read own summaries" ON summaries
  FOR SELECT USING (
    auth.uid() = user_id
    OR (document_id IS NULL AND subject_id IS NOT NULL)  -- Resumos de tópico são públicos
  );
```

## REPOSITORIES

### SummaryRepository
| Método | Descrição |
| --- | --- |
| `create(summary)` | Criar resumo |
| `getByDocument(documentId)` | Resumos de um documento |
| `getByTopic(subjectId, topicId?)` | Resumos de tópico |
| `getById(summaryId)` | Obter resumo específico |
| `delete(summaryId)` | Soft delete |
| `regenerate(summaryId)` | Marcar para regeneração |

### DocumentRepository
| Método | Descrição |
| --- | --- |
| `getById(docId)` | Obter documento (título, user_id) |
| `updateMetadata(docId, meta)` | Atualizar `has_summary: true` |

## SERVICES

### SummaryGenerationService
| Método | Descrição |
| --- | --- |
| `generate(source, style?, maxLength?)` | Orquestrar geração |
| `buildPrompt(text, style, maxLength)` | Construir prompt |
| `validateOutput(raw)` | Validar saída |
| `calculateCompression(original, summary)` | Calcular taxa de compressão |
| `extractKeyTopics(summary)` | Extrair tópicos-chave do resumo |
| `storeSummary(summary)` | Persistir |
| `getFullText(source)` | Obter texto completo (concatenar chunks) |

### Estratégia Map-Reduce (documentos longos)

Para documentos com mais de 10.000 caracteres, usar abordagem map-reduce:

1. **Map:** Dividir chunks em lotes de 5
2. **Resumir cada lote:** Chamar LLM para resumir cada lote
3. **Reduce:** Concatenar resumos parciais e chamar LLM para resumo final
4. **Merge:** Mesclar key_topics de todos os lotes

### Fluxo do método `generate`
1. Validar inputs (Zod)
2. `getFullText(source)` → texto completo (concatenar chunks)
3. Se `text.length > 10000`: usar map-reduce
4. Senão: sumarização direta
5. `buildPrompt(text, style, maxLength)` → prompt
6. Chamar DeepSeek
7. `validateOutput(raw)` → validar
8. `calculateCompression(original, summary)` → compression_ratio
9. `extractKeyTopics(summary)` → key_topics
10. `storeSummary(summary)` → INSERT
11. Atualizar `documents.metadata.has_summary = true`
12. Emitir `SummaryGenerated`
13. Retornar DTO

### Prompt template
```
Resuma o texto a seguir no estilo "{style}".

ESTILO:
- concise: Resumo enxuto de 1-2 parágrafos, destacando apenas o essencial.
- detailed: Resumo completo de 3-5 parágrafos, cobrindo todos os pontos principais.
- bullet_points: Lista de tópicos em bullet points (•), cada um com 1-2 frases.
- topics: Apenas os tópicos-chave (5-10 itens), sem desenvolvimento.

TAMANHO MÁXIMO: {max_length} caracteres.

TEXTO ORIGINAL:
{text}

FORMATO DE SAÍDA (JSON):
{{
  "title": "título do resumo",
  "content": "texto do resumo (markdown)",
  "key_topics": ["tópico 1", "tópico 2", "..."]
}}
```

## DTO

### SummaryGenRequestDto (input)
```typescript
{
  source: {
    type: 'document' | 'topic' | 'chunks',
    document_id?: string,
    subject_id?: string,
    topic_id?: string
  },
  style?: 'concise' | 'detailed' | 'bullet_points' | 'topics',
  max_length?: number          // default: 1500
}
```

### SummaryGenResponseDto (output)
```typescript
{
  summary: {
    id: string,
    title: string,
    content: string,           // Markdown
    key_topics: string[],
    style: string,
    compression_ratio: number,
    original_length: number,
    summary_length: number
  },
  tokens_used: number,
  source: {
    type: string,
    document_title?: string,
    subject_name?: string,
    topic_name?: string
  }
}
```

### Mapper
- `toSummaryGenResponseDto(summary, tokens, source): SummaryGenResponseDto`

## API

### `POST /api/knowledge/generate/summary` (V1.1)

- **Auth:** Obrigatória
- **Rate Limit:** 5/dia (Free), 20/dia (Pro)

**Request:**
```json
{
  "source": { "type": "document", "document_id": "uuid" },
  "style": "detailed",
  "max_length": 2000
}
```

**Response 201:**
```json
{
  "summary": {
    "id": "uuid",
    "title": "Resumo: Direitos Fundamentais - Art. 5º CF/88",
    "content": "## Direitos Fundamentais\n\nO Art. 5º da Constituição Federal...",
    "key_topics": ["Direito à vida", "Igualdade", "Legalidade", "Liberdade de expressão"],
    "style": "detailed",
    "compression_ratio": 0.28,
    "original_length": 12500,
    "summary_length": 1980
  },
  "tokens_used": 2400,
  "source": {
    "type": "document",
    "document_title": "CF88-Titulo-II.pdf"
  }
}
```

### `GET /api/knowledge/summaries?document_id={id}`
Listar resumos de um documento.

### `DELETE /api/knowledge/summaries/{id}`
Soft delete de um resumo.

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `SummaryGenerated` | `{ summary_id, document_id?, subject_id?, style, compression_ratio, tokens_used }` | Após geração |
| `SummaryRegenerated` | `{ summary_id, tokens_used }` | Após regeneração |

### Consumidos
- `DocumentUpdated` → invalidar resumos do documento (marcar para regeneração)

## CACHE

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `summary:{documentId}:{style}` | `SummaryResponseDto` | Até documento mudar | Cache de resumo de documento |
| `summary:{subjectId}:{topicId?}:{style}` | `SummaryResponseDto` | 24h | Cache de resumo de tópico |

### Invalidação
- `summary:{documentId}:*` invalidado quando documento é atualizado (reupload, rechunk)
- `summary:{subjectId}:*` TTL fixo (tópicos não mudam com frequência)

## OBSERVABILITY

### Logs
```
[INFO] Summary generation: source={type}:{id} style={style} text_length={n}
[INFO] Summary map-reduce: document={id} batches={n}
[INFO] Summary completed: id={id} compression={ratio} tokens={t} duration_ms={ms}
[WARN] Summary too long: id={id} max_length={max} actual_length={actual}
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `summary_gen_total` | Counter | Gerações iniciadas |
| `summary_gen_completed` | Counter | Gerações concluídas |
| `summary_gen_map_reduce_total` | Counter | Sumarizações via map-reduce |
| `summary_compression_ratio` | Histogram | Distribuição de compressão |
| `summary_gen_tokens` | Histogram | Tokens por geração |
| `summary_gen_duration_ms` | Histogram | Latência |

### Alertas
- `summary_compression_ratio_avg > 0.5` — resumos muito longos (não estão resumindo)
- `summary_gen_duration_ms_p95 > 30000` — map-reduce pode estar lento

## TESTS

### Unitários
- [ ] `buildPrompt` inclui estilo e max_length
- [ ] `validateOutput` rejeita content vazio
- [ ] `validateOutput` aceita key_topics como array
- [ ] `calculateCompression` retorna 0.25 para 1000/4000
- [ ] `extractKeyTopics` retorna array de strings
- [ ] Map-reduce: documento de 15k chars é dividido em lotes

### Integração
- [ ] Estilo `concise`: resumo de ~15% do original
- [ ] Estilo `bullet_points`: saída em Markdown com bullets
- [ ] Estilo `topics`: apenas 5-10 tópicos
- [ ] `summaries` populado com `compression_ratio`
- [ ] `documents.metadata.has_summary = true` após geração
- [ ] Documento muito longo usa map-reduce
- [ ] `SummaryGenerated` emitido

### E2E
- [ ] Usuário: "Resuma este edital" → resumo gerado → visível na página do documento

## ACCEPTANCE CRITERIA

1. ✅ Resumo gerado no estilo solicitado (`concise`, `detailed`, `bullet_points`, `topics`)
2. ✅ Tamanho do resumo ≤ `max_length` caracteres
3. ✅ `compression_ratio` calculado corretamente (resumo/original)
4. ✅ `key_topics` extraídos (3-10 tópicos)
5. ✅ Documentos longos (>10k chars) usam estratégia map-reduce
6. ✅ Resumos de tópicos (subject/topic) são públicos (leitura para todos)
7. ✅ Resumos de documentos são privados (RLS via user_id do documento)
8. ✅ Atualização do documento invalida resumos existentes
9. ✅ Regeneração disponível (usuário pode solicitar novo resumo)
10. ✅ Resumo formatado em Markdown para melhor legibilidade

## IMPLEMENTATION ORDER

1. **Migration `summaries`** — Criar tabela (V1.1)
2. **`src/lib/engines/generation/prompts/summary-prompts.ts`** — Templates por estilo
3. **`SummaryGenerationService`** — `generate()` com map-reduce
4. **Map-Reduce** — Implementar estratégia para documentos longos
5. **`SummaryRepository`** — CRUD
6. **`POST /api/knowledge/generate/summary`** — Endpoint
7. **`GET /api/knowledge/summaries`** — Listagem
8. **`DELETE /api/knowledge/summaries/{id}`** — Soft delete
9. **Integração com AI Professor** — Modo `summary` no chat
10. **Cache** — Redis keys `summary:*`
11. **DTO + Mapper** — `SummaryGenRequestDto`, `SummaryGenResponseDto`
12. **Testes**
