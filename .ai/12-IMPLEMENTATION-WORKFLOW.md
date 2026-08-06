# 12 — IMPLEMENTATION WORKFLOW

> Como implementar uma feature do início ao fim. Siga este roteiro.

## Passo 1 — Entender

- Ler `docs/` relevante (PRD, SDD, DB, API).
- Identificar tabelas, rotas e componentes envolvidos.
- Verificar se já existe algo parecido em `src/`.

## Passo 2 — Banco (se precisar de dados)

1. Adicionar/alterar tabelas em `sql/schema.sql`.
2. Índices em `sql/indexes.sql`.
3. Políticas RLS em `sql/policies.sql`.
4. (Opcional) seed em `sql/seed.sql`.
5. Aplicar no Supabase (SQL Editor ou CLI).

## Passo 3 — Tipos, DTO e validação

1. Tipos de domínio em `src/types/index.ts`.
2. Schema Zod de entrada em `src/lib/validations/<modulo>.ts`.
3. **DTO de saída** em `src/lib/dto/<modulo>.dto.ts`:
   - Schema Zod (`XxxDtoSchema`) + tipo (`XxxDto`).
   - Mapper `toXxxDto(input: unknown): XxxDto | null`.

## Passo 4 — Persistência (Repository)

Criar `src/lib/db/repositories/<modulo>.ts` com funções que encapsulam
as queries do Supabase (sem lógica de negócio).

## Passo 5 — Regras de negócio (Service)

- Colocar regras em funções/serviços reutilizáveis (ex.: SRS em
  `src/lib/db/repositories/flashcards.ts` ou `src/lib/services/`).

## Passo 6 — Ações (Server Actions) ou API

- Mutações internas → `actions.ts` com `actionXxx()` retornando
  `{ success, message }`.
- Integrações externas/leitura complexa → API route em `src/app/api/<modulo>/`.

## Passo 7 — UI

1. Página (Server Component) em `src/app/(dashboard)/<modulo>/page.tsx`.
2. Componente client em `src/components/<modulo>/`.
3. Usar componentes de `src/components/ui` (shadcn) — não recriar.

## Passo 8 — Segurança

- `requireAuth()` / sessão nas rotas/actions.
- RLS revisada para a nova tabela.
- Zod em toda entrada.

## Passo 9 — Validação

```bash
npm run lint
npm run typecheck
npm run build
```

## Passo 10 — Testes

- Testes unitários da lógica pura.
- (Se aplicável) teste do endpoint.

## Passo 11 — Merge

- Seguir `11-GIT-WORKFLOW.md` e checar `13-DEFINITION-OF-DONE.md`.
