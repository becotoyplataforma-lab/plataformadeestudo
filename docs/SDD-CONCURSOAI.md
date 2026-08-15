# SDD — ConcursoAI

> SDD consolidado da operação de implementação end-to-end (15/08/2026).
> Pipeline: APOSTILA → CONTEÚDO → IA → AULAS → QUESTÕES → EXERCÍCIOS →
> DESEMPENHO → IA IDENTIFICA DEFICIÊNCIAS → REFORÇO.

## 1. Visão do sistema
Plataforma de estudos para concursos públicos. O aluno envia apostilas e o ConcursoAI
transforma o conteúdo em aulas (professor virtual), questões geradas e validadas por IA,
exercícios de reforço e acompanhamento de desempenho — com uma área administrativa completa.

## 2. Objetivo
Fechar o fluxo completo de aprendizado baseado em apostilas, com rastreabilidade
documento → chunk → questão, curadoria administrativa e reforço adaptativo.

## 3. Arquitetura atual
Ver `docs/ARCHITECTURE.md`. Padrão: Next.js App Router + Drizzle (dados de usuário via
Drizzle, nunca REST anon) + Supabase Auth/Storage + DeepSeek + pgvector.

## 4. Stack
Next.js 16, React 19, TypeScript strict, Drizzle ORM, Supabase, Auth.js v5, DeepSeek,
BAAI/bge-m3, Mercado Pago (sandbox), Playwright, Vitest, Zod, Tailwind.

## 5. Área do aluno
`/dashboard`, `/cronograma`, `/apostilas`, `/apostilas/[id]`, `/aulas`, `/aulas/[id]`,
`/questoes`, `/flashcards`, `/professor`, `/analises`, `/sessao`, `/perfil`, `/configuracoes`.

## 6. Dashboard
Orientado ao concurso: métricas reais (taxa, acertos, streak, meta, revisões, evolução,
performance por matéria) + concurso/cargo do perfil, apostilas/aulas/questões, "continuar
estudando" e "você precisa reforçar" (WeaknessAnalysisService).

## 7. Apostilas
- Aluno: `/apostilas` (lista com status) e `/apostilas/[id]` (matérias, professor IA,
  questões relacionadas).
- Admin: `/admin/apostilas` (lista, upload, processamento, reprocessar, associação de
  matéria/edital/cargo).

## 8. Pipeline de conhecimento
Ver `docs/KNOWLEDGE_PIPELINE.md`. Upload → Storage → extração (PDF/DOCX/TXT/MD/HTML) →
normalização → chunking → embedding (opcional) → indexação. Estados `document_status` com
retry seguro (`/api/knowledge/documents/[id]/process`).

## 9. RAG
`RagService` + `HybridSearchService` (pgvector + FTS). O chat do Professor injeta o
conteúdo da apostila selecionada como contexto (`document_id`).

## 10. Professor IA
`/professor` com seleção de disciplina e apostila (RAG), modos de conversa e limites de
plano (`resolveUserLimits`). Requer `DEEPSEEK_API_KEY` (sem chave → 502 elegante).

## 11. Geração de questões
Ver `docs/QUESTION_GENERATION.md`. `QuestionGenerationService` → DeepSeek → validação →
persistência `em_revisao` com `source_document_id`/`source_chunk_id`.

## 12. Validação de questões
`QuestionValidationService` (5 alternativas, gabarito A–E, explicação, dificuldade,
duplicidade, relação com conteúdo, contradição) com score de confiança.

## 13. Banco de questões
`questions` + `question_options` + curadoria (`rascunho/em_revisao/publicada/rejeitada/bloqueada`)
+ histórico `question_moderation_events`.

## 14. Exercícios personalizados
`ExerciseGenerationService`: fraquezas (WeaknessAnalysisService) + apostila → questões de reforço.

## 15. Flashcards
`FlashcardGenerationService`: apostila → flashcards com fonte (`source_document_id/chunk_id`),
reutilizando `FlashcardService` (SRS).

## 16. Aulas
`LessonGenerationService`: apostila → roteiro estruturado (introdução, objetivos, explicação,
exemplos, pontos importantes, revisão, questões, encerramento). Ver `docs/LESSONS.md`.

## 17. Avatar/professor virtual
Personagem ORIGINAL (seed "Prof. Rafa"). Tabela `avatars`, admin `/admin/avatares`.
Ver `docs/AVATAR.md`.

## 18. Sessão de estudo
`/sessao` — player de estudo com modos (aula, leitura, questões, flashcards, foco) + progresso.

## 19. Área administrativa
`/admin/*` (ver `docs/ADMIN.md`): dashboard, alunos, concursos/editais/cargos, apostilas,
questões (gerar/revisão), aulas, avatares, IA.

## 20. Concursos/editais/cargos
Hierarquia existente: concurso → edital → cargo → matéria (notice_subjects) → apostilas →
questões. Leitura em `/admin/concursos`.

## 21. Usuários
`auth.users` + `profiles` (nível, concurso/cargo alvo, meta diária). Lista em `/admin/alunos`.

## 22. Planos
`plans` (free/pro/intensivo) → entitlement → limites → uso (`resolveUserLimits`).

## 23. Mercado Pago
`/api/billing/checkout` + `/api/billing/webhook` (sandbox). Sem pagamento real.

## 24. Segurança
`auth()` em APIs de aluno; `AdminGuardService` (allowlist) em APIs admin; `server-only` no
service role; RLS em tabelas novas; Zod; ownership por `user_id`. Nenhum aluno acessa dados
de outro, publica questão ou acessa admin.

## 25. Banco de dados
Ver `database/migrations/2026-08-15-concursoai-e2e.sql` (idempotente, não destrutiva) e
schemas Drizzle em `src/db/schema/`.

## 26. APIs
`/api/knowledge/*`, `/api/lessons/*`, `/api/admin/*` (questões generate/review, avatares,
lessons generate), `/api/ai/rag`, `/api/chat` (RAG por document_id).

## 27. Testes
Vitest unitário (423 passed / 25 skipped) — destaque para `QuestionValidationService`.

## 28. E2E
Playwright: baseline mantido (21 passed / 3 skipped). Fluxo completo apostila→questão é
validável localmente com `DEEPSEEK_API_KEY`/`EMBEDDING_API_URL` (bloqueados por config externa).

## 29. Variáveis de ambiente necessárias
`DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `AUTH_SECRET`, `ADMIN_EMAILS`, `DEEPSEEK_API_KEY`,
`DEEPSEEK_BASE_URL`, `EMBEDDING_API_URL`, `EMBEDDING_API_KEY`, `EMBEDDING_MODEL`,
`EMBEDDING_DIMENSION`, `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_PUBLIC_KEY`,
`MERCADO_PAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`. Storage: `R2_ACCOUNT_ID`,
`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` (opcionais — sem eles
usa Supabase Storage). (Valores NUNCA versionados.)

## 30. Migrations
`database/migrations/2026-08-15-concursoai-e2e.sql` — aplicada (idempotente) via
`node scripts/apply-migration.mjs`.

## 31. Commits realizados
Ver `docs/IMPLEMENTATION-REPORT.md` (commits locais, sem push).

## 32. Dívidas técnicas restantes
- `DEEPSEEK_API_KEY` e `EMBEDDING_API_URL` ausentes no `.env` (geração/embeddings bloqueados
  por configuração externa).
- `get_plan_limits` (SQL legado) sem consumidores.
- `maxQuestionsPerDay`/`maxDocuments` definidos mas não aplicados (decisão de produto).
- `/api/payments/*` ↔ `/api/billing/*` duplicados (contrato preservado).
- Rastreabilidade chunk→questão é heurística (sobreposição de termos); sem seleção de chunk pela IA.
- Geração de vídeo/voz/avatar é arquitetura preparada (sem serviço externo).

## 33. O que NÃO foi implementado
- Geração real de vídeo/voz/lip-sync (só arquitetura + player).
- Simulados completos (`/simulados`).
- CRUD completo de concursos/editais/cargos (leitura apenas — dados existem).
- Enforcement de limites de questões/documentos por plano.

## 34. Como operar o sistema
`npm run dev` (dev), `npm run build && npm start` (prod). Migrações:
`node scripts/apply-migration.mjs database/migrations/<arquivo>.sql`.

## 35. Como colocar uma apostila no sistema
1. Login como admin (allowlist `ADMIN_EMAILS`).
2. `/admin/apostilas` → enviar PDF/DOCX/TXT/MD/HTML.
3. A apostila é armazenada no Supabase Storage e processada (extração → chunk → embedding
   quando configurado). Acompanhe o status na lista.

## 36. Como gerar questões
1. `/admin/questoes/gerar` → escolha apostila (status chunked/indexed) + matéria + quantidade.
2. As questões entram em `em_revisao`. Requer `DEEPSEEK_API_KEY`.

## 37. Como revisar/publicar questões
`/admin/questoes/revisao` → aprovar/rejeitar/bloquear. Aprovar → `publicada` (visível ao aluno).

## 38. Como o aluno recebe as questões
`/questoes` lista apenas questões `publicada`; resolver grava `question_attempts`.

## 39. Fluxo IA → aluno
Apostila → (IA) questões em revisão → (admin) publicação → (aluno) resolução →
(IA) análise de fraqueza → exercícios de reforço → nova rodada.

## 40. Fluxo futuro do avatar
Aula (roteiro) → avatar (personagem original) → TTS → lip-sync → vídeo → player em `/aulas/[id]`.

## 41. Checklist para produção
- [ ] Configurar `DEEPSEEK_API_KEY`, `EMBEDDING_API_URL` (+ serviço bge-m3).
- [ ] Configurar `MERCADO_PAGO_ACCESS_TOKEN`/`PUBLIC_KEY`/`WEBHOOK_SECRET` (sandbox).
- [ ] Aplicar migration no ambiente alvo e revisar RLS.
- [ ] Definir enforcement de `maxQuestionsPerDay`/`maxDocuments`.
- [ ] Rodar E2E completo com backend real configurado.
