# 08 — QUESTION GENERATION BLUEPRINT

## PURPOSE
Gerar questões de múltipla escolha no estilo concurso público a partir de documentos ou tópicos de estudo, com enunciado, 5 alternativas (A-E), gabarito correto e explicação detalhada. As questões geradas passam por curadoria antes de integrarem o banco oficial.

> **Fase:** V1.1 — No MVP, questões são geradas sob demanda no chat (Professor IA), sem persistência separada.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `source` | `GenerationSource` | ✅ | Origem do conteúdo |
| `count` | `integer` | ❌ | Quantidade (default: 1, max: 5) |
| `options` | `GenOptions` | ❌ | Configuração de geração |

```
GenerationSource {
  type: 'document' | 'topic' | 'chunks'
  document_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
  chunk_ids?: UUID[]
}

GenOptions {
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed'  // default: mixed
  style?: 'cespe' | 'fgv' | 'cesgranrio' | 'generic' // default: generic
  avoid_ids?: UUID[]          // Questões já existentes (evitar repetição)
}
```

### Estilos de banca
| Estilo | Característica |
| --- | --- |
| `cespe` | Certo/Errado, enunciados longos, pegadinhas |
| `fgv` | Múltipla escolha, casos práticos, alternativa "correta" vs "mais correta" |
| `cesgranrio` | Objetiva, enunciados diretos, cálculos |
| `generic` | Padrão concurso: 5 alternativas, 1 correta |

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `questions` | `GeneratedQuestion[]` | Questões geradas |
| `tokens_used` | `integer` | Tokens consumidos |
| `source_info` | `SourceInfo` | Resumo da origem |

```
GeneratedQuestion {
  id: UUID
  enunciado: string
  alternativas: {
    letter: 'A' | 'B' | 'C' | 'D' | 'E'
    text: string
  }[]
  gabarito: 'A' | 'B' | 'C' | 'D' | 'E'
  explicacao: string
  source_document_id?: UUID
  source_chunk_id?: UUID
  subject_id?: UUID
  topic_id?: UUID
  difficulty: 'easy' | 'medium' | 'hard'
  style: string
  status: 'pending_review'    // Sempre gerado como pendente de curadoria
  is_curated: false
  created_at: ISO8601
}
```

## DEPENDENCIES

### Engines
- **Hybrid Search Engine:** Recuperar chunks quando `source.type = 'topic'`

### Serviços externos
- **DeepSeek API:** `deepseek-chat` para geração de questões

### Módulos internos
- `src/lib/engines/generation/question-generation-engine.ts`
- `src/lib/engines/generation/prompts/question-prompts.ts`
- `src/lib/engines/generation/validators.ts`

### Bibliotecas
- `zod` — validação de entrada e saída

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `documents` | `id`, `title`, `user_id` | Validar origem |
| `knowledge_subjects` | `id`, `name` | Classificação |
| `knowledge_topics` | `id`, `name`, `subject_id` | Classificação |
| `questions` | `content_hash` | Deduplicação (evitar gerar igual) |

### Tabelas escritas (V1.1)
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `generated_questions` | `id`, `source_document_id`, `source_chunk_id`, `subject_id`, `topic_id`, `enunciado`, `alternativas`, `gabarito`, `explicacao`, `difficulty`, `style`, `status`, `is_curated`, `tokens_used`, `created_at` | INSERT |

### Estrutura de `generated_questions` (V1.1)
```sql
CREATE TABLE generated_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id UUID REFERENCES documents(id),
  source_chunk_id UUID REFERENCES document_chunks(id),
  subject_id UUID REFERENCES knowledge_subjects(id),
  topic_id UUID REFERENCES knowledge_topics(id),
  enunciado TEXT NOT NULL,
  alternativas JSONB NOT NULL,    -- [{ letter, text }]
  gabarito CHAR(1) NOT NULL,      -- A-E
  explicacao TEXT,
  difficulty VARCHAR(20) NOT NULL DEFAULT 'medium',
  style VARCHAR(20) NOT NULL DEFAULT 'generic',
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
- `generated_questions`: administrador insere; usuário lê apenas questões curatedas associadas a seus documentos

## REPOSITORIES

### GeneratedQuestionRepository
| Método | Descrição |
| --- | --- |
| `createBatch(questions)` | Inserir múltiplas questões geradas |
| `getPendingReview(limit)` | Listar pendentes de curadoria |
| `approve(questionId, curatedBy)` | Marcar como curated |
| `reject(questionId)` | Soft delete |
| `getByDocument(documentId)` | Questões geradas de um documento |

### QuestionRepository (Study domain)
| Método | Descrição |
| --- | --- |
| `findByHash(contentHash)` | Buscar questão existente por hash |
| `createFromGenerated(generated)` | Migrar questão aprovada para `questions` |

## SERVICES

### QuestionGenerationService
| Método | Descrição |
| --- | --- |
| `generate(source, count, options?)` | Orquestrar geração |
| `buildPrompt(source, count, options)` | Construir prompt template |
| `validateOutput(raw)` | Validar saída do LLM (Zod) |
| `deduplicate(questions)` | Remover questões similares a existentes |
| `storeGenerated(questions)` | Persistir em generated_questions |
| `getContext(source)` | Recuperar chunks relevantes |

### Fluxo do método `generate`
1. Validar inputs (Zod)
2. `getContext(source)` → chunks relevantes (via Hybrid Search se topic)
3. `buildPrompt(source, count, options)` → prompt estruturado
4. Chamar DeepSeek com prompt
5. `validateOutput(raw)` → validar formato (alternativas A-E, gabarito válido)
6. `deduplicate(questions)` → remover similares a questões existentes
7. `storeGenerated(questions)` → INSERT em `generated_questions`
8. Emitir `QuestionsGenerated`
9. Retornar DTO

### Prompt template
```
Gere {count} questão(ões) de múltipla escolha no estilo {style} para concurso público.

NÍVEL: {difficulty}
MATÉRIA: {subject_name}
TÓPICO: {topic_name}

CONTEXTO (baseado no material de estudo):
{chunks_texto}

FORMATO DE SAÍDA (JSON):
[
  {{
    "enunciado": "texto da questão",
    "alternativas": [
      {{ "letter": "A", "text": "alternativa A" }},
      {{ "letter": "B", "text": "alternativa B" }},
      {{ "letter": "C", "text": "alternativa C" }},
      {{ "letter": "D", "text": "alternativa D" }},
      {{ "letter": "E", "text": "alternativa E" }}
    ],
    "gabarito": "C",
    "explicacao": "explicação detalhada do gabarito, mencionando o porquê cada alternativa está errada"
  }}
]

REGRAS:
1. Apenas UMA alternativa correta.
2. Alternativas plausíveis (não óbvias).
3. Explicação deve referenciar o conteúdo do contexto.
4. Se estilo CESPE: use formato "Certo/Errado" adaptado para A/B.
```

## DTO

### QuestionGenRequestDto (input)
```typescript
{
  source: {
    type: 'document' | 'topic' | 'chunks',
    document_id?: string,
    subject_id?: string,
    topic_id?: string
  },
  count?: number,              // 1-5, default 1
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed',
  style?: 'cespe' | 'fgv' | 'cesgranrio' | 'generic'
}
```

### QuestionGenResponseDto (output)
```typescript
{
  questions: {
    id: string,
    enunciado: string,
    alternativas: { letter: string, text: string }[],
    gabarito: string,
    explicacao: string,
    difficulty: string,
    style: string,
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
- `toQuestionGenResponseDto(questions, tokens, source): QuestionGenResponseDto`
- ⚠️ O DTO de saída NÃO inclui `gabarito` se a questão ainda não foi respondida pelo usuário (contexto de prova/simulado)

## API

### `POST /api/knowledge/generate/questions` (V1.1)

- **Auth:** Obrigatória
- **Rate Limit:** 10/dia (Free), 50/dia (Pro)

**Request:**
```json
{
  "source": { "type": "topic", "subject_id": "uuid", "topic_id": "uuid" },
  "count": 5,
  "difficulty": "medium",
  "style": "cespe"
}
```

**Response 201:**
```json
{
  "questions": [...],
  "tokens_used": 3200,
  "source": {
    "type": "topic",
    "subject_name": "Direito Constitucional",
    "topic_name": "Direitos Fundamentais"
  }
}
```

### `POST /api/admin/questions/{id}/approve` (V1.1, admin)
Aprovar questão gerada e migrar para `questions` (Study domain).

### `POST /api/admin/questions/{id}/reject` (V1.1, admin)
Rejeitar e soft-delete questão gerada.

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `QuestionsGenerated` | `{ source_type, source_id, count, difficulty, tokens_used }` | Após geração |
| `QuestionApproved` | `{ generated_id, question_id, curated_by }` | Após curadoria |
| `QuestionRejected` | `{ generated_id, curated_by }` | Após rejeição |

### Consumidos
- Nenhum (sob demanda)

## CACHE

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `gen:question:{sourceHash}:{count}:{difficulty}:{style}` | `question_ids[]` | 24h | Cache de geração (evitar re-gerar igual) |

### Invalidação
- TTL fixo (24h)
- Invalidado se source muda (documento atualizado)

## OBSERVABILITY

### Logs
```
[INFO] Question generation: source={type}:{id} count={n} difficulty={d} style={s}
[INFO] Question generation completed: count={n} tokens={t} duration_ms={ms}
[WARN] Question validation failed: reason={msg} raw_output={snippet}
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `question_gen_total` | Counter | Gerações iniciadas |
| `question_gen_completed` | Counter | Gerações concluídas |
| `question_gen_failed_validation` | Counter | Falhas de validação (formato inválido) |
| `question_gen_tokens` | Histogram | Tokens por geração |
| `question_gen_duration_ms` | Histogram | Latência |

### Alertas
- `question_gen_failed_validation_rate > 20%` — prompt pode estar mal calibrado

## TESTS

### Unitários
- [ ] `buildPrompt` inclui chunks, dificuldade, estilo
- [ ] `validateOutput` rejeita gabarito fora de A-E
- [ ] `validateOutput` rejeita enunciado vazio
- [ ] `validateOutput` rejeita alternativas com letras duplicadas
- [ ] `deduplicate` remove questão com mesmo `content_hash`

### Integração
- [ ] Geração de 1 questão retorna formato válido
- [ ] Geração de 5 questões retorna 5 questões distintas
- [ ] Estilo `cespe` gera questões certo/errado
- [ ] Estilo `generic` gera múltipla escolha padrão
- [ ] `generated_questions` populado com status `pending_review`
- [ ] `QuestionsGenerated` emitido

### E2E
- [ ] Usuário: "Gere 5 questões de Direito Constitucional" → 5 questões → aprovar 3 → visíveis no banco de questões

## ACCEPTANCE CRITERIA

1. ✅ Questão gerada contém enunciado + 5 alternativas (A-E) + gabarito + explicação
2. ✅ Gabarito é uma das letras A-E
3. ✅ Alternativas são plausíveis e distintas
4. ✅ Explicação referencia o conteúdo fonte
5. ✅ Estilo da banca é aplicado (cespe: C/E; fgv: casos práticos)
6. ✅ Dificuldade é respeitada (easy: conceitos básicos; hard: jurisprudência)
7. ✅ Questão gerada com status `pending_review` (não vai direto para produção)
8. ✅ Curadoria: admin pode aprovar ou rejeitar
9. ✅ Questão aprovada migra para `questions` (Study) com `is_public = false`
10. ✅ Deduplicação: não gerar questão idêntica a existente (content_hash)

## IMPLEMENTATION ORDER

1. **Migration `generated_questions`** — Criar tabela (V1.1)
2. **`src/lib/engines/generation/prompts/question-prompts.ts`** — Templates por estilo de banca
3. **`src/lib/engines/generation/validators.ts`** — Validação Zod da saída
4. **`QuestionGenerationService`** — `generate()` completo
5. **`GeneratedQuestionRepository`** — CRUD
6. **`POST /api/knowledge/generate/questions`** — Endpoint
7. **Integração com AI Professor** — Modo `question` no chat
8. **Curadoria** — Endpoints admin approve/reject + migração para `questions`
9. **DTO + Mapper** — `QuestionGenRequestDto`, `QuestionGenResponseDto`
10. **Testes**
