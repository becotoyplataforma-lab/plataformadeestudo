# 02 — ARCHITECTURE

> Arquitetura do **ConcursoAI Platform**.

## Filosofia

O MVP é um **Monólito Modular** (sem microsserviços). Cada módulo é
internamente independente, permitindo migração futura para microsserviços.

## Visão de alto nível

```
Usuário → Next.js 16 (App Router) → Server Actions / API Routes
                                     ├─→ Supabase (Postgres + pgvector + Auth + Storage)
                                     ├─→ DeepSeek API (LLM)
                                     └─→ Mercado Pago (pagamentos)
                                        Cloudflare R2 (futuro — documentos)
```

## Camadas

| Camada | Onde vive | Responsabilidade |
| --- | --- | --- |
| **Apresentação** | `src/app/*` + `src/components/*` | UI (Server Components primeiro) |
| **Aplicação** | Server Actions (`actions.ts`) + API routes | Orquestração + validação (Zod) |
| **Serviços** | `src/lib/services/*` (convenção) | Regras de negócio (chamadas a provedores) |
| **Repositórios** | `src/lib/db/repositories/*` | Persistência (SQL via Supabase) |
| **Integração** | `src/lib/supabase/*`, `src/lib/ai/*`, `src/lib/payments/*` | Clientes externos |

## Regras de arquitetura (obrigatórias)

1. **Nunca** acessar a API de IA (DeepSeek) diretamente pelo Frontend.
2. **Nunca** acessar PostgreSQL diretamente pelo React.
3. **Nunca** colocar lógica de negócio em componentes.
4. Toda regra de negócio em **Services**.
5. Toda persistência via **Repository**.
6. Route groups: `(auth)` (login/cadastro), `(dashboard)` (área autenticada com
   sidebar), `(study)` (modo foco sem sidebar).
7. Server Components por padrão; Client Components apenas onde há interatividade.
8. Validação de entrada com **Zod** em todas as fronteiras (Server Actions e API).

## Diagramas

Ver `docs/17-DIAGRAMS.md` e `docs/02-SDD.md` para diagramas Mermaid detalhados.
