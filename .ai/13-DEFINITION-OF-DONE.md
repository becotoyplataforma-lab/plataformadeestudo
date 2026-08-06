# 13 — DEFINITION OF DONE

> Checklist de "pronto" para qualquer feature/bug. **Tudo precisa passar.**

## Código

- [ ] Implementado conforme `docs/` e `.ai/` standards.
- [ ] Lógica de negócio em Services, persistência em Repositories.
- [ ] Validação Zod em toda entrada.
- [ ] Autenticação/autorização aplicada (requireAuth + RLS).
- [ ] Sem segredos no código/frontend.
- [ ] Sem `any` desnecessário; tipos em `src/types`.

## Qualidade

- [ ] `npm run lint` sem erros.
- [ ] `npm run typecheck` sem erros.
- [ ] `npm run build` passando.
- [ ] Testes relevantes escritos e passando (se aplicável).
- [ ] Sem imports/arquivos órfãos.

## Segurança

- [ ] RLS da(s) tabela(s) revisada(s).
- [ ] Mensagens de erro sem vazar dados internos.
- [ ] (IA) cotas respeitadas; sem injeção de prompt.
- [ ] (Pagamento) webhook valida status antes de ativar.

## UX (pt-BR)

- [ ] UI em português do Brasil.
- [ ] Mensagens de sucesso/erro amigáveis.
- [ ] Responsivo (mobile ≥ 375px).
- [ ] Estado de carregamento e vazio tratados.

## Documentação

- [ ] (Se nova feature/tabela/rota) atualizados:
  - `docs/` relevantes
  - `.ai/` (structure/API/DB) quando aplicável
  - `.env.example` se novas variáveis

## Entrega

- [ ] PR com Conventional Commit.
- [ ] CI verde.
- [ ] Teste manual do fluxo principal.
