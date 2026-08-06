# /specs

> Especificações **por funcionalidade** do ConcursoAI Platform.

Esta pasta é referenciada pelo fluxo de implementação (`.ai/00-START-HERE.md`):

> Quando existir dúvida: consulte os arquivos da pasta `/specs`.

## O que vai aqui

- Especificações técnicas por feature/módulo (aceite, regras, casos de borda).
- Contratos de dados (DTOs) e payloads de API por funcionalidade.
- Descrições de comportamento que complementam `docs/` e `.ai/`.

## Convenção de nome

```
specs/<modulo>-<feature>.md
```

Exemplos:
- `specs/auth-registro.md`
- `specs/chat-professor-ia.md`
- `specs/pagamentos-mercado-pago.md`
- `specs/knowledge-engine-upload.md`

## Relação com outras pastas

| Pasta | Papel |
| --- | --- |
| `.ai/` | Standards e regras (como implementar) |
| `docs/` | Documentação de arquitetura/produto (visão geral) |
| `specs/` | Especificação detalhada por funcionalidade (o quê exatamente) |
