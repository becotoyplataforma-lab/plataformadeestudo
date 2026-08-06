# 13 — Backlog

**Projeto:** ConcursoAI Platform
**Data:** 2026-08-04

Formato das tarefas: `[P]` prioridade (P0 crítica · P1 alta · P2 média · P3 baixa), `[TAG]` área.

---

## 1. MVP (implementação atual)

| # | Tarefa | P | Tag |
| --- | --- | --- | --- |
| 1 | Setup Next.js 16 + TS + Tailwind + shadcn/ui | P0 | infra |
| 2 | Schema SQL + RLS + seed | P0 | db |
| 3 | NextAuth v5 + Supabase Auth (login/cadastro/logout) | P0 | auth |
| 4 | Route groups `(auth)`, `(dashboard)`, `(study)` | P0 | app |
| 5 | Dashboard (métricas + gráficos) | P0 | app |
| 6 | Cronograma: CRUD disciplinas e tarefas | P0 | app |
| 7 | Questões: listar/filtrar/resolver/gabaritar | P0 | app |
| 8 | Professor IA: chat streaming (DeepSeek Flash/Pro) | P0 | ia |
| 9 | Cotas de IA + rate limit | P0 | ia |
| 10 | Flashcards + revisão SRS básica (SM-2) | P1 | app |
| 11 | Analíticas: acertos, evolução, matérias | P1 | app |
| 12 | Landing page + SEO (pt-BR) | P1 | app |
| 13 | Perfil/configurações (meta, banca, modelo IA) | P1 | app |
| 14 | Testes unitários (Zod, repositories) | P1 | qa |
| 15 | Testes E2E (login → estudo) | P1 | qa |
| 16 | Segurança: headers, CSP, auditoria RLS | P1 | sec |
| 17 | Deploy Vercel + CI/CD | P1 | infra |

## 2. V1.1 — Knowledge Engine

| # | Tarefa | P | Tag |
| --- | --- | --- | --- |
| 18 | Upload de documentos (multipart → R2) | P0 | ke |
| 19 | Pipeline de extração de texto (PDF + OCR) | P0 | ke |
| 20 | Transcrição Whisper (áudio/vídeo) | P1 | ke |
| 21 | Chunking inteligente por tipo de documento | P0 | ke |
| 22 | Embeddings + pgvector (HNSW) | P0 | ke |
| 23 | RAG no chat com citações de fonte | P0 | ke |
| 24 | Busca semântica na biblioteca | P1 | ke |
| 25 | Fila de processamento (pgmq/BullMQ) | P1 | ke |
| 26 | Status/progresso de processamento na UI | P2 | ke |
| 27 | Compartilhamento de documentos (comunidade) | P3 | ke |

## 3. V1.2 — Inteligência e Recomendação

| # | Tarefa | P | Tag |
| --- | --- | --- | --- |
| 28 | Contest Intelligence: análise de banca e edital | P0 | ci |
| 29 | Estatísticas de edital (cargos, vagas, conteúdos) | P1 | ci |
| 30 | Recommendation Engine: tópicos fracos | P0 | rec |
| 31 | Recomendação de questões e revisões diárias | P1 | rec |
| 32 | SRS avançado (FSRS) | P1 | srs |
| 33 | Geração de questões inéditas estilo banca | P2 | ia |
| 34 | Correção de redação/peça via IA | P2 | ia |
| 35 | Diagnóstico periódico (simulado adaptativo) | P2 | ia |

## 4. ETL e Conteúdo

| # | Tarefa | P | Tag |
| --- | --- | --- | --- |
| 36 | Pipeline questões Cebraspe | P0 | etl |
| 37 | Pipeline questões FGV | P0 | etl |
| 38 | Pipeline questões Vunesp | P0 | etl |
| 39 | Pipeline questões FCC e outras | P1 | etl |
| 40 | Pipeline de legislação (CF/88, CLT, CP, súmulas) | P0 | etl |
| 41 | Pipeline de editais e calendário | P1 | etl |
| 42 | Deduplicação e curadoria de questões | P1 | etl |
| 43 | Explicações geradas por IA (batch) | P2 | etl |

## 5. Plataforma e Escala

| # | Tarefa | P | Tag |
| --- | --- | --- | --- |
| 44 | Planos de assinatura (Mercado Pago + Pix) | P0 | biz |
| 45 | Gerenciamento de plano e faturamento na UI | P1 | biz |
| 46 | Painel admin (usuários, questões, conteúdo) | P1 | admin |
| 47 | Redis/Upstash: rate limit distribuído + cache | P1 | infra |
| 48 | Cache de respostas IA (economia) | P2 | ia |
| 49 | Logs estruturados + Sentry | P1 | obs |
| 50 | App mobile (Expo) | P2 | mobile |
| 51 | Leaderboards e gamificação | P3 | gam |
| 52 | Multi-idioma (es) | P3 | i18n |

## 6. Melhorias Contínuas (Sugestões)

- Notificações (push/e-mail) de tarefas do dia e revisões.
- Modo "foco" com timer Pomodoro integrado ao cronograma.
- Importar/exportar cronograma (CSV/ICS).
- Anotações vinculadas a questões e flashcards.
- Dicionário de direito com fontes oficiais (Link para Planalto).
- Modo escuro (já suportado pelo theme) e temas por banca.
- Acessibilidade: navegação por teclado completa, leitores de tela.

## 7. Priorização (Matriz Valor × Esforço)

**Fazer primeiro (alto valor, baixo esforço):** cotas de IA, dashboard, filtros de questões, SRS SM-2, cache de respostas.

**Planejar (alto valor, alto esforço):** Knowledge Engine, RAG, ETL de questões, painel admin, pagamentos.

**Mais tarde (baixo valor/esforço alto):** app mobile, leaderboards, i18n.
