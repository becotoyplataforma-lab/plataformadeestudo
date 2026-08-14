# 15 — NAMING CONVENTIONS

> Convenções de nomenclatura do projeto.

## Arquivos e pastas

| Item | Convenção | Exemplo |
| --- | --- | --- |
| Componentes | `kebab-case.tsx` | `question-card.tsx`, `cronograma-client.tsx` |
| Páginas | `page.tsx` (fixo) | — |
| Actions | `actions.ts` (fixo) | — |
| Repositórios | `kebab-case.ts` | `questoes.ts`, `flashcards.ts` |
| Services | `<modulo>.service.ts` | `cronograma.service.ts` |
| Validações | `kebab-case.ts` | `cronograma.ts` |
| DTOs | `<modulo>.dto.ts` | `chat.dto.ts` |
| Mappers | dentro do `<modulo>.dto.ts` | `toStudyTaskDto` |
| Tipos | `index.ts` / `kebab-case.d.ts` | `types/index.ts` |

## Identificadores

| Item | Convenção | Exemplo |
| --- | --- | --- |
| Componentes (função) | `PascalCase` | `QuestionCard` |
| Hooks | `useCamelCase` | `useDebounce` |
| Funções (módulo) | `camelCase` | `listQuestions` |
| Server Actions | `actionPascalCase` | `actionCreateTask` |
| Service (função) | `<acao><Entidade>Service` | `createStudyTaskService` |
| DTO schema | `XxxDtoSchema` | `StudyTaskDtoSchema` |
| DTO tipo | `XxxDto` | `StudyTaskDto` |
| DTO mapper | `toXxxDto` | `toStudyTaskDto` |
| Variáveis | `camelCase` | `subjectId` |
| Constantes | `UPPER_SNAKE_CASE` | `PAGE_SIZE` |
| Tipos/Interfaces | `PascalCase` | `StudyTask` |

## Banco de dados

| Item | Convenção | Exemplo |
| --- | --- | --- |
| Tabelas | plural `snake_case` | `study_tasks`, `question_attempts` |
| Colunas | `snake_case` | `scheduled_date` |
| Índices | `idx_<tabela>_<coluna>` | `idx_attempts_user_date` |
| Políticas | `<tabela>_<acao>_<escopo>` | `tasks_select_own` |
| Funções | `snake_case` | `register_ai_usage` |

## API

| Item | Convenção | Exemplo |
| --- | --- | --- |
| Rotas | `kebab-case` | `/api/study/tasks` |
| Query params | `camelCase` | `?subjectId=` (ou `snake_case` se espelhar coluna) |
| JSON | `snake_case` (espelha colunas) | `{ selected_letter }` |
| Erros | `{ error: "pt-BR" }` | — |

## Env

| Item | Convenção | Exemplo |
| --- | --- | --- |
| Públicas | `NEXT_PUBLIC_*` | `NEXT_PUBLIC_SUPABASE_URL` |
| Privadas | `UPPER_SNAKE` | `DEEPSEEK_API_KEY` |

## Idioma

- Código (nomes de função/variável): **inglês** (padrão técnico).
- Mensagens de UI, toasts e erros: **pt-BR**.
- Nomes de módulos/rotas da UI em pt-BR (`/questoes`, `/cronograma`, `/analises`).
