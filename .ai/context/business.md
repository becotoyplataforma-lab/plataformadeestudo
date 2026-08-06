# BUSINESS

## PURPOSE
- Descrever regras e fluxos de negócio gerais.

## CONTEXT
- Modelo: SaaS freemium.
- Planos: gratuito, pro, intensivo.
- Pagamentos processados pelo Mercado Pago.

## DECISIONS
- O plano define limites de uso.
- Cotas de IA são por plano e por dia.
- Plano ativado após confirmação de pagamento.

## RULES
- Fluxo do aluno: cadastrar, escolher concurso, receber cronograma, estudar, resolver questões, revisar, acompanhar analytics.
- Fluxo do administrador: gerir usuários, conteúdo, planos, uso de IA e logs.
- Fluxo do conteúdo: conteúdo autorizado entra indexado; perguntas usam material indexado primeiro.
- Toda regra de negócio vive em service.
- Nenhuma regra de negócio em componentes.

## OUT OF SCOPE
- Marketplace de conteúdo.
- Conteúdo não autorizado.

## REFERENCES
- .ai/01-PROJECT.md
- docs/01-PRD.md
- docs/16-ANALYTICS.md
