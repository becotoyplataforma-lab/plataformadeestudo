# 09 — FLASHCARD BLUEPRINT

## PURPOSE
Gerar flashcards (frente/verso) a partir de documentos ou tópicos de estudo, otimizados para o sistema de revisão espaçada (Spaced Repetition). Cada flashcard é um par pergunta-resposta ou termo-definição com tags e classificação por matéria/tópico.

> **Fase:** V1.1 — No MVP, flashcards são gerados sob demanda no chat (Professor IA), sem persistência separada.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `source` | `GenerationSource` | ✅ | Origem do conteúdo |
| `count` | `integer` | ❌ | Quantidade (default: 5, max: 10) |
| `options` | `FlashcardOptions` | ❌ | Configuração |

```
GenerationSource {
  type: 'document' | 'topic' | 'chunks'
  document_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
  chunk_ids?: UUID[]
}

FlashcardOptions {
  style?: 'term_definition' | 'question_answer' | 'fill_blank' | 'mixed'
  // term_definition: frente=termo, verso=definição
  // question_answer: frente=pergunta, verso=resposta
  // fill_blank: frente=frase com lacuna, verso=palavra
  // mixed: mistura dos estilos
}
```

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `flashcards` | `GeneratedFlashcard[]` | Flashcards gerados |
| `tokens_used` | `integer` | Tokens consumidos |
| `source_info` | `SourceInfo` | Resumo da origem |

```
GeneratedFlashcard {
  id: UUID
  front: string               // Frente do cartão
  back: string                // Verso do cartão
  style: 'term_definition' | 'question_answer' | 'fill_blank'
  tags: string[]              // Tags sugeridas
  source_document_id?: UUID
  source_chunk_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
  status: 'pending_review'
  is_curated: false
  created_at: ISO8601
}
```

## DEPENDENCIES

### Engines
- **Hybrid Search Engine:** Recuperar chunks quando `source.type = 'topic'`

### Serviços externos
- **DeepSeek API:** `deepseek-chat` para geração de flashcards

### Módulos internos
- `src/lib/engines/generation/flashcard-engine.ts`
- `src/lib/engines/generation/prompts/flashcard-prompts.ts`
- `src/lib/engines/generation/validators.ts`

### Bibliotecas
- `zod` — validação

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `documents` | `id`, `title`, `user_id` | Validar origem |
| `knowledge_subjects` | `id`, `name` | Classificação |
| `knowledge_topics` | `id`, `name`, `subject_id` | Classificação |
| `knowledge_tags` | `id`, `name` | Sugestão de tags |

### Tabelas escritas (V1.1)
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `generated_flashcards` | `id`, `source_document_id`, `source_chunk_id`, `subject_id`, `topic_id`, `front`, `back`, `style`, `tags`, `status`, `is_curated`, `tokens_used`, `created_at` | INSERT |

### Estrutura de `generated_flashcards` (V1.1)
```sql
CREATE TABLE generated_flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID REFERENCES documents(id),
  source_chunk_id UUID REFERENCES document_chunks(id),
  subject_id UUID REFERENCES knowledge_subjects(id),
  topic_id UUID REFERENCES knowledge_topics(id),
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  style VARCHAR(30) NOT NULL DEFAULT 'term_definition',
  tags JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(20) NOT NULL DEFAULT 'pending_review',
  is_curated BOOLEAN NOT NULL DEFAULT false,
  curated_by UUID REFERENCES auth.users(id),
  curated_at TIMESTAMPTZ,
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);
```

### Política RLS
- Similar a `generated_questions`: admin insere; usuário lê apenas flashcards curatedos

## REPOSITORIES

### GeneratedFlashcardRepository
| Método | Descrição |
| --- | --- |
| `createBatch(flashcards)` | Inserir múltiplos flashcards |
| `getPendingReview(limit)` | Listar pendentes de curadoria |
| `approve(flashcardId, curatedBy)` | Marcar como curated |
| `reject(flashcardId)` | Soft delete |
| `getByDocument(documentId)` | Flashcards gerados de um documento |

### FlashcardRepository (Study domain)
| Método | Descrição |
| --- | --- |
| `createFromGenerated(generated, userId)` | Migrar flashcard aprovado para `flashcards` |
| `createReviewSchedule(flashcardId, userId)` | Criar `review_schedules` inicial |

## SERVICES

### FlashcardGenerationService
| Método | Descrição |
| --- | --- |
| `generate(source, count, options?)` | Orquestrar geração |
| `buildPrompt(source, count, options)` | Construir prompt template |
| `validateOutput(raw)` | Validar saída (Zod) |
| `suggestTags(front, back, subjectId)` | Sugerir tags baseadas no conteúdo |
| `storeGenerated(flashcards)` | Persistir |
| `getContext(source)` | Recuperar chunks |

### Fluxo do método `generate`
1. Validar inputs (Zod)
2. `getContext(source)` → chunks relevantes
3. `buildPrompt(source, count, options)` → prompt
4. Chamar DeepSeek com prompt
5. `validateOutput(raw)` → validar formato
6. `suggestTags(front, back, subjectId)` → enriquecer com tags
7. `storeGenerated(flashcards)` → INSERT
8. Emitir `FlashcardsGenerated`
9. Retornar DTO

### Prompt template
```
Gere {count} flashcards no estilo {style} para estudo de concurso público.

MATÉRIA: {subject_name}
TÓPICO: {topic_name}

CONTEXTO:
{chunks_texto}

FORMATO DE SAÍDA (JSON):
[
  {{
    "front": "frente do cartão (termo, pergunta ou frase com lacuna ____)",
    "back": "verso do cartão (definição, resposta ou palavra da lacuna)",
    "style": "term_definition | question_answer | fill_blank"
  }}
]

REGRAS:
1. Frente deve ser concisa (até 150 caracteres).
2. Verso deve ser completo e informativo (até 500 caracteres).
3. Cada flashcard deve cobrir exatamente 1 conceito.
4. Evite flashcards muito óbvios ou triviais.
5. Priorize conceitos-chave para concursos (prazos, definições legais, súmulas).
```

## DTO

### FlashcardGenRequestDto (input)
```typescript
{
  source: {
    type: 'document' | 'topic' | 'chunks',
    document_id?: string,
    subject_id?: string,
    topic_id?: string
  },
  count?: number,              // 1-10, default 5
  style?: 'term_definition' | 'question_answer' | 'fill_blank' | 'mixed'
}
```

### FlashcardGenResponseDto (output)
```typescript
{
  flashcards: {
    id: string,
    front: string,
    back: string,
    style: string,
    tags: string[],
    subject_name?: string,
    topic_name?: string,
    status: 'pending_review'
  }[],
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
- `toFlashcardGenResponseDto(flashcards, tokens, source): FlashcardGenResponseDto`

## API

### `POST /api/knowledge/generate/flashcards` (V1.1)

- **Auth:** Obrigatória
- **Rate Limit:** 10/dia (Free), 50/dia (Pro)

**Request:**
```json
{
  "source": { "type": "topic", "subject_id": "uuid", "topic_id": "uuid" },
  "count": 10,
  "style": "mixed"
}
```

**Response 201:**
```json
{
  "flashcards": [
    {
      "id": "uuid",
      "front": "O que é o Princípio da Legalidade?",
      "back": "Art. 5º, II da CF/88: Ninguém será obrigado a fazer ou deixar de fazer alguma coisa senão em virtude de lei.",
      "style": "question_answer",
      "tags": ["direito-constitucional", "principios", "artigo-5"],
      "status": "pending_review"
    }
  ],
  "tokens_used": 1800,
  "source": {
    "type": "topic",
    "subject_name": "Direito Constitucional",
    "topic_name": "Direitos Fundamentais"
  }
}
```

### `POST /api/admin/flashcards/{id}/approve` (V1.1, admin)
Aprovar e migrar para `flashcards` + criar `review_schedules`.

### `POST /api/admin/flashcards/{id}/reject` (V1.1, admin)
Rejeitar e soft-delete.

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `FlashcardsGenerated` | `{ source_type, source_id, count, style, tokens_used }` | Após geração |
| `FlashcardApproved` | `{ generated_id, flashcard_id, curated_by }` | Após curadoria e migração |
| `FlashcardRejected` | `{ generated_id, curated_by }` | Após rejeição |

### Consumidos
- Nenhum (sob demanda)

## CACHE

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `gen:flashcard:{sourceHash}:{count}:{style}` | `flashcard_ids[]` | 24h | Cache de geração |

### Invalidação
- TTL fixo (24h)
- Invalidado se source muda

## OBSERVABILITY

### Logs
```
[INFO] Flashcard generation: source={type}:{id} count={n} style={s}
[INFO] Flashcard generation completed: count={n} tokens={t} duration_ms={ms}
[WARN] Flashcard validation failed: reason={msg}
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `flashcard_gen_total` | Counter | Gerações iniciadas |
| `flashcard_gen_completed` | Counter | Gerações concluídas |
| `flashcard_gen_failed_validation` | Counter | Falhas de validação |
| `flashcard_gen_tokens` | Histogram | Tokens por geração |
| `flashcard_gen_duration_ms` | Histogram | Latência |

### Alertas
- `flashcard_gen_failed_validation_rate > 20%` — prompt mal calibrado

## TESTS

### Unitários
- [ ] `buildPrompt` inclui estilo e contexto
- [ ] `validateOutput` rejeita frente vazia
- [ ] `validateOutput` rejeita verso vazio
- [ ] `validateOutput` aceita estilo `term_definition`
- [ ] `suggestTags` retorna array de strings
- [ ] `toFlashcardGenResponseDto` não expõe `gabarito` (não aplicável)

### Integração
- [ ] Geração de 5 flashcards retorna 5 pares frente/verso
- [ ] Estilo `term_definition`: frente curta, verso completo
- [ ] Estilo `question_answer`: frente com pergunta, verso com resposta
- [ ] `generated_flashcards` populado com status `pending_review`
- [ ] Tags são sugeridas automaticamente
- [ ] `FlashcardsGenerated` emitido

### E2E
- [ ] Usuário: "Crie 10 flashcards de Direito Administrativo" → 10 flashcards → aprovar 5 → aparecem no deck

## ACCEPTANCE CRITERIA

1. ✅ Flashcard contém frente (até 150 chars) + verso (até 500 chars)
2. ✅ Frente e verso não vazios
3. ✅ Estilo aplicado: `term_definition`, `question_answer`, `fill_blank`
4. ✅ Tags sugeridas automaticamente (mínimo 1, máximo 5)
5. ✅ Classificado por `subject_id` e `topic_id` automaticamente
6. ✅ Status `pending_review` (curadoria antes de ir para produção)
7. ✅ Curadoria: admin aprova → migra para `flashcards` + cria `review_schedules` (SM-2 inicial)
8. ✅ Deduplicação: flashcards idênticos (mesma frente) não são gerados
9. ✅ Conteúdo relevante para concursos (prazos, definições, súmulas, artigos)
10. ✅ Máximo de 10 flashcards por geração

## IMPLEMENTATION ORDER

1. **Migration `generated_flashcards`** — Criar tabela (V1.1)
2. **`src/lib/engines/generation/prompts/flashcard-prompts.ts`** — Templates por estilo
3. **`src/lib/engines/generation/validators.ts`** — Validação Zod (compartilhada com Question Gen)
4. **`FlashcardGenerationService`** — `generate()` completo
5. **`GeneratedFlashcardRepository`** — CRUD
6. **`POST /api/knowledge/generate/flashcards`** — Endpoint
7. **Integração com AI Professor** — Modo `flashcard` no chat
8. **Curadoria** — Endpoints admin + migração para `flashcards` + `review_schedules`
9. **DTO + Mapper** — `FlashcardGenRequestDto`, `FlashcardGenResponseDto`
10. **Testes**
