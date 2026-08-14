# 07 — API STANDARDS

> Padrões para API routes e Server Actions.

## API Routes (`src/app/api/*`)

- Métodos HTTP corretos: GET (leitura), POST (criação/ação), PATCH (atualização), DELETE (remoção).
- Autenticação: `requireAuth()` no topo (retorna `userId` ou `401`).
- Validação: Zod antes de qualquer operação.
- Resposta de sucesso: `apiOk(data, status)`.
- Resposta de erro: `apiError(status, mensagemPtBr)`.
- Erros nunca estouram: `try/catch` com `console.error` + `500`.
- Payload sempre JSON (exceto streaming SSE no chat).

## Convenções de resposta

```json
// Sucesso
{ "data": ..., "total": ..., "page": 1 }

// Erro
{ "error": "mensagem em pt-BR" }
```

## Códigos de status

| Código | Uso |
| --- | --- |
| 200 / 201 | Sucesso |
| 400 | Requisição inválida |
| 401 | Não autenticado |
| 403 | Sem permissão |
| 404 | Não encontrado |
| 409 | Conflito (ex.: e-mail já cadastrado) |
| 422 | Validação (Zod) |
| 429 | Rate limit / cota de IA |
| 500 | Erro interno |

## DTOs (saída)

- Toda resposta é um **DTO** validado por Zod (`src/lib/dto/<modulo>.dto.ts`).
- Mappers: `toXxxDto(input: unknown): XxxDto | null` — valida e normaliza.
- Em rotas/actions novas:
  ```ts
  import { strictDto } from "@/lib/dto";
  import { StudyTaskDtoSchema } from "@/lib/dto/study.dto";
  const dto = strictDto(StudyTaskDtoSchema, row); // ou toStudyTaskDto(row)
  ```
- Use `parseDto` quando quiser tolerar erro (log + null); `strictDto` para
  fail-fast no servidor.
- Nunca retornar entidade do banco crua — sempre via DTO.

## Camadas em rotas NOVAS (obrigatório)

Uma rota/action nova deve seguir este fluxo:

```
API / Server Action
   → Service (regras de negócio)
   → Repository (dados)
   → Mapper (entidade → DTO)
   → DTO validado (resposta)
```

| Camada | Onde | Responsabilidade |
| --- | --- | --- |
| **Service** | `src/lib/services/<modulo>.service.ts` | Regras de negócio, orquestração |
| **Repository** | `src/lib/db/repositories/<modulo>.ts` | Persistência/consultas |
| **Mapper** | `src/lib/dto/<modulo>.dto.ts` | Entidade → DTO |
| **DTO** | `src/lib/dto/<modulo>.dto.ts` | Contrato de saída validado |

Regras:
- A rota/action NÃO contém lógica de negócio — delega ao Service.
- Componentes nunca acessam banco diretamente.
- Rotas legadas podem permanecer como estão até sofrer manutenção
  (ver `04-CODING-RULES.md` §1.2).

## Endpoints principais

| Rota | Descrição |
| --- | --- |
| `POST /api/register` | Cadastro de usuário |
| `/api/auth/[...nextauth]` | NextAuth (login/logout/session) |
| `POST /api/auth/recuperar-senha` | Link de redefinição |
| `POST /api/chat` | Chat Professor IA (SSE streaming) |
| `GET /api/chat/sessions` / `[id]/messages` | Histórico de conversas |
| `GET /api/questoes` | Lista questões (filtros + paginação) |
| `POST /api/questoes/:id/responder` | Responde e retorna gabarito |
| `GET/POST /api/flashcards`, `POST /review` | Flashcards e revisão SRS |
| `GET /api/analises/resumo` | KPIs agregados |
| `POST /api/payments/checkout` | Checkout Mercado Pago |
| `POST /api/payments/webhook` | Webhook Mercado Pago (ativo plano) |
| `GET /api/health` | Health check |

## Server Actions (`actions.ts`)

- Prefixo `action` nos nomes: `actionCreateTask`, `actionToggleTask`.
- Retornam sempre `{ success: boolean; message: string }`.
- Chamam `revalidatePath()` após mutações.

## Streaming (chat)

- `POST /api/chat` responde `text/event-stream`.
- Eventos: `start` (session_id), `reasoning`, `delta` (texto), `done`, `error`.
- Cotas verificadas antes de gerar (`getAiUsage`).
