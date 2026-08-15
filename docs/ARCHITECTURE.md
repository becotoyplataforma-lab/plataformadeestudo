# ARCHITECTURE — ConcursoAI

## Visão
Plataforma de estudos para concursos públicos que transforma **apostilas em conteúdo
inteligente**: aulas com professor virtual, questões geradas e validadas por IA, exercícios
de reforço e acompanhamento do desempenho.

## Stack
- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript strict**
- **Drizzle ORM** (PostgreSQL via Supabase, schema `public` + `auth`)
- **Supabase** (Auth, banco, Storage) — dados de usuário via **Drizzle** (bypassa RLS,
  não usar REST anon)
- **Auth.js v5** (credentials via `createAdminClient`)
- **DeepSeek** (chat/reasoner) para geração de texto; **BAAI/bge-m3** (1024d) para embeddings
- **Mercado Pago** (sandbox) para cobrança
- **Playwright** (E2E) + **Vitest** (unitário)

## Estrutura de módulos
```
src/
  app/            rotas (aluno, admin, api)
  components/     UI (dashboard, professor, admin, study, ui)
  db/schema/      schema Drizzle por domínio
  lib/
    ai/           provedores e serviços de IA (chat, rag, geração, validação)
    knowledge/    pipeline de conhecimento (storage, extração, chunk, embedding, busca)
    study/        planner, flashcards, questões, weakness, lessons
    administration/  guard admin (allowlist), moderação, repositórios admin
    billing/      planos, entitlement, limites
    supabase/     createAdminClient (service role, server-only)
```

## Domínios de banco
- **identity** (auth.users + profiles)
- **contest** (concursos, editais, cargos, notice_subjects)
- **knowledge** (documents, document_chunks, embeddings, subjects, topics, tags)
- **study** (study_subjects, study_tasks, questions, question_options, question_attempts,
  flashcards, review_schedules, lessons, lesson_progress, question_moderation_events)
- **ai** (chat_sessions, chat_messages, ai_usage, avatars)
- **billing** (plans, subscriptions, payments)
- **administration** (settings, audit)

## Regras de arquitetura
1. Dados de usuário **sempre via Drizzle** (nunca REST anon do Supabase).
2. `server-only` em todo módulo de servidor (supabase admin, IA, repositórios de escrita).
3. Admin é allowlist (`ADMIN_EMAILS` + system_settings) — nunca coluna solta.
4. APIs novas validam `auth()`; APIs admin validam `AdminGuardService.requireAdmin`.
5. Questões geradas por IA **nunca** são publicadas automaticamente (status `em_revisao`).
6. Sem personagens protegidos por copyright — avatares são personagens originais.
