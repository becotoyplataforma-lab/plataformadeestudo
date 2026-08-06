# ROADMAP

## PURPOSE
- Definir as fases e a ordem oficial de implementação.

## CONTEXT
- Fase MVP: núcleo da plataforma.
- Fase V1.1: Knowledge Engine e RAG.
- Fase V1.2: Contest Intelligence, Recommendation, SRS avançado.
- Fase V2: comunidade e mobile.

## DECISIONS
- Ordem oficial: MVP primeiro.
- Knowledge depende de Identity e Study.
- RAG depende de Knowledge.
- Billing habilita planos pagos.
- Analytics depende de Study e Billing.

## RULES
- Não pular fases.
- Não implementar funcionalidade de fase futura antes da ordem.
- Cada módulo segue a stack obrigatória.
- Dependência entre módulos deve estar resolvida antes da implementação.

## OUT OF SCOPE
- Funcionalidades fora das fases definidas.

## REFERENCES
- .ai/01-PROJECT.md
- docs/12-ROADMAP.md
- docs/13-BACKLOG.md
