# 10 — TESTING STANDARDS

> Padrões de testes do projeto.

## Estratégia

| Camada | Ferramenta | Foco |
| --- | --- | --- |
| **Unitário (lógica pura)** | Vitest | `src/lib/analytics/streak.ts`, `computeNextSchedule` (SRS), Zod schemas, utils |
| **Repositories** | Vitest + mocks do Supabase | Queries e mapeamento de dados |
| **API routes** | Vitest + `supertest` | Contratos, status, validação, auth |
| **E2E (fluxos críticos)** | Playwright | Cadastro → login → estudo → IA |

## Regras

1. Toda lógica de negócio **pura** deve ser testável (funções puras sem I/O).
2. Nomes de teste descritivos: `describe('computeNextSchedule')` /
   `it('aplica facil dobrando o intervalo')`.
3. Fixtures em `tests/fixtures/`.
4. Não testar implementação do shadcn/ui (biblioteca).
5. Testes rodam em CI (GitHub Actions): `npm test`.

## Comandos

```bash
npm test          # roda a suíte
npm run typecheck # validação de tipos (obrigatório)
```

## O que priorizar

- Lógica de streak e SRS (críticas e fáceis de errar).
- Validação Zod (mensagens de erro em pt-BR).
- Contrato do `/api/chat` (SSE) e `/api/questoes/:id/responder`.
- Fluxo de autenticação (E2E).

## Definição de pronto (relacionado)

Ver `13-DEFINITION-OF-DONE.md`.
