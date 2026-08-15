# QUESTION GENERATION — ConcursoAI

## Fluxo
```
APOSTILA (chunked/indexed) → CHUNKS → DEEPSEEK → VALIDAÇÃO → EM_REVISÃO → ADMIN → PUBLICADA
```

## Componentes
- **`QuestionGenerationService`** (`src/lib/ai/services/question-generation.service.ts`):
  orquestra geração a partir de um documento processado.
- **`QuestionGenerationProvider`** (`src/lib/ai/generation/question-generation.provider.ts`):
  interface + `DeepSeekQuestionProvider`. Requer `DEEPSEEK_API_KEY`.
- **`QuestionValidationService`** (`src/lib/ai/services/question-validation.service.ts`):
  validação pura (5 alternativas, gabarito A–E, explicação, dificuldade, duplicidade,
  relação com o conteúdo, contradição). Retorna `score` de confiança 0–1.

## Regras
1. A IA é instruída a **não inventar informação fora da fonte** quando o modo é "baseado na apostila".
2. Cada questão tem **rastreabilidade**: `source_document_id` + `source_chunk_id`
   (chunk escolhido por sobreposição de termos com o enunciado).
3. Questões geradas entram como **`em_revisao`** com `needs_review=true` — **nunca** publicadas
   automaticamente.

## Estados (`question_status`)
`rascunho → em_revisao → publicada` | `rejeitada` | `bloqueada`

## APIs (admin)
- `POST /api/admin/questions/generate` — gera N questões de uma apostila.
- `POST /api/admin/questions/[id]/review` — `aprovar|rejeitar|publicar|bloquear|revisar`,
  grava histórico em `question_moderation_events`.
- `GET /api/admin/questions` — filtros: status, matéria, banca, origem, documento, dificuldade.

## Tela
`/admin/questoes/gerar` e `/admin/questoes/revisao` (fila de revisão).
