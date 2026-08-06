# ENGINE ARCHITECTURE

> Arquitetura oficial das Engines reutilizáveis da plataforma ConcursoAI.
> Sem código, sem SQL, sem Drizzle. Apenas especificação arquitetural pura.
> Documentos existentes não foram alterados.

---

## 1. VISÃO GERAL

### 1.1. O que são Engines

Engines são **unidades de processamento reutilizáveis, autônomas e composáveis** que formam o pipeline da plataforma. Cada Engine tem contrato de entrada/saída bem definido, dependências explícitas e pode operar de forma síncrona (MVP) ou assíncrona (V1.1+).

### 1.2. Princípios de design

| Princípio | Descrição |
| --- | --- |
| **Single Responsibility** | Cada Engine faz exatamente uma coisa |
| **Input/Output Contract** | Entrada e saída tipadas (Zod), documentadas |
| **Stateless** | Engines não mantêm estado entre invocações |
| **Idempotent** | Mesma entrada → mesma saída (quando determinística) |
| **Observable** | Toda Engine emite eventos de início, sucesso e falha |
| **Replaceable** | Cada Engine pode ser substituída sem quebrar o pipeline |
| **Configurable** | Parâmetros via `system_settings` ou constantes de ambiente |

### 1.3. Visão do ecossistema

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ENGINE ECOSYSTEM                                 │
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │INGESTION │  │   OCR    │  │TRANSCRIBE│  │ METADATA │              │
│  │  ENGINE  │  │  ENGINE  │  │  ENGINE  │  │  ENGINE  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │              │                    │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐              │
│  │  CHUNK   │  │ EMBEDDING│  │ HYBRID   │  │   RAG    │              │
│  │  ENGINE  │  │  ENGINE  │  │ SEARCH   │  │  ENGINE  │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │              │                    │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐              │
│  │ QUESTION │  │FLASHCARD │  │ SUMMARY  │  │   AI     │              │
│  │GEN ENGINE│  │  ENGINE  │  │  ENGINE  │  │PROFESSOR │              │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│       │              │              │              │                    │
│  ┌────┴─────┐  ┌────┴─────┐  ┌────┴─────┐                             │
│  │RECOMMEND│  │  STUDY   │  │ANALYTICS │                             │
│  │ ENGINE  │  │ PLANNER  │  │  ENGINE  │                             │
│  └─────────┘  └──────────┘  └──────────┘                             │
└────────────────────────────────────────────────────────────────────────┘
```

### 1.4. Mapa de fases

| Engine | MVP | V1.1 | V2 |
| --- | :---: | :---: | :---: |
| Ingestion Engine | ✅ | — | — |
| OCR Engine | — | ✅ | — |
| Transcription Engine | — | ✅ | — |
| Metadata Engine | ✅ | — | — |
| Chunk Engine | ✅ | — | — |
| Embedding Engine | ✅ | — | — |
| Hybrid Search Engine | ✅ | — | — |
| RAG Engine | ✅ | — | — |
| Question Generation Engine | — | ✅ | — |
| Flashcard Engine | — | ✅ | — |
| Summary Engine | — | ✅ | — |
| AI Professor Engine | ✅ | — | — |
| Recommendation Engine | — | — | ✅ |
| Study Planner Engine | — | ✅ | — |
| Analytics Engine | — | ✅ | — |

---

## 2. ESPECIFICAÇÃO DAS ENGINES

---

### 2.1. INGESTION ENGINE

#### Objetivo
Receber, validar e armazenar materiais brutos de múltiplas fontes (upload, URL, edital) no Cloudflare R2, registrando metadados iniciais no banco.

#### Responsabilidades
- Validar tipo MIME, extensão e tamanho do arquivo
- Verificar cotas de storage do plano do usuário (Billing)
- Calcular hash SHA-256 do conteúdo binário
- Deduplicar: rejeitar se mesmo hash já existe para o usuário
- Armazenar no Cloudflare R2 (`{user_id}/{document_id}/{filename}`)
- Criar registro em `documents` com status `pending`
- Emitir evento `DocumentUploaded`

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `file` | `File / Buffer` | Arquivo binário |
| `user_id` | `UUID` | Proprietário |
| `source_type` | `enum(upload, edital, url)` | Origem do material |
| `source_url` | `string?` | URL de origem (se source_type=url) |
| `external_id` | `UUID?` | ID do edital (se source_type=edital) |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `document_id` | `UUID` | ID do documento criado |
| `storage_path` | `string` | Caminho no R2 |
| `file_hash` | `string` | SHA-256 do conteúdo |
| `status` | `enum(pending)` | Estado inicial |

#### Dependências
- **Serviços:** Cloudflare R2, Billing Service (cota)
- **Tabelas:** `documents`, `subscriptions`
- **Bibliotecas:** `crypto` (SHA-256), Zod (validação)

#### Dados consumidos
- `subscriptions` (cota de storage por plano)
- `documents` (verificação de hash existente)

#### Dados produzidos
- Arquivo no R2
- Row em `documents`

#### Eventos gerados
- `DocumentUploaded { document_id, user_id, file_hash, file_size, source_type }`

#### Eventos consumidos
- Nenhum (início do pipeline)

#### Cache
- Não aplicável (operação de escrita única)

#### Performance
- **Latência alvo:** < 5s para arquivos de até 25 MB
- **Timeout:** 30s (síncrono MVP)
- **Limite:** 25 MB por arquivo (MVP), 100 MB (Pro)

#### Escalabilidade
- Upload direto para R2 (presigned URL) descarrega o servidor
- Hash e validação são operações leves (CPU-bound)

#### Fase
**MVP** — Essencial. Sem ingestão não há pipeline.

---

### 2.2. OCR ENGINE

#### Objetivo
Extrair texto de imagens e PDFs scaneados usando reconhecimento óptico de caracteres, com foco em documentos jurídicos em português.

#### Responsabilidades
- Detectar se PDF tem texto nativo ou é scan (pré-checagem)
- Aplicar OCR via Tesseract com modelo treinado para português
- Extrair texto com scores de confiança por região
- Estruturar saída preservando parágrafos e seções
- Retornar texto plano + metadados de confiança

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `document_id` | `UUID` | Documento a processar |
| `storage_path` | `string` | Caminho do arquivo no R2 |
| `mime_type` | `string` | Tipo MIME |
| `options` | `{ language, dpi, page_range }` | Configuração do OCR |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `text` | `string` | Texto extraído |
| `confidence` | `float` | Score médio de confiança (0-1) |
| `pages` | `PageResult[]` | Resultado por página |
| `processing_time_ms` | `integer` | Tempo de processamento |

#### Dependências
- **Serviços:** Cloudflare R2 (download do arquivo), Tesseract.js / Tesseract OCR
- **Tabelas:** `documents`
- **Bibliotecas:** `tesseract.js`, `pdf-parse` (detecção de scan)

#### Dados consumidos
- Arquivo no R2
- `documents` (mime_type, storage_path)

#### Dados produzidos
- Texto extraído (armazenado em `documents.metadata` como `extracted_text`)

#### Eventos gerados
- `OcrCompleted { document_id, confidence, page_count, processing_time_ms }`
- `OcrFailed { document_id, error, page }`

#### Eventos consumidos
- `DocumentUploaded` → dispara OCR se MIME type for PDF-imagem

#### Cache
- Cache do resultado por `document_id` + `file_hash` (evita re-OCR do mesmo arquivo)

#### Performance
- **Latência alvo:** 30s-120s por página (depende de DPI e complexidade)
- **Timeout:** 5 min (MVP), 15 min (V1.1 assíncrono)
- **GPU:** Recomendada para produção; CPU aceitável para MVP

#### Escalabilidade
- Processamento por página em paralelo
- Worker dedicado (V1.1) ou edge function com timeout maior
- Filas (QStash/Inngest) na V1.1

#### Fase
**V1.1** — MVP só suporta PDF com texto nativo. OCR é essencial para editais scaneados.

---

### 2.3. TRANSCRIPTION ENGINE

#### Objetivo
Transcrever áudio e vídeo (videoaulas, podcasts, áudios de estudo) para texto, com timestamps e segmentação por falante.

#### Responsabilidades
- Baixar mídia do R2
- Extrair faixa de áudio (de vídeo, se necessário)
- Transcrever via Whisper (modelo multilingual, português)
- Gerar texto com timestamps (formato SRT/VTT)
- Segmentar por frases ou parágrafos

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `document_id` | `UUID` | Documento de mídia |
| `storage_path` | `string` | Caminho no R2 |
| `mime_type` | `string` | Tipo MIME (mp3, mp4, webm, wav) |
| `options` | `{ language, model, timestamps }` | Configuração |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `text` | `string` | Transcrição completa |
| `segments` | `Segment[]` | Segmentos com timestamp |
| `language` | `string` | Idioma detectado |
| `duration_sec` | `integer` | Duração do áudio |
| `processing_time_ms` | `integer` | Tempo de processamento |

#### Dependências
- **Serviços:** Cloudflare R2, Whisper (OpenAI API ou self-hosted)
- **Tabelas:** `documents`, `transcripts` (V1.1)
- **Bibliotecas:** `ffmpeg` (extração de áudio), Whisper SDK

#### Dados consumidos
- Arquivo de mídia no R2
- `documents` (mime_type, storage_path)

#### Dados produzidos
- Row em `transcripts` (V1.1)
- Texto transcrito como input para Chunk Engine

#### Eventos gerados
- `TranscriptionCompleted { document_id, language, duration_sec, segment_count }`
- `TranscriptionFailed { document_id, error }`

#### Eventos consumidos
- `DocumentUploaded` → dispara transcrição se MIME type for áudio/vídeo

#### Cache
- Cache da transcrição por `file_hash` + `model_version`

#### Performance
- **Latência alvo:** ~1× duração do áudio (Whisper API), 2-5× (self-hosted CPU)
- **Timeout:** 30 min (V1.1 assíncrono)
- **GPU:** Essencial para self-hosted; API externa dispensa

#### Escalabilidade
- Sempre assíncrono (V1.1)
- Fila dedicada com prioridade
- Limitar upload de mídia por plano (cotas)

#### Fase
**V1.1** — MVP não suporta áudio/vídeo.

---

### 2.4. METADATA ENGINE

#### Objetivo
Extrair, inferir e enriquecer metadados de documentos para classificação, busca e recomendação.

#### Responsabilidades
- Extrair metadados do arquivo (título, autor, data, páginas)
- Inferir `knowledge_subject_id` e `knowledge_topic_id` via LLM ou keyword matching
- Sugerir tags baseadas no conteúdo
- Detectar idioma
- Extrair menções a leis, artigos, bancas, cargos
- Armazenar em `documents.metadata` (JSONB)

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `document_id` | `UUID` | Documento |
| `text` | `string` | Texto extraído/normalizado |
| `file_metadata` | `object` | Metadados do arquivo (nome, tamanho, data) |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `metadata` | `JSONB` | Metadados enriquecidos |
| `suggested_subject_id` | `UUID?` | Matéria inferida |
| `suggested_topic_ids` | `UUID[]` | Tópicos inferidos |
| `suggested_tags` | `string[]` | Tags sugeridas |
| `legal_references` | `{ law, article }[]` | Menções legais detectadas |
| `language` | `string` | Idioma (ex.: pt-BR) |

#### Dependências
- **Serviços:** DeepSeek API (classificação), regex jurídico
- **Tabelas:** `documents`, `knowledge_subjects`, `knowledge_topics`, `knowledge_tags`
- **Bibliotecas:** Zod

#### Dados consumidos
- Texto extraído do documento
- `knowledge_subjects` (catálogo para matching)
- `knowledge_topics` (catálogo para matching)

#### Dados produzidos
- `documents.metadata` atualizado
- `document_subjects` (junction)
- `document_topics` (junction)
- `document_tags` (junction)

#### Eventos gerados
- `MetadataExtracted { document_id, subject_id, topic_count, tag_count }`

#### Eventos consumidos
- `OcrCompleted` ou `TextExtracted` → dispara extração de metadados

#### Cache
- Cache de classificação por `knowledge_subject_id` + texto similar (hash de bigramas)

#### Performance
- **Latência alvo:** < 3s (com LLM), < 500ms (keyword matching puro)
- **Timeout:** 10s

#### Escalabilidade
- Leve (consulta catálogos + prompt LLM curto)
- Pode rodar inline após extração de texto

#### Fase
**MVP** — Essencial para classificação e busca. MVP usa keyword matching + regex; V1.1 adiciona LLM.

---

### 2.5. CHUNK ENGINE

#### Objetivo
Dividir texto extraído em chunks indexáveis, preservando estrutura semântica e aplicando estratégia configurável por tipo de documento.

#### Responsabilidades
- Selecionar estratégia de chunking baseada no `document_type`
- Dividir texto em chunks de ~1000 caracteres com overlap de 200
- Preservar fronteiras de parágrafos e seções (não quebrar no meio)
- Numerar chunks sequencialmente (`seq`)
- Extrair metadados por chunk (página, seção, heading)
- Gerar hash de conteúdo para deduplicação

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `document_id` | `UUID` | Documento |
| `text` | `string` | Texto normalizado |
| `document_type` | `enum` | Tipo do documento (define estratégia) |
| `options` | `{ chunk_size, overlap, strategy }` | Configuração (override) |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `chunks` | `Chunk[]` | Array de chunks |
| `chunk_count` | `integer` | Total de chunks gerados |

```
Chunk {
  seq: number
  content: string
  content_hash: string       // SHA-256 do conteúdo normalizado
  metadata: {
    page?: number
    section_title?: string
    heading_level?: number
    char_start: number
    char_end: number
  }
}
```

#### Dependências
- **Serviços:** Nenhum externo (puramente algorítmico)
- **Tabelas:** `document_chunks`, `embeddings` (cache de hash)
- **Bibliotecas:** `crypto` (SHA-256)

#### Dados consumidos
- Texto normalizado do documento
- `embeddings` (verificação de hash existente para reuso)

#### Dados produzidos
- Rows em `document_chunks`
- Dispara Embedding Engine para cada chunk novo

#### Eventos gerados
- `DocumentChunked { document_id, chunk_count, strategy }`

#### Eventos consumidos
- `MetadataExtracted` → dispara chunking

#### Cache
- Cache de chunk por `content_hash` (evita re-chunking e re-embedding)

#### Performance
- **Latência alvo:** < 2s para documento de 100 páginas
- **Timeout:** 30s
- **Complexidade:** O(n) sobre caracteres

#### Escalabilidade
- Algorítmico, CPU-bound leve
- Pode chunkear em lote (paralelizar por documento)

#### Fase
**MVP** — Essencial. Sem chunks não há embeddings nem RAG.

---

### 2.6. EMBEDDING ENGINE

#### Objetivo
Gerar vetores de representação semântica (embeddings) para cada chunk de documento, usando o modelo BAAI/bge-m3 (dimensão 1024).

#### Responsabilidades
- Receber chunks pendentes de embedding
- Verificar cache por `content_hash` (reuso)
- Chamar BAAI/bge-m3 (self-hosted) para gerar vetor
- Armazenar vetor em `embeddings` (pgvector)
- Atualizar status do documento para `indexed`

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `chunks` | `Chunk[]` | Chunks a embeddar |
| `model` | `string` | Modelo (default: BAAI/bge-m3) |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `results` | `EmbeddingResult[]` | Resultados por chunk |
| `cached_count` | `integer` | Chunks reusados do cache |
| `generated_count` | `integer` | Chunks com embedding novo |

```
EmbeddingResult {
  chunk_id: UUID
  embedding: number[]       // 1024 dimensões
  model: string
  from_cache: boolean
}
```

#### Dependências
- **Serviços:** BAAI/bge-m3 (self-hosted ou API)
- **Tabelas:** `document_chunks`, `embeddings`
- **Bibliotecas:** pgvector, embedding SDK

#### Dados consumidos
- `document_chunks` (content, content_hash)
- `embeddings` (cache por hash)

#### Dados produzidos
- Rows em `embeddings`
- Atualização de `documents.status` → `indexed`

#### Eventos gerados
- `EmbeddingsGenerated { document_id, total_chunks, cached, generated }`

#### Eventos consumidos
- `DocumentChunked` → dispara embedding

#### Cache
- **Primário:** `embedding_cache` por `content_hash` + `model` (Redis ou tabela dedicada)
- **Política:** TTL infinito enquanto o modelo não mudar

#### Performance
- **Latência alvo:** < 500ms por chunk (batch de 20)
- **Batch:** 20 chunks por requisição ao modelo
- **Timeout:** 60s por lote

#### Escalabilidade
- Batch processing (20 chunks/request)
- Cache de embeddings reduz workload em 60-80% (deduplicação)
- Modelo self-hosted em GPU; escalar horizontalmente com mais workers

#### Fase
**MVP** — Essencial. Sem embeddings não há busca vetorial.

---

### 2.7. HYBRID SEARCH ENGINE

#### Objetivo
Realizar busca combinada (vetorial + texto) sobre os documentos do usuário, retornando resultados ranqueados com scores combinados.

#### Responsabilidades
- Receber query do usuário (texto livre)
- Gerar embedding da query (BAAI/bge-m3)
- Executar busca vetorial (cosine similarity, HNSW) — top 20
- Executar busca textual (Full Text Search, GIN) — top 20
- Combinar scores: 70% vetorial + 30% FTS
- Aplicar filtros: `user_id`, `knowledge_subject_id`, `document_id`, tags
- Retornar top-K resultados com scores, conteúdo e referência ao documento

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `query` | `string` | Texto da busca |
| `user_id` | `UUID` | Usuário (RLS) |
| `filters` | `SearchFilters` | Filtros opcionais |
| `top_k` | `integer` | Limite de resultados (default: 10) |

```
SearchFilters {
  subject_id?: UUID
  topic_id?: UUID
  document_id?: UUID
  tags?: string[]
  date_from?: Date
  date_to?: Date
}
```

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `results` | `SearchResult[]` | Resultados ranqueados |
| `total_hits` | `integer` | Total encontrado |
| `query_time_ms` | `integer` | Tempo da query |

```
SearchResult {
  chunk_id: UUID
  document_id: UUID
  document_title: string
  content: string
  score: number              // 0-1 combinado
  vector_score: number       // score vetorial puro
  fts_score: number          // score FTS puro
  metadata: { page, section_title }
  subject_name?: string
}
```

#### Dependências
- **Serviços:** BAAI/bge-m3 (embedding da query)
- **Tabelas:** `embeddings`, `document_chunks`, `documents`, `knowledge_subjects`
- **Índices:** HNSW (`embeddings.embedding`), GIN (`document_chunks.fts_vector`)

#### Dados consumidos
- `embeddings` + `document_chunks` (JOIN)
- `documents` (filtro user_id, metadados)
- `knowledge_subjects` (nome para resultado)

#### Dados produzidos
- Nenhum (read-only)

#### Eventos gerados
- `SearchPerformed { user_id, query_hash, result_count, query_time_ms }`

#### Eventos consumidos
- Nenhum (sob demanda)

#### Cache
- Cache de query: `(query_hash, user_id, filters_hash, top_k) → result_ids` (TTL: 1h)
- Cache de embedding da query: `query_hash → embedding` (TTL: 24h)

#### Performance
- **Latência alvo:** < 500ms
- **Índices:** HNSW + GIN garantem sub-100ms por sub-query
- **Gargalo:** Embedding da query (~200ms)

#### Escalabilidade
- Read replica para busca (V2)
- Cache de queries reduz carga no banco
- Filtro user_id antes da busca (RLS) reduz search space

#### Fase
**MVP** — Essencial para RAG e busca do usuário.

---

### 2.8. RAG ENGINE

#### Objetivo
Recuperar contexto relevante dos documentos do usuário e gerar resposta fundamentada via DeepSeek, com citações de fonte.

#### Responsabilidades
- Receber pergunta do usuário + contexto da conversa
- Chamar Hybrid Search Engine para recuperar chunks relevantes
- Construir prompt com: instruções de sistema + chunks recuperados + pergunta
- Chamar DeepSeek (deepseek-chat) com prompt montado
- Extrair citações da resposta
- Retornar resposta + fontes citadas

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `question` | `string` | Pergunta do usuário |
| `user_id` | `UUID` | Usuário |
| `session_id` | `UUID` | Conversa atual |
| `context` | `ChatContext` | Contexto adicional |

```
ChatContext {
  subject_id?: UUID          // Matéria em foco
  document_ids?: UUID[]      // Documentos específicos
  history?: Message[]        // Histórico da conversa
  top_k?: integer            // Chunks a recuperar (default: 5)
}
```

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `answer` | `string` | Resposta gerada |
| `citations` | `Citation[]` | Fontes citadas |
| `tokens_in` | `integer` | Tokens de entrada |
| `tokens_out` | `integer` | Tokens de saída |
| `model` | `string` | Modelo usado |

```
Citation {
  chunk_id: UUID
  document_id: UUID
  document_title: string
  content_snippet: string    // Trecho relevante
  relevance_score: number
}
```

#### Dependências
- **Engines:** Hybrid Search Engine, Embedding Engine (via Hybrid Search)
- **Serviços:** DeepSeek API
- **Tabelas:** `chat_messages`, `chat_sessions`, `ai_usage`

#### Dados consumidos
- Chunks + embeddings (via Hybrid Search)
- `chat_messages` (histórico da conversa)

#### Dados produzidos
- Row em `chat_messages` (role=assistant)
- Row em `ai_usage` (atualização de cota)

#### Eventos gerados
- `RagQueryPerformed { session_id, chunks_retrieved, tokens_used }`
- `TokenUsed { user_id, tokens_in, tokens_out }`

#### Eventos consumidos
- Nenhum (sob demanda, disparado pelo chat)

#### Cache
- Cache de resposta: `(question_hash, context_hash, user_id) → answer` (TTL: 30 min)
- Cache de chunks recuperados: `(query_embedding_hash, user_id) → chunk_ids` (TTL: 1h)

#### Performance
- **Latência alvo:** < 3s (end-to-end)
- **Composição:** Hybrid Search (~500ms) + DeepSeek streaming (~2s)
- **Streaming:** SSE para UX responsiva

#### Escalabilidade
- Streaming reduz latência percebida
- Cache reduz chamadas ao LLM
- Rate limiting por plano (Free: 20/dia, Pro: 100/dia, Intensivo: ilimitado)

#### Fase
**MVP** — Essencial. É o core da feature Professor IA.

---

### 2.9. QUESTION GENERATION ENGINE

#### Objetivo
Gerar questões de múltipla escolha (estilo concurso) a partir de documentos ou tópicos, com gabarito e explicação.

#### Responsabilidades
- Receber contexto (documento, tópico, ou lista de chunks)
- Construir prompt template para geração de questão
- Chamar DeepSeek com formato estruturado (enunciado + 5 alternativas A-E + gabarito + explicação)
- Validar saída (gabarito entre A-E, alternativas distintas, enunciado não vazio)
- Armazenar questão candidata em `generated_questions` (V1.1)
- Registrar rastreabilidade (documento/chunk de origem)

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `source` | `GenerationSource` | Origem do conteúdo |
| `count` | `integer` | Quantidade (default: 1) |
| `options` | `GenOptions` | Configuração |

```
GenerationSource {
  type: 'document' | 'topic' | 'chunks'
  document_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
  chunk_ids?: UUID[]
}

GenOptions {
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'
  question_type?: 'multiple_choice' | 'true_false'
  style?: 'cespe' | 'fgv' | 'cesgranrio' | 'generic'
}
```

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `questions` | `GeneratedQuestion[]` | Questões geradas |
| `tokens_used` | `integer` | Tokens consumidos |

```
GeneratedQuestion {
  id: UUID
  enunciado: string
  alternativas: { letter: string, text: string }[]
  gabarito: string           // A-E
  explicacao: string
  source_document_id?: UUID
  source_chunk_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
  difficulty: string
}
```

#### Dependências
- **Engines:** Hybrid Search Engine (se source=topic, recupera chunks)
- **Serviços:** DeepSeek API
- **Tabelas:** `generated_questions`, `knowledge_subjects`, `knowledge_topics`

#### Dados consumidos
- Chunks de documentos (contexto)
- `knowledge_subjects`, `knowledge_topics` (classificação)

#### Dados produzidos
- Rows em `generated_questions` (V1.1)
- Após curadoria: rows em `questions` + `question_options` (Study)

#### Eventos gerados
- `QuestionsGenerated { source_type, source_id, count, tokens_used }`

#### Eventos consumidos
- Nenhum (sob demanda ou batch)

#### Cache
- Cache de prompt template por estilo de banca
- Cache de questões geradas: `(source_hash, count, difficulty) → questions` (TTL: 24h)

#### Performance
- **Latência alvo:** < 5s para 1 questão, < 15s para 5 questões
- **Batch:** Gerar até 5 questões por chamada

#### Escalabilidade
- Processamento em lote para gerar múltiplas questões
- Rate limiting por plano

#### Fase
**V1.1** — MVP gera questões sob demanda no chat, sem persistência separada.

---

### 2.10. FLASHCARD ENGINE

#### Objetivo
Gerar flashcards (frente/verso) a partir de documentos ou tópicos, otimizados para revisão espaçada.

#### Responsabilidades
- Receber contexto (documento, tópico, ou chunks)
- Construir prompt template para geração de flashcards
- Chamar DeepSeek com formato estruturado (frente: termo/pergunta, verso: definição/resposta)
- Validar saída (frente e verso não vazios, frente distinta)
- Sugerir tags e classificação (subject/topic)
- Armazenar em `generated_flashcards` (V1.1)

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `source` | `GenerationSource` | Igual Question Generation |
| `count` | `integer` | Quantidade (default: 5) |
| `options` | `{ style }` | Estilo (definição, pergunta-resposta, completar) |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `flashcards` | `GeneratedFlashcard[]` | Flashcards gerados |
| `tokens_used` | `integer` | Tokens consumidos |

```
GeneratedFlashcard {
  id: UUID
  front: string
  back: string
  tags: string[]
  source_document_id?: UUID
  source_chunk_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
}
```

#### Dependências
- **Engines:** Hybrid Search Engine (recuperação de contexto)
- **Serviços:** DeepSeek API
- **Tabelas:** `generated_flashcards`, `knowledge_subjects`, `knowledge_topics`, `knowledge_tags`

#### Dados consumidos
- Chunks de documentos
- Catálogo de subjects/topics/tags

#### Dados produzidos
- Rows em `generated_flashcards` (V1.1)
- Após curadoria: rows em `flashcards` + `review_schedules` (Study)

#### Eventos gerados
- `FlashcardsGenerated { source_type, source_id, count, tokens_used }`

#### Eventos consumidos
- Nenhum

#### Cache
- Similar a Question Generation Engine

#### Performance
- **Latência alvo:** < 5s para 5 flashcards
- **Batch:** Até 10 flashcards por chamada

#### Escalabilidade
- Similar a Question Generation

#### Fase
**V1.1** — MVP gera flashcards sob demanda no chat.

---

### 2.11. SUMMARY ENGINE

#### Objetivo
Gerar resumos concisos de documentos, seções ou tópicos, preservando informações essenciais para estudo.

#### Responsabilidades
- Receber documento ou conjunto de chunks
- Construir prompt de sumarização progressiva (map-reduce para documentos longos)
- Chamar DeepSeek para gerar resumo
- Extrair tópicos-chave e ideias principais
- Armazenar em `summaries` (V1.1)

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `source` | `GenerationSource` | Origem |
| `style` | `enum` | Estilo do resumo |
| `max_length` | `integer` | Tamanho máximo em caracteres |

```
SummaryStyle: 'concise' | 'detailed' | 'bullet_points' | 'topics'
```

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `summary` | `string` | Texto do resumo |
| `key_topics` | `string[]` | Tópicos-chave |
| `compression_ratio` | `float` | Taxa de compressão (resumo/original) |
| `tokens_used` | `integer` | Tokens consumidos |

#### Dependências
- **Engines:** Hybrid Search Engine (se source=topic)
- **Serviços:** DeepSeek API
- **Tabelas:** `summaries`, `documents`

#### Dados consumidos
- Chunks do documento (concatenados ou em map-reduce)
- Metadados do documento

#### Dados produzidos
- Row em `summaries` (V1.1)
- `documents.metadata` atualizado com `has_summary`

#### Eventos gerados
- `SummaryGenerated { document_id, style, compression_ratio, tokens_used }`

#### Eventos consumidos
- Nenhum

#### Cache
- Cache do resumo por `document_id` + `file_hash` + `style` (TTL: até documento mudar)

#### Performance
- **Latência alvo:** < 10s para documento médio (50 chunks)
- **Estratégia:** Map-reduce: resumir chunks em lotes, depois resumir resumos

#### Escalabilidade
- Map-reduce permite paralelizar sumarização de documentos longos
- Cache evita re-geração

#### Fase
**V1.1** — MVP gera resumos sob demanda no chat, sem persistência.

---

### 2.12. AI PROFESSOR ENGINE

#### Objetivo
Prover experiência de tutoria interativa via chat, combinando RAG, contexto de estudo e personalidade de professor.

#### Responsabilidades
- Gerenciar sessão de chat (contexto, histórico)
- Orquestrar RAG Engine para perguntas baseadas em documentos
- Orquestrar Question/Flashcard/Summary Engines sob demanda
- Manter persona de "Professor IA" especialista em concursos
- Adaptar respostas ao nível do aluno e matéria em foco
- Controlar cotas de uso (plano)
- Fazer streaming SSE da resposta

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `message` | `string` | Mensagem do usuário |
| `user_id` | `UUID` | Usuário |
| `session_id` | `UUID` | Conversa |
| `profile` | `UserProfile` | Perfil (nível, matéria foco) |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `response` | `string` | Resposta do professor |
| `actions` | `Action[]` | Ações sugeridas (fazer questão, revisar flashcard) |
| `citations` | `Citation[]` | Fontes (se RAG usado) |
| `tokens_used` | `integer` | Tokens consumidos |

#### Dependências
- **Engines:** RAG Engine, Question Generation Engine (V1.1), Flashcard Engine (V1.1), Summary Engine (V1.1)
- **Serviços:** DeepSeek API
- **Tabelas:** `chat_sessions`, `chat_messages`, `ai_usage`, `profiles`

#### Dados consumidos
- `profiles` (nível, concurso alvo, banca preferida)
- `chat_messages` (histórico da conversa)
- `knowledge_subjects` (contexto da matéria)

#### Dados produzidos
- Rows em `chat_messages` (user + assistant)
- Atualização de `ai_usage`

#### Eventos gerados
- `ProfessorResponseGenerated { session_id, message_id, tokens_used, used_rag }`

#### Eventos consumidos
- Nenhum (sob demanda)

#### Cache
- Cache de respostas frequentes (apresentação, comandos de ajuda)
- Cache de contexto de matéria

#### Performance
- **Latência alvo:** Primeiro token em < 1s (streaming SSE)
- **Streaming:** Essencial para UX

#### Escalabilidade
- SSE streaming (já implementado)
- Rate limiting por plano
- Session isolation por user_id

#### Fase
**MVP** — Core da plataforma. Já parcialmente implementado em `src/app/api/chat/route.ts`.

---

### 2.13. RECOMMENDATION ENGINE

#### Objetivo
Recomendar conteúdo personalizado (documentos, questões, flashcards, tópicos) baseado no perfil, histórico e desempenho do aluno.

#### Responsabilidades
- Analisar perfil do usuário (nível, concurso alvo, banca)
- Analisar histórico (questões respondidas, flashcards revisados, tempo de estudo)
- Identificar gaps de conhecimento (tópicos com baixo desempenho)
- Recomendar: próximos tópicos a estudar, questões para praticar, flashcards para revisar, documentos para ler
- Priorizar por urgência (due_date de revisões, proximidade de prova)

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `user_id` | `UUID` | Usuário |
| `context` | `RecContext` | Contexto da recomendação |
| `limit` | `integer` | Máximo de recomendações |

```
RecContext {
  type: 'study' | 'review' | 'practice' | 'explore'
  subject_id?: UUID
  exclude_ids?: UUID[]
}
```

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `recommendations` | `Recommendation[]` | Lista ranqueada |
| `reason` | `string` | Explicação da recomendação |

```
Recommendation {
  type: 'document' | 'question' | 'flashcard' | 'topic'
  id: UUID
  title: string
  score: number
  reason: string
  urgency: 'high' | 'medium' | 'low'
}
```

#### Dependências
- **Engines:** Hybrid Search Engine (busca de conteúdo similar)
- **Serviços:** Nenhum externo (algorítmico + queries)
- **Tabelas:** `question_attempts`, `review_schedules`, `daily_summaries`, `study_tasks`, `profiles`

#### Dados consumidos
- `question_attempts` (desempenho por tópico)
- `review_schedules` (flashcards pendentes)
- `daily_summaries` (volume de estudo)
- `study_tasks` (cronograma)
- `profiles` (perfil)

#### Dados produzidos
- Nenhum persistido (efêmero, gerado sob demanda)

#### Eventos gerados
- `RecommendationsGenerated { user_id, context_type, count }`

#### Eventos consumidos
- Nenhum (sob demanda)

#### Cache
- Cache de recomendações por `(user_id, context_type)` (TTL: 1h)

#### Performance
- **Latência alvo:** < 2s
- **Complexidade:** Queries agregadas + scoring algorítmico

#### Escalabilidade
- Pré-computar recomendações em job noturno (V2)
- Cache reduz carga

#### Fase
**V2** — MVP e V1.1 usam heurísticas simples (próximos flashcards, tarefas do dia). Recomendação inteligente é V2.

---

### 2.14. STUDY PLANNER ENGINE

#### Objetivo
Gerar e adaptar cronogramas de estudo personalizados com base no edital, perfil do aluno e tempo disponível.

#### Responsabilidades
- Receber parâmetros: concurso alvo, edital, disciplinas, horas/semana, data da prova
- Distribuir carga horária entre disciplinas proporcionalmente ao peso no edital
- Gerar `study_tasks` diárias/semanais
- Incluir revisões espaçadas e simulados
- Adaptar cronograma quando usuário atrasa ou adianta
- Reprogramar automaticamente tarefas não concluídas

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `user_id` | `UUID` | Usuário |
| `config` | `PlannerConfig` | Configuração do plano |

```
PlannerConfig {
  contest_id?: UUID
  subjects: { subject_id: UUID, weight: number }[]
  hours_per_week: number
  study_days: number[]        // [1,2,3,4,5] = seg-sex
  exam_date?: Date
  start_date: Date
}
```

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `tasks` | `StudyTask[]` | Tarefas geradas |
| `schedule` | `WeeklySchedule` | Distribuição semanal |
| `coverage_pct` | `float` | Cobertura do edital (%) |

#### Dependências
- **Serviços:** DeepSeek API (otimização de distribuição, opcional)
- **Tabelas:** `study_tasks`, `study_subjects`, `knowledge_subjects`, `contests`, `editais`

#### Dados consumidos
- `editais` (conteúdo programático, pesos)
- `knowledge_subjects` (catálogo)
- `study_subjects` (disciplinas do aluno)
- `study_tasks` (tarefas existentes)

#### Dados produzidos
- Rows em `study_tasks`
- Atualização de `study_subjects` (carga horária)

#### Eventos gerados
- `StudyPlanGenerated { user_id, task_count, period_days }`
- `StudyPlanAdapted { user_id, tasks_added, tasks_removed }`

#### Eventos consumidos
- `StudyTaskCompleted` → recalibrar cronograma
- `StudyTaskOverdue` → reprogramar

#### Cache
- Cache do plano atual por `user_id` (TTL: até próxima adaptação)

#### Performance
- **Latência alvo:** < 3s para geração, < 1s para adaptação
- **Complexidade:** Algorítmico (bin packing com pesos)

#### Escalabilidade
- Geração de tarefas é operação batch (1× por criação de plano)
- Adaptação é incremental (leve)

#### Fase
**V1.1** — MVP tem cronograma manual (usuário cria tarefas). V1.1 gera automaticamente.

---

### 2.15. ANALYTICS ENGINE

#### Objetivo
Coletar, agregar e expor métricas de estudo para o usuário (dashboard) e para a plataforma (business intelligence).

#### Responsabilidades
- Consumir eventos de outros domínios (Study, AI, Knowledge, Billing)
- Agregar métricas diárias em `daily_summaries`
- Calcular streaks, médias, tendências
- Gerar insights (ex.: "Seu desempenho em Direito Constitucional melhorou 15%")
- Expor métricas via API para dashboard
- Gerar relatórios semanais/mensais

#### Entradas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `events` | `Event[]` | Eventos de domínio |
| `aggregation_window` | `enum(day, week, month)` | Janela de agregação |

#### Saídas
| Parâmetro | Tipo | Descrição |
| --- | --- | --- |
| `metrics` | `DashboardMetrics` | Métricas agregadas |
| `insights` | `Insight[]` | Insights textuais |
| `trends` | `Trend[]` | Tendências temporais |

```
DashboardMetrics {
  total_questions: number
  correct_answers: number
  accuracy_pct: float
  study_minutes: number
  reviews_done: number
  ai_messages: number
  streak_days: number
  top_subjects: { name: string, accuracy: float }[]
  weekly_evolution: { date: string, minutes: number, questions: number }[]
}
```

#### Dependências
- **Tabelas:** `event_logs`, `daily_summaries`, `question_attempts`, `review_schedules`, `study_tasks`, `ai_usage`
- **Serviços:** DeepSeek API (insights textuais, opcional)

#### Dados consumidos
- `question_attempts` (questões respondidas)
- `review_schedules` (revisões concluídas)
- `study_tasks` (tarefas concluídas, tempo)
- `ai_usage` (mensagens de IA)
- `event_logs` (todos os eventos)

#### Dados produzidos
- Rows em `daily_summaries`
- Métricas agregadas (cache)

#### Eventos gerados
- `DailySummaryGenerated { user_id, date }`
- `InsightGenerated { user_id, insight_type }`

#### Eventos consumidos
- `QuestionAnswered`, `FlashcardReviewed`, `StudyTaskCompleted`, `MessageSent`, `DocumentUploaded` (e todos os demais)

#### Cache
- Cache de métricas do dia atual (TTL: 5 min)
- Cache de dashboard (TTL: 15 min)
- `daily_summaries` materializadas (não precisam de cache adicional)

#### Performance
- **Latência alvo:** < 1s para dashboard
- **Agregação:** Job noturno (ou incremental durante o dia)

#### Escalabilidade
- `daily_summaries` materializadas → leitura rápida
- Agregação incremental evita re-processamento
- Read replica para dashboards pesados (V2)

#### Fase
**V1.1** — MVP tem dashboard simples com queries diretas (já implementado). V1.1 formaliza a Engine com materialização e insights.

---

## 3. FLUXO COMPLETO DA PLATAFORMA

### 3.1. Diagrama de fluxo

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     PLATFORM FLOW (END-TO-END)                           │
│                                                                         │
│  ┌──────────┐                                                           │
│  │  UPLOAD  │  Usuário envia PDF, DOCX, MP4, etc.                       │
│  └────┬─────┘                                                           │
│       ▼                                                                 │
│  ┌──────────────┐  Valida, armazena no R2, cria document                │
│  │  INGESTION   │  Evento: DocumentUploaded                             │
│  └────┬─────────┘                                                       │
│       ▼                                                                 │
│  ┌──────────┐  Detecta texto nativo vs scan                             │
│  │   OCR    │  Se scan: extrai texto via Tesseract                      │
│  └────┬─────┘  Evento: OcrCompleted / TextExtracted (se nativo)        │
│       ▼                                                                 │
│  ┌──────────────┐  Se áudio/vídeo: transcreve via Whisper               │
│  │TRANSCRIPTION │  Evento: TranscriptionCompleted                       │
│  └────┬─────────┘                                                       │
│       ▼                                                                 │
│  ┌──────────────┐  UTF-8, whitespace, caracteres                        │
│  │NORMALIZATION │  (implícita nos extratores)                            │
│  └────┬─────────┘                                                       │
│       ▼                                                                 │
│  ┌──────────────┐  Classifica (subject/topic), extrai tags, leis        │
│  │  METADATA    │  Evento: MetadataExtracted                             │
│  └────┬─────────┘                                                       │
│       ▼                                                                 │
│  ┌──────────┐  Divide em chunks de 1000 chars, overlap 200              │
│  │ CHUNKING │  Evento: DocumentChunked                                   │
│  └────┬─────┘                                                           │
│       ▼                                                                 │
│  ┌──────────────┐  Gera vetor 1024d via BAAI/bge-m3                     │
│  │  EMBEDDING   │  Evento: EmbeddingsGenerated                           │
│  └────┬─────────┘                                                       │
│       ▼                                                                 │
│  ┌──────────────┐  Índices HNSW + GIN automáticos                       │
│  │  INDEXAÇÃO   │  (PostgreSQL mantém)                                   │
│  └────┬─────────┘                                                       │
│       ▼                                                                 │
│  ┌──────────────┐  Busca vetorial + FTS combinada                       │
│  │HYBRID SEARCH │  Pronto para consultas                                 │
│  └────┬─────────┘                                                       │
│       │                                                                 │
│       ├────────────────────────────────────────────┐                    │
│       ▼                                            ▼                    │
│  ┌──────────┐                              ┌──────────────┐            │
│  │   RAG    │  Contexto + LLM → resposta   │   ANALYTICS  │            │
│  └────┬─────┘  fundamentada                │   ENGINE     │            │
│       │                                    └──────────────┘            │
│       ├──────────┬──────────┬──────────┐                               │
│       ▼          ▼          ▼          ▼                               │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐                        │
│  │QUESTION│ │FLASHCARD│ │SUMMARY │ │   AI     │                        │
│  │  GEN   │ │  GEN   │ │  GEN   │ │PROFESSOR │                        │
│  └───┬────┘ └───┬────┘ └───┬────┘ └─────┬────┘                        │
│      │          │          │             │                              │
│      ▼          ▼          ▼             ▼                              │
│  ┌──────────────────────────────────────────────────┐                  │
│  │              STUDY DOMAIN                         │                  │
│  │  questions, flashcards, study_tasks, reviews      │                  │
│  └──────────────────────┬───────────────────────────┘                  │
│                         ▼                                              │
│  ┌──────────────────────────────────────────────────┐                  │
│  │           STUDY PLANNER ENGINE (V1.1)             │                  │
│  │  Gera/adapta cronograma baseado em edital         │                  │
│  └──────────────────────┬───────────────────────────┘                  │
│                         ▼                                              │
│  ┌──────────────────────────────────────────────────┐                  │
│  │         RECOMMENDATION ENGINE (V2)                │                  │
│  │  Recomenda conteúdo personalizado                 │                  │
│  └──────────────────────┬───────────────────────────┘                  │
│                         ▼                                              │
│  ┌──────────────────────────────────────────────────┐                  │
│  │              ANALYTICS ENGINE (V1.1)              │                  │
│  │  Métricas, insights, dashboard, relatórios        │                  │
│  └──────────────────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.2. Fluxo síncrono (MVP)

No MVP, o pipeline opera de forma síncrona:

```
Upload → Ingestão → Extração de texto → Normalização → Metadados → Chunking → Embeddings → Status: indexed
                                                                                              │
                                                                                              ▼
                                                                               Hybrid Search ←┤
                                                                                              │
                                                                                    ┌─────────┴─────────┐
                                                                                    │   AI PROFESSOR    │
                                                                                    │  (RAG sob demanda) │
                                                                                    └───────────────────┘
```

**Características:**
- Tudo executado em sequência no request handler
- Timeout máximo: 30s (Vercel Pro), 60s (Edge Functions)
- Limite de arquivo: 25 MB
- Processamento bloqueante: usuário espera
- Status do documento: `pending → processing → processed/indexed`

### 3.3. Fluxo assíncrono (V1.1)

Na V1.1, o pipeline migra para assíncrono:

```
Upload → Ingestão → Evento: DocumentUploaded
                          │
                          ▼
                    ┌─────────────┐
                    │  FILA (QStash/Inngest)  │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
          Extração     OCR (se     Transcrição
          de texto     scan)       (se mídia)
              │            │            │
              └────────────┼────────────┘
                           ▼
                    Normalização
                           │
                           ▼
                       Metadados
                           │
                           ▼
                       Chunking
                           │
                           ▼
                       Embeddings
                           │
                           ▼
                   Status: indexed
```

**Características:**
- Cada etapa é um job independente
- Retry automático com backoff exponencial (3 tentativas)
- Webhook de conclusão notifica o frontend
- Status do documento: `pending → processing → processing_ocr → processing_metadata → processing_chunking → processing_embedding → indexed`
- Usuário pode sair e voltar; progresso visível

### 3.4. Filas futuras (V1.1+)

| Fila | Engine | Prioridade | Volume esperado |
| --- | --- | --- | --- |
| `ingestion-queue` | Ingestion | Alta | 10-100/dia |
| `extraction-queue` | OCR, Transcription | Média | 5-50/dia |
| `pipeline-queue` | Metadata, Chunk, Embedding | Média | 10-100/dia |
| `generation-queue` | Question, Flashcard, Summary | Baixa | 10-50/dia |
| `analytics-queue` | Analytics (agregação) | Baixa | Noturno |
| `maintenance-queue` | Reindex, Cleanup | Baixa | Semanal |

### 3.5. Jobs futuros (V1.1+)

| Job | Engine | Agendamento | Descrição |
| --- | --- | --- | --- |
| `daily-summary-job` | Analytics | Diário (01:00) | Agrega métricas do dia anterior |
| `weekly-report-job` | Analytics | Segunda (02:00) | Gera relatório semanal |
| `cache-warmup-job` | Hybrid Search | Diário (03:00) | Aquece cache de queries comuns |
| `reindex-job` | Embedding | Sob demanda | Reindexa todos os documentos |
| `stale-cleanup-job` | Ingestion | Semanal (domingo) | Soft-delete documentos órfãos |
| `embedding-model-migration` | Embedding | Sob demanda | Migra embeddings para novo modelo |
| `plan-adaptation-job` | Study Planner | Horário | Recalibra cronogramas afetados por atraso |

---

## 4. ESTRATÉGIAS TRANSVERSAIS

### 4.1. Estratégia de cache

| Camada | Mecanismo | TTL | Escopo |
| --- | --- | --- | --- |
| **Embedding Cache** | Redis / tabela `embedding_cache` | Infinito (até modelo mudar) | Global por `content_hash` |
| **Query Cache (Hybrid Search)** | Redis | 1h | Por `(query_hash, user_id, filters)` |
| **RAG Response Cache** | Redis | 30 min | Por `(question_hash, context_hash, user_id)` |
| **Generation Cache** | Redis | 24h | Por `(source_hash, count, options)` |
| **Dashboard Cache** | Redis / Memory | 15 min | Por `user_id` |
| **Metadata Classificação** | Redis | 24h | Por `(text_hash, catalog_version)` |
| **CDN (R2)** | Cloudflare CDN | 7 dias | Arquivos originais |

### 4.2. Estratégia de reprocessamento

| Gatilho | Escopo | Procedimento |
| --- | --- | --- |
| **Falha no pipeline** | Documento específico | Retry 3× com backoff; após 3 falhas → status `failed` |
| **Correção manual de OCR** | Chunks do documento | Re-chunk + re-embed do trecho corrigido |
| **Mudança de chunking strategy** | Todos os documentos | Job `reindex-job`; regenerar chunks e embeddings |
| **Mudança de modelo de embedding** | Todos os embeddings | Job `embedding-model-migration`; flag `model` rastreia versão |
| **Documento re-upload** | Documento (MVP: substituição) | Pipeline completo do zero |
| **Corrupção de índice** | Índice HNSW/GIN | `REINDEX` + `VACUUM` |

### 4.3. Estratégia de auditoria

| O que auditar | Como | Onde |
| --- | --- | --- |
| **Upload de documento** | Evento `DocumentUploaded` | `event_logs` |
| **Cada etapa do pipeline** | Evento de conclusão/falha | `event_logs` |
| **Query de busca** | Evento `SearchPerformed` | `event_logs` |
| **Geração de ativos** | Evento `QuestionsGenerated`, etc. | `event_logs` |
| **Resposta do Professor IA** | `chat_messages` + `ai_usage` | Tabelas de domínio |
| **Acesso a documento** | RLS + log de acesso (opcional) | `event_logs` |
| **Erros e exceções** | Log estruturado + stack trace | `event_logs` + sistema de logging |

### 4.4. Estratégia de monitoramento

| Métrica | Engine | Alerta |
| --- | --- | --- |
| **Pipeline success rate** | Todas | < 95% nas últimas 24h |
| **Pipeline latency (p95)** | Todas | > 2× baseline |
| **Embedding cache hit rate** | Embedding | < 50% |
| **Search latency (p95)** | Hybrid Search | > 1s |
| **RAG latency (p95)** | RAG | > 5s |
| **LLM error rate** | Todas (Gen) | > 5% |
| **Storage usage per user** | Ingestion | > 90% da cota |
| **AI token usage per user** | AI Professor | > 90% da cota diária |
| **Queue depth** | Todas (V1.1) | > 100 pendentes |

### 4.5. Estratégia de observabilidade

| Pilar | Ferramenta | O que observar |
| --- | --- | --- |
| **Logging** | Structured JSON logs | Início/fim de cada Engine, erros, warnings |
| **Metrics** | Prometheus / Postgres views | Latências, taxas de sucesso, cache hit rates |
| **Tracing** | OpenTelemetry (V2) | Trace distribuído entre Engines |
| **Alerting** | Log alerts + metric thresholds | Falhas em pipeline, latência alta, cota excedida |
| **Dashboard** | Admin panel + Grafana (V2) | Health das engines, volume de processamento |

---

## 5. ARQUITETURA RECOMENDADA

```
src/
├── lib/
│   ├── engines/                           # Engine layer
│   │   ├── types.ts                       # Engine interface + contratos
│   │   ├── ingestion/
│   │   │   ├── ingestion-engine.ts
│   │   │   └── validators.ts
│   │   ├── ocr/
│   │   │   └── ocr-engine.ts              # V1.1
│   │   ├── transcription/
│   │   │   └── transcription-engine.ts    # V1.1
│   │   ├── metadata/
│   │   │   ├── metadata-engine.ts
│   │   │   └── classifiers.ts
│   │   ├── chunk/
│   │   │   ├── chunk-engine.ts
│   │   │   └── strategies.ts
│   │   ├── embedding/
│   │   │   ├── embedding-engine.ts
│   │   │   └── cache.ts
│   │   ├── search/
│   │   │   ├── hybrid-search-engine.ts
│   │   │   └── query-builder.ts
│   │   ├── rag/
│   │   │   ├── rag-engine.ts
│   │   │   └── prompt-templates.ts
│   │   ├── generation/
│   │   │   ├── question-generation-engine.ts  # V1.1
│   │   │   ├── flashcard-engine.ts            # V1.1
│   │   │   └── summary-engine.ts              # V1.1
│   │   ├── professor/
│   │   │   └── ai-professor-engine.ts
│   │   ├── planner/
│   │   │   └── study-planner-engine.ts        # V1.1
│   │   ├── recommendation/
│   │   │   └── recommendation-engine.ts       # V2
│   │   └── analytics/
│   │       └── analytics-engine.ts            # V1.1
│   └── ...
└── ...
```

### Engine Interface (conceitual)

```
interface Engine<TInput, TOutput> {
  readonly name: string;
  readonly version: string;
  
  execute(input: TInput): Promise<EngineResult<TOutput>>;
  canHandle(input: unknown): boolean;
}

type EngineResult<T> = 
  | { success: true; data: T; metadata: EngineMetadata }
  | { success: false; error: EngineError; metadata: EngineMetadata };

interface EngineMetadata {
  engine_name: string;
  engine_version: string;
  started_at: Date;
  completed_at: Date;
  duration_ms: number;
  trace_id: string;
}
```

---

## 6. ORDEM DE IMPLEMENTAÇÃO DAS ENGINES

### FASE E1 — MVP (Core Pipeline)

| Ordem | Engine | Depende de | Justificativa |
| :---: | --- | --- | --- |
| 1 | **Ingestion Engine** | — | Sem ingestão, nada existe |
| 2 | **Metadata Engine** | Ingestion (texto extraído) | Classifica documentos para busca |
| 3 | **Chunk Engine** | Metadata (texto normalizado) | Prepara chunks para embedding |
| 4 | **Embedding Engine** | Chunk (chunks) | Gera vetores para busca |
| 5 | **Hybrid Search Engine** | Embedding (índice HNSW + FTS) | Busca é pré-requisito para RAG |
| 6 | **RAG Engine** | Hybrid Search | Recupera contexto para LLM |
| 7 | **AI Professor Engine** | RAG | Feature principal da plataforma |

### FASE E2 — V1.1 (Pipeline Avançado)

| Ordem | Engine | Depende de |
| :---: | --- | --- |
| 8 | **OCR Engine** | Ingestion (detecção de scan) |
| 9 | **Transcription Engine** | Ingestion (detecção de mídia) |
| 10 | **Question Generation Engine** | RAG (recupera contexto de tópicos) |
| 11 | **Flashcard Engine** | RAG |
| 12 | **Summary Engine** | RAG |
| 13 | **Study Planner Engine** | Metadata (catálogo de editais) |
| 14 | **Analytics Engine** | Eventos de todas as engines |

### FASE E3 — V2 (Plataforma Inteligente)

| Ordem | Engine | Depende de |
| :---: | --- | --- |
| 15 | **Recommendation Engine** | Analytics + Study Planner |

---

## 7. DEPENDÊNCIAS ENTRE ENGINES

```
                    ┌──────────────┐
                    │  INGESTION   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │   OCR    │ │TRANSCRIBE│ │  METADATA    │
        │  (V1.1)  │ │ (V1.1)   │ │  (MVP)       │
        └────┬─────┘ └────┬─────┘ └──────┬───────┘
             │            │              │
             └────────────┼──────────────┘
                          ▼
                    ┌──────────┐
                    │  CHUNK   │
                    └────┬─────┘
                         ▼
                    ┌──────────────┐
                    │  EMBEDDING   │
                    └──────┬───────┘
                           ▼
                    ┌──────────────┐
                    │HYBRID SEARCH │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────────────┐
              ▼            ▼                    ▼
        ┌──────────┐ ┌──────────┐        ┌──────────┐
        │   RAG    │ │ANALYTICS │        │   DEMAND │
        │  (MVP)   │ │ (V1.1)   │        │  SEARCH  │
        └────┬─────┘ └──────────┘        └──────────┘
             │
    ┌────────┼────────┬────────────┐
    ▼        ▼        ▼            ▼
┌──────┐┌──────┐┌──────────┐┌──────────┐
│QUEST.││FLASH.││ SUMMARY  ││   AI     │
│ GEN  ││ GEN  ││   GEN    ││PROFESSOR │
│(V1.1)││(V1.1)││  (V1.1)  ││  (MVP)   │
└──┬───┘└──┬───┘└────┬─────┘└────┬─────┘
   │       │         │           │
   └───────┼─────────┼───────────┘
           ▼         ▼
    ┌──────────────────────────┐
    │     STUDY PLANNER        │
    │        (V1.1)            │
    └────────────┬─────────────┘
                 ▼
    ┌──────────────────────────┐
    │    RECOMMENDATION        │
    │        (V2)              │
    └──────────────────────────┘
```

---

## 8. ROADMAP TÉCNICO

| Milestone | Entregáveis | Complexidade | Duração estimada |
| --- | --- | --- | --- |
| **M1 — E1 a E3** | Ingestion + Metadata + Chunk Engines | Média | 2-3 semanas |
| **M2 — E4 a E5** | Embedding + Hybrid Search Engines | Alta | 2-3 semanas |
| **M3 — E6 a E7** | RAG + AI Professor Engines | Alta | 2-3 semanas |
| **M4 — E8 a E12** | OCR, Transcription, Question, Flashcard, Summary (V1.1) | Muito Alta | 4-6 semanas |
| **M5 — E13 a E14** | Study Planner + Analytics (V1.1) | Alta | 2-3 semanas |
| **M6 — E15** | Recommendation Engine (V2) | Média | 1-2 semanas |

---

## 9. RISCOS

### Risco 1 — Pipeline síncrono no MVP causa timeouts
- **Descrição:** Documentos grandes podem exceder o timeout de 30s no processamento síncrono.
- **Mitigação:** Limitar a 25 MB. Chunking em lotes pequenos. Timeout de 60s em Edge Functions. Migrar para assíncrono na V1.1.
- **Severidade:** Alta.

### Risco 2 — Embedding Engine dependente de modelo self-hosted
- **Descrição:** Se o BAAI/bge-m3 ficar indisponível ou degradado, todo o pipeline de embedding para.
- **Mitigação:** Cache agressivo de embeddings. Fallback para API externa em emergência. Provedor isolado em camada de abstração.
- **Severidade:** Alta.

### Risco 3 — Acoplamento forte entre Engines no MVP
- **Descrição:** No MVP, as Engines são chamadas em sequência no mesmo request. Se uma falhar, todo o pipeline falha.
- **Mitigação:** Eventos de falha por etapa permitem retry granular. V1.1 quebra em jobs independentes.
- **Severidade:** Média.

### Risco 4 — Latência acumulada do pipeline
- **Descrição:** Soma das latências: Ingestão (2s) + Extração (3s) + Metadata (3s) + Chunk (2s) + Embedding (10s) = ~20s no total.
- **Mitigação:** Paralelizar onde possível (chunks em batch). Cache de embeddings. Assíncrono na V1.1.
- **Severidade:** Média.

### Risco 5 — Custo de LLM nas Engines de geração
- **Descrição:** Question, Flashcard e Summary Engines dependem de chamadas ao DeepSeek. Em escala, o custo pode ser significativo.
- **Mitigação:** Cache agressivo de gerações. Rate limiting por plano. Prompt otimizado para reduzir tokens.
- **Severidade:** Média.

### Risco 6 — Consistência entre Engines e domínios
- **Descrição:** Engines produzem dados que alimentam múltiplos domínios. Se uma Engine mudar seu contrato de saída, domínios quebram.
- **Mitigação:** Contratos tipados (Zod). Versionamento de saída das Engines. Testes de integração entre Engines e domínios.
- **Severidade:** Média.

### Risco 7 — Complexidade de troubleshooting
- **Descrição:** Com 15 Engines encadeadas, debugar um problema no meio do pipeline pode ser difícil.
- **Mitigação:** `trace_id` em cada etapa. Eventos de início/fim/falha. Logging estruturado. Dashboard de health.
- **Severidade:** Baixa (MVP com 7 Engines), Média (V1.1 com 14).

---

## 10. SUMÁRIO

| Dimensão | MVP | V1.1 | V2 |
| --- | :---: | :---: | :---: |
| **Total Engines** | 7 | +7 (14) | +1 (15) |
| **Pipeline** | Síncrono | Assíncrono (QStash/Inngest) | Assíncrono com filas dedicadas |
| **Cache** | Embedding + Query | + Response + Generation | + Distribuído |
| **Observabilidade** | Logs estruturados | + Métricas + Alertas | + Tracing distribuído |
| **Processamento** | Request handler | Jobs + Workers | Workers dedicados por Engine |
| **Timeout máximo** | 30-60s | 15 min (OCR), 30 min (Transcrição) | Configurável por Engine |

---

> **Documento criado em:** FASE 7 — Engine Architecture.
> **Próximo passo:** Após aprovação, implementar Drizzle schemas dos domínios ou iniciar implementação das Engines MVP.
> **Documentos referenciados:** 13-KNOWLEDGE-CORE-ARCHITECTURE, 10-EMBEDDING-STANDARD, 08-DATABASE-PHYSICAL, 06-DOMAIN-DECISIONS.
