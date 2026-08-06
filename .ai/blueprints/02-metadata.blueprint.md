# 02 — METADATA BLUEPRINT

## PURPOSE
Extrair, inferir e enriquecer metadados de documentos após extração de texto: classificar automaticamente por matéria e tópico, sugerir tags, detectar menções legais e armazenar tudo em `documents.metadata` (JSONB) com junctions para subjects, topics e tags.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `document_id` | `UUID` | ✅ | Documento a classificar |
| `text` | `string` | ✅ | Texto extraído e normalizado (primeiros 5000 caracteres para classificação) |
| `file_metadata` | `object` | ❌ | Metadados do arquivo (nome, tamanho, data de modificação) |

### Pré-condições
- Documento com status `processing`
- Texto já extraído e normalizado (UTF-8, whitespace limpo)
- Catálogos `knowledge_subjects` e `knowledge_topics` populados (seed)

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `metadata` | `JSONB` | Metadados enriquecidos mesclados ao `documents.metadata` |
| `suggested_subject_id` | `UUID?` | Matéria inferida (maior score) |
| `suggested_topic_ids` | `UUID[]` | Tópicos inferidos (score > threshold) |
| `suggested_tags` | `string[]` | Tags sugeridas |
| `legal_references` | `LawRef[]` | Menções a leis/artigos detectadas |
| `language` | `string` | Idioma detectado (ex.: `pt-BR`) |

```
LawRef {
  law: string           // ex.: "Constituição Federal"
  article?: string      // ex.: "5º"
  paragraph?: string    // ex.: "II"
  raw_text: string      // Texto original da menção
}
```

### Campos do `documents.metadata` enriquecido
```json
{
  "extracted_title": "string?",
  "author": "string?",
  "page_count": 42,
  "language": "pt-BR",
  "subject": { "id": "uuid", "name": "Direito Constitucional", "confidence": 0.92 },
  "topics": [
    { "id": "uuid", "name": "Direitos Fundamentais", "confidence": 0.87 }
  ],
  "tags": ["constitucional", "artigo-5", "direitos-fundamentais"],
  "legal_references": [
    { "law": "Constituição Federal", "article": "5º", "raw_text": "Art. 5º da CF/88" }
  ],
  "processing": {
    "extracted_at": "2026-08-04T12:00:00Z",
    "extraction_method": "pdf-parse",
    "encoding": "UTF-8"
  }
}
```

## DEPENDENCIES

### Serviços externos
- **DeepSeek API:** Classificação via LLM com prompt estruturado (V1.1; MVP usa keyword matching)
- Nenhum obrigatório no MVP (algorítmico + regex)

### Módulos internos
- `src/lib/knowledge/pipeline/metadata.ts`
- `src/lib/knowledge/pipeline/classifiers.ts`
- `src/lib/knowledge/pipeline/legal-regex.ts`

### Bibliotecas
- `zod` — validação
- `franc` ou similar — detecção de idioma (leve)

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `documents` | `id`, `metadata`, `status` | Obter documento atual |
| `knowledge_subjects` | `id`, `name`, `slug` | Catálogo para matching |
| `knowledge_topics` | `id`, `name`, `slug`, `subject_id`, `parent_topic_id` | Catálogo para matching |
| `knowledge_tags` | `id`, `name`, `slug` | Catálogo para matching |

### Tabelas escritas
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `documents` | `metadata` | UPDATE (merge) |
| `document_subjects` | `document_id`, `subject_id`, `confidence` | UPSERT |
| `document_topics` | `document_id`, `topic_id`, `confidence` | UPSERT |
| `document_tags` | `document_id`, `tag_id` | INSERT (se nova tag, criar em `knowledge_tags`) |

### Políticas RLS
- `document_subjects`, `document_topics`, `document_tags`: acesso herdado via `document_id` (verificar ownership no `documents`)

## REPOSITORIES

### KnowledgeSubjectRepository
| Método | Descrição |
| --- | --- |
| `getAll()` | Listar todas as matérias ativas |
| `findByName(name)` | Buscar por nome exato |

### KnowledgeTopicRepository
| Método | Descrição |
| --- | --- |
| `getBySubject(subjectId)` | Tópicos de uma matéria |
| `searchByName(name)` | Busca textual por nome |

### KnowledgeTagRepository
| Método | Descrição |
| --- | --- |
| `findOrCreate(name)` | Buscar tag ou criar nova |
| `searchByName(name)` | Busca textual por nome |

### DocumentRepository
| Método | Descrição |
| --- | --- |
| `updateMetadata(docId, metadata)` | Merge JSONB no `documents.metadata` |
| `getById(docId)` | Obter documento |

### DocumentSubjectRepository, DocumentTopicRepository, DocumentTagRepository
- `upsert(docId, subjectId/topicId/tagId, confidence?)` — criar ou atualizar associação
- `deleteByDocument(docId)` — limpar associações antigas

## SERVICES

### MetadataService
| Método | Descrição |
| --- | --- |
| `extract(documentId, text, fileMetadata)` | Orquestrar extração completa |
| `detectLanguage(text)` | Detectar idioma |
| `classifySubject(text)` | Inferir matéria (keyword matching no MVP) |
| `classifyTopics(text, subjectId)` | Inferir tópicos dentro da matéria |
| `suggestTags(text)` | Extrair palavras-chave como tags |
| `extractLegalReferences(text)` | Regex de padrões jurídicos |
| `mergeMetadata(documentId, newMeta)` | Atualizar JSONB + junctions |

### Estratégia de classificação (MVP)
1. **Keyword matching:** Cada `knowledge_subject` e `knowledge_topic` possui uma lista de keywords associadas (ex.: "Direito Constitucional" → ["constituição", "CF/88", "controle de constitucionalidade", "ADI", "ADC"])
2. Contar ocorrências de keywords no texto
3. Normalizar scores por tamanho do texto
4. Selecionar subject com maior score; tópicos com score > threshold

### Estratégia de classificação (V1.1)
- Prompt LLM: "Classifique o texto a seguir em uma das matérias: [lista]. Retorne JSON com subject_id, topic_ids e confidence."

### Extração de referências legais (regex)
```
Padrões:
- "Art\.\s*\d+[º°]?\s*(,?\s*(§\s*\d+[º°]?|inciso\s+[IVXLC]+))?\s*(da|do|de)?\s*.+"
- "(Lei|Decreto|MP|EC)\s*(n\.?|nº|no\.?)?\s*[\d\.]+[/-]\d{4}"
- "Súmula\s*(Vinculante\s*)?\d+\s*(do\s*)?(STF|STJ|TST)"
- "CF/88|CRFB/88|Constituição Federal"
```

## DTO

### MetadataResultDto (output)
```typescript
{
  document_id: string,
  metadata: Record<string, unknown>,
  subject: { id: string, name: string, confidence: number } | null,
  topics: { id: string, name: string, confidence: number }[],
  tags: string[],
  legal_references: { law: string, article?: string, raw_text: string }[],
  language: string
}
```

### Mapper
- `toMetadataResultDto(document, subjects, topics, tags): MetadataResultDto`

## API

### Interna (não exposta ao cliente)
A Metadata Engine é acionada automaticamente após extração de texto, não possui endpoint público próprio.

### Fluxo de chamada
1. `TextExtracted` (ou `OcrCompleted`) → dispara `MetadataService.extract()`
2. Pipeline interno, sem resposta HTTP direta ao cliente
3. Status do documento atualizado para `processed` ao concluir

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `MetadataExtracted` | `{ document_id, subject_id?, topic_count, tag_count, legal_ref_count, language }` | Após classificação concluída |

### Consumidos
| Evento | Origem | Ação |
| --- | --- | --- |
| `TextExtracted` | Extraction (PDF nativo) | Dispara `MetadataService.extract()` |
| `OcrCompleted` | OCR Engine (V1.1) | Dispara `MetadataService.extract()` |
| `TranscriptionCompleted` | Transcription Engine (V1.1) | Dispara `MetadataService.extract()` |

## CACHE

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `subjects:catalog` | `KnowledgeSubject[]` | 1h | Evitar query de catálogo a cada classificação |
| `topics:catalog:{subjectId}` | `KnowledgeTopic[]` | 1h | Idem para tópicos |
| `tags:catalog` | `KnowledgeTag[]` | 1h | Idem para tags |
| `classify:{textHash}` | `{ subject_id, topic_ids }` | 24h | Classificação de textos similares |

### Invalidação
- Catálogos invalidados quando admin atualiza subjects/topics/tags
- `classify:{textHash}` mantido por 24h (catálogo estável)

## OBSERVABILITY

### Logs
```
[INFO] Metadata extraction started: document={docId} text_length={chars}
[INFO] Metadata extraction completed: document={docId} subject={name} confidence={score} duration_ms={ms}
[WARN] Low confidence classification: document={docId} subject={name} confidence={score}
[INFO] Legal references found: document={docId} count={n}
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `metadata_extractions_total` | Counter | Extrações iniciadas |
| `metadata_classification_confidence` | Histogram | Distribuição de scores de confiança |
| `metadata_low_confidence_total` | Counter | Classificações com score < 0.5 |
| `metadata_legal_refs_total` | Counter | Total de referências legais extraídas |
| `metadata_duration_ms` | Histogram | Latência da extração |

### Alertas
- `metadata_low_confidence_rate > 30%` — catálogo pode estar incompleto

## TESTS

### Unitários
- [ ] `detectLanguage` identifica pt-BR corretamente
- [ ] `extractLegalReferences` encontra "Art. 5º da CF/88"
- [ ] `extractLegalReferences` encontra "Lei nº 8.112/90"
- [ ] `extractLegalReferences` encontra "Súmula Vinculante 10 do STF"
- [ ] `classifySubject` retorna matéria correta para texto conhecido
- [ ] `toMetadataResultDto` mapeia corretamente

### Integração
- [ ] Texto sobre "controle de constitucionalidade" classifica como "Direito Constitucional"
- [ ] Texto com "Art. 37 da CF/88" gera legal_reference
- [ ] `documents.metadata` é atualizado com merge (não sobrescrito)
- [ ] Junctions `document_subjects`, `document_topics`, `document_tags` são criadas
- [ ] Evento `MetadataExtracted` é emitido

### E2E
- [ ] Upload de PDF → classificação automática visível no dashboard do documento

## ACCEPTANCE CRITERIA

1. ✅ Documento é automaticamente classificado em uma `knowledge_subject` após extração de texto
2. ✅ Score de confiança é armazenado (> 0.5 = sucesso; < 0.5 = baixa confiança, registrado)
3. ✅ Tópicos relevantes são associados (score > threshold configurável)
4. ✅ Tags são extraídas e associadas (mínimo 1, máximo 10)
5. ✅ Referências legais são detectadas e armazenadas no metadata
6. ✅ Idioma é detectado e registrado
7. ✅ `documents.metadata` preserva campos existentes (merge, não replace)
8. ✅ Se classificação falhar, documento avança com metadata parcial (sem blocking)
9. ✅ Para documentos em inglês/espanhol, classificação ainda funciona (catálogo multilíngue futuro)
10. ✅ Metadados do arquivo (nome, data) são preservados

## IMPLEMENTATION ORDER

1. **Seed de keywords** — Adicionar coluna `keywords` (JSONB) em `knowledge_subjects` e `knowledge_topics`
2. **`src/lib/knowledge/pipeline/legal-regex.ts`** — Padrões regex para leis, artigos, súmulas
3. **`src/lib/knowledge/pipeline/classifiers.ts`** — Keyword matching para subjects e topics
4. **`MetadataService`** — Orquestrador `extract()`
5. **Repositories** — `KnowledgeSubjectRepository`, `KnowledgeTopicRepository`, `KnowledgeTagRepository`, junctions
6. **Integração com pipeline** — Conectar ao evento `TextExtracted`
7. **Cache de catálogos** — Redis
8. **DTO + Mapper** — `MetadataResultDto`
9. **Testes**
