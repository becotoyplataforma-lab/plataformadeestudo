# AI — ConcursoAI

## Provedores
- **DeepSeek** (`deepseek-chat` = flash, `deepseek-reasoner` = pro) — chat, RAG, geração de
  questões, flashcards e aulas. Config: `DEEPSEEK_API_KEY` (opcional).
- **BAAI/bge-m3** (1024d) — embeddings. Config: `EMBEDDING_API_URL`, `EMBEDDING_API_KEY`,
  `EMBEDDING_MODEL`, `EMBEDDING_DIMENSION`.

## Serviços
- `ChatService` / `DeepSeekProvider` — chat streaming do Professor.
- `RagService` — busca híbrida + prompt + DeepSeek, com citações e confiança.
- `QuestionGenerationService` / `QuestionValidationService`.
- `FlashcardGenerationService` — apostila → flashcards (com fonte).
- `LessonGenerationService` — apostila → roteiro estruturado de aula.
- `ExerciseGenerationService` — fraqueza do aluno → questões de reforço.
- `WeaknessAnalysisService` — matérias/tópicos com baixo acerto.

## Limites
`resolveUserLimits` (billing) → `getAiUsage` (Drizzle, `ai_usage`). Free 50 msgs/dia.

## Segurança
- `server-only` em todos os serviços de IA.
- Nenhuma API key no código; apenas leitura de `process.env` via `src/lib/env.ts`.
- Sem chave configurada → respostas elegantes ("não configurado"), sem crash de build.
