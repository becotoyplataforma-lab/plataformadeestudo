# 16 — Analytics

**Projeto:** ConcursoAI Platform
**Versão:** 1.0
**Data:** 2026-08-04

---

## 1. Objetivo

Dar aos usuários **visibilidade objetiva** do desempenho nos estudos e à equipe métricas de produto para decisão.

## 2. Dimensões de Análise

| Dimensão | O que mede | Fonte de dados |
| --- | --- | --- |
| **Questões** | Volume, taxa de acerto, tempo médio | `question_attempts` |
| **Cronograma** | Conclusão de tarefas, aderência à meta | `study_tasks` |
| **Flashcards** | Revisões feitas, taxa de retenção (fácil/difícil) | `review_schedules` |
| **IA** | Mensagens enviadas, modelos usados | `chat_messages`, `ai_usage` |
| **Sessão** | Tempo de estudo diário, streak | Derivado (logs de atividade) |

## 3. Métricas do Usuário (Dashboard)

### 3.1 KPIs principais
- **Taxa de acerto** = acertos / total de tentativas.
- **Streak (sequência)** = dias consecutivos com ≥ 1 atividade de estudo.
- **Aderência ao cronograma** = tarefas concluídas / agendadas no período.
- **Revisões pendentes** = flashcards com `due_date <= today`.

### 3.2 Gráficos
| Gráfico | Tipo | Descrição |
| --- | --- | --- |
| Evolução de acertos | Área/Line (30d) | % de acerto diário/semanal |
| Acerto por matéria | Barra horizontal | Identifica pontos fracos |
| Tempo de estudo | Barra (7d) | Minutos por dia |
| Distribuição de estudos | Pizza/Donut | Proporção por disciplina |
| Progresso do cronograma | Barra de progresso | Concluído × planejado |

## 4. Queries de Referência (SQL)

### 4.1 Taxa de acerto global

```sql
SELECT
  COUNT(*) FILTER (WHERE is_correct) AS acertos,
  COUNT(*) AS total,
  ROUND(COUNT(*) FILTER (WHERE is_correct)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS taxa
FROM question_attempts
WHERE user_id = :user_id;
```

### 4.2 Acerto por matéria

```sql
SELECT
  s.name AS materia,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE a.is_correct) AS acertos,
  ROUND(COUNT(*) FILTER (WHERE a.is_correct)::numeric / NULLIF(COUNT(*),0) * 100, 1) AS taxa
FROM question_attempts a
JOIN questions q ON q.id = a.question_id
JOIN content_subjects s ON s.id = q.subject_id
WHERE a.user_id = :user_id
GROUP BY s.name
ORDER BY taxa ASC;   -- piores primeiro (pontos fracos)
```

### 4.3 Evolução (30 dias)

```sql
SELECT
  date_trunc('day', created_at)::date AS dia,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE is_correct) AS acertos
FROM question_attempts
WHERE user_id = :user_id
  AND created_at >= now() - interval '30 days'
GROUP BY 1 ORDER BY 1;
```

### 4.4 Streak

```sql
-- dias distintos de atividade com gap detection (janelas)
SELECT count(*) AS streak_dias
FROM (
  SELECT dia, dia - row_number() OVER (ORDER BY dia)::int AS grp
  FROM (SELECT DISTINCT date_trunc('day', created_at)::date AS dia
        FROM question_attempts WHERE user_id = :user_id
        UNION
        SELECT DISTINCT date_trunc('day', completed_at)::date AS dia
        FROM study_tasks WHERE user_id = :user_id) t
) g
WHERE grp = (SELECT max(dia) - row_number() OVER (ORDER BY dia)::int
             FROM (SELECT DISTINCT date_trunc('day', created_at)::date AS dia
                   FROM question_attempts WHERE user_id = :user_id) x)
GROUP BY grp ORDER BY count(*) DESC LIMIT 1;
```

> No código, o streak é calculado em `src/lib/analytics/streak.ts` (lógica em TS, mais simples de testar).

## 5. Rota de Agregação

- `GET /api/analises/resumo` — agrega os KPIs (implementação server-side, sem expor SQL ao cliente).
- `GET /api/analises/por-materia` e `GET /api/analises/evolucao` — séries.
- Cache de 60s para reduzir carga.

## 6. Métricas de Produto (Equipe)

| Métrica | Definição | Meta |
| --- | --- | --- |
| Ativação | Usuários que completam 1ª sessão de estudo em 24h | ≥ 40% |
| Retenção D7/D30 | % ativos no 7º/30º dia | ≥ 30% / ≥ 20% |
| DAU/MAU | Razão de engajamento | ≥ 25% |
| Questões/sessão | Produtividade média | ≥ 15 |
| Conversão pago | Assinantes / ativos | ≥ 5% |
| Custo IA/usuário | Custo mensal por usuário ativo | < R$ 1,50 |

Fonte: Supabase (tabelas de evento) + Vercel Analytics. Modelagem de evento em `docs/16-ANALYTICS.md` (eventos `study.session_started`, `question.answered`, `flashcard.reviewed`, `chat.message_sent`).

## 7. Privacidade

- Métricas de usuário são agregadas e **anonimizadas** para análises da equipe.
- O usuário vê **apenas** suas próprias métricas (RLS por `user_id`).
- Nenhum dado individual é compartilhado com terceiros.

## 8. Roadmap de Analytics

- Simulado adaptativo (diagnóstico automático de pontos fracos).
- Previsão de "pronto para a prova" (probabilidade de aprovação).
- Benchmarks por concurso/banca (comparativo anônimo).
- Notificações de marcos (ex.: 1.000 questões, 80% de acerto em matéria).
