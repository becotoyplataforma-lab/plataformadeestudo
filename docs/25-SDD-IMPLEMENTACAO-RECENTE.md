# Software Design Document — Implementação Recente (Agosto 2026)

**Versão:** 1.0  
**Data:** 2026-08-30  
**Status:** Implementado e validado em produção  
**Autor:** ConcursoAI Development Team

---

## 1. Visão Geral

Este documento descreve as mudanças implementadas recentemente na plataforma ConcursoAI, incluindo:

1. **Redesign do Sidebar do Aluno** — padrão "Estratégia Concursos"
2. **Redesign de Apostilas** — suporte a favoritos + redesign de página
3. **Catálogo de Cursos** — placeholder "Em breve"
4. **Correção de Testes** — 3 falhas pre-existentes corrigidas
5. **Validação Completa** — typecheck, lint, build, testes

**Deploy anterior (Task C):**
- 4 fases de risco (análise de performance, recomendações estratégicas, simulado adaptativo, monitoramento em tempo real)
- Landing page redesenhada
- Transformação de apostilas com marca DeepSeek
- VPS: `137.131.179.48` (app.becotoy.com)
- Health check: `127.0.0.1:3001`

---

## 2. Infraestrutura & Stack Técnico

### 2.1 Tecnologias Principais

| Componente | Tecnologia | Versão |
|------------|-----------|--------|
| Framework | Next.js | 16.3.0 (Turbopack) |
| Linguagem | TypeScript | strict mode |
| Database | PostgreSQL (Supabase) | ref do projeto no .env (nao no doc) |
| Auth | Auth.js v5 | Supabase + Credentials |
| Storage | Cloudflare R2 + Supabase | r2 (explícito via env) |
| Testing | Vitest | v4.1.11 |
| ORM | Drizzle | PostgreSQL dialect |
| UI Components | Lucide React + Shadcn | CSS customizado |
| AI | DeepSeek | flash (32768 tokens) |
| Rate Limit | Custom | Por plano/hora |

### 2.2 Storage Backend

**Ativo:** `STORAGE_BACKEND=r2` (Cloudflare R2)

```
Bucket: nome do bucket em R2_BUCKET (valor nao vai para o repositorio)
Endpoint: derivado de R2_ACCOUNT_ID em src/lib/knowledge/storage/r2-storage.service.ts
Credentials: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY
```

**Sem fallback automatico:** o backend e decidido por `STORAGE_BACKEND`. Supabase Storage (bucket `documents`) continua servindo os documentos legados porque o download usa o `storage_backend` gravado no documento, nao o backend global.

**Migração Realizada:**
- 2 documentos migrados de Supabase -> R2 (execucao historica, com credenciais que hoje nao estao neste ambiente);
- Originais deletados de Supabase; reexecutar `scripts/migrate-storage-r2.mjs` so com credenciais e banco de teste isolado
- 0 docs permanecem em Supabase
- 8 docs + transformados em R2 + 2 em Supabase (confirmado via HeadObject + download)

### 2.3 Database Schema (Alterações Recentes)

#### Tabela: `documents` (Knowledge)

```sql
ALTER TABLE documents ADD COLUMN is_favorite boolean NOT NULL DEFAULT false;
```

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id` | UUID | PK, gerado pelo DB |
| `user_id` | UUID | FK auth.users |
| `type` | ENUM | 'txt', 'pdf', 'html', 'md' |
| `title` | TEXT | Nome da apostila |
| `storage_backend` | VARCHAR | 'r2' ou 'supabase' (padrão: 'supabase') |
| `storage_path` | TEXT | Caminho no storage (sanitizado) |
| `status` | ENUM | pending, processing, processed, chunked, indexing, indexed, failed |
| `file_size` | BIGINT | Bytes |
| `mime_type` | VARCHAR | application/pdf, text/plain, etc. |
| `metadata` | JSONB | Metadados customizados |
| `page_count` | INT | Nulo para .txt, .md |
| `chunk_count` | INT | Após chunking |
| `embedding_count` | INT | Após embedding |
| `processing_error` | TEXT | Mensagem de erro (se status=failed) |
| `is_favorite` | BOOLEAN | **NOVO** — favorito do aluno (default: false) |
| `edital_id` | UUID | FK editais (opcional) |
| `position_id` | UUID | FK positions (opcional) |
| `source_type` | VARCHAR | 'upload', 'edital', 'url' |
| `source_url` | TEXT | URL original (se source_type='url') |
| `external_id` | VARCHAR | ID externo (se source_type='edital') |
| `processed_at` | TIMESTAMP | Data de processamento completo |
| `deleted_at` | TIMESTAMP | Soft delete |
| `created_at` | TIMESTAMP | Criação |
| `updated_at` | TIMESTAMP | Última alteração |

---

## 3. Componentes Redesenhados

### 3.1 Sidebar do Aluno (`src/components/layout/app-sidebar.tsx`)

**Padrão:** "Estratégia Concursos" (vertical, com ícones + texto, badges para "Em breve")

#### Estrutura

```tsx
interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  badge?: string;      // "Em breve", "IA", etc.
  disabled?: boolean;  // true = <span> (não-clicável)
}

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  {
    href: "/catalogo",
    label: "Catálogo de Cursos",
    icon: Compass,
    badge: "Em breve",
    disabled: true,
  },
  { href: "/apostilas", label: "Minhas Apostilas", icon: BookOpen },
  { href: "/cronograma", label: "Trilhas Estratégicas", icon: CalendarCheck2 },
  { href: "/questoes", label: "Caderno de Questões", icon: FileQuestion },
  { href: "/analises", label: "Monitor de Performance", icon: BarChart3 },
  {
    href: "/simulados",
    label: "Simulados",
    icon: Target,
    badge: "Em breve",
    disabled: true,
  },
  { href: "/perfil", label: "Minhas Preferências", icon: Settings },
];

const extraItems: NavItem[] = [
  { href: "/flashcards", label: "Flashcards", icon: Layers },
  { href: "/professor", label: "Professor IA", icon: MessagesSquare, badge: "IA" },
  { href: "/professor-apostilas", label: "Apostilas (Professor)", icon: FileText },
];
```

#### Renderização de `NavLink`

```tsx
function NavLink({ item, pathname }) {
  const active = !item.disabled && (pathname === item.href || pathname.startsWith(item.href + "/"));
  
  const classes = cn(
    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
    item.disabled
      ? "cursor-not-allowed text-slate-500"
      : active
        ? "bg-gradient-to-r from-cyan-500/20 to-blue-600/12 text-white shadow-[inset_0_0_0_1px_rgba(6,182,212,0.3)]"
        : "text-slate-300 hover:bg-white/5 hover:text-white"
  );

  // Item desabilitado = <span> com aria-disabled="true"
  // Item ativo (link) = gradiente cyan→blue
  // Item inativo (link) = texto cinza com hover
}
```

#### Badges

- **"Em breve"** (desabilitado): `border-white/10 bg-white/5 text-slate-400`
- **"IA"** (ativo): `bg-gradient-to-r from-cyan-400 to-blue-600 text-white shadow-lg`

#### Layout (Desktop vs Mobile)

| Viewport | Renderização |
|----------|--------------|
| Desktop (≥768px) | Sidebar fixo à esquerda (288px), sticky top-0 |
| Mobile (<768px) | Menu hambúrguer com modal do sidebar |

---

### 3.2 Página de Apostilas (`src/app/(dashboard)/apostilas/page.tsx`)

**Função:** Listar apostilas do aluno, agrupadas por matéria (do concurso selecionado).

#### Fluxo de Dados

```
1. Page (server component)
   ├─ auth() → sessão
   ├─ getProfile(userId) → profile.contest_id + profile.position_id
   ├─ SELECT contests WHERE id=profile.contest_id → contestName
   ├─ listSubjectsByDocuments(userId) → [{ subjectId, subjectName, subjectColor, documents: [...] }]
   └─ Passa para <ApostilasList> (client component)

2. ApostilasList (client component)
   ├─ State: filters (subject, search), favorites
   ├─ useMemo: subjectFilter (memoiza itens por matéria)
   ├─ Renderiza grid de cards
   └─ Card clicável → /apostilas/[id]/visualizar
```

#### Componentes

**ApostilasList** (`src/components/apostilas/apostilas-list.tsx`):
- Filtros: por matéria, busca por título
- Cards: cor da matéria, ícone de favorito (estrela), barra de progresso, datas
- Modal de detalhes (opcional)
- Link para visualizar/estudar

**Card**:
```tsx
<Card>
  <CardHeader>
    <div style={{ backgroundColor: subjectColor }} className="h-1 rounded" />
    <CardTitle>{document.title}</CardTitle>
    <CardDescription>{subjectName}</CardDescription>
  </CardHeader>
  <CardContent>
    <Button onClick={() => toggleFavorite(document.id)}>
      <Heart className={isFavorite ? "fill-current" : ""} />
    </Button>
    <Progress value={progressPercent} />
    <span>{document.status}</span>
  </CardContent>
  <CardFooter>
    <Link href={`/apostilas/${document.id}/visualizar`}>Ver apostila</Link>
  </CardFooter>
</Card>
```

#### API: Favoritos

**POST `/api/knowledge/documents/[id]/favorite`**

```http
POST /api/knowledge/documents/{documentId}/favorite
Authorization: Bearer <token>
Content-Type: application/json

{
  "isFavorite": true
}

Response: 200
{
  "document": {
    "id": "...",
    "is_favorite": true,
    ...
  }
}
```

---

### 3.3 Catálogo de Cursos

**Status:** Placeholder "Em breve"  
**Implementação:** Item no sidebar com `disabled: true` e badge "Em breve"

```tsx
{
  href: "/catalogo",
  label: "Catálogo de Cursos",
  icon: Compass,
  badge: "Em breve",
  disabled: true,
}
```

**Investigação Realizada:**
- Verificado: NÃO existe tela de catálogo de concursos para o aluno
- Único lugar onde aluno escolhe concurso: `/perfil` (via `listPublishedContests()`)
- Admin: `/admin/concursos` (exclusivo)
- Conclusão: "Catálogo de Cursos" seria uma tela para o aluno explorar e escolher concursos → ainda não foi implementada como funcionalidade real

---

## 4. Camada de Repositório & DTO

### 4.1 Document Repository

**Arquivo:** `src/lib/knowledge/repositories/document.repository.ts`

#### Métodos Implementados

```ts
export const DocumentRepository = {
  // Leitura
  async findById(id: string): Promise<Document | null>,
  async listByStorageBackend(backend: string, limit: number, offset: number),
  
  // Escrita
  async updateFavorite(id: string, isFavorite: boolean),
  async updateMetadata(id: string, metadata: Record<string, unknown>),
  async updatePipeline(id: string, patch: Partial<Document>),
  async updateStorageBackend(id: string, backend: string),
  async updateAssociations(id: string, { editalId, positionId }),
  
  // Deleção
  async softDelete(id: string),
};
```

#### updateFavorite (Novo)

```ts
async updateFavorite(id: string, isFavorite: boolean) {
  return db
    .update(documents)
    .set({ isFavorite })
    .where(eq(documents.id, id))
    .returning();
}
```

### 4.2 Junction Repository

**Arquivo:** `src/lib/knowledge/repositories/junction.repository.ts`

#### Método Renovado

**listSubjectsByDocuments** — agora retorna cor da matéria

```ts
export async function listSubjectsByDocuments(userId: string) {
  return db
    .select({
      subjectId: knowledgeSubjects.id,
      subjectName: knowledgeSubjects.name,
      subjectColor: knowledgeSubjects.color,  // <-- NOVO
      documents: sql`json_agg(...)`,
    })
    .from(documentSubjectJunction)
    .innerJoin(documents, eq(documents.id, documentSubjectJunction.documentId))
    .innerJoin(knowledgeSubjects, eq(knowledgeSubjects.id, documentSubjectJunction.subjectId))
    .where(eq(documents.userId, userId))
    .groupBy(knowledgeSubjects.id, knowledgeSubjects.name, knowledgeSubjects.color);
}
```

### 4.3 DTO (Knowledge)

**Arquivo:** `src/lib/dto/knowledge.dto.ts`

#### DocumentDto Schema (Zod)

```ts
export const DocumentDtoSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  title: z.string(),
  storage_backend: z.enum(["r2", "supabase"]).optional().default("supabase"),
  storage_path: z.string(),
  type: z.enum(["txt", "pdf", "html", "md"]),
  status: z.enum(["pending", "processing", "processed", "chunked", "indexing", "indexed", "failed"]),
  is_favorite: z.boolean().default(false),  // <-- NOVO
  metadata: z.record(z.unknown()).optional(),
  file_size: z.number(),
  mime_type: z.string(),
  page_count: z.number().nullable(),
  chunk_count: z.number().default(0),
  embedding_count: z.number().default(0),
  processing_error: z.string().nullable(),
  edital_id: z.string().uuid().nullable(),
  position_id: z.string().uuid().nullable(),
  source_type: z.enum(["upload", "edital", "url"]).default("upload"),
  source_url: z.string().nullable(),
  external_id: z.string().nullable(),
  processed_at: z.date().nullable(),
  deleted_at: z.date().nullable(),
  created_at: z.date(),
  updated_at: z.date(),
});

export type DocumentDto = z.infer<typeof DocumentDtoSchema>;
```

---

## 5. APIs Implementadas

### 5.1 Upload de Apostila (Existente)

**POST `/api/knowledge/upload`**

- Autenticação: Obrigatória
- Autorização: **Admin ou Professor** (PROFESSOR_EMAILS env)
- Rate Limit: 10/h (free), 50/h (pro), 100/h (intensivo)
- Validação: tipo de arquivo, conteúdo vs. extensão

#### Fluxo

```
1. Auth + FORBIDDEN check (admin/professor)
2. FormData parse: file, subject_id, edital_id, position_id, transformar
3. IngestionService.ingest() → validação + registro no banco
4. DocumentStorageService.upload() → R2 (via storage_backend)
5. DocumentPipelineService.processDocument() → extração, chunking, embedding
6. ApostilaTransformService.transformDocument() → (opcional, transformar=true)
7. DocumentSubjectRepository.upsert() → matéria
8. DocumentRepository.updateAssociations() → edital/cargo
9. Resposta: DTO do documento (201)
```

#### Error Handling

| Erro | Status | Mensagem |
|------|--------|----------|
| Não autenticado | 401 | "Não autorizado" |
| Aluno (não-admin) | 403 | "FORBIDDEN" |
| Arquivo não encontrado | 400 | "Arquivo não encontrado" |
| INVALID_TYPE | 400 | "Tipo de arquivo não permitido" |
| INVALID_CONTENT | 400 | "Conteúdo do arquivo não corresponde" |
| DUPLICATE_FILE | 409 | "Arquivo duplicado" |
| QUOTA_EXCEEDED | 413 | "Cota excedida" |
| FILE_TOO_LARGE | 413 | "Arquivo muito grande" |
| RATE_LIMIT_EXCEEDED | 429 | "Limite de uploads excedido" |
| UPLOAD_FAILED | 500 | "Erro no armazenamento" |

### 5.2 Favoritos (Novo)

**POST `/api/knowledge/documents/[id]/favorite`**

```http
POST /api/knowledge/documents/{documentId}/favorite
Authorization: Bearer <token>
Content-Type: application/json

{
  "isFavorite": true
}

Response: 200 OK
{
  "document": { ...DocumentDto }
}
```

**Fluxo:**
1. Auth obrigatória
2. Verificar documento pertence ao usuário
3. Atualizar `is_favorite` no banco
4. Retornar documento atualizado (DTO)

---

## 6. Testes & Validação

### 6.1 Correção de Falhas Pre-existentes

**Arquivo:** `src/app/api/knowledge/upload/__tests__/api-knowledge-upload.test.ts`

#### Problema Original

O route usa `AdminGuardService.isProfessorOrAdmin()` para autorização. O teste mockava apenas `isAdminEmail()`. Como o mock preservava métodos reais via spread operator, `isProfessorOrAdmin()` chamava `isSuperadminEmail()` (real, consulta banco), que lançava erro → `.catch(() => false)` retornava false → 403 em vez de 201/400.

#### Solução

Atualizar mock para `isProfessorOrAdmin()` (o método real usado pelo route):

```ts
const mockIsProfessorOrAdmin = vi.fn();
vi.mock("@/lib/administration/services/admin-guard.service", async (importOriginal) => {
  const actual = await importOriginal<...>();
  return {
    ...actual,
    AdminGuardService: {
      ...actual.AdminGuardService,
      isProfessorOrAdmin: (...a: unknown[]) => mockIsProfessorOrAdmin(...a),
    },
  };
});
```

Atualizar 4 referências de `mockIsAdminEmail` → `mockIsProfessorOrAdmin`.

#### Resultado

- ✅ Test file: 5/5 testes passaram
- ✅ Suite completa: 74 arquivos, 746 testes, **0 falhas**

### 6.2 Build & Validação

| Ferramenta | Resultado | Detalhes |
|-----------|-----------|----------|
| `tsc --noEmit` | ✅ PASS | Sem erros TypeScript |
| `eslint` | ✅ PASS | Sem erros lint |
| `npm run build` | ✅ PASS | 26.7s, TS 99s, 92/92 páginas |
| `vitest run` | ✅ PASS | 746 testes, 0 falhas |

---

## 7. Arquitetura & Decisões de Design

### 7.1 Pattern: Sidebar Navegação

**Decisão:** Usar componente reutilizável `NavLink` que detecta se deve ser `<Link>` ou `<span>` baseado no atributo `disabled`.

**Vantagem:**
- Consistent UX (mesmo visual para ambos)
- Acessibilidade via `aria-disabled="true"`
- Separação clara entre clicável e não-clicável

**Implementação:**

```tsx
if (item.disabled) {
  return <span className={classes} aria-disabled="true" title="Em breve">{content}</span>;
}
return <Link href={item.href} className={classes}>{content}</Link>;
```

### 7.2 Pattern: Storage Backend Explícito

**Decisão:** Usar `STORAGE_BACKEND=r2` variável de ambiente **obrigatória** em produção, com fallback para Supabase em desenvolvimento.

**Implementação:**

```ts
export function resolveStorageBackend(env: NodeJS.ProcessEnv): "r2" | "supabase" {
  const backend = env.STORAGE_BACKEND ?? "supabase";
  if (env.NODE_ENV === "production" && backend !== "r2") {
    throw new Error("[FATAL] STORAGE_BACKEND must be 'r2' in production");
  }
  return backend as "r2" | "supabase";
}
```

**Vantagem:**
- Fail-fast em produção se backend não configurado
- Dev-friendly com fallback
- Documentado na .env.example

### 7.3 Pattern: DTO com Zod

**Decisão:** Validar schema de documento via Zod, type-safe mapping.

**Implementação:**

```ts
export function mapDocumentToDto(doc: unknown): DocumentDto {
  return DocumentDtoSchema.parse(doc);
}
```

**Vantagem:**
- Runtime validation
- Type safety (TypeScript + Zod)
- Fácil refatoração futura

### 7.4 Pattern: Soft Delete

**Decisão:** Usar `deleted_at` para marcar exclusão lógica (não remover da DB).

**Implementação:**

```ts
.where(and(eq(documents.id, id), isNull(documents.deletedAt)))
```

**Vantagem:**
- Recuperação possível
- Auditoria preservada
- Sem cascata de exclusões

---

## 8. Alterações de Código-Fonte

### 8.1 Arquivos Modificados

| Arquivo | Mudança | Tipo |
|---------|---------|------|
| `src/components/layout/app-sidebar.tsx` | Redesign do sidebar | Componente |
| `src/app/(dashboard)/apostilas/page.tsx` | Integração de favoritos | Page |
| `src/components/apostilas/apostilas-list.tsx` | UI redesignada + favoritos | Componente |
| `src/db/schema/knowledge.ts` | Adição de `is_favorite` | Schema |
| `src/lib/dto/knowledge.dto.ts` | Mapping de `is_favorite` | DTO |
| `src/lib/knowledge/repositories/document.repository.ts` | `updateFavorite()` + `updateStorageBackend()` | Repository |
| `src/lib/knowledge/repositories/junction.repository.ts` | `listSubjectsByDocuments()` retorna cor | Repository |
| `src/app/api/knowledge/upload/__tests__/api-knowledge-upload.test.ts` | Mock de `isProfessorOrAdmin` | Testes |

### 8.2 Arquivos Criados

| Arquivo | Conteúdo | Tipo |
|---------|----------|------|
| `src/app/api/knowledge/documents/[id]/favorite/route.ts` | API de favoritos | Route (criado anteriormente) |

---

## 9. Fluxos de Usuário

### 9.1 Aluno Navegando pelo Sidebar

```
1. Acessa /dashboard
2. Sidebar renderiza com navItems (8 itens) + extraItems (3 itens)
3. Item atual destacado com gradiente cyan→blue
4. "Catálogo de Cursos" e "Simulados" aparecem desabilitados (text-slate-500)
5. Clica em "Minhas Apostilas"
   → Navega para /apostilas
   → Vê cards agrupadas por matéria (cor da matéria)
   → Clica em ❤️ para favoritar
   → POST /api/knowledge/documents/{id}/favorite com isFavorite=true
   → Card atualiza (❤️ fica preenchido)
6. Clica em card
   → Navega para /apostilas/{id}/visualizar
   → Vê transformado (se disponível) ou PDF/HTML bruto
```

### 9.2 Admin/Professor Enviando Apostila

```
1. Acessa /professor-apostilas (sidebar)
2. Vê formulário de upload
3. Seleciona arquivo + matéria + edital (opcional)
4. Marca checkbox "Transformar em fases com marca DeepSeek" (opcional)
5. Clica "Enviar"
   → POST /api/knowledge/upload
   → IngestionService valida arquivo
   → DocumentStorageService faz upload para R2
   → DocumentPipelineService processa (extração, chunking, embedding)
   → (Opcional) ApostilaTransformService transforma layout
   → Documento salvo no banco com status "pending" → "processed"
   → Toast: "Apostila enviada com sucesso!"
6. Pode visualizar em /professor-apostilas
   → Link para /apostilas/{id}/visualizar
```

---

## 10. Considerações de Performance

### 10.1 Frontend

| Aspecto | Implementação |
|--------|-----------------|
| Sidebar | Fixed position, sticky top-0 (desktop) |
| Apostilas grid | Lazy loading de imagens (img lazy) |
| Favoritos | Mutation otimista (UI atualiza antes de API) |
| Search/Filter | useMemo para evitar re-renders |

### 10.2 Backend

| Aspecto | Implementação |
|--------|-----------------|
| Storage | R2 (CDN global, replicação automática) |
| DB | Índices em `user_id`, `deleted_at`, `status` |
| API | Rate limiting por plano (10/50/100 uploads/h) |
| Embedding | Async pipeline, falha não quebra upload |

---

## 11. Segurança

### 11.1 Autorização

| Recurso | Regra |
|---------|--------|
| Upload | Admin + Professor (PROFESSOR_EMAILS env) |
| Favoritos | Aluno pode favoritar seus próprios docs |
| Visualizar | Aluno pode visualizar seus próprios docs |
| Admin area | Admin + Superadmin (ADMIN_EMAILS env) |

### 11.2 Storage

| Medida | Implementação |
|--------|-----------------|
| Path Traversal | Nomes sanitizados via IngestionService |
| CORS | R2 configurado com origem única (app.becotoy.com) |
| Assinatura | Requisições R2 assinadas (AWS SigV4) |
| Soft Delete | Deletados não acessíveis via API |

---

## 12. Próximas Etapas & Backlog

### 12.1 Itens "Em breve" (Sidebar)

1. **Catálogo de Cursos** — tela para aluno explorar/escolher concursos
2. **Simulados** — simulados adaptativos com feedback IA

### 12.2 Melhorias Futuras

1. Validação de documento transformado (layout em fases)
2. Cache de transformados (salvar HTML em R2)
3. Favoritos compartilhados (turmas)
4. Histórico de downloads (auditoria)
5. Integração com plataforma de redação (Scratch)

---

## 13. Deploy & Produção

### 13.1 VPS Ativo

```
Host: 137.131.179.48
User: ubuntu
App Path: /opt/apps/plataformadeestudo
Port: 3001 (health check: 127.0.0.1:3001)
URL: https://app.becotoy.com
SSH Key: ~/.ssh/ssh-key-2026-05-27.key
Alias: concursoai-vps
```

### 13.2 Deployment Recente (Task C)

- ✅ 4 fases de risco deployadas
- ✅ Landing page redesenhada
- ✅ Transformação de apostilas ativa
- ✅ Health check OK
- ⏳ Google OAuth credentials (PENDING user action)
- ⏳ GitHub Actions secrets (PENDING: VPS_HOST, VPS_USER, VPS_SSH_KEY, VPS_PORT)

### 13.3 Environments

```
Production:  .env.production
            - DATABASE_URL (Supabase)
            - STORAGE_BACKEND=r2 (obrigatório)
            - PROFESSOR_EMAILS (comma-separated)
            - ADMIN_EMAILS
            
Development: .env.local / .env
            - DATABASE_URL (local ou Supabase dev)
            - STORAGE_BACKEND=supabase (ou r2)
            - PROFESSOR_EMAILS
            - ADMIN_EMAILS
```

---

## 14. Referências de Código

### 14.1 Imports Principais

```ts
// Sidebar
import { AppSidebar, SidebarNav, SidebarBrand } from "@/components/layout/app-sidebar";

// Apostilas
import { ApostilasList } from "@/components/apostilas/apostilas-list";
import { listSubjectsByDocuments } from "@/lib/knowledge/repositories/junction.repository";

// Repository
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";

// DTO
import { DocumentDtoSchema, mapDocumentToDto } from "@/lib/dto/knowledge.dto";

// Auth & Guards
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";

// Storage
import { DocumentStorageService } from "@/lib/knowledge/storage.service";
import { resolveStorageBackend } from "@/lib/knowledge/storage/backend";

// AI
import { ApostilaTransformService } from "@/lib/knowledge/services/apostila-transform.service";
```

### 14.2 Routes Principais

```
Student Routes:
  /dashboard                      → Dashboard
  /apostilas                      → Lista de apostilas
  /apostilas/[id]/visualizar      → Visualizar apostila
  /cronograma                     → Trilhas estratégicas
  /questoes                       → Caderno de questões
  /analises                       → Monitor de performance
  /perfil                         → Preferências
  /flashcards                     → Flashcards
  /professor                      → Chat com IA
  /redacao                        → Corretor de redação
  /aulas                          → Aulas

Professor Routes:
  /professor-apostilas            → Upload de apostilas

Admin Routes:
  /admin                          → Dashboard administrativo
  /admin/apostilas                → Gerenciar apostilas
  /admin/concursos                → Gerenciar concursos
  /admin/questoes                 → Gerenciar questões
  /admin/materias                 → Gerenciar matérias

API Routes:
  POST   /api/knowledge/upload                      → Upload
  POST   /api/knowledge/documents/[id]/favorite     → Favoritar
  GET    /api/knowledge/documents/[id]/transformado → Transformado HTML
  POST   /api/knowledge/documents/[id]/transformar  → Transformar IA
  POST   /api/auth/callback/credentials             → Login
  GET    /api/health                                → Health check
```

---

## 15. Documentação Associada

- `docs/01-PRD.md` — Product Requirements
- `docs/02-SDD.md` — Design anterior (agora atualizado neste documento)
- `docs/03-AIDD.md` — AI/DeepSeek
- `docs/05-API.md` — API Documentation
- `docs/08-DATABASE-PHYSICAL.md` — Schema físico
- `docs/14-PROMPTS.md` — Prompts de IA
- `docs/20-CONTEST-IMPLEMENTATION-MAP.md` — Roadmap de implementação
- `docs/23-CATALOGO-PROVENIENCIA-E-VOCABULARIO.md` — proveniência e vocabulário do catálogo
- `docs/24-CATALOGACAO-HISTORICA-CBMERJ-2021.md` — edital histórico medido, não retranscrito
- `docs/27-VOCABULARIO-EM-CODIGO-E-MEDIDA-CALIBRADA.md` — o que virou código e a medida calibrada

---

## 16. Atualização 2026-10-03 — catálogo (FASE 4) em código, nenhuma escrita
Escopo: transformar em código o que `docs/23` deixava em prosa e calibrar a medida de
`docs/24`. Justificativas e números completos em `docs/27`.
- **Vocabulário de assunto** (`src/lib/catalog/services/catalog-subject-vocabulary.ts`):
  `Língua Portuguesa` → `Português` e `Matemática e Raciocínio Lógico` → `Matemática`;
  `Conhecimentos Específicos` e `Conhecimentos Básicos` registrados como cabeçalhos sem alvo.
  Alias resolve assunto e nunca renomeia linha canônica.
- **Matcher** usa o vocabulário como linha de base; alias do caller tem precedência. O contrato
  está fixado em `catalog-matcher.service.test.ts` (15 testes, snapshot sintético, sem banco).
- **Normalizador e detectores de colisão**: precedência única em `classifyCollision`,
  `collisionId` estável por `kind + chave`, comparadores separados para pontuação contra
  caixa/acento. Todo grupo devolve `deduplicated: false` e `discardedEntries: 0`.
- **Medida calibrada do CBMERJ-2021** (278 unidades contra o snapshot de 33 assuntos e 31
  tópicos): 9 `REUSO_CANONICO`, 127 `NOVO_CANONICO`, 78 `PENDENTE_REVISAO`,
  64 `BLOQUEADO` (só `Conhecimentos Específicos`), 0 `AMBIGUO`; 78 grupos de colisão
  `NORMALIZED_NAME` sobre 220 unidades; 0 acordo de chave completa.
- **Apply segue recusado**: `APPLY_DISABLED_IN_AUDIT_PHASE`, `databaseOperations: []`, inclusive
  com `force`/`skip-review`. `db:push`, `db:seed` e `db:migrate` continuam bloqueados por guard
  até existir banco de teste isolado.
- **Validação**: 1134 testes passando em 103 arquivos (6 expected fail já registrados),
  `tsc --noEmit` limpo, `eslint src/lib/catalog` limpo; catálogo: 62 testes em 4 arquivos.
- **Pendente**: a FASE 3B (revisão humana de vocabulário e vínculo) pertence a `docs/26`, que
  ainda não existe.
---
## 17. Atualização 2026-10-03 — CourseCatalogAgent (FASE 4B): entrada de novo curso
Escopo: transformar o esqueleto da FASE 4 em fluxo utilizável de auditoria — fatos de edital,
proposta DeepSeek, rota administrativa, fixture de concurso novo. Justificativa e números completos
em `docs/28`. `docs/26` continua reservado à FASE 3B (revisão humana) e não foi criado.
- **Agente** (`src/lib/catalog/agents/course-catalog-agent.ts`): `analyze()` mapeia a borda, chama o
  `run()` da FASE 4 intacto, mede fatos de edital e projeta proposta revisável; `snapshotReader` é
  costura de leitura para teste — sem banco, sem rede.
- **Fatos de edital** (`src/lib/catalog/services/contest-facts.service.ts`): banca, órgão, nível,
  vagas, questões, data, nome do concurso e cargo, cada um com `start`/`end`/`page`; regras
  CONTEST-01…CONTEST-10, e `CONTEST-DECLARED-01` marca declaração do caller como
  `DETERMINISTIC_MAPPING`. Campo sem âncora publicada cai em `missingFields`.
- **DeepSeek** (`src/lib/catalog/services/deepseek-catalog-ai-client.ts`): adapter da porta
  `CatalogAiClient` sobre o `DeepSeekProvider` que já existia; mesma `DEEPSEEK_API_KEY`, modelo
  `flash`, temperatura 0, teto de 45 s. Sem chave, a fábrica devolve `null` e a seção fica
  `AI_CLIENT_UNAVAILABLE`. IA é anotação: `AI_OVERREACH`, `AI_SCHEMA_INVALID`,
  `AI_PROVIDER_FAILED` e `INVALID_AI_PROPOSAL` viram rejeição, nunca mudança de classificação.
- **Rota** `POST /api/admin/catalog/analyze` (exige sessão de admin): `AUDIT` executa; fonte sem
  proveniência auditável devolve 422 `SOURCE_REFUSED`; `APPLY` é aceito apenas para ser recusado. A
  resposta traz `applyStatus: "BLOCKED"`, `apply.code` = `APPLY_DISABLED_IN_AUDIT_PHASE`,
  `databaseOperations: []` e `report` legível.
- **Medida**: CBMERJ-2021 pelo agente reproduz a calibração de `docs/27` sem mover um número (278
  unidades; 9 `REUSO_CANONICO`, 127 `NOVO_CANONICO`, 0 `AMBIGUO`, 64 `BLOQUEADO`, 78
  `PENDENTE_REVISAO`; 78 grupos de colisão sobre 220 unidades). A fixture sintética
  `novo-curso-2026` cobre reuso canônico, near-miss semântico, tópico novo, cinco tipos de colisão,
  disciplina inexistente bloqueada e fragmento derivado que nunca vira reuso.
- **Validação**: 123 testes em 8 arquivos de catálogo/rota; suíte completa 1195 passando, 6 expected
  fail, 29 skipped; `tsc --noEmit` limpo; `eslint src/lib/catalog src/app/api/admin/catalog
  --max-warnings=0` limpo. Nenhuma escrita em banco, nenhuma migração, nenhum seed, nenhuma
  requisição de rede, nenhum `.env` alterado.

---
## 18. Atualização 2026-10-05 — aprovação humana da análise (FASE 5): contrato, sem escrita
Escopo: transformar "revisão humana pendente" de frase em registro assinado por digest. Justificativa
e tabelas completas em `docs/29`. `docs/26` continua reservado à FASE 3B e não foi tocado.
- **Contrato** (`src/lib/catalog/types/catalog-approval.ts`): `CatalogApproval` sem `updatedAt`, sem
  `deletedAt` e sem UPDATE; status exatamente `"aprovado" | "rejeitado"` em minúsculo, sem `pendente`
  persistido — ausência de registro é que significa "não decidido"; corrigir é novo registro com
  `supersedesApprovalId`. O status de `documents.review_status` é de outro domínio (vive em coluna, com
  máquina de estados própria) e não foi importado.
- **Digest compartilhado** (`src/lib/catalog/services/catalog-digest.ts`): `sha256Hex` subiu do
  validador de fonte para este módulo, que só importa `server-only` e `node:crypto`;
  `source-validator.service.ts` importa e re-exporta o símbolo, preservando a API que os testes da
  FASE 4 já usam. Os dois hashes fora do domínio catálogo (`scripts/migrate-storage-r2.mjs`,
  `src/lib/knowledge/storage/migrate-classifier.ts`) ficaram onde estavam.
- **Vínculo triplo** (`src/lib/catalog/services/catalog-approval.service.ts`): `analysisDigest` é cópia
  de `provenance.analysedTextSha256` (não é rederivado); `proposalId` é `PRP-` mais 24 hex de
  `sha256(agente|fase|schema|analysisDigest)`; `proposalDigest` é o sha256 do canonical JSON da
  projeção; `approvalId` é `APR-` mais 32 hex do registro menos o próprio id. O canonical ordena
  chaves por unidade UTF-16, omite `undefined` e recusa `Date`, `Map`, `Set`, classe, função, symbol,
  bigint, `NaN` e `Infinity`.
- **Projeção de decisão:** entra o que o humano aprovou — concurso declarado e publicado, sem slug
  inventado (`CatalogContestProfile` não tem `slug`), disciplinas, tópicos, casamentos, colisões,
  conflitos de decisão e resumo recalculado sobre a lista filtrada. Ficam fora `audit.*` (relógio e
  custo), `report`, `aiProposal`, `aiAssist` por linha, `apply`, `applyStatus`, `requestedMode`, nota
  de borda e os conflitos `INVALID_AI_PROPOSAL`, `AI_OVERREACH` e `APPLY_DISABLED_IN_AUDIT_PHASE`.
  Reexecutar o DeepSeek com outra saída não invalida a decisão de um humano sobre as regras
  determinísticas.
- **Gate em memória:** `buildApprovalGate` devolve `approved`, `status`, `approval`, os três vínculos
  e `issues`; `findCurrentApproval` percorre a cadeia por supersessão, não por relógio, e reporta
  `SUPERSEDES_SELF`, `SUPERSEDES_UNKNOWN`, `SUPERSEDES_CYCLE` e `SUPERSEDES_AMBIGUOUS`. A aprovação é
  da **análise inteira**: `SUB-`, `TOP-` e `AIP-` seguem identificadores de linha, nunca de decisão.
- **APPLY continua bloqueado:** `approved: true` é condição necessária, não suficiente.
  `catalog-apply.service.ts`, `course-catalog-agent.ts`, `catalog-analysis.ts`, a rota `analyze` e
  `src/db/**` não foram tocados; nenhuma rota ou UI de aprovação foi criada.
- **Validação:** 192 testes em 11 arquivos de catálogo e rota (7 de digest, 54 de aprovação unitários,
  8 de integração sobre payload real do agente, 123 anteriores da FASE 4/4B intactos); `tsc --noEmit`
  limpo; `eslint src/lib/catalog src/app/api/admin/catalog --max-warnings=0` limpo; `git diff --check`
  sem whitespace. Nenhuma escrita em banco, nenhuma migration, nenhum seed, nenhuma requisição de
  rede, nenhum `.env` alterado, nenhum commit, nenhum push.
- **Suíte global do repositório:** `npx vitest run --reporter=dot` fechou a fase com 121 arquivos
  (110 passando, 11 de integração pulados) e 1299 testes (1264 passando, 6 marcados como
  esperado-falhar, 29 pulados), exit 0. Os pulados são a prova de que nada falou com banco:
  `src/integration/helpers.ts` define `hasDb` por `isNonProductionDatabaseUrl(DATABASE_URL)`
  e desliga os arquivos com `describe.skipIf` enquanto não há banco de teste isolado.

---
## Apêndice: Checklist de Validação

- [x] Sidebar redesenhado (padrão "Estratégia Concursos")
- [x] "Catálogo de Cursos" adicionado como "Em breve"
- [x] "Simulados" já presente como "Em breve"
- [x] Apostilas com suporte a favoritos (is_favorite)
- [x] API de favoritos implementada
- [x] Página de apostilas redesignada
- [x] Cor de matéria no card
- [x] Storage backend = R2 (explícito)
- [x] Documentação de storage
- [x] Testes de upload corrigidos (3 falhas → 0)
- [x] Typecheck pasado (tsc --noEmit)
- [x] Lint passado (eslint)
- [x] Build passado (npm run build)
- [x] Suíte de testes passada (746/746)
- [x] Visualização em desktop (1440px) validada
- [x] Visualização em mobile (menu hambúrguer) validada
- [x] SDD completo documentado

---

**Documento Finalizado em:** 2026-08-30  
**Próxima Revisão:** Quando novas features forem implementadas

