# 05 — Documento de API

**Projeto:** ConcursoAI Platform
**Versão:** 1.0
**Data:** 2026-08-04

---

## 1. Visão Geral

A plataforma expõe dois estilos de API:

1. **API de Integração** — API Routes do Next.js (`/api/*`) para consumidores externos e integrações com terceiros (chat com streaming).
2. **Server Actions** — para mutações internas da UI (CRUD) com validação Zod.

Todas as rotas de negócio exigem autenticação (sessão NextAuth).

## 2. Autenticação

- `GET /api/auth/session` — sessão atual.
- `POST /api/auth/callback/*` — callbacks de provedores.
- Toda rota protegida usa `auth()` de NextAuth v5 e responde `401` com `{ error: "Não autenticado" }` quando ausente.

## 3. Convenções Gerais

- **Formato:** JSON (`application/json`), exceto `/api/chat` que usa SSE.
- **Erros:** `{ "error": "mensagem em pt-BR" }` com códigos:
  - `400` Bad Request (validação)
  - `401` Não autenticado
  - `403` Sem permissão
  - `404` Não encontrado
  - `409` Conflito (ex.: e-mail já cadastrado)
  - `422` Dados inválidos (Zod)
  - `429` Limite de uso atingido (rate limit)
  - `500` Erro interno
- **Paginação:** `?page=1&pageSize=20` → resposta `{ data, total, page, pageSize }`.
- **Filtros:** `?subject_id=...&banca=...&nivel=...`.

## 4. Endpoints

### 4.1 Autenticação

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| POST | `/api/register` | Não | Cria conta + perfil |
| POST | `/api/auth/[...nextauth]` | — | Handlers NextAuth (login/logout/callback) |
| GET | `/api/auth/session` | — | Sessão atual |

**POST /api/register**

```json
// Request
{ "name": "Maria Silva", "email": "maria@email.com", "password": "••••••••" }

// Response 201
{ "user": { "id": "uuid", "email": "maria@email.com", "plano": "free" } }
```

### 4.2 Dashboard e Analíticas

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/api/analises/resumo` | Sim | Resumo: acertos, streak, metas, evolução |
| GET | `/api/analises/por-materia` | Sim | Taxa de acerto por matéria |
| GET | `/api/analises/evolucao?days=30` | Sim | Série temporal de acertos |

**GET /api/analises/resumo → 200**

```json
{
  "total_questoes": 214,
  "acertos": 168,
  "taxa_acerto": 0.785,
  "streak_dias": 12,
  "meta_hoje_min": 120,
  "estudado_hoje_min": 95,
  "revisoes_pendentes": 14
}
```

### 4.3 Questões

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/api/questoes` | Sim | Lista questões (filtros + paginação) |
| POST | `/api/questoes` | Sim (admin/curador) | Cria questão |
| GET | `/api/questoes/[id]` | Sim | Detalhe com alternativas |
| POST | `/api/questoes/[id]/responder` | Sim | Registra tentativa e retorna gabarito |

**POST /api/questoes/:id/responder**

```json
// Request
{ "selected_letter": "C", "time_spent_sec": 42, "mode": "estudo" }

// Response 200
{
  "correct": true,
  "gabarito": "C",
  "explicacao": "O art. 5º, X, da CF/88 assegura...",
  "acertos_acumulados": 169
}
```

### 4.4 Flashcards

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/api/flashcards` | Sim | Lista (filtro por matéria/pendentes) |
| POST | `/api/flashcards` | Sim | Cria flashcard |
| PUT | `/api/flashcards/[id]` | Sim | Edita |
| DELETE | `/api/flashcards/[id]` | Sim | Remove |
| POST | `/api/flashcards/review` | Sim | Registra revisão SRS |

**POST /api/flashcards/review**

```json
// Request
{ "flashcard_id": "uuid", "rating": "facil" } // facil | medio | dificil

// Response 200
{ "next_review": "2026-08-06", "interval_days": 3, "due_today_left": 9 }
```

### 4.5 Chat Professor IA

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| POST | `/api/chat` | Sim | Envia mensagem (streaming SSE) |
| GET | `/api/chat/sessions` | Sim | Lista sessões de conversa |
| GET | `/api/chat/sessions/[id]/messages` | Sim | Histórico de mensagens |
| DELETE | `/api/chat/sessions/[id]` | Sim | Exclui sessão |

**POST /api/chat** — `Content-Type: text/event-stream`

```json
// Request
{
  "session_id": "uuid | null",
  "message": "Explique o que é responsabilidade civil do Estado",
  "model": "flash",
  "subject_id": "uuid | null"
}
```

```text
// Response (SSE)
event: start
data: {"session_id":"uuid"}

event: delta
data: {"text":"A responsabilidade civil do Estado está prevista no "}

event: delta
data: {"text":"art. 37, §6º, da CF/88..."}

event: done
data: {"tokens_in":310,"tokens_out":420,"model":"flash"}
```

### 4.6 Cronograma

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/api/cronograma/tarefas?date=...` | Sim | Tarefas do período |
| POST | `/api/cronograma/tarefas` | Sim | Cria tarefa |
| PATCH | `/api/cronograma/tarefas/[id]` | Sim | Atualiza/alterna status |
| DELETE | `/api/cronograma/tarefas/[id]` | Sim | Remove |
| GET/POST | `/api/cronograma/materias` | Sim | CRUD de disciplinas |

### 4.7 Perfil

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| GET | `/api/perfil` | Sim | Perfil atual |
| PATCH | `/api/perfil` | Sim | Atualiza preferências |
| POST | `/api/perfil/senha` | Sim | Altera senha |

### 4.8 Pagamentos (Mercado Pago)

| Método | Rota | Auth | Descrição |
| --- | --- | --- | --- |
| POST | `/api/payments/checkout` | Sim | Cria preferência de checkout p/ o plano |
| POST | `/api/payments/webhook` | Não | Webhook do Mercado Pago (ativa plano) |

**POST /api/payments/checkout**

```json
// Request
{ "plan": "pro" } // pro | intensivo

// Response 200
{
  "init_point": "https://www.mercadopago.com.br/checkout/v1/redirect?...",
  "sandbox_init_point": "https://sandbox.mercadopago.com.br/checkout/v1/redirect?...",
  "external_reference": "pro:uuid-do-usuario",
  "plan": "pro"
}
```

**POST /api/payments/webhook** — chamado pelo Mercado Pago:

```json
{ "action": "payment.created", "type": "payment", "data": { "id": "123456789" } }
```

- O servidor consulta o status na API do MP; se `approved`, chama a função
  `register_payment` (SECURITY DEFINER) que grava o pagamento e ativa o plano.
- Sempre responde `200` para evitar retries infinitos.

## 5. Rate Limiting

| Recurso | Limite | Janela |
| --- | --- | --- |
| Chat (free) | 50 mensagens | dia |
| Chat (pro) | 500 mensagens | dia |
| Chat (intensivo) | 2.000 mensagens | dia |
| Registro | 5 criações/IP | hora |
| API geral | 120 req/min | minuto |

Implementação: tabela `ai_usage` + cache em memória para registros; Redis (Upstash) no futuro.

## 6. Server Actions (mutações internas)

As seguintes operações usam Server Actions com `use server`:

| Ação | Local |
| --- | --- |
| `createStudyTask` / `toggleStudyTask` / `deleteStudyTask` | `src/app/(dashboard)/cronograma/actions.ts` |
| `createFlashcard` / `deleteFlashcard` | `src/app/(dashboard)/flashcards/actions.ts` |
| `updateProfile` | `src/app/(dashboard)/configuracoes/actions.ts` |

## 7. Versionamento e Compatibilidade

- Prefixo `/api/v1/` reservado para quando houver consumidores externos.
- Mudanças que quebram compatibilidade exigem deprecation window de 1 versão.

## 8. Documentação OpenAPI

- Spec em `docs/openapi.yaml` (futuro).
- Schema dos tipos em `src/types/api.ts` (fonte da verdade para clientes).

## 9. Testes de API

- Suíte com Vitest + `supertest` para rotas puras.
- Testes de contrato para `/api/chat` (SSE) e `/api/questoes/:id/responder`.
- Fixtures em `tests/fixtures/`.
