# 04 — CODING RULES

> Regras de código obrigatórias. **Violar estas regras = código não mergeado.**

## 1. Arquitetura (imutáveis)

- Nunca acessar DeepSeek/IA diretamente do Frontend.
- Nunca acessar PostgreSQL diretamente do React.
- Nunca colocar lógica de negócio em componentes — use **Services**.
- Toda persistência via **Repository** (`src/lib/db/repositories/*`).
- Toda saída de fronteira via **DTO** validado (`src/lib/dto/*`).
- Server Components por padrão; `"use client"` apenas quando necessário.

## 1.1 Novas funcionalidades — stack OBRIGATÓRIA

> **Decisão oficial (2026-08-04):** toda funcionalidade NOVA deve usar, sem exceção:

| Camada | Onde | Exigência |
| --- | --- | --- |
| **DTO** | `src/lib/dto/<modulo>.dto.ts` | Saída validada por Zod (`XxxDtoSchema` + `toXxxDto`) |
| **Zod** | `src/lib/validations/<modulo>.ts` | Entrada validada antes de qualquer operação |
| **Repository** | `src/lib/db/repositories/<modulo>.ts` | Toda persistência/consulta de dados |
| **Service** | `src/lib/services/<modulo>.service.ts` | Toda regra de negócio/orquestração |
| **Mapper** | dentro do DTO (`toXxxDto`) | Converte entidade/banco → DTO |

Fluxo de uma nova funcionalidade:

```
API / Server Action
   → Service (regras de negócio)
   → Repository (dados)
   → Mapper (entidade → DTO)
   → DTO validado (resposta)
```

Regras:
- Componentes NUNCA chamam Repository/banco diretamente — passam pelo Service.
- Services NUNCA retornam entidade crua — retornam DTO.
- Se uma nova feature precisar de dados que já existem no legado, crie o
  Repository/Service/DTO próprios (não use o legado como desculpa para pular a stack).

## 1.2 Código legado

- **Decisão oficial:** o código legado (anterior à infra de DTO) **pode permanecer
  como está** até sofrer manutenção.
- Não é obrigatório refatorar o legado no momento.
- Ao **tocar** um trecho legado (manutenção/correção), siga a stack obrigatória
  (DTO/Zod/Repository/Service/Mapper) naquela alteração.
- Nunca remover ou "consertar" código legado por fora do escopo da tarefa.

## 2. TypeScript (strict)

- `strict: true` — respeitar.
- Tipos de domínio em `src/types/` (espelham o schema do banco).
- Tipar retornos de funções; evitar `any` (usar `unknown` + narrowing).
- Importar tipos com `import type { ... }`.

## 3. Validação

- Toda entrada (Server Action, API route) validada com **Zod**.
- Schemas de entrada em `src/lib/validations/*`.
- **Toda saída** de API/Server Action é um **DTO** validado por Zod
  (em `src/lib/dto/*`), usando `parseDto`/`strictDto`.
- Nunca confiar em dados do cliente sem validação.
- Nunca retornar entidade do banco "crua" — sempre passar pelo DTO
  (remove campos sensíveis e normaliza o contrato).

## 4. Autenticação/autorização

- `requireAuth()` (ou `auth()`) no topo de toda rota/action protegida.
- Nunca confiar em `user_id` vindo do cliente — sempre da sessão.
- RLS no banco é a fonte da verdade de permissões.

## 5. Erros

- Nunca deixar exceção "estourar" para a UI — sempre retornar
  `{ success: false, message }` (Server Actions) ou `{ error }` JSON (API).
- Mensagens em **pt-BR** para o usuário.

## 6. Estilo e qualidade

- Formatação com Prettier (config do VS Code em `.vscode/settings.json`).
- Sem imports não utilizados.
- Componentes de UI somente em `src/components/ui` (shadcn).
- Não recriar componentes que já existem em `src/components/ui`.

## 7. Proibido

- ❌ Segredos em código ou frontend (`NEXT_PUBLIC_*` só com valores públicos).
- ❌ `use client` desnecessário.
- ❌ Lógica pesada em componentes client.
- ❌ Buscar dados em componentes client quando dá para usar Server Component.
