# 01 — INGESTION BLUEPRINT

## PURPOSE
Receber, validar, deduplicar e armazenar materiais de estudo enviados pelo usuário no Cloudflare R2, registrando o documento no banco de dados como ponto de entrada do Knowledge Pipeline.

## INPUT

| Campo | Tipo | Obrigatório | Descrição |
| --- | --- | :---: | --- |
| `file` | `File` | ✅ | Arquivo binário (multipart/form-data) |
| `user_id` | `UUID` | ✅ | Proprietário (extraído da sessão, não enviado pelo cliente) |
| `source_type` | `enum(upload, edital, url)` | ❌ | Origem (default: `upload`) |
| `source_url` | `string` | ❌ | URL de origem (se `source_type=url`) |
| `external_id` | `UUID` | ❌ | ID do edital (se `source_type=edital`) |

### Validações de entrada
- Tipo MIME na allowlist: `text/plain`, `text/markdown`, `text/html`, `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- Tamanho máximo: 25 MB (Free), 100 MB (Pro) — validar contra `subscriptions` + `plans.limits`
- Extensão do arquivo consistente com o MIME type
- Hash SHA-256 não duplicado para o mesmo `user_id`

## OUTPUT

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `document_id` | `UUID` | ID do documento criado |
| `storage_path` | `string` | Caminho no R2: `{user_id}/{document_id}/{filename}` |
| `file_hash` | `string` | SHA-256 hex |
| `file_size` | `integer` | Tamanho em bytes |
| `mime_type` | `string` | Tipo MIME detectado |
| `status` | `enum(pending)` | Estado inicial do documento |
| `created_at` | `ISO8601` | Timestamp de criação |

### Erros possíveis
| Código | Condição |
| --- | --- |
| `DUPLICATE_FILE` | Hash SHA-256 já existe para este usuário |
| `QUOTA_EXCEEDED` | Storage total do usuário excede o limite do plano |
| `INVALID_TYPE` | MIME type não permitido |
| `FILE_TOO_LARGE` | Arquivo excede tamanho máximo do plano |
| `UPLOAD_FAILED` | Falha ao enviar para o R2 |

## DEPENDENCIES

### Serviços externos
- **Cloudflare R2:** Bucket `knowledge-documents` — armazenamento de arquivos
- **Billing Service:** `getUserQuota(user_id)` — verificação de cota de storage

### Módulos internos
- `src/lib/knowledge/pipeline/upload.ts`
- `src/lib/knowledge/dedup.ts`
- `src/lib/billing/quota.ts`

### Bibliotecas
- `crypto` (Node.js nativo) — SHA-256
- `zod` — validação de entrada
- `@supabase/supabase-js` — Storage client

## DATABASE

### Tabelas lidas
| Tabela | Colunas | Propósito |
| --- | --- | --- |
| `documents` | `file_hash`, `user_id` | Verificar duplicação |
| `subscriptions` | `user_id`, `plan_id`, `status` | Obter plano atual |
| `plans` | `limits` | Obter cota de storage |

### Tabelas escritas
| Tabela | Colunas | Operação |
| --- | --- | --- |
| `documents` | `id`, `user_id`, `type`, `title`, `storage_path`, `file_hash`, `file_size`, `mime_type`, `source_type`, `source_url`, `external_id`, `status`, `metadata`, `created_at`, `updated_at` | INSERT |

### Política RLS
```sql
-- documents: usuário insere apenas com seu próprio user_id
CREATE POLICY "Users can insert own documents" ON documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## REPOSITORIES

### DocumentRepository
| Método | Descrição |
| --- | --- |
| `findByHash(userId, hash)` | Buscar documento por hash (deduplicação) |
| `create(input)` | Criar novo documento |
| `getUserStorageUsage(userId)` | Somar `file_size` dos documentos ativos do usuário |

## SERVICES

### IngestionService
| Método | Descrição |
| --- | --- |
| `ingest(userId, file, sourceType?, sourceUrl?, externalId?)` | Orquestrar upload completo |
| `validateQuota(userId, fileSize)` | Verificar se upload cabe na cota |
| `computeHash(buffer)` | Calcular SHA-256 |
| `uploadToR2(buffer, path, mimeType)` | Enviar para Cloudflare R2 |
| `registerDocument(userId, metadata)` | Criar registro no banco |

### Fluxo do método `ingest`
1. Validar MIME type e tamanho (Zod)
2. `validateQuota(userId, fileSize)` → lança `QUOTA_EXCEEDED` se não couber
3. `computeHash(buffer)` → SHA-256
4. `DocumentRepository.findByHash(userId, hash)` → lança `DUPLICATE_FILE` se existir
5. Gerar `document_id` (UUID v7)
6. `uploadToR2(buffer, path, mimeType)` → storage_path
7. `DocumentRepository.create(input)` → document
8. Emitir evento `DocumentUploaded`
9. Retornar `DocumentDto`

## DTO

### UploadRequestDto
```typescript
// Zod schema
{
  file: File,                    // Validado pelo Zod + Multer/FormData
  source_type?: 'upload' | 'edital' | 'url',
  source_url?: string,           // Condicional: obrigatório se source_type='url'
  external_id?: string           // UUID, condicional: obrigatório se source_type='edital'
}
```

### DocumentDto (output)
```typescript
{
  id: string,                    // UUID
  user_id: string,
  type: string,
  title: string,
  storage_path: string,
  status: 'pending',
  file_size: number,
  mime_type: string,
  source_type: string,
  source_url?: string,
  external_id?: string,
  metadata: Record<string, unknown>,
  created_at: string             // ISO8601
}
```

### Mapper
- `toDocumentDto(row: Document): DocumentDto` — DB row → DTO

## API

### `POST /api/knowledge/upload`

- **Auth:** Obrigatória (session JWT)
- **Content-Type:** `multipart/form-data`
- **Rate Limit:** 10 uploads/hora (Free), 50/hora (Pro)
- **Timeout:** 30s (MVP síncrono)

**Request:**
```
POST /api/knowledge/upload
Content-Type: multipart/form-data

file: (binary)
source_type: upload
```

**Response 201:**
```json
{
  "document": {
    "id": "uuid",
    "title": "meu-edital.pdf",
    "status": "pending",
    "file_size": 2048576,
    "mime_type": "application/pdf",
    "created_at": "2026-08-04T12:00:00Z"
  }
}
```

**Response 409 (duplicado):**
```json
{
  "error": "DUPLICATE_FILE",
  "message": "Este arquivo já foi enviado",
  "existing_document_id": "uuid"
}
```

**Response 413 (cota excedida):**
```json
{
  "error": "QUOTA_EXCEEDED",
  "message": "Você atingiu o limite de armazenamento do plano Free",
  "usage_bytes": 104857600,
  "limit_bytes": 104857600
}
```

## EVENTS

### Emitidos
| Evento | Payload | Quando |
| --- | --- | --- |
| `DocumentUploaded` | `{ document_id, user_id, file_hash, file_size, mime_type, source_type }` | Após upload bem-sucedido no R2 e INSERT no banco |

### Consumidos
- Nenhum (início do pipeline)

## CACHE

| Chave | Valor | TTL | Propósito |
| --- | --- | --- | --- |
| `quota:{user_id}` | `{ used_bytes, limit_bytes }` | 5 min | Evitar query de soma a cada upload |
| `hash:{user_id}:{sha256}` | `document_id` | Permanente (até documento ser deletado) | Deduplicação rápida |

### Invalidação
- `quota:{user_id}` invalidado após upload bem-sucedido
- `hash:{user_id}:{sha256}` invalidado apenas se documento for deletado

## OBSERVABILITY

### Logs
```
[INFO] Ingestion started: user={userId} file={filename} size={bytes} mime={mimeType}
[INFO] Ingestion completed: document={docId} hash={hash} duration_ms={ms}
[WARN] Duplicate file rejected: user={userId} hash={hash}
[ERROR] Ingestion failed: user={userId} reason={error} duration_ms={ms}
```

### Métricas
| Métrica | Tipo | Descrição |
| --- | --- | --- |
| `ingestion_requests_total` | Counter | Uploads iniciados |
| `ingestion_success_total` | Counter | Uploads bem-sucedidos |
| `ingestion_duplicates_total` | Counter | Uploads rejeitados (duplicado) |
| `ingestion_quota_rejections_total` | Counter | Uploads rejeitados (cota) |
| `ingestion_duration_ms` | Histogram | Latência do upload completo |
| `ingestion_file_size_bytes` | Histogram | Distribuição de tamanhos |

### Alertas
- `ingestion_success_rate < 95%` nos últimos 15 min
- `ingestion_duration_ms_p95 > 10000` (10s)

## TESTS

### Unitários
- [ ] `computeHash` retorna SHA-256 consistente
- [ ] `validateQuota` rejeita quando `used + fileSize > limit`
- [ ] `validateQuota` permite quando `used + fileSize <= limit`
- [ ] Validação Zod rejeita MIME types inválidos
- [ ] `toDocumentDto` mapeia corretamente

### Integração
- [ ] Upload de TXT: cria document, armazena no R2, retorna DTO
- [ ] Upload duplicado: retorna 409 com `existing_document_id`
- [ ] Upload acima da cota: retorna 413
- [ ] Upload com MIME type inválido: retorna 400
- [ ] `DocumentUploaded` é emitido após upload bem-sucedido

### E2E
- [ ] Fluxo completo: POST /api/knowledge/upload → 201 → documento visível no dashboard

## ACCEPTANCE CRITERIA

1. ✅ Usuário autenticado envia arquivo PDF/TXT/MD/DOCX/HTML de até 25 MB (Free)
2. ✅ Arquivo é armazenado no Cloudflare R2 em `{userId}/{documentId}/{filename}`
3. ✅ Registro criado em `documents` com status `pending`
4. ✅ Hash SHA-256 impede duplicação para o mesmo usuário (409)
5. ✅ Cota do plano é respeitada (413 se exceder)
6. ✅ Tipos MIME não permitidos são rejeitados (400)
7. ✅ Evento `DocumentUploaded` é registrado em `event_logs`
8. ✅ Upload é rejeitado se usuário não autenticado (401)
9. ✅ Rate limit aplicado por plano (10/h Free, 50/h Pro)
10. ✅ Título do documento é extraído do nome do arquivo (sem extensão)

## IMPLEMENTATION ORDER

1. **Expansão do schema `documents`** — Adicionar colunas `source_type`, `source_url`, `external_id`, `file_hash`
2. **`src/lib/knowledge/dedup.ts`** — Função `computeHash(buffer)`
3. **`src/lib/knowledge/pipeline/upload.ts`** — Validação Zod + lógica de upload para R2
4. **`DocumentRepository`** — `findByHash`, `create`, `getUserStorageUsage`
5. **`IngestionService`** — Orquestrador `ingest()`
6. **`UploadRequestDto` / `DocumentDto`** — Zod schemas + mapper
7. **`POST /api/knowledge/upload`** — Route handler
8. **Cache** — Redis keys `quota:{userId}` + `hash:{userId}:{sha256}`
9. **Testes** — Unitários → Integração → E2E
