# 21 — Funções do Dashboard Administrativo (ConcursoAI)

> **Objetivo deste documento:** Descrever, de forma completa e estruturada, **todas as funções** que um administrador tem no dashboard do ConcursoAI. Este documento foi gerado para que outra IA possa analisar o escopo administrativo da plataforma.

**Data:** 2026-08-22
**Escopo:** Área `/admin` — painel administrativo completo.

---

## 1. Visão Geral da Área Admin

### 1.1 Proteção de acesso (gatekeeper)

Toda a área `/admin` é protegida pelo layout raiz `src/app/admin/layout.tsx`, que:

1. Chama `auth()` (NextAuth) e redireciona para `/login` se não houver sessão.
2. Chama `AdminGuardService.isAdminEmail(session.user.email)` — verifica se o e-mail está na **allowlist** (variável `ADMIN_EMAILS` + `system_settings['admin.emails']`).
3. Se não for admin, redireciona para `/dashboard`.
4. Renderiza o `AdminShell` (sidebar lateral + topo com breadcrumb e avatar).

> **Importante:** Como a proteção está no layout raiz, **todos os subdiretórios** (`alunos`, `apostilas`, `questoes`, etc.) herdam essa proteção automaticamente. Não há proteção individual por página.

### 1.2 Níveis de acesso

| Nível | Descrição | Acesso |
|---|---|---|
| **Admin** | Operador administrativo padrão | Toda a área `/admin` |
| **Superadmin** | Nível mais alto; gerencia a allowlist de admins | Tudo que o admin + página `/admin/admins` |

> O superadmin **herda** todos os privilégios de admin. A diferença é que apenas superadmins podem gerenciar a lista de administradores (adicionar/remover admins e superadmins).

### 1.3 Navegação (sidebar)

| Grupo | Itens |
|---|---|
| **Visão geral** | Dashboard |
| **Pessoas** | Alunos |
| **Concursos** | Concursos/Editais, Edital IA, Importar (URL), Intelligence |
| **Conteúdo** | Matérias, Apostilas, Revisão material, Fontes externas, Aulas, Avatares |
| **Questões** | Questões, Gerar questões, Importar questões, Revisão |
| **Sistema** | IA, Administradores (superadmin) |

---

## 2. Dashboard Principal (`/admin`)

Página `force-dynamic` que chama `AdminDashboardRepository.stats()` e exibe **10 cards clicáveis** com números reais:

| Card | Link | Observação |
|---|---|---|
| Alunos | `/admin/alunos` | — |
| Concursos | `/admin/concursos` | — |
| Editais | `/admin/concursos` | — |
| Apostilas | `/admin/apostilas` | — |
| Apostilas com erro | `/admin/apostilas` | Alerta âmbar se > 0 |
| Questões | `/admin/questoes` | — |
| Aguardando revisão | `/admin/questoes/revisao` | Alerta âmbar se > 0 |
| Aulas | `/admin/aulas` | — |
| Avatares | `/admin/avatares` | — |
| Mensagens IA | `/admin/ia` | — |

Exibe também um **banner de alertas**: apostilas com erro, questões pendentes, e dependência de variáveis de ambiente (`DEEPSEEK_API_KEY` / `EMBEDDING_API_URL`).

---

## 3. Módulo: Alunos (`/admin/alunos`)

**Função:** Lista os usuários registrados (até 200) com email, nível, número de questões respondidas e data de cadastro.

**Ações do admin:**
- **Visualização apenas** — não há CRUD, botões ou formulários. É uma tabela read-only.

**Dados consultados:** `authUsers` + `profiles` (left join) e `questionAttempts` (contagem agrupada por usuário).

---

## 4. Módulo: Apostilas (`/admin/apostilas`)

**Função:** Lista apostilas (até 200) com título, tipo, status, status de revisão, chunks, páginas e link para detalhes.

**Ações do admin:**
- **Enviar apostila** (upload individual) — `ApostilaUploadForm`
- **Upload em lote** (múltiplos arquivos, matéria obrigatória) — `BatchUploadForm`
- **Ir para fila de revisão** (link)
- **Ver detalhes** de cada apostila (link)

**APIs usadas:**
- `GET /api/knowledge/subjects` (carregar matérias)
- `POST /api/knowledge/upload` (upload individual, FormData com `file` + `subject_id`)
- `GET /api/admin/subjects` (carregar matérias no batch)
- `POST /api/admin/apostilas/batch` (upload em lote, FormData com `subject_id` + `files[]`)

### 4.1 Subpágina: Detalhes da apostila (`/admin/apostilas/[id]`)

**Função:** Mostra detalhes de uma apostila: título, tipo, tamanho, status, contagem de chunks/embeddings/páginas, matérias associadas.

**Ações do admin:**
- **Reprocessar** apostila — `ApostilaActions`
- **Gerar questões** a partir da apostila (link → `/admin/questoes/gerar?document_id=`)
- **Revisar questões da apostila** (link → `/admin/questoes/revisao?document_id=`)

**APIs usadas:**
- `POST /api/knowledge/documents/{id}/process` (reprocessar)

### 4.2 Subpágina: Fila de revisão de material (`/admin/apostilas/revisao`)

**Função:** Lista documentos aguardando revisão (até 100) para conferir o texto extraído.

**Ações do admin:**
- **Aprovar** material
- **Rejeitar** material (com nota/motivo opcional)
- **Voltar para pendente** (se já foi aprovado/rejeitado)
- **Ver preview do texto extraído** (chunks)

**APIs usadas:**
- `POST /api/admin/documents/{id}/review` (body: `{ action: "aprovar"|"rejeitar"|"voltar_pendente", note }`)
- `GET /api/admin/documents/{id}/preview` (carregar chunks)

---

## 5. Módulo: Aulas (`/admin/aulas`)

**Função:** Lista aulas geradas (até 200) com título, capítulo, duração e status.

**Ações do admin:**
- **Gerar aula (roteiro) por IA** — `LessonGenerateForm`: seleciona apostila (status `chunked`/`indexed`), matéria, avatar (opcional) e capítulo (opcional).

**APIs usadas:**
- `GET /api/knowledge/documents` (carregar apostilas)
- `GET /api/knowledge/subjects` (carregar matérias)
- `GET /api/admin/avatares/list` (carregar avatares)
- `POST /api/admin/lessons/generate` (body: `{ document_id, subject_id, avatar_id?, chapter? }`)

---

## 6. Módulo: Avatares (`/admin/avatares`)

**Função:** Lista avatares (professores virtuais) em cards com nome, descrição, personalidade, aparência, voz e status ativo/inativo.

**Ações do admin:**
- **Criar avatar** — `AvatarCreateForm`: nome, slug, personalidade, voz.

**APIs usadas:**
- `POST /api/admin/avatares` (body: `{ nome, slug, personalidade, voz }`)

---

## 7. Módulo: Concursos (`/admin/concursos`)

**Função:** Página central de concursos, editais e cargos. Lista concursos (50), editais (100), cargos (100) e matérias do edital (200).

**Ações do admin:**
- **Cadastrar concurso** — `ContestCreateForm`: órgão, banca, título, descrição, status (rascunho/publicado/encerrado/arquivado), datas de início/fim.
- **Cadastrar órgão / banca** — `OrganBoardCreateForm`: tipo (organ/board) + nome.
- **Excluir (soft delete) concurso** — `ContestManager`: botão "Excluir" com confirmação.

**APIs usadas:**
- `GET /api/admin/organs-boards` (carregar catálogo de órgãos/bancas)
- `POST /api/admin/contests` (criar concurso)
- `POST /api/admin/organs-boards` (criar órgão/banca)
- `DELETE /api/admin/contests/{id}` (soft delete)

> **Nota:** O componente `PositionCreateForm` existe (`POST /api/admin/positions`) mas **não é usado** nesta página — é um componente disponível para uso futuro.

---

## 8. Módulo: Contest Intelligence (`/admin/contest-intelligence`)

**Função:** Análise de banca/edital (v1): distribuição de peso por matéria e padrão histórico da banca. Só exibe dados que existem no banco.

**Ações do admin:**
- **Analisar edital** — `ContestIntelligenceClient`: seleciona um edital importado e dispara a análise.

**APIs usadas:**
- `GET /api/admin/contest-intelligence?edital_id={id}` (retorna análise com matérias/pesos e histórico da banca)

---

## 9. Módulo: Editais — Importar edital (IA) (`/admin/editais/importar`)

**Função:** Importa um edital via IA: envia o PDF do edital (já processado em Apostilas) e extrai matérias/pesos automaticamente para aplicar no edital vigente.

**Ações do admin:**
- **Analisar com IA** — `EditalImport`: escolhe documento do edital (status `chunked`/`indexed`) e dispara a extração.
- **Ajustar pesos** das matérias extraídas (inputs numéricos).
- **Aplicar no edital** — vincula as matérias/pesos ao concurso destino.

**APIs usadas:**
- `POST /api/admin/editais/parse` (body: `{ document_id }` → retorna sugestões com banca, cargo, data e matérias/pesos)
- `POST /api/admin/editais/apply` (body: `{ document_id, contest_id, title?, banca, materias[] }`)

---

## 10. Módulo: Fontes (`/admin/fontes`)

**Função:** Biblioteca de fontes externas — lista materiais importados com origem/licença para rastreabilidade.

**Ações do admin:**
- **Editar fonte e licença** de cada material — `FontesList`: inputs de texto + botão "Salvar".

**APIs usadas:**
- `POST /api/admin/documents/{id}/fonte` (body: `{ fonte, licenca }`)

---

## 11. Módulo: IA (`/admin/ia`)

**Função:** Status da infraestrutura de IA (sem exibir segredos): configuração de DeepSeek, Kimi/Moonshot e Embeddings; lista de modelos Kimi disponíveis; uso acumulado (mensagens, tokens entrada/saída).

**Ações do admin:**
- **Visualização apenas** — não há formulários ou botões de ação.

**Dados consultados:**
- `KimiService.isConfigured()` e `KimiService.listModels()` (server-side)
- `aiUsage` (soma de mensagens/tokens)
- Variáveis de ambiente: `DEEPSEEK_API_KEY`, `EMBEDDING_API_URL`, `KIMI_API_KEY`, `KIMI_BASE_URL`

---

## 12. Módulo: Importar (`/admin/importar`)

**Função:** Importa conteúdo externo via URL (editais, leis, diários oficiais, provas anteriores).

**Ações do admin:**
- **Importar conteúdo externo (URL)** — `UrlImportForm`: URL, título (opcional), matéria (opcional).

**APIs usadas:**
- `GET /api/admin/subjects` (carregar matérias)
- `POST /api/admin/import/url` (body: `{ url, title?, subject_id? }`)

---

## 13. Módulo: Matérias (`/admin/materias`)

**Função:** Catálogo geral de matérias — lista com nome, slug, cor e status.

**Ações do admin:**
- **Cadastrar matéria** — `MateriaCreateForm`: nome, descrição (opcional), cor (color picker).

**APIs usadas:**
- `POST /api/admin/subjects` (body: `{ name, description?, color? }`)

---

## 14. Módulo: Questões (`/admin/questoes`)

**Função:** Lista questões (até 100) com filtros por status, matéria e banca (via query params). Mostra matéria, banca, nível, enunciado (truncado), origem e status.

**Ações do admin:**
- **Gerar questões** (link → `/admin/questoes/gerar`)
- **Revisão** (link → `/admin/questoes/revisao`)

**APIs usadas:**
- `ModerationRepository.listQuestions({ status, subjectId, banca, page, pageSize })` (server-side)

### 14.1 Subpágina: Gerar questões (`/admin/questoes/gerar`)

**Função:** Gera questões por IA a partir de uma apostila processada. As questões entram como **EM REVISÃO** (nunca publicadas automaticamente). Requer `DEEPSEEK_API_KEY`.

**Ações do admin:**
- **Gerar questões** — `QuestaoGenerateForm`: apostila (status `chunked`/`indexed`), matéria, quantidade (1–20), nível (fácil/médio/difícil), banca (opcional). Aceita `document_id` via query param.

**APIs usadas:**
- `GET /api/knowledge/documents` (carregar apostilas)
- `GET /api/knowledge/subjects` (carregar matérias)
- `POST /api/admin/questions/generate` (body: `{ document_id, subject_id, quantity, nivel, banca? }`)

### 14.2 Subpágina: Importar questões (`/admin/questoes/importar`)

**Função:** Importa questões prontas (CSV, XLSX ou JSON) com validação de formato. Questões entram em `em_revisão` e são deduplicadas por conteúdo.

**Ações do admin:**
- **Importar questões** — `QuestoesImportForm`: arquivo, matéria (obrigatória), banca/cargo/ano padrão (opcionais).
- **Baixar modelo CSV** (link para template).

**APIs usadas:**
- `GET /api/admin/subjects` (carregar matérias)
- `POST /api/admin/questions/import` (FormData: `file`, `subject_id`, `banca?`, `cargo?`, `ano?`)
- `GET /api/admin/questions/import/template` (baixar modelo CSV)

### 14.3 Subpágina: Revisão de questões (`/admin/questoes/revisao`)

**Função:** Fila de revisão de questões geradas por IA. Aceita `document_id` via query param para filtrar por apostila.

**Ações do admin:**
- **Aprovar** questão
- **Rejeitar** questão
- **Bloquear** questão

**APIs usadas:**
- `GET /api/admin/questions?status=em_revisao&source_document_id={id?}` (carregar fila)
- `POST /api/admin/questions/{id}/review` (body: `{ action: "aprovar"|"rejeitar"|"bloquear" }`)

---

## 15. Módulo: Administradores (`/admin/admins`) — **SUPERADMIN**

> **Novo módulo (FASE 5).** Apenas superadmins têm acesso. Redireciona para `/admin` se o usuário não for superadmin.

**Função:** Gerencia a allowlist de administradores e superadministradores da plataforma.

**Ações do superadmin:**
- **Listar** admins e superadmins atuais.
- **Adicionar admin** — informa e-mail + papel (`admin`).
- **Adicionar superadmin** — informa e-mail + papel (`superadmin`).
- **Remover admin** — remove e-mail da allowlist.
- **Remover superadmin** — remove e-mail da allowlist (bloqueado para si mesmo, evita lockout).

**Regras de negócio:**
- Valida formato de e-mail.
- Previne duplicados.
- Bloqueia auto-remoção de superadmin (evita ficar sem superadmin).
- Toda mutação é registrada em auditoria (`admin_action_logs`).

**APIs usadas:**
- `GET /api/admin/admins` — lista admins e superadmins (superadmin only).
- `POST /api/admin/admins` — body `{ email, role: "admin"|"superadmin" }` (superadmin only).
- `DELETE /api/admin/admins` — body `{ email, role }` (superadmin only; bloqueia auto-remoção).

**Persistência:** `system_settings` nas chaves `admin.emails` e `superadmin.emails`.

---

## 16. Resumo das APIs do Admin

### Endpoints `/api/admin/*`

| Endpoint | Métodos | Função |
|---|---|---|
| `/api/admin/admins` | GET, POST, DELETE | Gerenciar admins/superadmins (superadmin) |
| `/api/admin/apostilas/batch` | POST | Upload em lote de apostilas |
| `/api/admin/audit` | GET | Auditoria |
| `/api/admin/avatares` | GET, POST | Listar/criar avatares |
| `/api/admin/contest-intelligence` | GET | Análise de edital/banca |
| `/api/admin/contests` | GET, POST | Listar/criar concursos |
| `/api/admin/contests/[id]` | DELETE | Soft delete de concurso |
| `/api/admin/documents/[id]/fonte` | POST | Atualizar fonte/licença |
| `/api/admin/documents/[id]/preview` | GET | Preview de chunks |
| `/api/admin/documents/[id]/review` | POST | Aprovar/rejeitar material |
| `/api/admin/editais/apply` | POST | Aplicar matérias/pesos no edital |
| `/api/admin/editais/parse` | POST | Extrair estrutura do edital via IA |
| `/api/admin/fontes` | GET | Listar fontes externas |
| `/api/admin/import/url` | POST | Importar conteúdo por URL |
| `/api/admin/lessons/generate` | POST | Gerar aula por IA |
| `/api/admin/organs-boards` | GET, POST | Listar/criar órgãos e bancas |
| `/api/admin/positions` | GET, POST | Listar/criar cargos |
| `/api/admin/positions/[id]` | DELETE | Soft delete de cargo |
| `/api/admin/questions` | GET | Listar questões (com filtros) |
| `/api/admin/questions/[id]/review` | POST | Aprovar/rejeitar/bloquear questão |
| `/api/admin/questions/generate` | POST | Gerar questões por IA |
| `/api/admin/questions/import` | POST | Importar questões (CSV/XLSX/JSON) |
| `/api/admin/questions/import/template` | GET | Baixar modelo CSV |
| `/api/admin/settings` | GET, POST | Gerenciar configurações |
| `/api/admin/settings/[key]` | GET, DELETE | Ler/remover configuração |
| `/api/admin/subjects` | GET, POST | Listar/criar matérias |

### Endpoints `/api/knowledge/*` (usados pelo admin)

| Endpoint | Métodos | Função |
|---|---|---|
| `/api/knowledge/documents` | GET | Listar documentos |
| `/api/knowledge/documents/[id]` | GET, DELETE | Ler/remover documento |
| `/api/knowledge/documents/[id]/process` | POST | Reprocessar documento |
| `/api/knowledge/search` | POST | Busca vetorial |
| `/api/knowledge/subjects` | GET | Listar matérias |
| `/api/knowledge/topics` | GET | Listar tópicos |
| `/api/knowledge/upload` | POST | Upload de apostila |

---

## 17. Conclusões-chave

1. **Proteção centralizada:** Toda a área admin é protegida pelo `layout.tsx` raiz via `AdminGuardService.isAdminEmail` (allowlist de e-mails). Nenhuma página individual tem guard próprio — todas herdam do layout.
2. **Níveis:** Admin (operador) e Superadmin (gestor da allowlist). Superadmin herda todos os privilégios de admin.
3. **Auditoria:** Ações administrativas são registradas em `admin_action_logs`.
4. **Moderação:** Questões e materiais gerados por IA entram sempre em estado de revisão — nunca são publicados automaticamente.
5. **Sem segredos:** A página de IA não exibe chaves/segredos; apenas status de configuração.
