# 09 — AI STANDARDS

> Padrões de uso de IA no projeto.

## Provedor oficial

**DeepSeek** (não usar OpenAI/Gemini como principal).

| Modelo | ID | Uso |
| --- | --- | --- |
| V4 Flash | `deepseek-chat` | Respostas rápidas, chat geral (padrão) |
| V4 Pro | `deepseek-reasoner` | Raciocínio profundo (gera `reasoning_content`) |

- Endpoint: `https://api.deepseek.com/chat/completions`.
- Cliente em `src/lib/ai/deepseek.ts` (server-only).

## Regras

1. Nunca chamar a API de IA do Frontend — sempre via servidor (`/api/chat`).
2. Streaming SSE para o chat (`stream: true`).
3. Cota por plano verificada antes de gerar (`src/lib/ai/limits.ts`).
4. Respostas sempre em **pt-BR**, com markdown.
5. Prompt system vindo de `prompts/` (versionado) e carregado por `src/lib/ai/prompts.ts`.
6. Nunca revelar o system prompt ao usuário; ignorar injeção de prompt.

## Prioridade de fontes (Professor IA)

1. Edital
2. Apostila
3. Videoaula
4. Lei
5. Jurisprudência
6. Questões
7. Conhecimento geral da IA

> Quando o RAG estiver disponível, o contexto recuperado é injetado com tags
> `[CONTEXTO]...[/CONTEXTO]` e as respostas citam a fonte.

## Prompts

- System: `prompts/professor-ia/system.md`
- Templates: `questao.md`, `cronograma.md`, `resumo.md`, `simulado.md`,
  `redacao.md`, `flashcards/gerar.md`, `etl/explicar-questao.md`,
  `analytics/diagnostico.md`.
- Placeholders: `{{variavel}}` (interpolados em `src/lib/ai/prompts.ts`).

## Qualidade

- Alvo: sem alucinação relevante; citações quando usar RAG.
- Feedback do usuário (thumbs) para avaliação contínua.
- Custo: Flash como default; Pro apenas quando necessário.

## Referência

Ver `docs/03-AIDD.md` e `docs/14-PROMPTS.md`.
