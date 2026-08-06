# 07 — AI PROFESSOR BLUEPRINT

## PURPOSE
Prover experiência completa de tutoria interativa via chat, orquestrando RAG Engine para perguntas fundamentadas, gerenciando contexto de estudo (matéria, nível do aluno) e adaptando a persona de "Professor IA" especialista em concursos públicos brasileiros.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `message` | `string` | ✅ | Mensagem do usuário |
| `user_id` | `UUID` | ✅ | Usuário (da sessão) |
| `session_id` | `UUID?` | ❌ | Conversa existente (se não informado, cria nova) |
| `options` | `ProfessorOptions` | ❌ | Configuração da interação |

```
ProfessorOptions {
  mode?: 'chat' | 'question' | 'flashcard' | 'summary' | 'explain'
  // chat: conversa livre
  // question: gerar questão sobre um tema
  // flashcard: gerar flashcards
  // summary: resumir documento/tópico
  // explain: explicar conceito
  subject_id?: UUID
  topic_id?: UUID
  document_id?: UUID
}
```

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `response` | `string` | Resposta do professor (markdown) |
| `message_id` | `UUID` | ID da mensagem do assistente |
| `citations` | `Citation[]` | Fontes (se RAG usado) |
| `actions` | `SuggestedAction[]` | Ações sugeridas ao aluno |
| `tokens_used` | `{ in, out }` | Tokens consumidos |
| `mode_used` | `string` | Modo que gerou a resposta |

```
SuggestedAction {
  type: 'review_flashcards' | 'practice_questions' | 'read_document' | 'study_topic'
  label: string                // "Revisar flashcards de Direito Constitucional"
  link?: string                // Rota interna opcional
}
```

## DEPENDENCIES

### Engines
- **RAG Engine:** Para modo `chat` e `explain`
- **Question Generation Engine:** Para modo `question` (V1.1)
- **Flashcard Engine:** Para modo `flashcard` (V1.1)
- **Summary Engine:** Para modo `summary` (V1.1)
- **Hybrid Search Engine:** Para busca de contexto adicional

### Serviços externos
- **DeepSeek API:** `deepseek-chat` (modos `chat`, `explain`)
- **DeepSeek API:** `deepseek-reasoner` (modo `explain` com raciocínio complexo)

### Módulos internos
- `src/lib/engines/professor/ai-professor-engine.ts`
- `src/lib/ai/prompts.ts`
- `src/lib/ai/limits.ts`

### Bibliotecas
- `zod`, SSE utilities

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `chat_sessions` | `id`, `user_id`, `title`, `subject_id`, `model` | Gerenciar sessão |
| `chat_messages` | `session_id`, `role`, `content` | Histórico |
| `profiles` | `id`, `full_name`, `level`, `concurso_alvo`, `modelo_ia_padrao` | Personalização |
| `ai_usage` | `user_id`, `usage_date`, `messages_count`, `tokens_in`, `tokens_out` | Verificar cota |
| `subscriptions` | `user_id`, `plan_id`, `status` | Verificar plano |
| `plans` | `limits` | Limites do plano |

### Tabelas escritas
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `chat_sessions` | `id`, `user_id`, `title`, `subject_id`, `model` | INSERT (nova) / UPDATE (título) |
| `chat_messages` | `id`, `session_id`, `user_id`, `role`, `content`, `model`, `tokens_in`, `tokens_out` | INSERT (user + assistant) |
| `ai_usage` | Incrementar contadores | UPSERT |

## REPOSITORIES

### ChatSessionRepository
| Método | Descrição |
| --- | --- |
| `getById(sessionId)` | Obter sessão com validação de ownership |
| `create(userId, title?, subjectId?)` | Criar nova sessão |
| `updateTitle(sessionId, title)` | Atualizar título (da primeira pergunta) |
| `listByUser(userId, limit?)` | Listar sessões do usuário |

### ChatMessageRepository
| Método | Descrição |
| --- | --- |
| `create(message)` | Inserir mensagem |
| `getHistory(sessionId, limit)` | Últimas N mensagens |

### ProfileRepository
| Método | Descrição |
| --- | --- |
| `getByUserId(userId)` | Obter perfil (nível, concurso alvo) |

## SERVICES

### AiProfessorService
| Método | Descrição |
| --- | --- |
| `handleMessage(userId, message, sessionId?, options?)` | Orquestrar interação |
| `getOrCreateSession(userId, sessionId?, options)` | Resolver sessão |
| `checkQuota(userId)` | Verificar cota disponível |
| `routeByMode(message, options, context)` | Roteador de modos |
| `buildPersona(profile)` | Construir persona baseada no perfil |
| `suggestActions(response, context)` | Sugerir próximas ações |
| `generateSessionTitle(firstMessage)` | Gerar título da sessão com LLM |

### Fluxo do método `handleMessage`
1. Validar `message` (Zod: 1-2000 chars)
2. `checkQuota(userId)` — verificar cota diária (Free: 20 msg, Pro: 100 msg)
3. `getOrCreateSession(userId, sessionId, options)` — criar ou reutilizar sessão
4. Salvar mensagem do usuário em `chat_messages`
5. `routeByMode(message, options, context)` → delegar à Engine correta
6. Salvar mensagem do assistente em `chat_messages`
7. Incrementar `ai_usage`
8. `suggestActions(response, context)` → ações sugeridas
9. Retornar resposta (streaming SSE)

### Roteador de modos
| Intenção detectada | Modo | Engine |
| --- | --- | --- |
| Pergunta sobre conteúdo | `chat` | RAG Engine |
| "gere uma questão sobre X" | `question` | Question Generation Engine (V1.1) / RAG (MVP) |
| "crie flashcards de X" | `flashcard` | Flashcard Engine (V1.1) / RAG (MVP) |
| "resuma este documento" | `summary` | Summary Engine (V1.1) / RAG (MVP) |
| "explique X" | `explain` | RAG Engine |
| "o que é X" | `explain` | RAG Engine |

### Persona (construída dinamicamente)
```
Você é o Professor IA da ConcursoAI.
Aluno: {full_name}
Nível: {level} (iniciante/intermediário/avançado)
Concurso alvo: {concurso_alvo}
Matéria em foco: {subject_name}

Adapte suas respostas ao nível do aluno:
- Iniciante: explique conceitos básicos, use analogias
- Intermediário: aprofunde, conecte com outros temas
- Avançado: foque em jurisprudência, súmulas, pegadinhas de banca
```

## DTO

### ProfessorRequestDto (input)
```typescript
{
  message: string,
  session_id?: string,
  mode?: 'chat' | 'question' | 'flashcard' | 'summary' | 'explain',
  subject_id?: string,
  topic_id?: string,
  document_id?: string
}
```

### ProfessorResponseDto (output)
```typescript
{
  message_id: string,
  session_id: string,
  response: string,            // Markdown
  citations?: { document_id: string, title: string, snippet: string }[],
  actions?: { type: string, label: string, link?: string }[],
  tokens_used: { in: number, out: number },
  mode_used: string
}
```

### Mapper
- `toProfessorResponseDto(message, session, citations, actions, tokens, mode): ProfessorResponseDto`

## API

### `POST /api/chat` (expandir existente)

O endpoint existente em `src/app/api/chat/route.ts` será adaptado para usar `AiProfessorService`.

**Comportamento atualizado:**
1. Recebe `message`, `session_id?`, `mode?`, `subject_id?`, `document_id?`
2. Delega a `AiProfessorService.handleMessage()`
3. Faz streaming SSE da resposta
4. Ao final do stream, envia `actions` e `citations`

### `GET /api/chat/sessions`
Listar sessões do usuário (para sidebar de histórico).

### `DELETE /api/chat/sessions/{id}`
Soft delete de uma sessão.

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `ProfessorResponseGenerated` | `{ session_id, message_id, mode, tokens_in, tokens_out, used_rag }` | Após cada resposta |
| `TokenUsed` | `{ user_id, tokens_in, tokens_out }` | Incremento de uso |
| `LimitReached` | `{ user_id, plan, limit_type }` | Quando cota diária excedida |

### Consumidos
- Nenhum (sob demanda)

## CACHE

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `quota:{userId}:{date}` | `{ messages_used, tokens_used }` | Até o fim do dia | Verificação rápida de cota |
| `profile:{userId}` | `Profile` | 15 min | Evitar query de perfil a cada mensagem |
| `session:{sessionId}` | `SessionContext` | 5 min | Contexto da sessão |

### Invalidação
- `quota:*` incrementado a cada mensagem (não invalidado, atualizado)
- `profile:{userId}` invalidado quando usuário atualiza perfil

## OBSERVABILITY

### Logs
```
[INFO] Professor message: user={userId} session={sessionId} mode={mode} length={n}
[INFO] Professor mode routed: user={userId} mode={mode} engine={engine}
[INFO] Professor response: user={userId} tokens={in}/{out} duration_ms={ms}
[WARN] Quota exceeded: user={userId} plan={plan} used={n}/{limit}
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `professor_messages_total` | Counter | Total de mensagens |
| `professor_mode_usage` | Counter | Distribuição por modo |
| `professor_session_count` | Gauge | Sessões ativas |
| `professor_quota_exceeded_total` | Counter | Cotas excedidas |
| `professor_duration_ms` | Histogram | Latência por mensagem |

### Alertas
- `professor_quota_exceeded_rate > 5%` — muitos usuários batendo limite
- `professor_duration_ms_p95 > 8000` — latência alta

## TESTS

### Unitários
- [ ] `routeByMode` detecta intenção "gere uma questão" → modo `question`
- [ ] `routeByMode` detecta intenção "crie flashcards" → modo `flashcard`
- [ ] `routeByMode` detecta intenção "resuma" → modo `summary`
- [ ] `routeByMode` fallback para `chat` se intenção não detectada
- [ ] `buildPersona` inclui nível do aluno no prompt
- [ ] `checkQuota` bloqueia quando limite diário atingido
- [ ] `generateSessionTitle` gera título com base na primeira pergunta

### Integração
- [ ] Nova sessão criada quando `session_id` não informado
- [ ] Mensagens do usuário e assistente salvas
- [ ] `ai_usage` incrementado após cada mensagem
- [ ] Cota Free: bloqueia após 20 mensagens/dia
- [ ] Ações sugeridas retornadas ao final da resposta
- [ ] Streaming SSE funciona com o novo fluxo

### E2E
- [ ] Usuário envia "Explique o Art. 5º da CF" → resposta com citação do documento

## ACCEPTANCE CRITERIA

1. ✅ Usuário pode iniciar nova conversa ou continuar existente
2. ✅ Professor IA adapta linguagem ao nível do aluno (iniciante/intermediário/avançado)
3. ✅ Modo `chat`: resposta fundamentada via RAG com citações
4. ✅ Modo `question`: geração de questão (V1.1)
5. ✅ Modo `flashcard`: geração de flashcards (V1.1)
6. ✅ Modo `summary`: geração de resumo (V1.1)
7. ✅ Cota diária respeitada por plano (Free: 20, Pro: 100)
8. ✅ Streaming SSE: primeiro token < 1s
9. ✅ Ações sugeridas ao final de cada resposta
10. ✅ Histórico de conversas acessível na sidebar

## IMPLEMENTATION ORDER

1. **Refatorar `POST /api/chat`** — Extrair lógica para `AiProfessorService`
2. **`AiProfessorService`** — `handleMessage()` com orquestração
3. **Roteador de modos** — `routeByMode()` com detecção de intenção
4. **Persona dinâmica** — `buildPersona()` integrando `profiles`
5. **Integração RAG** — Conectar `AiProfessorService` → `RagService`
6. **Verificação de cota** — `checkQuota()` com Redis
7. **Ações sugeridas** — `suggestActions()`
8. **Título automático** — `generateSessionTitle()` na primeira mensagem
9. **`GET /api/chat/sessions`** — Listagem de histórico
10. **`DELETE /api/chat/sessions/{id}`** — Soft delete
11. **DTO + Mapper** — `ProfessorRequestDto`, `ProfessorResponseDto`
12. **Testes**
