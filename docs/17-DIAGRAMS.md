# 17 — Diagramas

**Projeto:** ConcursoAI Platform
**Data:** 2026-08-04

Este documento concentra todos os diagramas de arquitetura e fluxos da plataforma (formato Mermaid). Os diagramas também aparecem contextualizados nos documentos específicos (`02-SDD.md`, `06-KNOWLEDGE-ENGINE.md`, `07-RAG.md`, `08-ETL.md`, `11-DEPLOYMENT.md`).

---

## 1. Arquitetura Geral

```mermaid
flowchart TB
    subgraph Cliente
        B[Browser]
        M[Mobile - futuro]
    end
    subgraph Edge
        CDN[Vercel Edge/CDN]
    end
    subgraph App[Next.js 16 - Vercel]
        RSC[Server Components]
        CC[Client Components]
        SA[Server Actions]
        API[API Routes]
        AUTH[NextAuth v5]
    end
    subgraph Dados[Supabase]
        PG[(PostgreSQL + pgvector)]
        ST[(Storage)]
        AU[(Auth)]
    end
    subgraph IA
        DS[DeepSeek API]
        EMB[Embeddings - futuro]
        WH[Whisper - futuro]
    end
    subgraph Docs[Cloudflare R2 - futuro]
        R2[(Bucket de documentos)]
    end

    B --> CDN
    M --> CDN
    CDN --> RSC
    CDN --> CC
    CC --> SA
    CC --> API
    SA --> PG
    API --> PG
    RSC --> PG
    AUTH --> AU
    AUTH --> PG
    API --> DS
    SA --> DS
    SA --> R2
    API --> ST
    EMB --> PG
    WH --> API
```

## 2. Fluxo de Autenticação

```mermaid
sequenceDiagram
    participant U as Usuário
    participant F as Form (login)
    participant NA as NextAuth
    participant SA as Supabase Auth
    participant DB as Postgres

    U->>F: E-mail + senha
    F->>NA: signIn('credentials')
    NA->>SA: Validar credenciais
    SA-->>NA: OK (user)
    NA->>DB: Buscar profiles
    NA-->>F: JWT session (cookie)
    F->>U: Redireciona /dashboard
    Note over NA: Rota protegida verifica auth() + user_id
```

## 3. Fluxo de Resolução de Questão

```mermaid
sequenceDiagram
    participant U as Usuário
    participant Q as Página Questões
    participant API as POST /api/questoes/:id/responder
    participant DB as Postgres

    U->>Q: Escolhe alternativa
    Q->>API: {selected_letter, time_spent_sec}
    API->>DB: Insere question_attempts
    API->>DB: Consulta gabarito + explicação
    API-->>Q: {correct, gabarito, explicacao}
    Q-->>U: Feedback + explicação
```

## 4. Fluxo de Revisão de Flashcards (SRS)

```mermaid
flowchart LR
    U[Usuário] -->|Abre revisão| R[Revisões pendentes]
    R -->|Mostra frente| FR[Flashcard]
    FR -->|Vira| BK[Mostra verso]
    BK -->|Autoavaliação| RT{Fácil / Médio / Difícil}
    RT -->|Fácil| U1[intervalo x2.5]
    RT -->|Médio| U2[intervalo x1.5]
    RT -->|Difícil| U3[intervalo x1.0 / reset]
    U1 --> S[(review_schedules)]
    U2 --> S
    U3 --> S
```

## 5. Fluxo do Chat com Professor IA (com RAG futuro)

```mermaid
sequenceDiagram
    participant U as Usuário
    participant C as Chat UI
    participant A as /api/chat
    participant R as RAG (futuro)
    participant D as DeepSeek
    participant S as Supabase

    U->>C: Mensagem + modelo (flash/pro)
    C->>A: POST /api/chat (stream)
    A->>S: Valida sessão e cota
    A->>R: (futuro) busca semântica top-k
    R-->>A: chunks + fontes
    A->>D: completions (stream)
    loop SSE
        D-->>A: delta
        A-->>C: delta
    end
    C-->>U: Resposta + fontes
    A->>S: Salva mensagens + uso tokens
```

## 6. Pipeline da Knowledge Engine

```mermaid
flowchart LR
    UP[Upload] --> R2[Cloudflare R2]
    R2 --> Q[Fila]
    Q --> EX{Extração}
    EX -->|PDF texto| P[pdf-parse]
    EX -->|PDF imagem| OCR[Tesseract]
    EX -->|Áudio/Vídeo| WH[Whisper]
    P --> CH[Chunking]
    OCR --> CH
    WH --> CH
    CH --> EMB[Embeddings]
    EMB --> PG[(pgvector HNSW)]
    PG --> RAG[Professor IA - RAG]
```

## 7. Pipeline ETL (Questões)

```mermaid
flowchart TB
    SRC[Fontes: bancas, portais] --> CRAWL[Crawler agendado]
    CRAWL --> DL[Download PDF/HTML]
    DL --> PARSER[Parser por banca]
    PARSER --> NORM[Padronização de matéria]
    NORM --> VAL[Validação + dedupe]
    VAL -->|válido| DB[(questions)]
    VAL -->|inválido| LOG[Fila de curadoria]
    DB --> EXPL[Explicações IA - batch]
```

## 8. Fluxo de Deploy

```mermaid
flowchart LR
    DEV[push/PR] --> CI[CI: lint/type/test/build]
    CI -->|PR| PREV[Preview Vercel]
    CI -->|merge main| MIG[Migrations staging+prod]
    CI -->|merge main| DEP[Deploy produção]
    DEP --> MON[Monitoramento: Sentry + Analytics]
```

## 9. Diagrama de Implantação (Deployment)

```mermaid
flowchart TB
    subgraph AWS-Region[Vercel Region]
        APP[Next.js App]
    end
    subgraph Supabase-Cloud[Supabase]
        PG[(Postgres + pgvector)]
        AUTH[SupaAuth]
        STORAGE[Supa Storage]
    end
    subgraph Cloud[Cloudflare]
        R2[Cloudflare R2]
    end
    subgraph IA-CLOUD[IA Provider]
        DS[DeepSeek API]
    end

    APP -->|pg pooler/SSL| PG
    APP --> AUTH
    APP --> STORAGE
    APP -->|S3 API| R2
    APP -->|HTTPS| DS
```

## 10. Legenda de Cores (sugestão para docs)

- **Verde:** fluxos do MVP.
- **Azul:** serviços externos.
- **Laranja:** módulos futuros (Knowledge Engine, RAG).
- **Vermelho tracejado:** dependências de segurança (RLS, cotas).
