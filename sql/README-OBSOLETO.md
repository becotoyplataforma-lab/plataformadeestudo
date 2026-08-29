# SQL Legado (OBSOLETO)

> **⚠️ ESTA PASTA ESTÁ OBSOLETA — NÃO USE PARA NOVAS MIGRAÇÕES.**

Estes arquivos SQL foram usados para criar o banco de dados real (Supabase) de forma
manual, antes da adoção do **Drizzle ORM** como fonte de verdade do schema.

## Status

- **Fonte de verdade atual:** `src/db/schema/` (schema Drizzle) + `drizzle/*.sql` (migrations).
- **Estes arquivos NÃO são mais aplicados** em nenhum ambiente.
- Mantidos apenas como **referência histórica** do estado inicial do banco.

## O que cada arquivo era

| Arquivo | Conteúdo |
|---------|----------|
| `schema.sql` | Criação inicial de tabelas, enums e extensões. |
| `indexes.sql` | Índices adicionais. |
| `policies.sql` | Políticas RLS (Row Level Security). |
| `seed.sql` | Dados de seed (planos, avatares, etc.). |
| `migrations/0003_add_kimi_model.sql` | Adicionava o valor `kimi` ao enum `ai_model`. |

## Por que está obsoleto

O banco real foi criado por estes arquivos, mas o schema Drizzle (`src/db/schema/`)
evoluiu de forma independente. A auditoria de schema (Fase 1) consolidou a divergência:

- As **10 tabelas** que existiam no banco real mas não nas migrations Drizzle
  (`avatars`, `boards`, `contests`, `editais`, `lesson_progress`, `lessons`,
  `notice_subjects`, `organs`, `positions`, `question_moderation_events`) foram
  adicionadas à migration `drizzle/0002_preapproval.sql`.
- O valor `kimi` do enum `ai_model` foi adicionado à migration `drizzle/0000_baseline.sql`
  e aplicado ao banco real.

## Ação recomendada

- **Não edite** estes arquivos.
- **Não os aplique** em nenhum banco.
- Podem ser **removidos** em um commit futuro, após confirmação de que nenhum
  processo de deploy ainda os referencia.
