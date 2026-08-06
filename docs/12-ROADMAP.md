# 12 — Roadmap

**Projeto:** ConcursoAI Platform
**Versão:** 1.0
**Data:** 2026-08-04

---

## 1. Fases

| Fase | Período (referência) | Foco |
| --- | --- | --- |
| **MVP** | Mês 1–3 | Núcleo da plataforma (auth, dashboard, cronograma, questões, flashcards, Professor IA, analíticas) |
| **V1.1** | Mês 4–5 | Knowledge Engine beta (PDFs + RAG), perfis avançados |
| **V1.2** | Mês 6–7 | Contest Intelligence, recomendação, SRS avançado |
| **V2** | Mês 8+ | Comunidade, marketplace de conteúdo, app mobile |

## 2. MVP — Entregáveis (Mês 1–3)

### Sprint 1 — Fundação (Semanas 1–2)
- [ ] Setup do projeto (Next.js 16, TS, Tailwind, shadcn/ui)
- [ ] Docs (este repositório), SQL schema + policies + seed
- [ ] Supabase + NextAuth configurados
- [ ] Login/cadastro funcionais

### Sprint 2 — Núcleo de estudo (Semanas 3–5)
- [ ] Dashboard com métricas
- [ ] Cronograma (disciplinas + tarefas)
- [ ] Banco de questões (listar, resolver, gabaritar)
- [ ] Flashcards + revisão SRS básica

### Sprint 3 — IA e analíticas (Semanas 6–8)
- [ ] Professor IA com streaming (DeepSeek Flash/Pro)
- [ ] Cotas e rate limit de IA
- [ ] Analíticas (acertos, evolução, matérias)
- [ ] Landing page + SEO

### Sprint 4 — Polimento (Semanas 9–12)
- [ ] Testes E2E dos fluxos críticos
- [ ] Segurança (headers, rate limit, auditoria)
- [ ] Deploy em produção
- [ ] Beta com grupo de usuários (feedback)

## 3. V1.1 — Knowledge Engine (Mês 4–5)

- [ ] Upload de documentos (PDF, apostilas, editais) → R2
- [ ] Extração de texto + OCR
- [ ] Transcrição Whisper (áudio/vídeo)
- [ ] Chunking + embeddings + pgvector (HNSW)
- [ ] RAG no Professor IA com citações
- [ ] Busca semântica na biblioteca do usuário

## 4. V1.2 — Inteligência de Concurso (Mês 6–7)

- [ ] **Contest Intelligence:** análise de banca, peso de matérias, estatísticas de edital
- [ ] **Recommendation Engine:** recomenda tópicos fracos, questões e revisões
- [ ] **SRS avançado:** FSRS (Free Spaced Repetition Scheduler)
- [ ] Geração de questões inéditas estilo banca via IA
- [ ] Correção de redação/peça via IA (Pro)

## 5. V2 — Comunidade e Escala (Mês 8+)

- [ ] Planos pagos (Mercado Pago + Pix) e gerenciamento de assinatura
- [ ] Conteúdo comunitário (questões compartilhadas, resumos)
- [ ] App mobile (React Native/Expo) consumindo a mesma API
- [ ] Leaderboards e gamificação
- [ ] Multi-idioma (espanhol) para concursos de outros países

## 6. Dependências Críticas

| Dependência | Para | Status |
| --- | --- | --- |
| Supabase (pgvector) | RAG | Pronto (extensão disponível) |
| DeepSeek API | Professor IA | Pronta |
| Cloudflare R2 | Knowledge Engine | Criar conta |
| Whisper (transcrição) | Knowledge Engine | Escolher (local vs API) |
| Pagamentos | V2 | Mercado Pago (assinaturas + Pix) |

## 7. Métricas por Fase (North Star)

| Fase | North Star | Meta |
| --- | --- | --- |
| MVP | Ativação (1ª sessão de estudo em 24h) | ≥ 40% |
| MVP | Retenção D30 | ≥ 20% |
| V1.1 | Documentos ingeridos/semana | ≥ 1.000 |
| V1.2 | Conversão para pago | ≥ 5% |

## 8. Backlog Futuro

Ver `13-BACKLOG.md` para a lista detalhada e priorizada.
