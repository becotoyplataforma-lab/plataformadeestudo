# 05 — FOLDER STRUCTURE

> Estrutura de pastas do projeto. Siga esta convenção ao adicionar código.

```
.
├── .ai/                     → Standards para agentes (este diretório)
├── .vscode/                 → Config do editor
├── docs/                    → Documentação detalhada (PRD, SDD, DB, API, RAG...)
├── prompts/                 → Prompts do Professor IA (versionados)
│   ├── professor-ia/
│   ├── flashcards/
│   ├── etl/
│   └── analytics/
├── sql/                     → Migrations e seed (aplicar nesta ordem)
│   ├── schema.sql
│   ├── indexes.sql
│   ├── policies.sql
│   └── seed.sql
├── src/
│   ├── app/                 → Rotas (App Router)
│   │   ├── (auth)/          → login, cadastro, recuperar-senha (layout centrado)
│   │   ├── (dashboard)/     → área autenticada com sidebar
│   │   │   ├── page.tsx                 → Dashboard
│   │   │   ├── cronograma/              → Módulo cronograma (+ actions.ts)
│   │   │   ├── questoes/
│   │   │   ├── flashcards/
│   │   │   ├── professor/               → Chat Professor IA
│   │   │   ├── analises/
│   │   │   ├── perfil/                  → (+ actions.ts)
│   │   │   └── configuracoes/
│   │   ├── (study)/         → sessao (modo foco, sem sidebar)
│   │   ├── api/             → API routes
│   │   │   ├── auth/[...nextauth]/
│   │   │   ├── auth/recuperar-senha/
│   │   │   ├── register/
│   │   │   ├── chat/                    → POST (SSE streaming)
│   │   │   ├── chat/sessions/
│   │   │   ├── questoes/
│   │   │   ├── flashcards/
│   │   │   ├── cronograma/tarefas/
│   │   │   ├── analises/
│   │   │   ├── payments/                → checkout + webhook (Mercado Pago)
│   │   │   └── health/
│   │   ├── layout.tsx
│   │   ├── page.tsx         → Landing page
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/              → shadcn/ui (NÃO criar aqui componentes de negócio)
│   │   ├── layout/          → sidebar, header, user-menu
│   │   ├── auth/            → formulários de login/cadastro
│   │   └── {modulo}/        → componentes por módulo (dashboard, questoes, ...)
│   ├── hooks/               → hooks reutilizáveis
│   ├── lib/
│   │   ├── api/             → helpers (requireAuth, apiOk, apiError)
│   │   ├── auth/            → configuração NextAuth
│   │   ├── supabase/        → client, server, admin, middleware
│   │   ├── ai/              → deepseek.ts, prompts.ts, limits.ts, types.ts
│   │   ├── payments/        → mercadopago.ts, plans.ts
│   │   ├── dto/             → DTOs validados por Zod (contratos de fronteira)
│   │   │   ├── index.ts                 → helpers (parseDto, strictDto, isDto)
│   │   │   └── <modulo>.dto.ts          → schema + tipo + mapper por módulo
│   │   ├── services/       → regras de negócio por módulo (novas features)
│   │   │   └── <modulo>.service.ts
│   │   ├── db/repositories/ → camada de persistência por módulo
│   │   ├── analytics/       → streak.ts (lógica pura/testável)
│   │   ├── validations/     → schemas Zod de entrada
│   │   ├── env.ts
│   │   └── utils.ts
│   ├── types/               → tipos de domínio
│   └── middleware.ts        → sessão Supabase + proteção de rotas
```

## Como adicionar um novo módulo

1. Criar pasta em `src/app/(dashboard)/<modulo>/` (página + `actions.ts`).
2. Componentes client em `src/components/<modulo>/`.
3. Service (regras de negócio) em `src/lib/services/<modulo>.service.ts`.
4. Repositório em `src/lib/db/repositories/<modulo>.ts`.
5. DTO de saída em `src/lib/dto/<modulo>.dto.ts` (ver `DTO-GUIDELINES.md`).
6. Validação de entrada em `src/lib/validations/<modulo>.ts`.
7. (Se aplicável) API em `src/app/api/<modulo>/`.
