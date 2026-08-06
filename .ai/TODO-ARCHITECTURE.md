# TODO — ARCHITECTURE

> Registro de inconsistências de arquitetura do ConcursoAI.
> Itens em aberto (Status: Open). Não corrigir até decisão explícita.
> Formato por item: ID, Título, Descrição, Impacto, Prioridade, Documentos afetados, Dependências, Solução proposta, Status.

---

## ARC-001

- **ID:** ARC-001
- **Título:** Escopo "Concursos/Editais" no MVP divergente da implementação.
- **Descrição:** O PRD (versão ChatGPT) lista "Concursos" (selecionar concurso, visualizar edital, acompanhar status) como funcionalidade do MVP. A implementação atual do MVP não possui módulo de concursos/editais — apenas disciplinas e cronograma.
- **Impacto:** Desalinhamento entre documento de produto e código; risco de escopo maior ou de feature esperada ausente.
- **Prioridade:** Média
- **Documentos afetados:** docs/01-PRD.md, docs/12-ROADMAP.md, docs/13-BACKLOG.md, .ai/context/vision.md, .ai/context/roadmap.md
- **Dependências:** Decisão de produto sobre o escopo do MVP.
- **Solução proposta:** Definir formalmente se "Concursos/Editais" é MVP ou pós-MVP e alinhar PRD, Roadmap e Backlog; implementar o módulo Contest quando decidido.
- **Status:** Open

---

## ARC-002

- **ID:** ARC-002
- **Título:** Provedor de embeddings (RAG) não decidido; OpenAI ainda referenciado.
- **Descrição:** docs/06, docs/07 e .env.example citam OpenAI (OPENAI_API_KEY, text-embedding-3-small) para embeddings do RAG futuro. O .ai/context/stack.md proíbe OpenAI como LLM principal, mas não define o provedor oficial de embeddings.
- **Impacto:** Conflito de padrões; risco de usar tecnologia não aprovada no pós-MVP.
- **Prioridade:** Média
- **Documentos afetados:** .ai/context/stack.md, docs/06-KNOWLEDGE-ENGINE.md, docs/07-RAG.md, .env.example
- **Dependências:** Decisão sobre provedor de embeddings (Supabase/DeepSeek vs OpenAI).
- **Solução proposta:** Escolher o provedor oficial de embeddings, atualizar docs e .env.example e remover referências não autorizadas.
- **Status:** Resolved
- **Resolução:** `docs/10-EMBEDDING-STANDARD.md` — BAAI/bge-m3, dimensão 1024, pgvector/HNSW, Hybrid Search (OPEN-001).

---

## ARC-003

- **ID:** ARC-003
- **Título:** Terminologia "módulos" × "domínios" sem mapeamento.
- **Descrição:** .ai/01-PROJECT.md usa "módulos" (Core, Concurso, Question Engine, Flashcard Engine...). .ai/context/domains.md usa "domínios" (Identity, Contest, Study, AI...). Não há mapeamento oficial domínio → módulo → caminho de código.
- **Impacto:** Dificuldade de navegação e implementação consistente; agentes podem interpretar os conceitos de forma divergente.
- **Prioridade:** Baixa
- **Documentos afetados:** .ai/01-PROJECT.md, .ai/context/domains.md, .ai/05-FOLDER-STRUCTURE.md
- **Dependências:** Nenhuma.
- **Solução proposta:** Criar documento de mapeamento domínio → módulo → caminho de código e alinhar a terminologia.
- **Status:** Open

---

## ARC-004

- **ID:** ARC-004
- **Título:** Duas convenções de 9 seções (contracts × templates).
- **Descrição:** .ai/contracts/* usa 9 seções com RESPONSIBILITIES, VALIDATIONS, ERROR HANDLING, ACCEPTANCE CRITERIA. .ai/templates/* usa outras 9 seções com SCOPE, IMPLEMENTATION, TESTS, CHECKLIST. Não há documento ligando contrato ao template.
- **Impacto:** Ambiguidade para agentes sobre o que usar em cada etapa; risco de formatos divergentes.
- **Prioridade:** Baixa
- **Documentos afetados:** .ai/contracts/*, .ai/templates/*, .ai/DTO-GUIDELINES.md
- **Dependências:** Nenhuma.
- **Solução proposta:** Criar documento de ligação contract (o quê) → template (como) e padronizar as seções.
- **Status:** Open

---

## ARC-005

- **ID:** ARC-005
- **Título:** Camada de Services documentada, mas inexistente no código.
- **Descrição:** Standards e workflow exigem services em src/lib/services/<modulo>.service.ts para novas features, mas a pasta ainda não existe. As regras de negócio atuais vivem em repositories e actions.
- **Impacto:** Novas features podem não seguir o padrão se a pasta não for criada; o legado continua sem camada de serviço.
- **Prioridade:** Alta
- **Documentos afetados:** .ai/04-CODING-RULES.md, .ai/05-FOLDER-STRUCTURE.md, .ai/12-IMPLEMENTATION-WORKFLOW.md, .ai/DTO-GUIDELINES.md
- **Dependências:** Nenhuma (criar a pasta é o primeiro passo).
- **Solução proposta:** Criar src/lib/services/ ao iniciar a primeira feature nova e garantir a stack obrigatória (DTO, Zod, Repository, Service, Mapper).
- **Status:** Open

---

## ARC-006

- **ID:** ARC-006
- **Título:** Identidade: public.users × auth.users.
- **Descrição:** O domínio Identity modelava public.users em paralelo ao auth.users do Supabase, gerando dupla fonte da verdade.
- **Impacto:** Risco de dessincronização e de segurança.
- **Prioridade:** Alta
- **Documentos afetados:** docs/08-DATABASE-PHYSICAL.md, docs/06-DOMAIN-DECISIONS.md, database/identity/*
- **Dependências:** Decisão de arquitetura de identidade.
- **Solução proposta:** Opção A — auth.users única fonte; public.profiles referencia auth.users(id); public.users removido.
- **Status:** Resolved
- **Resolução:** ADR-001 (.ai/adr/ADR-001-SUPABASE-AUTH.md) e docs/11-IDENTITY-ARCHITECTURE-REVIEW.md.
