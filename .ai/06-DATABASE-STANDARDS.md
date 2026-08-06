# 06 — DATABASE STANDARDS

> Padrões para o banco de dados (Supabase / PostgreSQL).

## Regras gerais

1. **RLS ativo em todas as tabelas.** Sem política → sem acesso.
2. Nome de tabelas no **plural, snake_case**: `study_tasks`, `question_attempts`.
3. Colunas em **snake_case**.
4. PK sempre `uuid DEFAULT gen_random_uuid()` (exceto `profiles.id` que referencia `auth.users.id`).
5. `created_at timestamptz NOT NULL DEFAULT now()` em toda tabela.
6. FKs com `ON DELETE CASCADE` para relações dono/filho; `SET NULL` para referências opcionais.
7. Tabelas com `user_id` têm políticas `USING (auth.uid() = user_id)`.

## Migrations

- Aplicar na ordem: `schema.sql → indexes.sql → policies.sql → seed.sql`.
- Migrations devem ser **reversíveis** e não destrutivas quando possível.
- `seed.sql` apenas em dev/staging.

## Tabelas principais (MVP)

`profiles`, `content_subjects`, `subjects`, `study_tasks`, `questions`,
`question_options`, `question_attempts`, `flashcards`, `review_schedules`,
`chat_sessions`, `chat_messages`, `ai_usage`, `payments`.

Futuro: `documents`, `document_chunks`, `embeddings` (pgvector).

## Índices

- Sempre indexar `user_id` e colunas de filtro/ordenação frequentes.
- `question_attempts(user_id, created_at DESC)` para analytics.
- `review_schedules(user_id, due_date)` para revisões pendentes.
- Vetores: índice **HNSW** (`vector_cosine_ops`).

## Funções definer (servidor)

Funções com `SECURITY DEFINER` para operações sem sessão de usuário:

- `register_ai_usage(user_id, tokens_in, tokens_out)` — cotas de IA.
- `register_payment(user_id, plan, amount_cents, status, ...)` — Mercado Pago.
- `handle_new_user()` — cria `profiles` no signup.

> Nunca criar política de cliente para tabelas gerenciadas por funções definer
> (ex.: `ai_usage`, `payments`).

## Esquema de referência

Ver `docs/04-DATABASE.md` para o detalhamento completo de todas as tabelas.
