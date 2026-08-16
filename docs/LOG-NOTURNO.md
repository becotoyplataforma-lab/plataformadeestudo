# Log Noturno — ConcursoAI (2026-08-15/16)

Registro de execução autônoma das fases do PROMPT-NOTURNO. Cada entrada:
timestamp, o que foi feito, resultado da validação (typecheck/lint/vitest/build).

## FASE 0 — Finalização da sidebar admin (pendente da rodada anterior)
- **Feito:** sidebar lateral fixa (AdminShell + AdminSidebar + AdminNavContent) com grupos,
  colapso (ícone-only + tooltip) e drawer mobile (Sheet). Topo virou breadcrumb + avatar.
- **Validação:** typecheck 0 · lint 0 · vitest 449/25 · build 0. Commit `f9c0d7c`.

## FASE 1 — Preços e limites de IA
- **Feito:** Grátis 50→5 mensagens IA/dia (DEFAULT_FREE_LIMITS + seed + UPDATE no banco).
  Pro: R$ 9,90 no 1º mês (promo_price_cents=990) e R$ 19,90/mês (price_cents=1990) a partir
  do 2º ciclo — decidido por histórico de assinatura no checkout (sem job de renovação
  automática; cada ciclo é um novo checkout). Enforcement de tokens no `/api/chat` (429
  educado). Migration `2026-08-15-pricing-limits.sql` aplicada.
- **Validação:** typecheck 0 · lint 0 · vitest 450/25 · build 0. Commit `6f21731`.

## FASE 2 — Seção "Em breve"
- **Feito:** a seção já existia em `/configuracoes`; atualizada com badge "exclusivo
  Intensivo" no Knowledge Engine (resolve colisão de nome com o card do plano Intensivo) e
  textos de preço novos. Documentado no SDD (abaixo).
- **Validação:** coberta na validação da FASE 1 (mesmo commit).

## FASE 3 — Revisão espaçada com FSRS
- **Feito:** `fsrs.ts` (FSRS simplificado escrito do zero a partir da spec pública: D, S,
  R(t), notas again/hard/good/easy). Colunas `stability`, `difficulty`, `last_rating` em
  `review_schedules` (migration `2026-08-15-fsrs.sql` aplicada). `ReviewScheduleService.review`
  passou a usar FSRS (mantém SM-2 `srsNextState` por compat). +7 testes unitários.
- **Validação:** typecheck 0 · lint 0 · vitest 457/25 · build 0. Commit `23b93dc`.

## FASE 4 — Contest Intelligence v1
- **Feito:** serviço `ContestIntelligenceService` (peso por matéria via notice_subjects +
  histórico de questões publicadas da mesma banca), API `GET /api/admin/contest-intelligence`,
  página `/admin/contest-intelligence` + item "Intelligence" na sidebar. Honesto: sem banca
  confirmada ou histórico < 5 questões → aviso claro, nunca número fake.
- **Validação:** typecheck 0 · lint 0 · vitest 457/25 · build 0. Commit `c9050b7`.

## FASE 5 — Correção de redação (Professor IA)
- **Feito:** `EssayCorrectionService` (DeepSeek "pro", critérios estilo ENEM, nota 0–1000 +
  feedback por critério), `POST /api/essay/correct` (respeita cota diária), página `/redacao`
  e link na seção "Em breve" das configurações.
- **Validação:** (pendente nesta fase — typecheck/lint/vitest/build em execução).

