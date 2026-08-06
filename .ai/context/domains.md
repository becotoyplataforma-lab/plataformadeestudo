# DOMAINS

## PURPOSE
- Listar os domínios do sistema e suas responsabilidades.

## CONTEXT
- Domínios: Identity, Contest, Knowledge, Study, AI, Billing, Analytics, Administration.
- Cada domínio tem fronteira própria.
- A comunicação entre domínios ocorre por contratos.

## DECISIONS
- Identity: autenticação, cadastro, sessão, perfil, recuperação de senha.
- Contest: órgãos, bancas, concursos, editais, cronograma.
- Knowledge: ingestão de materiais, OCR, transcrição, embeddings, organização do conhecimento.
- Study: questões, simulados, flashcards, revisão espaçada.
- AI: Professor IA, geração de conteúdo, RAG.
- Billing: planos, assinaturas, pagamentos.
- Analytics: estatísticas, evolução, tempo de estudo.
- Administration: usuários, conteúdo, IA, uploads, logs.

## RULES
- Um domínio não implementa responsabilidade de outro.
- O domínio Billing depende de Identity.
- O domínio Knowledge depende de Identity e Study.
- O domínio AI depende de Knowledge (pós-MVP) e Identity.

## OUT OF SCOPE
- Detalhes de implementação interna de cada domínio.

## REFERENCES
- .ai/01-PROJECT.md
- docs/02-SDD.md
- docs/04-DATABASE.md
