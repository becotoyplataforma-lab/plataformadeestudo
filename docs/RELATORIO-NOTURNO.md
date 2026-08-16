# Relatório Noturno — ConcursoAI (2026-08-15/16)

Execução autônoma do PROMPT-NOTURNO-CONCURSOAI.md. Nenhum push/deploy; apenas commits locais.

## Resumo por fase

### FASE 0 — Sidebar admin (concluído, herdado da rodada anterior)
Menu horizontal → sidebar lateral fixa (grupos, colapso, drawer mobile, breadcrumb + avatar).
Commit `f9c0d7c`.

### FASE 1 — Preços e limites de IA ✅ 100% concluído
- **Grátis**: 5 mensagens IA/dia (era 50). `DEFAULT_FREE_LIMITS` + seed + UPDATE no banco
  (migration `2026-08-15-pricing-limits.sql`, aplicada).
- **Pro**: R$ 9,90 no 1º mês, R$ 19,90/mês a partir do 2º.
  - **Como ficou implementado**: coluna `plans.promo_price_cents` (Pro = 990, regular = 1990).
    O checkout decide o preço pela existência de assinatura anterior
    (`subscriptions.hasAnyByUser`): 1º ciclo → promo; ciclos seguintes → cheio.
  - **Limitação honesta**: não há débito automático mensal (o gateway atual usa preferência
    one-time). "Troca automática" ocorre no próximo checkout, que já cobra R$ 19,90.
  - **UI**: `/configuracoes` mostra "R$ 9,90 no 1º mês, depois R$ 19,90/mês".
- **Quota de IA**: enforcement de tokens no `/api/chat` (429 com mensagem educada), além do
  limite de mensagens que já existia. Reusado o contador `ai_usage` diário já existente.
- **"Knowledge Engine" (colisão de nome)**: decidido que é recurso de ingestão **exclusivo do
  Intensivo**. Na seção "Em breve" ganhou badge "exclusivo Intensivo" (sem repetir o nome solto).
Commit `6f21731`.

### FASE 2 — Seção "Em breve" ✅ 100% concluído
Já existia em `/configuracoes`; atualizada (preços, badge Knowledge Engine, link de redação).
Mesmo commit da FASE 1.

### FASE 3 — Revisão espaçada FSRS ✅ 100% concluído
- `src/lib/study/services/fsrs.ts`: FSRS **simplificado**, escrito do zero a partir da
  especificação pública (dificuldade D ∈ [1,10], estabilidade S em dias, recuperabilidade
  R(t) = (1 + t/(9S))^-1, notas again/hard/good/easy). Sem dependência externa.
- Migration `2026-08-15-fsrs.sql` (aplicada): `stability`, `difficulty`, `last_rating` em
  `review_schedules`. `ReviewScheduleService.review` usa FSRS (SM-2 `srsNextState` mantido por
  compat). UI de 3 botões mapeada para easy/good/again.
- Testes: +7 (`fsrs.test.ts`) com casos conhecidos.
Commit `23b93dc`.

### FASE 4 — Contest Intelligence v1 ✅ 100% concluído (v1 honesta)
- `GET /api/admin/contest-intelligence?edital_id=` + página `/admin/contest-intelligence` +
  item "Intelligence" na sidebar.
- Mostra **peso por matéria** (notice_subjects) e **histórico da banca** (questões publicadas
  agrupadas por matéria). Sem banca confirmada ou histórico < 5 questões → aviso claro, nunca
  número inventado.
Commit `c9050b7`.

### FASE 5 — Correção de redação ✅ 100% concluído
- `POST /api/essay/correct` + página `/redacao`. Critérios estilo ENEM (coerência, coesão,
  norma culta, argumentação, proposta de intervenção), nota 0–1000 + feedback por critério.
  Respeita a cota diária de IA.
Commit `0f9390c`.

## Pendências / limitações (para o Fernando revisar)
1. **Preço escalonado**: a "renovação automática" não existe (gateway é one-time). O 2º ciclo
   é um novo checkout que já cobra R$ 19,90. Se quiser débito recorrente real, é preciso migrar
   para assinaturas do Mercado Pago — fica como dívida técnica.
2. **FSRS**: implementação **simplificada** (sem o conjunto completo de pesos w0..w17 e sem
   "otimização" de parâmetros). Suficiente para v1; evoluir para o FSRS completo (ou
   `ts-fsrs`, licença MIT) quando quiser precisão total.
3. **Contest Intelligence**: a análise histórica depende de haver questões publicadas com a
   banca preenchida. Hoje o banco tem poucas/nenhuma — a tela exibe o aviso honesto.
4. **DEEPSEEK_API_KEY**: configurada no `.env` local (deepseekConfigured=true). A chave ficou
   exposta no chat — considere rotacionar após o teste.
5. **EMBEDDING_API_URL** continua ausente (busca vetorial/RAG pendente).

## Validação final
- typecheck: **0 erros**
- lint: **0 erros**
- vitest: **457 passed / 25 skipped**
- build: **0 erros**
- E2E: **22 passed / 3 skipped (0 falhas)** — 3 skipped são administração (sem
  `E2E_ADMIN_EMAIL`) e 1 chat via API do Professor IA (sem chave de IA válida no processo de
  teste).

## Commits da rodada
```
0f9390c feat(ai): correção de redação (ENEM) + /redacao + SDD/log
c9050b7 feat(contest): Contest Intelligence v1
23b93dc feat(study): FSRS + log noturno F1-F3
6f21731 feat(billing): grátis 5 msgs/dia, Pro 9,90→19,90, tokens + em breve
f9c0d7c feat(admin): sidebar lateral
```
