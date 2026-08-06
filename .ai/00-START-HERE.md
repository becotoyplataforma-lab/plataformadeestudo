# START HERE

## ROLE

Você é um Senior Software Engineer responsável por implementar o ConcursoAI Platform.

Você deve seguir rigorosamente toda a documentação da pasta `.ai`.

Nunca implemente funcionalidades utilizando suposições.

Quando existir dúvida:

1. Leia novamente a documentação.
2. Consulte os arquivos da pasta `/specs`.
3. Nunca altere a arquitetura.

---

## IMPLEMENTATION ORDER

Sempre siga esta ordem:

1. Ler `.ai`
2. Ler `/docs`
3. Ler `/specs`
4. Implementar
5. Executar Testes
6. Executar Lint
7. Executar Build
8. Corrigir erros
9. Finalizar

Nunca pule etapas.

---

## ABSOLUTE RULES

Nunca utilizar `any`.

Nunca desabilitar TypeScript Strict.

Nunca alterar estrutura de pastas.

Nunca acessar banco diretamente pelo React.

Nunca acessar IA pelo Frontend.

Nunca criar código duplicado.

Nunca remover testes existentes.

Nunca alterar migrations já aplicadas.

Sempre criar código limpo.

Sempre documentar APIs.

Sempre seguir Repository Pattern.

Sempre utilizar DTO.

Sempre utilizar Zod.

Sempre utilizar Server Components quando possível.

---

## Estado atual do projeto (2026-08-04)

- **MVP implementado**: auth (NextAuth + Supabase), dashboard, cronograma, questões,
  flashcards (SRS), Professor IA (DeepSeek streaming), analíticas, perfil,
  configurações, sessão de foco.
- **Pagamentos**: Mercado Pago (checkout + webhook) — ativação de planos.
- **Pós-MVP**: Knowledge Engine, RAG, ETL, Contest Intelligence (documentados em `docs/`).

## Comandos essenciais

```bash
npm run dev          # desenvolvimento
npm run build        # build de produção
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
```

## Antes de começar

1. Leia este arquivo e o `01-PROJECT.md`.
2. Verifique a pasta `docs/` para documentação detalhada (PRD, SDD, banco, API, RAG...).
3. Consulte a pasta `/specs` para especificações por funcionalidade.
4. Para QUALQUER funcionalidade nova, leia `DTO-GUIDELINES.md` (DTO/Zod/Repository/Service/Mapper).
5. Siga `12-IMPLEMENTATION-WORKFLOW.md` para qualquer nova feature.
6. Nunca ignore `04-CODING-RULES.md` e `08-SECURITY-STANDARDS.md`.
