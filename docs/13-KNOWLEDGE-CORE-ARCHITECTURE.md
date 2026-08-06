# 13 — KNOWLEDGE CORE ARCHITECTURE

> Arquitetura completa do domínio Knowledge Core — o núcleo da plataforma ConcursoAI.
> Sem código, sem SQL, sem migrations, sem Drizzle. Apenas análise arquitetural pura.
> Documentos existentes não foram alterados.

---

## 1. VISÃO GERAL DO DOMÍNIO

### 1.1. O que é o Knowledge Core

O Knowledge Core é o domínio responsável por **ingerir, processar, armazenar, indexar e servir** todo o conteúdo de estudo da plataforma. Ele transforma materiais brutos (PDFs, vídeos, áudios, textos, leis) em ativos de conhecimento estruturados que alimentam:

- **Professor IA** (RAG — Retrieval-Augmented Generation)
- **Geração de Questões** (com gabarito e explicação)
- **Geração de Flashcards** (frente/verso com spaced repetition)
- **Geração de Resumos** (síntese automática)
- **Mapas Mentais** (estrutura hierárquica visual)
- **Busca Inteligente** (híbrida: vetorial + texto)

### 1.2. Papel na plataforma

```
┌──────────────────────────────────────────────────────────┐
│                     KNOWLEDGE CORE                        │
│                                                          │
│  UPLOAD  →  PROCESS  →  STORE  →  INDEX  →  SERVE       │
│                                                          │
│  Materiais brutos           Ativos de conhecimento        │
│  (PDF, DOCX, MP4, MP3,     (chunks, embeddings,           │
│   TXT, MD, HTML, URL)       summaries, citations)         │
│                                                          │
│                          ↓                               │
│              ┌───────────┼───────────┐                   │
│              │           │           │                   │
│         Professor IA   Questões   Flashcards             │
│         (RAG + chat)   (geração)  (geração)              │
│              │           │           │                   │
│         Resumos       Gabaritos   Revisão                │
│         Mapas Mentais  Explicações Espaçada               │
└──────────────────────────────────────────────────────────┘
```

### 1.3. Relação com outros domínios

| Domínio | Relação com Knowledge |
| --- | --- |
| **Identity** | Ownership de documents (user_id). RLS herdada. |
| **Contest** | Editais são fontes de conhecimento; notice_subjects liga edital → knowledge_subjects. |
| **Study** | knowledge_subjects é catálogo de referência; questions e flashcards podem ser gerados a partir do Knowledge. |
| **AI** | ChatSession consome chunks + embeddings via RAG. |
| **Billing** | Cotas de upload, processamento e armazenamento por plano. |
| **Analytics** | Eventos de upload, processamento, indexação e consumo. |
| **Administration** | Configurações de pipeline, limites de processamento. |

---

## 2. MODELO ATUAL (08-DATABASE-PHYSICAL)

O modelo físico atual já define o núcleo mínimo do Knowledge:

| Entidade | Tabela | Domínio | Função |
| --- | --- | --- | --- |
| Document | `documents` | Knowledge | Material enviado pelo usuário (agregado raiz) |
| DocumentChunk | `document_chunks` | Knowledge | Trecho extraído do documento |
| Embedding | `embeddings` | Knowledge | Vetor (1024d) do chunk |
| KnowledgeSubject | `knowledge_subjects` | Study | Catálogo de matérias (compartilhado) |

**O que falta:** O modelo atual cobre apenas o pipeline básico (documento → chunk → embedding). Não cobre versionamento, múltiplos formatos de ingestão, processamento assíncrono, ativos derivados (questões, flashcards, resumos), citações, transcrições, nem metadados ricos.

---

## 3. FORMATOS SUPORTADOS

Cada formato possui uma rota de ingestão específica, com pré-processamento e extração adequados.

### 3.1. Documentos textuais (nativos)

| Formato | Ingestão | Pré-processamento | Complexidade | Fase |
| --- | --- | --- | --- | --- |
| **TXT** | Upload direto | Encoding detection, sanitização | Baixa | **MVP** |
| **Markdown** | Upload direto | Parse de frontmatter, preservar estrutura | Baixa | **MVP** |
| **HTML** | Upload / URL | Strip de tags, preserve headings, links | Média | **MVP** |
| **PDF (texto nativo)** | Upload | Extração de texto com pdf.js/pdf-parse | Média | **MVP** |

### 3.2. Documentos office

| Formato | Ingestão | Pré-processamento | Complexidade | Fase |
| --- | --- | --- | --- | --- |
| **DOCX** | Upload | Extração via mammoth.js/python-docx | Média | **MVP** |
| **PDF (imagem/scaneado)** | Upload | OCR via Tesseract.js | Alta | **V1.1** |
| **Apresentações (PPTX)** | Upload | Extração de slides e notas | Média | **V1.1** |
| **Planilhas (XLSX)** | Upload | Extração tabular para texto | Média | **V1.1** |

### 3.3. Mídia

| Formato | Ingestão | Pré-processamento | Complexidade | Fase |
| --- | --- | --- | --- | --- |
| **Videoaulas (MP4/WEBM)** | Upload / URL | Transcrição via Whisper | Alta | **V1.1** |
| **Áudios (MP3/WAV)** | Upload | Transcrição via Whisper | Alta | **V1.1** |

### 3.4. Conteúdo jurídico (especializado)

| Formato | Ingestão | Pré-processamento | Complexidade | Fase |
| --- | --- | --- | --- | --- |
| **Leis** | URL (gov.br) / Upload | Parse estruturado (artigo, parágrafo, inciso) | Alta | **V1.1** |
| **Decretos** | URL (gov.br) / Upload | Parse estruturado | Alta | **V1.1** |
| **Normas** | URL / Upload | Parse estruturado | Alta | **V1.1** |
| **Jurisprudência** | URL / Upload | Extração de ementa, relator, decisão | Alta | **V2** |

### 3.5. Conteúdo estruturado da plataforma

| Formato | Origem | Natureza | Fase |
| --- | --- | --- | --- |
| **Editais** | Upload / Contest domain | Fonte oficial para extração de conteúdo programático | **MVP** |
| **Apostilas** | Upload | Material didático completo (PDF/DOCX) | **MVP** |
| **Livros** | Upload | Obra completa (PDF) | **V1.1** |
| **Questões** | Study domain / Geração IA | Consumidas e indexadas para RAG | **MVP** |
| **Gabaritos** | Vinculados a questões | Referência para correção | **MVP** |
| **Flashcards** | Study domain / Geração IA | Consumidos para revisão espaçada | **MVP** |
| **Resumos** | Geração IA | Derivados de documents | **V1.1** |
| **Mapas Mentais** | Geração IA | Estrutura hierárquica | **V1.1** |

### 3.6. Matriz de formatos × fases

| Fase | Formatos |
| --- | --- |
| **MVP** | TXT, Markdown, HTML, PDF (texto), DOCX, Editais, Apostilas |
| **V1.1** | PDF (OCR), PPTX, XLSX, MP4 (transcrição), MP3 (transcrição), Leis, Decretos, Normas, Livros |
| **V2** | Jurisprudência, formatos adicionais sob demanda |

---

## 4. ENTIDADES AVALIADAS

### 4.1. `documents`

**Finalidade:** Representar um documento físico ou digital enviado pelo usuário ou originado do sistema (edital, apostila, livro, lei, etc.). É o agregado raiz do domínio Knowledge.

**Responsabilidade:** Armazenar metadados do arquivo original, rastrear o status de processamento e ser o ponto de ownership para RLS.

**Relacionamentos:**
- `user_id → auth.users` (ownership, obrigatório)
- `1:N → document_versions` (versionamento)
- `1:N → document_chunks` (decomposição)
- `1:N → knowledge_assets` (ativos derivados)
- `N:M → knowledge_subjects` via junction (classificação)
- `N:M → knowledge_tags` via junction (etiquetagem)

**Dependências:** Identity (ownership), Storage (R2 path).

**Origem dos dados:** Upload do usuário, importação de edital (Contest), URL pública (lei, decreto).

**Destino dos dados:** Pipeline de processamento → chunks → embeddings → RAG.

**Impacto arquitetural:** Já existe no modelo físico (`documents`). Precisa ser expandido para suportar `source_type` (upload, edital, url, system), `source_url`, `external_id` (referência ao edital de origem).

**Fase:** **MVP** (já existe, com expansão de colunas).

---

### 4.2. `document_versions`

**Finalidade:** Versionar documentos para rastrear alterações e permitir rollback de embeddings.

**Responsabilidade:** Manter histórico de versões de um documento. Cada versão gera sua própria cadeia de chunks + embeddings.

**Relacionamentos:**
- `document_id → documents` (pertence ao documento)
- `1:N → document_chunks` (chunks pertencem à versão, não ao documento diretamente)
- `1:N → embeddings` (via chunks)

**Dependências:** documents.

**Origem dos dados:** Reupload, atualização de edital, correção de OCR.

**Destino dos dados:** Nova cadeia de chunks + embeddings.

**Impacto arquitetural:** Muda a FK de `document_chunks.document_id` para `document_chunks.version_id`. Exige estratégia de invalidação de embeddings antigos.

**Fase:** **V1.1** — No MVP, reupload substitui o documento sem histórico.

---

### 4.3. `knowledge_assets`

**Finalidade:** Representar ativos de conhecimento gerados a partir de documentos (resumos, questões, flashcards, explicações, mapas mentais). Tabela polimórfica ou base abstrata para ativos derivados.

**Responsabilidade:** Unificar a rastreabilidade de tudo que foi gerado a partir de um documento. Permite auditoria e invalidação em cadeia.

**Relacionamentos:**
- `document_id → documents` (origem)
- `asset_type` + `asset_id` → polimórfico para generated_questions, generated_flashcards, generated_summaries, mind_maps, learning_objects

**Dependências:** documents, e cada tipo de ativo.

**Origem dos dados:** Geração via IA (DeepSeek) a partir de chunks + contexto.

**Destino dos dados:** Study domain (questions, flashcards), interface do usuário.

**Impacto arquitetural:** Introduz polimorfismo. Alternativa é ter tabelas independentes com FK direta para document (mais simples, menos acoplada).

**Fase:** **V1.1** — No MVP, questões e flashcards gerados não rastreiam documento de origem.

---

### 4.4. `knowledge_sources`

**Finalidade:** Representar fontes externas de conhecimento (URLs de leis, decretos, normas, jurisprudência) que podem ser ingeridas automaticamente.

**Responsabilidade:** Gerenciar fontes de conteúdo que não são uploads de arquivo. Rastrear URL, última consulta, periodicidade de atualização.

**Relacionamentos:**
- `1:1 → documents` (quando ingerido, vira document)
- `N:M → knowledge_subjects` (classificação da fonte)

**Dependências:** Nenhuma — é raiz independente.

**Origem dos dados:** Curadoria (admin), sugestão do usuário, catálogo oficial (gov.br).

**Destino dos dados:** Pipeline de ingestão → document → chunks → embeddings.

**Impacto arquitetural:** Baixo. Tabela de configuração. Essencial para V1.1 (leis e decretos).

**Fase:** **V1.1** — MVP não tem ingestão automática de fontes externas.

---

### 4.5. `knowledge_subjects`

**Finalidade:** Catálogo oficial de matérias/disciplinas da plataforma (Direito Constitucional, Raciocínio Lógico, Português, etc.).

**Responsabilidade:** Ser a referência canônica de classificação para todo conteúdo (documentos, questões, flashcards, editais).

**Relacionamentos:**
- `1:N → knowledge_topics` (árvore de tópicos)
- `N:M → documents` (via junction)
- `1:N → questions` (classificação de questões)
- `1:N → chat_sessions` (contexto de chat)
- `N:M → editais` (via notice_subjects, se implementado)

**Dependências:** Nenhuma — é catálogo raiz.

**Origem dos dados:** Curadoria (admin), seed inicial.

**Destino dos dados:** Classificação de conteúdo, filtro de busca, contexto de IA.

**Impacto arquitetural:** Já existe no modelo físico. Precisa de seed inicial robusto.

**Fase:** **MVP** (já existe).

---

### 4.6. `knowledge_topics`

**Finalidade:** Árvore hierárquica de tópicos dentro de cada knowledge_subject. Ex.: Direito Constitucional → Direitos Fundamentais → Art. 5º.

**Responsabilidade:** Permitir granularidade fina na classificação e busca. Essencial para o Professor IA contextualizar respostas no tópico correto.

**Relacionamentos:**
- `subject_id → knowledge_subjects` (pertence à matéria)
- `parent_topic_id → knowledge_topics` (auto-referência para árvore)
- `N:M → documents` (via junction)
- `N:M → questions` (via junction)

**Dependências:** knowledge_subjects.

**Origem dos dados:** Curadoria, extração automática de editais (V1.1).

**Destino dos dados:** Classificação fina, busca facetada, contexto de RAG.

**Impacto arquitetural:** Tabela com auto-referência (árvore). Precisa de índice para consulta recursiva (PostgreSQL WITH RECURSIVE).

**Fase:** **MVP** (catálogo essencial, mesmo que população manual inicial).

---

### 4.7. `knowledge_tags`

**Finalidade:** Etiquetas livres e transversais para classificação flexível (ex.: "concurso TRT", "cespe", "2024", "direito administrativo").

**Responsabilidade:** Complementar a classificação hierárquica (subjects/topics) com etiquetas planas e pesquisáveis.

**Relacionamentos:**
- `N:M → documents` (via junction document_tags)
- `N:M → questions` (via junction question_tags)

**Dependências:** Nenhuma — catálogo livre.

**Origem dos dados:** Usuário (ao fazer upload), extração automática de metadados, IA (sugestão de tags).

**Destino dos dados:** Filtro de busca, recomendação, agrupamento.

**Impacto arquitetural:** Baixo. Tabela de tags + junction tables.

**Fase:** **MVP** (simples e de alto valor para organização).

---

### 4.8. `knowledge_metadata`

**Finalidade:** Armazenar metadados estruturados extraídos de documentos (autor, ano, banca, edital de origem, número de páginas, idioma, etc.).

**Responsabilidade:** Enriquecer o documento com campos pesquisáveis sem poluir a tabela principal.

**Alternativa:** Coluna `metadata` (JSONB) em `documents` já cobre essa necessidade com mais flexibilidade.

**Recomendação:** Não criar entidade separada. Usar JSONB em `documents.metadata`.

**Fase:** **Não implementar** — JSONB supre a necessidade.

---

### 4.9. `document_chunks`

**Finalidade:** Representar um trecho extraído de um documento após chunking.

**Responsabilidade:** Ser a unidade atômica de indexação e recuperação. Cada chunk gera 1 embedding.

**Relacionamentos:**
- `document_id → documents` (MVP) ou `version_id → document_versions` (V1.1)
- `1:1 → embeddings` (vetor correspondente)

**Dependências:** documents (e document_versions quando existir).

**Origem dos dados:** Pipeline de chunking (divisão por parágrafos, seções, ou tamanho fixo).

**Destino dos dados:** Geração de embeddings → indexação → RAG.

**Impacto arquitetural:** Já existe. A migração de `document_id` para `version_id` em V1.1 é estrutural mas contida.

**Fase:** **MVP** (já existe).

---

### 4.10. `embeddings`

**Finalidade:** Vetor de representação semântica (1024 dimensões) de um chunk.

**Responsabilidade:** Permitir busca por similaridade semântica (RAG).

**Relacionamentos:**
- `chunk_id → document_chunks` (1:1)

**Dependências:** document_chunks, provedor BAAI/bge-m3.

**Origem dos dados:** Serviço de embedding (BAAI/bge-m3) sobre o conteúdo do chunk.

**Destino dos dados:** Índice HNSW → busca vetorial → RAG.

**Impacto arquitetural:** Já existe conforme `docs/10-EMBEDDING-STANDARD.md`.

**Fase:** **MVP** (já existe).

---

### 4.11. `citations`

**Finalidade:** Representar referências extraídas de documentos (menções a leis, artigos, jurisprudência, doutrina).

**Responsabilidade:** Permitir que o Professor IA cite fontes precisas (artigo X da lei Y) e que o usuário navegue entre documentos relacionados.

**Relacionamentos:**
- `source_document_id → documents` (documento que contém a citação)
- `target_document_id → documents` (documento citado, opcional)
- `source_chunk_id → document_chunks` (trecho exato da citação)

**Dependências:** documents, document_chunks.

**Origem dos dados:** Extração automática (regex de padrões jurídicos: "Art. X da Lei Y"), LLM (extração via prompt).

**Destino dos dados:** Navegação entre documentos, grounding de respostas do Professor IA.

**Impacto arquitetural:** Baixo. Tabela de relação.

**Fase:** **V1.1** — MVP pode citar chunks sem rastrear citações estruturadas.

---

### 4.12. `summaries`

**Finalidade:** Representar um resumo gerado a partir de um documento ou trecho.

**Responsabilidade:** Armazenar sumários para acesso rápido sem re-gerar.

**Relacionamentos:**
- `document_id → documents` (resumo de documento inteiro)
- `chunk_id → document_chunks` (resumo de trecho, opcional)
- `user_id → auth.users` (quem solicitou a geração)

**Dependências:** documents, AI (DeepSeek).

**Origem dos dados:** Geração via IA (DeepSeek) a partir de chunks concatenados.

**Destino dos dados:** Exibição ao usuário, indexação para busca.

**Impacto arquitetural:** Médio. Exige cache e versionamento (resumo inválido se documento muda).

**Fase:** **V1.1** — No MVP, resumos são gerados sob demanda pelo chat (não persistidos).

---

### 4.13. `transcripts`

**Finalidade:** Representar a transcrição de um vídeo ou áudio.

**Responsabilidade:** Armazenar transcrição com timestamps para navegação e indexação.

**Relacionamentos:**
- `document_id → documents` (mídia original, 1:1)
- `1:N → document_chunks` (transcrição é chunked após gerada)

**Dependências:** documents, Whisper (transcrição).

**Origem dos dados:** Serviço de transcrição (Whisper) sobre MP4/MP3.

**Destino dos dados:** Chunking → embeddings → RAG.

**Impacto arquitetural:** Médio. Exige processamento assíncrono pesado (GPU recomendada). Pode usar API externa (OpenAI Whisper API).

**Fase:** **V1.1** — MVP não suporta vídeo/áudio.

---

### 4.14. `mind_maps`

**Finalidade:** Representar um mapa mental (estrutura hierárquica de nós) gerado a partir de um documento.

**Responsabilidade:** Armazenar estrutura de grafo (nós + arestas) para visualização interativa.

**Relacionamentos:**
- `document_id → documents` (origem)
- Estrutura interna em JSONB: `{nodes: [...], edges: [...]}`

**Dependências:** documents, AI (DeepSeek com prompt estruturado).

**Origem dos dados:** Geração via IA a partir de chunks agregados.

**Destino dos dados:** Renderização na UI (componente de mind map).

**Impacto arquitetural:** Baixo. Uma tabela com JSONB.

**Fase:** **V2** — MVP e V1.1 focam em texto e questões.

---

### 4.15. `generated_questions`

**Finalidade:** Questão gerada por IA a partir de um documento ou tópico.

**Responsabilidade:** Armazenar questão candidata antes de ser publicada no catálogo do Study.

**Relacionamentos:**
- `document_id → documents` (origem do conteúdo)
- `chunk_id → document_chunks` (trecho de referência, opcional)
- `knowledge_subject_id → knowledge_subjects` (classificação)
- Após aprovação, migra para `questions` (Study domain)

**Dependências:** documents, knowledge_subjects, AI (DeepSeek).

**Origem dos dados:** Geração via IA com prompt estruturado (enunciado + alternativas + gabarito + explicação).

**Destino dos dados:** Curadoria humana/IA → questions (Study).

**Impacto arquitetural:** Alto. Exige pipeline de curadoria (aprovação/edição antes de publicar).

**Fase:** **V1.1** — MVP pode gerar questões sob demanda no chat, sem persistência separada.

---

### 4.16. `generated_flashcards`

**Finalidade:** Flashcard gerado por IA a partir de um documento ou tópico.

**Responsabilidade:** Armazenar flashcard candidato antes de migrar para o deck do usuário.

**Relacionamentos:**
- `document_id → documents` (origem)
- `chunk_id → document_chunks` (trecho de referência)
- `knowledge_subject_id → knowledge_subjects` (classificação)
- Após aprovação, migra para `flashcards` (Study domain)

**Dependências:** documents, knowledge_subjects, AI (DeepSeek).

**Origem dos dados:** Geração via IA.

**Destino dos dados:** flashcards (Study), com review_schedule.

**Impacto arquitetural:** Similar a generated_questions. Exige curadoria.

**Fase:** **V1.1** — MVP gera flashcards sob demanda.

---

### 4.17. `generated_summaries`

**Finalidade:** wrapper de `summaries` com metadados de geração (prompt usado, modelo, tokens).

**Análise:** Esta entidade é redundante com `summaries` + metadados em JSONB. O campo `metadata` em `summaries` pode conter: modelo usado, tokens gastos, prompt template, data de geração.

**Recomendação:** Consolidar em `summaries` com JSONB.

**Fase:** **Não implementar como entidade separada** — usar `summaries`.

---

### 4.18. `generated_explanations`

**Finalidade:** Explicação detalhada gerada para um gabarito de questão ou tópico.

**Responsabilidade:** Associar explicação a uma questão, documento ou tópico para consulta.

**Relacionamentos:**
- `question_id → questions` (explicação de gabarito)
- `document_id → documents` (explicação de trecho)
- `knowledge_topic_id → knowledge_topics` (explicação de tópico)

**Dependências:** questions (Study), documents, knowledge_topics, AI (DeepSeek).

**Origem dos dados:** Geração via IA.

**Destino dos dados:** Exibição no estudo, feedback de questões.

**Impacto arquitetural:** Pode ser armazenado como coluna `explicacao` em `questions` (já existe). Para tópicos, pode ser coluna em `knowledge_topics`.

**Fase:** **Não implementar como entidade separada** — colunas em `questions.explicacao` e `knowledge_topics.explanation` suprem.

---

### 4.19. `learning_objects`

**Finalidade:** Unidade de aprendizado estruturada (aula, módulo, trilha) que agrupa documentos, questões, flashcards e resumos.

**Responsabilidade:** Criar trilhas de estudo coerentes (ex.: "Direito Constitucional para TRT — Módulo 1: Fundamentos").

**Relacionamentos:**
- `N:M → documents`
- `N:M → questions`
- `N:M → flashcards`
- `N:M → summaries`
- `N:1 → knowledge_topics`
- `user_id → auth.users` (se for trilha personalizada)

**Dependências:** documents, questions, flashcards, summaries, knowledge_topics.

**Origem dos dados:** Curadoria (admin) ou geração automática via IA.

**Destino dos dados:** Interface de estudo guiado (Learning Path).

**Impacto arquitetural:** Alto. Exige junctions para cada tipo de ativo. Concorre com Study (cronograma).

**Fase:** **V2** — MVP e V1.1 usam cronograma (Study) para organizar estudo.

---

### 4.20. Matriz consolidada de entidades

| # | Entidade | MVP | V1.1 | V2 | Não implementar |
| --- | --- | :---: | :---: | :---: | :---: |
| 1 | `documents` | ✅ (expandir) | — | — | — |
| 2 | `document_versions` | — | ✅ | — | — |
| 3 | `knowledge_assets` | — | ✅ | — | — |
| 4 | `knowledge_sources` | — | ✅ | — | — |
| 5 | `knowledge_subjects` | ✅ (já existe) | — | — | — |
| 6 | `knowledge_topics` | ✅ | — | — | — |
| 7 | `knowledge_tags` | ✅ | — | — | — |
| 8 | `knowledge_metadata` | — | — | — | ❌ (JSONB) |
| 9 | `document_chunks` | ✅ (já existe) | — | — | — |
| 10 | `embeddings` | ✅ (já existe) | — | — | — |
| 11 | `citations` | — | ✅ | — | — |
| 12 | `summaries` | — | ✅ | — | — |
| 13 | `transcripts` | — | ✅ | — | — |
| 14 | `mind_maps` | — | — | ✅ | — |
| 15 | `generated_questions` | — | ✅ | — | — |
| 16 | `generated_flashcards` | — | ✅ | — | — |
| 17 | `generated_summaries` | — | — | — | ❌ → `summaries` |
| 18 | `generated_explanations` | — | — | — | ❌ → colunas |
| 19 | `learning_objects` | — | — | ✅ | — |

**Total MVP:** 6 entidades (2 já existem, 4 novas)
**Total V1.1:** 9 entidades novas
**Total V2:** 2 entidades
**Não implementar:** 3 entidades redundantes

---

## 5. PIPELINE COMPLETO DE PROCESSAMENTO

### 5.1. Visão geral do pipeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                       KNOWLEDGE PIPELINE                             │
│                                                                     │
│  ┌────────┐   ┌──────────┐   ┌─────┐   ┌───────────┐               │
│  │ UPLOAD │ → │ PROCESS  │ → │ OCR │ → │TRANSCRIBE  │              │
│  └────────┘   └──────────┘   └─────┘   └───────────┘               │
│       │            │             │             │                     │
│       ▼            ▼             ▼             ▼                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │NORMALIZE │ │ METADATA │ │ CHUNKING │ │EMBEDDING │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
│       │            │             │             │                     │
│       └────────────┴─────────────┴──────┬──────┘                    │
│                                         ▼                            │
│                              ┌──────────────────┐                    │
│                              │     INDEXAÇÃO     │                    │
│                              │  (HNSW + FTS)    │                    │
│                              └────────┬─────────┘                    │
│                                       ▼                              │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                         RAG ENGINE                            │   │
│  │  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌───────────┐  │   │
│  │  │ QUESTÕES │  │ FLASHCARDS │  │ RESUMOS  │  │ PROF. IA  │  │   │
│  │  └──────────┘  └────────────┘  └──────────┘  └───────────┘  │   │
│  └──────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
```

### 5.2. Etapa 1 — UPLOAD

| Aspecto | Decisão |
| --- | --- |
| **Interface** | Upload via Supabase Storage (presigned URL) ou API Route com multipart |
| **Armazenamento** | Cloudflare R2 (bucket: `knowledge-documents`) |
| **Validação** | Tipo MIME, tamanho máximo (plano), extensão permitida |
| **Limite MVP** | 25 MB por arquivo, 100 MB total (plano Free); 100 MB/500 MB (Pro) |
| **Registro** | Cria row em `documents` com status `pending` |
| **Evento** | `DocumentUploaded` |

### 5.3. Etapa 2 — PROCESSAMENTO (dispatch)

| Aspecto | Decisão |
| --- | --- |
| **Gatilho** | Document status = `pending` |
| **Modelo** | Fila assíncrona (Inngest / QStash / Supabase Edge Function com retry) |
| **Router** | Roteia por MIME type para o extrator adequado |
| **Status** | `processing` ao iniciar, `processed` ou `failed` ao concluir |
| **Retry** | 3 tentativas com backoff exponencial |
| **Timeout** | 5 min por documento (MVP); 15 min (V1.1 com OCR/transcrição) |

### 5.4. Etapa 3 — OCR

| Aspecto | Decisão |
| --- | --- |
| **Quando** | Somente PDFs sem texto nativo (scaneados) |
| **Engine** | Tesseract.js (MVP local) ou API de OCR (V1.1) |
| **Idioma** | Português (treinamento adicional se necessário) |
| **Output** | Texto plano + scores de confiança por região |
| **Fase** | V1.1 (MVP só suporta PDF com texto nativo) |

### 5.5. Etapa 4 — TRANSCRIÇÃO

| Aspecto | Decisão |
| --- | --- |
| **Quando** | MP4, MP3, WEBM |
| **Engine** | Whisper (via API ou self-hosted) |
| **Idioma** | Português (modelo multilingual) |
| **Output** | Texto com timestamps (SRT/VTT) + texto plano |
| **Fase** | V1.1 |

### 5.6. Etapa 5 — NORMALIZAÇÃO

| Aspecto | Decisão |
| --- | --- |
| **Encoding** | UTF-8 (detectar e converter) |
| **Whitespace** | Normalizar espaços, remover linhas em branco excessivas |
| **Caracteres** | Remover caracteres de controle, preservar pontuação |
| **Estrutura** | Preservar headings, parágrafos, listas |
| **Output** | Texto limpo pronto para chunking |

### 5.7. Etapa 6 — METADADOS

| Aspecto | Decisão |
| --- | --- |
| **Extração** | Título (do nome do arquivo ou metadados internos), autor, data, página |
| **Classificação** | Sugestão de knowledge_subject e knowledge_topic via IA (keyword matching ou LLM) |
| **Tags** | Extração de termos-chave, menções a leis, bancas, cargos |
| **Armazenamento** | JSONB em `documents.metadata` |
| **Evento** | `DocumentMetadataExtracted` |

### 5.8. Etapa 7 — CHUNKING

| Aspecto | Decisão |
| --- | --- |
| **Estratégia padrão** | Tamanho fixo: 1000 caracteres com overlap de 200 (conforme `docs/10-EMBEDDING-STANDARD.md`) |
| **Estratégia estrutural** | Quando o formato permitir (Markdown, HTML): chunk por heading/section |
| **Metadados do chunk** | `seq`, `page`, `section_title`, `document_id` |
| **Limite** | Máximo de 500 chunks por documento (MVP) |
| **Evento** | `DocumentChunked` (após todos chunks criados) |

### 5.9. Etapa 8 — EMBEDDINGS

| Aspecto | Decisão |
| --- | --- |
| **Modelo** | BAAI/bge-m3 (conforme `docs/10-EMBEDDING-STANDARD.md`) |
| **Dimensão** | 1024 |
| **Batch** | 20 chunks por requisição (otimização) |
| **Cache** | Hash do conteúdo do chunk como chave de cache (evita re-embedding) |
| **Armazenamento** | Coluna `embedding` na tabela `embeddings` (pgvector) |
| **Evento** | `EmbeddingsGenerated` |

### 5.10. Etapa 9 — INDEXAÇÃO

| Aspecto | Decisão |
| --- | --- |
| **Índice vetorial** | HNSW sobre `embeddings.embedding` (cosine similarity) |
| **Índice textual** | GIN sobre `document_chunks.content` (Full Text Search em português) |
| **Atualização** | Índices mantidos pelo PostgreSQL (automático) |
| **Rebuild** | Reindexação completa via job administrativo (VACUUM + REINDEX) |

### 5.11. Etapa 10 — RAG (Retrieval-Augmented Generation)

| Aspecto | Decisão |
| --- | --- |
| **Estratégia** | Hybrid Search (vetorial + FTS com pesos configuráveis) |
| **Query** | Embedding da pergunta do usuário + palavras-chave extraídas |
| **Top-K** | 5-10 chunks mais relevantes |
| **Filtro** | Por `user_id` (RLS + filter), por `knowledge_subject_id` (se contexto ativo) |
| **Contexto** | Chunks concatenados + prompt template → DeepSeek |
| **Citações** | Referência ao documento e trecho de origem |

### 5.12. Etapa 11 — GERAÇÃO DE QUESTÕES

| Aspecto | Decisão |
| --- | --- |
| **Input** | Chunks de um documento/tópico + instruções de formato |
| **Modelo** | DeepSeek (deepseek-chat) com prompt template estruturado |
| **Output** | Enunciado + 5 alternativas (A-E) + gabarito + explicação |
| **Validação** | Gabarito presente entre A-E, enunciado não vazio |
| **Curadoria** | Flag `is_curated`; somente curadas vão para `questions` (Study) |
| **Fase** | V1.1 (MVP gera sob demanda no chat) |

### 5.13. Etapa 12 — GERAÇÃO DE FLASHCARDS

| Aspecto | Decisão |
| --- | --- |
| **Input** | Chunks de um documento/tópico |
| **Modelo** | DeepSeek com prompt template (frente: pergunta/termo, verso: resposta/definição) |
| **Output** | Frente + verso + tags sugeridas |
| **Curadoria** | Similar a questões: flag de aprovação antes de migrar |
| **Fase** | V1.1 |

### 5.14. Etapa 13 — GERAÇÃO DE RESUMOS

| Aspecto | Decisão |
| --- | --- |
| **Input** | Chunks concatenados de um documento ou seção |
| **Modelo** | DeepSeek com prompt de sumarização |
| **Output** | Texto resumido (20-30% do original) + tópicos-chave |
| **Fase** | V1.1 (MVP gera sob demanda no chat) |

### 5.15. Etapa 14 — PROFESSOR IA

| Aspecto | Decisão |
| --- | --- |
| **Mecanismo** | RAG sobre o Knowledge Core |
| **Contexto** | ChatSession + knowledge_subject_id opcional + documentos do usuário |
| **Prompt** | Sistema: "Você é o Professor IA da ConcursoAI. Responda com base APENAS no contexto fornecido. Cite a fonte." |
| **Fallback** | Se não houver contexto relevante, informar que não há material suficiente |
| **Streaming** | SSE (já implementado em `src/app/api/chat/route.ts`) |

---

## 6. ESTRATÉGIAS TRANSVERSAIS

### 6.1. Versionamento de documentos

| Aspecto | Decisão |
| --- | --- |
| **MVP** | Reupload substitui o documento. `storage_path` é atualizado. Chunks e embeddings antigos são marcados `deleted_at`. |
| **V1.1** | `document_versions` armazena histórico. Cada versão tem seus próprios chunks + embeddings. |
| **Transição** | Quando V1.1 for implementada, `document_chunks.document_id` migra para `document_chunks.version_id`. |
| **Política** | Manter últimas 3 versões; versões antigas arquivadas no R2 (cold storage). |

### 6.2. Estratégia de deduplicação

| Nível | Estratégia |
| --- | --- |
| **Arquivo** | Hash SHA-256 do conteúdo binário. Se o mesmo hash já existe para o usuário, rejeitar upload (409 Conflict) com link para o documento existente. |
| **Chunk** | Hash SHA-256 do conteúdo normalizado. Se o mesmo chunk já existe (mesmo documento ou outro), reutilizar o embedding existente. |
| **Cross-user** | Não deduplicar entre usuários (RLS e privacidade). Cada usuário tem seus próprios embeddings. |
| **Questão** | `content_hash` em `questions` já implementa deduplicação de questões. |

### 6.3. Estratégia de atualização

| Gatilho | Ação |
| --- | --- |
| **Reupload do mesmo arquivo** | Nova versão (MVP: substituição). Reprocessar pipeline completo. |
| **Edital atualizado** | Contest domain emite `EditalUpdated`. Knowledge ingere nova versão do edital. |
| **Correção de OCR** | Usuário edita texto extraído → re-chunking e re-embedding do trecho corrigido. |
| **Mudança de metadados** | Atualizar `documents.metadata` sem reprocessar chunks. |

### 6.4. Estratégia de invalidação de embeddings

| Gatilho | Escopo | Ação |
| --- | --- | --- |
| **Documento excluído** | Todos os chunks | Soft delete em documents, chunks e embeddings (cascade lógico). |
| **Nova versão** | Versão antiga | Soft delete nos chunks + embeddings da versão anterior. |
| **Mudança no modelo de embedding** | Todos os documentos | Reindexação completa (job administrativo). Flag `embedding_model` em embeddings permite identificar versões antigas. |
| **Chunk corrigido** | Apenas o chunk afetado | Re-gerar embedding do chunk específico. |

### 6.5. Estratégia de reindexação

| Aspecto | Decisão |
| --- | --- |
| **Quando** | Mudança de modelo de embedding, mudança de chunking strategy, corrupção de índice. |
| **Como** | Job administrativo que percorre `documents` ativos (`deleted_at IS NULL`), regenera chunks e embeddings. |
| **Online** | Reindexação não bloqueia leitura; novos embeddings coexistem com antigos até swap atômico. |
| **Swap** | Atualizar flag `is_current` nos embeddings; remover antigos após confirmação. |

### 6.6. Estratégia de cache

| Camada | Estratégia |
| --- | --- |
| **Embedding** | Cache por hash de conteúdo. Redis ou tabela `embedding_cache(hash, model, embedding)`. Evita re-gerar embeddings para chunks idênticos. |
| **RAG query** | Cache de queries frequentes (hash da query + user_id + top-K). TTL: 1 hora. |
| **Resumo** | Cache do resumo gerado. Invalidar se documento atualizar. |
| **Transcrição** | Cache da transcrição por hash do áudio/vídeo. |
| **CDN** | R2 com cache via Cloudflare CDN para acesso a arquivos originais. |

### 6.7. Estratégia de auditoria

| Aspecto | Decisão |
| --- | --- |
| **Eventos** | `DocumentUploaded`, `DocumentProcessed`, `DocumentIndexed`, `DocumentFailed`, `DocumentDeleted`, `QuestionGenerated`, `FlashcardGenerated`, `SummaryGenerated` |
| **Registro** | `event_logs` (Analytics domain) com payload completo |
| **Rastreabilidade** | Todo ativo derivado (questão, flashcard, resumo) referencia o documento e chunk de origem |
| **Auditoria de acesso** | RLS + logs de query RAG (quem consultou qual documento) |

### 6.8. Estratégia de armazenamento no Cloudflare R2

| Aspecto | Decisão |
| --- | --- |
| **Bucket** | `knowledge-documents` (arquivos originais), `knowledge-processed` (texto extraído, opcional) |
| **Path** | `{user_id}/{document_id}/{filename}` — isolamento por usuário |
| **Acesso** | Presigned URLs para upload/download. Acesso público NUNCA. |
| **Ciclo de vida** | Arquivos de documentos deletados movidos para cold storage após 30 dias. |
| **Backup** | R2 replicação automática. Backup adicional sob demanda. |
| **Cotas** | Plano Free: 100 MB. Pro: 500 MB. Intensivo: 2 GB. |

### 6.9. Estratégia de busca híbrida (FTS + Vetor)

| Aspecto | Decisão |
| --- | --- |
| **Abordagem** | Duas queries paralelas: (1) similarity search via HNSW no pgvector, (2) Full Text Search via `tsvector` no PostgreSQL. |
| **FTS** | Coluna `document_chunks.fts_vector` (GENERATED ALWAYS AS `to_tsvector('portuguese', content)`) com índice GIN. |
| **Pesos** | 70% vetorial + 30% FTS (configurável via `system_settings`). |
| **Score** | Normalizar scores de 0-1 e combinar com pesos. |
| **Fallback** | Se índice vetorial indisponível, usar apenas FTS. |
| **Query** | `ts_rank` para FTS, `cosine_distance` para vetorial. |

```
Query SQL (conceitual):
WITH semantic AS (
  SELECT chunk_id, 1 - cosine_distance(embedding, query_embedding) AS score
  FROM embeddings
  WHERE chunk_id IN (SELECT id FROM document_chunks WHERE document_id IN user_docs)
  ORDER BY score DESC
  LIMIT 20
),
fts AS (
  SELECT id AS chunk_id, ts_rank(fts_vector, query_tsquery) AS score
  FROM document_chunks
  WHERE document_id IN user_docs AND fts_vector @@ query_tsquery
  ORDER BY score DESC
  LIMIT 20
)
SELECT chunk_id, 
       COALESCE(s.score, 0) * 0.7 + COALESCE(f.score, 0) * 0.3 AS hybrid_score
FROM semantic s FULL OUTER JOIN fts f USING (chunk_id)
ORDER BY hybrid_score DESC
LIMIT 10;
```

---

## 7. MODELO RECOMENDADO DO DOMÍNIO

### 7.1. MVP — Knowledge Core Essencial

```
┌───────────────────────────────────────────────────────────┐
│                    MVP (FASE ATUAL)                        │
│                                                           │
│  documents (expandido)                                     │
│  ├── id, user_id, type, title, storage_path, status        │
│  ├── source_type (upload | edital) [NOVO]                  │
│  ├── source_url [NOVO]                                     │
│  ├── external_id [NOVO]                                    │
│  ├── file_hash (SHA-256) [NOVO]                            │
│  ├── metadata (JSONB)                                      │
│  └── ...                                                   │
│                                                           │
│  document_chunks                                           │
│  ├── id, document_id, seq, content, metadata               │
│  ├── fts_vector (tsvector GENERATED) [NOVO]                │
│  └── ...                                                   │
│                                                           │
│  embeddings                                                │
│  ├── id, chunk_id, model, embedding (1024d)                │
│  └── ...                                                   │
│                                                           │
│  knowledge_subjects (já existe no Study)                    │
│  └── id, name, slug, description, color, status            │
│                                                           │
│  knowledge_topics [NOVO]                                   │
│  ├── id, subject_id, parent_topic_id, name, slug            │
│  └── ...                                                   │
│                                                           │
│  knowledge_tags [NOVO]                                     │
│  ├── id, name, slug                                        │
│  └── ...                                                   │
│                                                           │
│  document_subjects (junction) [NOVO]                        │
│  └── document_id, subject_id                               │
│                                                           │
│  document_topics (junction) [NOVO]                          │
│  └── document_id, topic_id                                 │
│                                                           │
│  document_tags (junction) [NOVO]                            │
│  └── document_id, tag_id                                   │
└───────────────────────────────────────────────────────────┘
```

**Entidades MVP:** 6 (2 existentes expandidas + 4 novas)
**Junctions MVP:** 3
**Total de tabelas MVP:** 9 (6 + 3 junctions)

### 7.2. V1.1 — Knowledge Intelligence

```
┌───────────────────────────────────────────────────────────┐
│                    V1.1                                    │
│                                                           │
│  document_versions                                         │
│  knowledge_sources                                         │
│  knowledge_assets                                          │
│  citations                                                 │
│  summaries                                                 │
│  transcripts                                               │
│  generated_questions                                       │
│  generated_flashcards                                      │
│                                                           │
│  + OCR (Tesseract)                                         │
│  + Transcrição (Whisper)                                   │
│  + Ingestão de leis e decretos                             │
│  + Curadoria de questões e flashcards                      │
│  + Pipeline assíncrono completo                            │
└───────────────────────────────────────────────────────────┘
```

### 7.3. V2 — Learning Platform

```
┌───────────────────────────────────────────────────────────┐
│                    V2                                      │
│                                                           │
│  mind_maps                                                 │
│  learning_objects                                          │
│                                                           │
│  + Mapas mentais interativos                               │
│  + Trilhas de aprendizagem                                 │
│  + Ingestão de jurisprudência                              │
│  + Recomendação personalizada                              │
│  + Re-ranking de busca                                     │
│  + Ajuste fino de chunking por tipo                        │
└───────────────────────────────────────────────────────────┘
```

---

## 8. ROADMAP INTERNO DO KNOWLEDGE

### FASE K1 — FUNDAÇÃO (MVP)
- [x] `documents` (já existe, expandir com `source_type`, `source_url`, `external_id`, `file_hash`)
- [x] `document_chunks` (já existe)
- [x] `embeddings` (já existe)
- [ ] `knowledge_topics` (nova)
- [ ] `knowledge_tags` (nova)
- [ ] `document_subjects` (junction)
- [ ] `document_topics` (junction)
- [ ] `document_tags` (junction)
- [ ] Pipeline síncrono: upload → extração de texto → chunking → embedding → indexação
- [ ] Deduplicação por hash (arquivo + chunk)
- [ ] FTS vector em document_chunks
- [ ] Hybrid Search (vetorial + FTS)
- [ ] RAG engine para Professor IA

### FASE K2 — AVANÇADO (V1.1)
- [ ] `document_versions`
- [ ] `knowledge_sources`
- [ ] `knowledge_assets`
- [ ] `citations`
- [ ] `summaries`
- [ ] `transcripts`
- [ ] `generated_questions`
- [ ] `generated_flashcards`
- [ ] Migração chunks.version_id
- [ ] OCR (Tesseract)
- [ ] Transcrição (Whisper)
- [ ] Pipeline assíncrono (Inngest/QStash)
- [ ] Ingestão de leis e decretos
- [ ] Curadoria de ativos gerados
- [ ] Cache de embeddings por hash

### FASE K3 — PLATAFORMA (V2)
- [ ] `mind_maps`
- [ ] `learning_objects`
- [ ] Ingestão de jurisprudência
- [ ] Re-ranking de resultados
- [ ] Recomendação personalizada
- [ ] Ajuste fino de chunking por tipo de documento

---

## 9. DEPENDÊNCIAS DOS DEMAIS DOMÍNIOS

### 9.1. Dependências que o Knowledge tem de outros domínios

| Domínio | Dependência | Natureza |
| --- | --- | --- |
| **Identity** | `auth.users` — ownership de documents | Obrigatória — já existe |
| **Contest** | `editais` — fonte de documentos (source_type=edital) | Opcional no MVP |
| **Storage (R2)** | Armazenamento de arquivos | Obrigatória — já configurado |
| **AI (DeepSeek)** | Geração de questões, flashcards, resumos | MVP: sob demanda no chat. V1.1: pipeline |

### 9.2. Dependências que outros domínios têm do Knowledge

| Domínio | Dependência | Impacto se Knowledge atrasar |
| --- | --- | --- |
| **Study** | `knowledge_subjects`, `knowledge_topics` — classificação de questions e flashcards | **Alto** — questions e flashcards perdem classificação fina |
| **Study** | `generated_questions`, `generated_flashcards` (V1.1) — fonte de conteúdo | **Médio** — sem geração automática, usuário cria manualmente |
| **AI** | Chunks + embeddings — RAG para Professor IA | **Crítico** — Professor IA sem RAG perde grounding |
| **Contest** | `knowledge_subjects` — notice_subjects (se implementado) | **Baixo** — Contest funciona sem mapeamento |
| **Analytics** | Eventos de upload, processamento, consumo | **Baixo** — Analytics agrega outros eventos |
| **Billing** | Cotas de storage e processamento | **Médio** — cotas não aplicadas sem métricas |

### 9.3. Ordem crítica de implementação

```
1. knowledge_subjects (seed inicial)
2. knowledge_topics (seed inicial)
3. documents (expandido com novas colunas)
4. document_chunks + embeddings (já existem)
5. Hybrid Search (FTS + vetorial)
6. RAG Engine → Professor IA
7. (demais features conforme roadmap)
```

---

## 10. RISCOS ARQUITETURAIS

### Risco 1 — Custo de embeddings em escala
- **Descrição:** Cada chunk gera 1 embedding de 1024d. 100 documentos × 50 chunks = 5.000 vetores. Com crescimento para milhares de usuários, o índice HNSW pode consumir memória significativa no PostgreSQL.
- **Mitigação:** Limitar chunks por documento (500). Cache de embeddings por hash. Monitorar tamanho do índice. Plano de migração para pgvector externo se necessário.
- **Severidade:** Média (curto prazo), Alta (longo prazo).

### Risco 2 — Pipeline síncrono no MVP
- **Descrição:** No MVP, o pipeline (upload → chunk → embed → index) será síncrono. Documentos grandes podem causar timeouts.
- **Mitigação:** Limitar tamanho de arquivo (25 MB). Chunking em lotes. Timeout generoso (5 min). Migrar para assíncrono na V1.1.
- **Severidade:** Média.

### Risco 3 — Qualidade do OCR em PDFs jurídicos
- **Descrição:** PDFs de editais e leis frequentemente têm formatação complexa (colunas, tabelas, brasões). OCR pode degradar a qualidade.
- **Mitigação:** V1.1 apenas. Testar com amostra real de editais antes de liberar. Oferecer correção manual.
- **Severidade:** Alta (se OCR ruim, RAG degrada).

### Risco 4 — Consistência entre documento e ativos derivados
- **Descrição:** Se um documento é atualizado, questões e flashcards gerados da versão antiga ficam desatualizados.
- **Mitigação:** `knowledge_assets` rastreia a versão de origem. Flag `is_stale` para assets de versões antigas. Notificar usuário.
- **Severidade:** Média.

### Risco 5 — Isolamento de embeddings entre usuários
- **Descrição:** Embeddings são gerados por usuário (RLS). Não há compartilhamento. Se 100 usuários fizerem upload do mesmo edital, haverá 100× embeddings redundantes.
- **Mitigação:** No MVP, privacidade > eficiência. Na V1.1, avaliar embeddings compartilhados para documentos públicos (editais) com RLS apenas na camada de acesso.
- **Severidade:** Baixa (MVP com poucos usuários).

### Risco 6 — Dependência do BAAI/bge-m3
- **Descrição:** Modelo de embedding é externo e self-hosted. Se houver indisponibilidade, o pipeline para.
- **Mitigação:** Abstração de provider (trocar sem alterar domínio). Fallback para API externa (OpenAI embeddings) em emergência.
- **Severidade:** Alta.

### Risco 7 — Carga no PostgreSQL com Hybrid Search
- **Descrição:** Cada query de RAG executa 2 buscas (vetorial + FTS) com JOIN e ordenação composta.
- **Mitigação:** Índices otimizados (HNSW + GIN). Limitar top-K. Cache de queries frequentes. Read replica no futuro.
- **Severidade:** Média.

---

## 11. RECOMENDAÇÕES PARA IMPLEMENTAÇÃO

### 11.1. Arquitetura de código

```
src/
├── lib/
│   ├── knowledge/                    # Knowledge Core domain
│   │   ├── pipeline/                 # Pipeline de processamento
│   │   │   ├── upload.ts             # Upload e validação
│   │   │   ├── extractors/           # Extratores por formato
│   │   │   │   ├── text.ts
│   │   │   │   ├── markdown.ts
│   │   │   │   ├── html.ts
│   │   │   │   ├── pdf.ts
│   │   │   │   └── docx.ts
│   │   │   ├── normalizer.ts         # Normalização de texto
│   │   │   ├── chunker.ts            # Estratégia de chunking
│   │   │   ├── embedder.ts           # Geração de embeddings
│   │   │   └── indexer.ts            # Indexação (FTS + vetorial)
│   │   ├── retrieval/                # Recuperação
│   │   │   ├── hybrid-search.ts      # Busca híbrida
│   │   │   ├── rag.ts                # RAG engine
│   │   │   └── citation.ts           # Extração de citações
│   │   ├── generation/               # Geração de ativos (V1.1)
│   │   │   ├── questions.ts
│   │   │   ├── flashcards.ts
│   │   │   ├── summaries.ts
│   │   │   └── mind-maps.ts
│   │   ├── dedup.ts                  # Deduplicação (hash)
│   │   ├── cache.ts                  # Cache de embeddings
│   │   └── types.ts                  # Tipos do domínio
│   └── ...
├── db/
│   ├── schema/
│   │   ├── knowledge.ts              # Drizzle schema
│   │   └── ...
│   └── ...
└── app/
    └── api/
        ├── knowledge/
        │   ├── upload/route.ts       # Upload endpoint
        │   ├── process/route.ts      # Processamento assíncrono
        │   ├── search/route.ts       # Busca híbrida
        │   └── generate/route.ts     # Geração de ativos (V1.1)
        └── ...
```

### 11.2. Ordem de implementação (MVP)

1. **Seed de `knowledge_subjects` e `knowledge_topics`** — Dados iniciais de matérias e tópicos (Direito Constitucional, Administrativo, Raciocínio Lógico, Português, etc.)
2. **Expandir schema `documents`** — Adicionar colunas: `source_type`, `source_url`, `external_id`, `file_hash`
3. **Schema `knowledge_topics`, `knowledge_tags`** — Novas tabelas + junctions
4. **FTS em `document_chunks`** — Coluna `fts_vector` (GENERATED) + índice GIN
5. **Pipeline síncrono** — Extratores (TXT, MD, HTML, PDF texto, DOCX) → Normalização → Chunking → Embedding
6. **Deduplicação** — Hash SHA-256 no upload e no chunk
7. **Hybrid Search** — Query combinada vetorial + FTS
8. **RAG Engine** — Integração com Professor IA (substituir busca atual)
9. **Upload endpoint** — API Route com validação e disparo do pipeline

### 11.3. Seed inicial sugerido

```
knowledge_subjects (MVP):
- Direito Constitucional
- Direito Administrativo
- Direito Penal
- Direito Processual Penal
- Direito Civil
- Direito Processual Civil
- Direito do Trabalho
- Direito Processual do Trabalho
- Direito Tributário
- Direito Previdenciário
- Direito Ambiental
- Direito Empresarial
- Direitos Humanos
- Legislação Especial
- Raciocínio Lógico
- Matemática
- Estatística
- Português
- Redação
- Informática
- Atualidades
- Ética no Serviço Público
- Administração Pública
- Economia
- Contabilidade

knowledge_topics (exemplo — Direito Constitucional):
- Teoria da Constituição
- Poder Constituinte
- Direitos e Garantias Fundamentais
  - Direitos Individuais (Art. 5º)
  - Direitos Sociais
  - Nacionalidade
  - Direitos Políticos
- Organização do Estado
- Administração Pública
- Poder Legislativo
- Poder Executivo
- Poder Judiciário
- Funções Essenciais à Justiça
- Defesa do Estado e Instituições Democráticas
- Controle de Constitucionalidade
- Ordem Social
```

### 11.4. Princípios de design

| Princípio | Aplicação |
| --- | --- |
| **Repository Pattern** | `KnowledgeRepository` para acesso a documents, chunks, embeddings, topics, tags |
| **Service Layer** | `KnowledgeService` para pipeline, `SearchService` para busca, `GenerationService` para ativos |
| **DTO obrigatório** | `DocumentDto`, `ChunkDto`, `SearchResultDto`, `GenerationRequestDto` |
| **Zod validation** | Validação de upload, parâmetros de busca, requisições de geração |
| **RLS** | Ownership via `user_id`. Embeddings e chunks herdam RLS do documento pai |
| **Soft Delete** | Documents, chunks, topics, tags. Embeddings não (regeneráveis) |
| **UUID** | Todas as PKs |
| **Audit** | `created_at`, `updated_at`, `deleted_at` conforme padrão |

### 11.5. O que NÃO fazer

- ❌ Não criar `knowledge_metadata` — JSONB em `documents.metadata` supre
- ❌ Não criar `generated_summaries` — consolidar em `summaries` com JSONB
- ❌ Não criar `generated_explanations` — colunas em `questions.explicacao` e `knowledge_topics.explanation`
- ❌ Não usar embeddings compartilhados entre usuários no MVP (privacidade)
- ❌ Não implementar pipeline assíncrono no MVP (complexidade desnecessária)
- ❌ Não usar OpenAI para embeddings (decisão DD-012/DD-013)
- ❌ Não criar tabelas sem RLS
- ❌ Não expor `storage_path` diretamente ao cliente

---

## 12. SUMÁRIO

| Dimensão | MVP | V1.1 | V2 |
| --- | --- | --- | --- |
| **Entidades** | 6 (2 expandidas + 4 novas) | +9 | +2 |
| **Junctions** | 3 | — | — |
| **Formatos suportados** | TXT, MD, HTML, PDF texto, DOCX, Editais, Apostilas | + PDF OCR, PPTX, XLSX, MP4, MP3, Leis, Decretos, Normas, Livros | + Jurisprudência |
| **Pipeline** | Síncrono (upload → chunk → embed → index) | Assíncrono (Inngest/QStash) | Pipeline completo com re-ranking |
| **Ativos gerados** | Sob demanda no chat | Questões, Flashcards, Resumos (curadoria) | Mapas mentais, Trilhas |
| **Busca** | Hybrid Search (vetorial + FTS) | + Citações estruturadas | + Re-ranking |
| **Versionamento** | Reupload substitui | document_versions (3 versões) | Histórico completo |
| **Cache** | Hash de chunk | + Cache de queries RAG | + Cache distribuído |
| **Total de tabelas** | ~9 | ~18 | ~20 |

---

> **Documento criado em:** FASE 6 — Knowledge Core Architecture.
> **Próximo passo:** Após aprovação, implementar Drizzle schema do Knowledge (MVP) ou continuar revisão de outros domínios.
> **Documentos referenciados:** 08-DATABASE-PHYSICAL, 10-EMBEDDING-STANDARD, 06-DOMAIN-DECISIONS, 12-CONTEST-DOMAIN-REVIEW.
