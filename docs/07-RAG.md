# 07 — RAG (Retrieval-Augmented Generation)

**Projeto:** ConcursoAI Platform
**Status:** PÓS-MVP (design)
**Data:** 2026-08-04

---

## 1. Conceito

O **RAG** permite que o Professor IA responda com base em **conteúdo real do usuário** (apostilas, leis, editais, transcrições) — reduzindo alucinações e personalizando as respostas ao material de estudo.

```
Pergunta do usuário
        │
        ▼
[1] Query embedding ────────────────► pgvector (HNSW) ──► top-k chunks
        │                                        │
        ▼                                        ▼
[2] Monta prompt = System + Contexto(RAG) + Histórico + Pergunta
        │
        ▼
[3] DeepSeek gera resposta citando fontes
```

## 2. Etapas do Fluxo

### 2.1 Query Embedding
- A pergunta do usuário é convertida em embedding com o mesmo modelo usado na indexação.
- Guardrail: se a pergunta for curta/demais ou genérica, pular recuperação (economia de custo).

### 2.2 Recuperação (Retrieval)
- SQL com pgvector:

```sql
SELECT
  e.chunk_id,
  dc.content,
  dc.metadata,
  1 - (e.embedding <=> $query_embedding) AS similarity
FROM embeddings e
JOIN document_chunks dc ON dc.id = e.chunk_id
JOIN documents d ON d.id = dc.document_id
WHERE d.user_id = $user_id
  AND d.status = 'done'
ORDER BY e.embedding <=> $query_embedding
LIMIT 6;   -- top-k
```

- **Filtros pré-recuperação:** `user_id`, `document_id` (opcional), tipo (lei, edital), matéria.
- **Re-ranqueamento:** opcional com um pequeno modelo de cross-encoder ou LLM.

### 2.3 Montagem de Contexto
- Chunks ordenados por similaridade → concatenados no prompt com metadados de fonte.
- Limite de tokens do contexto RAG: ~2.000–3.000 tokens (aprox. 6 chunks de 500).

### 2.4 Geração
- Prompt com instrução: *"Responda com base APENAS no contexto fornecido. Se a informação não estiver no contexto, diga que não encontrou no material e sugira onde procurar. Cite a fonte entre colchetes."*

## 3. Estratégias de Chunking para RAG

| Documento | Estratégia | Tamanho do chunk |
| --- | --- | --- |
| Lei (CF/88, CLT, CP) | Por artigo | 1 artigo + parágrafos |
| Apostila/PDF corrido | Janela com overlap 15% | 600–800 tokens |
| Transcrição de aula | Por turno de fala / 30s | 400–600 tokens |
| Edital | Por seção (requisitos, conteúdo programático) | Inteiro da seção |

## 4. Relevância e Qualidade

- **Score mínimo:** filtrar chunks com `similarity < 0.55` (ajustável).
- **Diversificação:** MMR (Maximum Marginal Relevance) para evitar chunks redundantes.
- **Feedback implícito:** thumbs up/down na resposta → logs para ajustar parâmetros.

## 5. Híbrido (Vetorial + Lexical)

Para termos exatos (números de lei, nomes), combinar busca vetorial com `tsvector`/FTS do Postgres:

```sql
-- Score híbrido
(1 - e.embedding <=> $query) * 0.7
+ ts_rank(dc.tsv, plainto_tsquery('portuguese', $q)) * 0.3 AS score
```

## 6. Citações e Rastreabilidade

- A resposta do LLM é pós-processada para anexar referências:
  - `[1] Apostila Direito Constitucional — pág. 42`
  - `[2] Edital TCE-SP 2026 — Seção 5.2`
- A UI renderiza as fontes como chips clicáveis que abrem o documento na página correspondente.

## 7. Cache

- **Cache de embeddings** por hash do texto (evita re-embedding).
- **Cache de respostas** para perguntas frequentes por sessão (TTL 24h) — reduz custo.
- **Cache da query semântica** em Redis (TTL 15 min) para perguntas repetidas.

## 8. Segurança

- **Isolamento:** o RAG só recupera documentos do `user_id` autenticado (RLS).
- **Injeção de prompt:** contexto é tratado como *dados* (delimitado por tags `[CONTEXTO]...[/CONTEXTO]`), nunca como instrução.
- **Sanitização de metadados** antes de inserir no prompt.

## 9. Métricas de Qualidade RAG

| Métrica | Definição | Alvo |
| --- | --- | --- |
| Recall@5 | Documentos relevantes recuperados no top-5 | ≥ 0.8 |
| Precision@5 | Chunks recuperados que são relevantes | ≥ 0.7 |
| Fé do LLM (faithfulness) | Resposta suportada pelo contexto | ≥ 0.9 |
| Cite accuracy | Citações apontam para o trecho correto | ≥ 0.85 |

## 10. Ferramentas e Dependências

- `pgvector` (Supabase) — índice HNSW.
- `@supabase/supabase-js` — clientes.
- SDK da OpenAI para embeddings (ou endpoint do Supabase).
- Scripts de avaliação em `scripts/eval/`.
