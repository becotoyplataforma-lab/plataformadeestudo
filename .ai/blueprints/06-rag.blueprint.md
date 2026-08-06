# 06 — RAG BLUEPRINT

## PURPOSE
Recuperar contexto relevante dos documentos do usuário via Hybrid Search e gerar respostas fundamentadas usando DeepSeek, com citações de fonte e controle de alucinação. É o motor de grounding do Professor IA.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `question` | `string` | ✅ | Pergunta do usuário |
| `user_id` | `UUID` | ✅ | Usuário |
| `session_id` | `UUID` | ✅ | Conversa atual |
| `context` | `ChatContext` | ❌ | Contexto adicional |

```
ChatContext {
  subject_id?: UUID              // Matéria em foco (filtra busca)
  document_ids?: UUID[]          // Documentos específicos
  history?: {                     // Últimas N mensagens
    role: 'user' | 'assistant'
    content: string
  }[]
  top_k?: number                 // Chunks a recuperar (default: 5)
  max_tokens?: number            // Limite de tokens na resposta
}
```

### Validações
- `question`: 1-2000 caracteres, não vazio
- `session_id`: UUID válido, pertence ao `user_id`
- `context.top_k`: 1-20

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `answer` | `string` | Resposta gerada (markdown) |
| `citations` | `Citation[]` | Fontes citadas |
| `tokens_in` | `integer` | Tokens consumidos (entrada) |
| `tokens_out` | `integer` | Tokens consumidos (saída) |
| `model` | `string` | Modelo usado |
| `grounding_score` | `float` | Score de grounding (0-1, se resposta baseada nos chunks) |

```
Citation {
  chunk_id: UUID
  document_id: UUID
  document_title: string
  content_snippet: string        // Trecho do chunk (até 200 chars)
  relevance_score: number
  page?: number
}
```

## DEPENDENCIES

### Engines
- **Hybrid Search Engine:** Recuperação de chunks relevantes

### Serviços externos
- **DeepSeek API:** `deepseek-chat` para geração de resposta

### Módulos internos
- `src/lib/knowledge/retrieval/rag.ts`
- `src/lib/knowledge/retrieval/prompt-templates.ts`

### Bibliotecas
- `zod` — validação
- SDK do DeepSeek

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `chat_sessions` | `id`, `user_id`, `subject_id`, `model` | Validar sessão, obter contexto |
| `chat_messages` | `session_id`, `role`, `content`, `created_at` | Histórico da conversa |
| `documents` | `id`, `title` | Título para citações |

### Tabelas escritas
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `chat_messages` | `id`, `session_id`, `user_id`, `role`, `content`, `model`, `tokens_in`, `tokens_out`, `created_at` | INSERT (user + assistant) |
| `ai_usage` | `user_id`, `usage_date`, `tokens_in`, `tokens_out`, `messages_count` | UPSERT (incremento) |

### Política RLS
- `chat_messages`: usuário insere apenas em sessões próprias
- `ai_usage`: acesso por função SECURITY DEFINER

## REPOSITORIES

### ChatSessionRepository
| Método | Descrição |
| --- | --- |
| `getById(sessionId)` | Obter sessão + validar ownership |
| `getContext(sessionId)` | Obter subject_id + últimas N mensagens |

### ChatMessageRepository
| Método | Descrição |
| --- | --- |
| `create(message)` | Inserir mensagem |
| `getHistory(sessionId, limit)` | Últimas N mensagens |

### AiUsageRepository
| Método | Descrição |
| --- | --- |
| `incrementUsage(userId, tokensIn, tokensOut)` | Incrementar contadores do dia |

## SERVICES

### RagService
| Método | Descrição |
| --- | --- |
| `generateAnswer(question, userId, sessionId, context?)` | Orquestrar RAG completo |
| `retrieveContext(question, userId, context)` | Chamar Hybrid Search |
| `buildSystemPrompt(context)` | Construir prompt de sistema (persona + grounding) |
| `buildUserPrompt(question, chunks, history)` | Construir prompt do usuário com contexto |
| `callLLM(systemPrompt, userPrompt, model)` | Chamar DeepSeek |
| `extractCitations(answer, chunks)` | Extrair citações implícitas |
| `calculateGrounding(answer, chunks)` | Verificar se resposta é fundamentada nos chunks |

### Fluxo do método `generateAnswer`
1. Validar inputs (Zod)
2. `ChatSessionRepository.getById(sessionId)` — validar sessão e ownership
3. `ChatMessageRepository.getHistory(sessionId, 10)` — últimas mensagens
4. `retrieveContext(question, userId, context)` → `SearchResult[]` (top 5)
5. Se 0 resultados → fallback: responder que não há material suficiente
6. `buildSystemPrompt(sessionContext)` → system prompt
7. `buildUserPrompt(question, chunks, history)` → user prompt
8. `callLLM(systemPrompt, userPrompt, model)` → resposta (streaming SSE)
9. `extractCitations(answer, chunks)` → citações
10. Salvar `chat_messages` (user + assistant)
11. `AiUsageRepository.incrementUsage(userId, tokensIn, tokensOut)`
12. Emitir `RagQueryPerformed`

### Prompt template (sistema)
```
Você é o Professor IA da ConcursoAI, especialista em concursos públicos brasileiros.

REGRAS:
1. Responda APENAS com base no CONTEXTO fornecido abaixo.
2. Se o contexto não contiver informação suficiente, diga: "Não encontrei material suficiente sobre este tema nos seus documentos. Sugiro fazer upload de materiais relacionados."
3. Cite a fonte ao final de cada afirmação: [Documento: nome, Página: X].
4. Use linguagem clara e didática, adequada para estudo.
5. Formate a resposta em Markdown para melhor legibilidade.
6. Se a pergunta for sobre resolução de questões, apresente o raciocínio passo a passo.

CONTEXTO:
{chunks_formatados}

PERGUNTA DO ALUNO:
{question}
```

## DTO

### RagRequestDto (input)
```typescript
{
  question: string,
  session_id: string,
  subject_id?: string,
  document_ids?: string[],
  top_k?: number
}
```

### RagResponseDto (output)
```typescript
{
  answer: string,              // Markdown
  citations: {
    document_id: string,
    document_title: string,
    snippet: string,
    page?: number
  }[],
  tokens_used: {
    in: number,
    out: number
  },
  model: string,
  grounding_score: number
}
```

### Mapper
- `toRagResponseDto(answer, citations, tokens, model, grounding): RagResponseDto`

## API

### `POST /api/chat` (expandir endpoint existente)

O endpoint atual (`src/app/api/chat/route.ts`) já implementa SSE streaming. A integração RAG adiciona:

- Antes de chamar o LLM, executar `RagService.retrieveContext()`
- Injetar chunks no system prompt
- Incluir citações na resposta final (após streaming)
- Registrar `tokens_in`, `tokens_out`, `grounding_score`

**Request (atualizado):**
```json
{
  "message": "Quais são os direitos fundamentais previstos no Art. 5º?",
  "session_id": "uuid",
  "subject_id": "uuid-opcional"
}
```

**Response (SSE stream):**
```
data: {"type":"token","content":"Os "}
data: {"type":"token","content":"direitos "}
...
data: {"type":"done","citations":[...],"tokens":{"in":1240,"out":380},"grounding_score":0.94}
```

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `RagQueryPerformed` | `{ session_id, user_id, chunks_retrieved, tokens_in, tokens_out, grounding_score }` | Após resposta gerada |
| `TokenUsed` | `{ user_id, tokens_in, tokens_out, model }` | Após incremento em ai_usage |

### Consumidos
- Nenhum (sob demanda)

## CACHE

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `rag:response:{questionHash}:{contextHash}:{userId}` | `RagResponseDto` | 30 min | Cache de resposta para perguntas repetidas |
| `rag:chunks:{queryHash}:{userId}` | `chunk_ids[]` | 1h | Cache dos chunks recuperados |

### Invalidação
- `rag:*:{userId}:*` invalidado quando documentos do usuário mudam
- TTL curto (30 min) para respostas (conteúdo pode ser atualizado)

## OBSERVABILITY

### Logs
```
[INFO] RAG query: user={userId} session={sessionId} question_length={n}
[INFO] RAG retrieved: user={userId} chunks={n} top_score={score}
[WARN] RAG low grounding: user={userId} score={score} (threshold: 0.5)
[INFO] RAG completed: user={userId} tokens_in={n} tokens_out={n} duration_ms={ms}
[WARN] RAG no context: user={userId} (0 chunks retrieved)
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `rag_queries_total` | Counter | Total de queries RAG |
| `rag_chunks_retrieved` | Histogram | Distribuição de chunks recuperados |
| `rag_grounding_score` | Histogram | Distribuição de scores de grounding |
| `rag_tokens_per_query` | Histogram | Tokens por query |
| `rag_duration_ms` | Histogram | Latência total do RAG |
| `rag_no_context_total` | Counter | Queries sem contexto (0 chunks) |

### Alertas
- `rag_grounding_score_avg < 0.5` — modelo alucinando ou chunks irrelevantes
- `rag_no_context_rate > 20%` — catálogo de documentos insuficiente
- `rag_duration_ms_p95 > 5000` — latência alta

## TESTS

### Unitários
- [ ] `buildSystemPrompt` inclui chunks formatados no prompt
- [ ] `buildUserPrompt` inclui pergunta + histórico
- [ ] `extractCitations` identifica menções a documentos na resposta
- [ ] `calculateGrounding` retorna score baixo para resposta genérica (sem fontes)
- [ ] `toRagResponseDto` inclui citações e tokens

### Integração
- [ ] Pergunta sobre conteúdo de documento → resposta com citação
- [ ] Pergunta sem documentos → "Não encontrei material suficiente"
- [ ] Histórico da conversa é incluído no prompt
- [ ] `chat_messages` salvo com `tokens_in`, `tokens_out`
- [ ] `ai_usage` incrementado
- [ ] `RagQueryPerformed` emitido

### E2E
- [ ] Upload PDF → pergunta no chat → resposta com citação do PDF

## ACCEPTANCE CRITERIA

1. ✅ Resposta é fundamentada nos chunks recuperados (grounding_score > 0.5)
2. ✅ Citações incluem `document_title` e `page` (quando disponível)
3. ✅ Se 0 chunks recuperados, resposta informa falta de material
4. ✅ Streaming SSE mantido (primeiro token < 1s)
5. ✅ Latência total < 5s (p95)
6. ✅ Resposta formatada em Markdown
7. ✅ Prompt do sistema inclui regras de grounding e persona
8. ✅ Histórico da conversa (últimas 10 mensagens) incluído como contexto
9. ✅ Tokens contabilizados em `ai_usage`
10. ✅ Cache de resposta evita chamada duplicada ao LLM (30 min TTL)

## IMPLEMENTATION ORDER

1. **`src/lib/knowledge/retrieval/prompt-templates.ts`** — System prompt + user prompt builder
2. **`RagService`** — `generateAnswer()` com orquestração completa
3. **Integração com Hybrid Search** — `retrieveContext()`
4. **Integração com `POST /api/chat`** — Adicionar RAG ao endpoint existente
5. **Citações** — `extractCitations()` + formato na resposta SSE
6. **Cache** — Redis keys `rag:response:*` + `rag:chunks:*`
7. **`AiUsageRepository`** — `incrementUsage()`
8. **DTO + Mapper** — `RagRequestDto`, `RagResponseDto`
9. **Testes**
