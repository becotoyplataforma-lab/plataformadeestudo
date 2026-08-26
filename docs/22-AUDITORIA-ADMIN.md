# 22 — Auditoria Detalhada do Dashboard Administrativo (ConcursoAI)

> **Objetivo:** Auditoria minuciosa de funcionalidades do painel admin, com mapeamento do que existe, análise de lacunas críticas de negócio e proposta de reestruturação diretamente aplicável ao código.

**Data:** 2026-08-26
**Escopo:** Área `/admin` — painel administrativo completo.
**Base:** Código real da aplicação (schema Drizzle, serviços, repositórios, páginas).

---

## PARTE 1 — MAPEAMENTO DE FUNÇÕES EXISTENTES

### 1.1 VISÃO GERAL: Dashboard (`/admin`)

**Responsabilidade esperada:** Ser o "cockpit" do negócio — mostrar a saúde operacional e financeira da plataforma em um relance.

**O que existe hoje** (`AdminDashboardRepository.stats()` + `src/app/admin/page.tsx`):
10 cards clicáveis com contagens reais:

| Card | Métrica | Fonte |
|---|---|---|
| Alunos | total de usuários | `count(authUsers)` |
| Concursos | concursos não deletados | `count(contests)` |
| Editais | editais não deletados | `count(editais)` |
| Apostilas | documentos não deletados | `count(documents)` |
| Apostilas com erro | docs com status `failed` | `count(documents)` |
| Questões | questões não deletadas | `count(questions)` |
| Aguardando revisão | questões `em_revisao`/`needsReview` | `count(questions)` |
| Aulas | aulas não deletadas | `count(lessons)` |
| Avatares | avatares não deletados | `count(avatars)` |
| Mensagens IA | **linhas de `ai_usage`** (não mensagens reais) | `count(aiUsage)` |

**KPIs que DEVERIAM estar no Dashboard principal (hoje ausentes):**
- **Financeiros:** MRR (receita recorrente mensal), assinaturas ativas, receita do mês, inadimplência, churn, LTV, novos pagamentos.
- **Operacionais:** alunos ativos (que usaram nos últimos 7/30 dias), taxa de conversão free→pago, consumo de tokens de IA, custo operacional de IA, questões geradas por IA vs. importadas.
- **Qualidade:** taxa de aprovação de questões na revisão, apostilas com erro, tempo médio de revisão.

---

### 1.2 PESSOAS: Alunos (`/admin/alunos`)

**Responsabilidade esperada:** Gestão completa do ciclo de vida do aluno — cadastro, plano, pagamento, acesso, bloqueio.

**O que existe hoje** (`src/app/admin/alunos/page.tsx`):
Tabela **somente leitura** com 4 colunas (limitada a 200 usuários):

| Coluna | Fonte |
|---|---|
| Email | `authUsers.email` |
| Nível | `profiles.level` |
| Questões respondidas | `count(questionAttempts)` |
| Cadastro | `profiles.createdAt` |

**Ações/funções que DEVERIAM existir (hoje ausentes):**
- **CRUD:** editar perfil, resetar senha, desativar conta.
- **Financeiro:** ver plano ativo, status do pagamento, data de renovação, histórico de transações.
- **Acesso:** bloquear/desbloquear aluno, conceder dias de teste, liberar curso específico.
- **Telemetria:** consumo de IA por aluno, custo gerado, atividade recente.

---

### 1.3 CONCURSOS

#### Concursos/Editais (`/admin/concursos`)
**Responsabilidade:** Cadastro e gestão de concursos, editais, órgãos, bancas e cargos.

**O que existe:**
- Cadastrar concurso (`ContestCreateForm`): órgão, banca, título, descrição, status, datas.
- Cadastrar órgão/banca (`OrganBoardCreateForm`).
- Excluir (soft delete) concurso (`ContestManager`).
- Lista concursos (50), editais (100), cargos (100), matérias do edital (200).

**Lacunas:** Sem edição de concurso (só criar/excluir), sem gestão de cargos na UI (componente `PositionCreateForm` existe mas não é usado), sem upload de edital nesta tela.

#### Edital IA (`/admin/editais/importar`)
**Responsabilidade:** Extrair matérias/pesos de um edital via IA.

**O que existe:**
- Analisar com IA (`EditalImport`): escolhe documento do edital e dispara extração.
- Ajustar pesos das matérias extraídas.
- Aplicar no edital (vincular matérias/pesos ao concurso).

**Lacunas:** Sem histórico de extrações, sem re-análise incremental, sem validação humana formal antes de aplicar.

#### Importar (URL) (`/admin/importar`)
**Responsabilidade:** Importar conteúdo externo via URL (leis, diários, provas).

**O que existe:**
- Importar conteúdo externo (`UrlImportForm`): URL, título, matéria.

**Lacunas:** Sem fila de processamento visível, sem status de cada importação, sem deduplicação de URLs.

#### Intelligence (`/admin/contest-intelligence`)
**Responsabilidade:** Análise de banca/edital — distribuição de peso por matéria e padrão histórico.

**O que existe:**
- Analisar edital (`ContestIntelligenceClient`): seleciona edital e dispara análise.

**Lacunas:** v1 básica — sem histórico de bancas, sem comparação entre editais, sem previsão de questões por peso.

---

### 1.4 CONTEÚDO

#### Matérias (`/admin/materias`)
**Responsabilidade:** Catálogo de matérias.

**O que existe:**
- Cadastrar matéria (`MateriaCreateForm`): nome, descrição, cor.

**Lacunas:** Sem editar/excluir matéria, sem ordenação, sem vínculo visual com questões/apostilas.

#### Apostilas (`/admin/apostilas`)
**Responsabilidade:** Upload, processamento e gestão de apostilas.

**O que existe:**
- Enviar apostila (upload individual).
- Upload em lote (`BatchUploadForm`).
- Ir para fila de revisão.
- Ver detalhes (reprocessar, gerar questões, revisar questões).

**Lacunas:** Sem editar metadados, sem re-upload, sem gestão de chunks/embeddings individualmente.

#### Revisão material (`/admin/apostilas/revisao`)
**Responsabilidade:** Aprovar/rejeitar o texto extraído de materiais.

**O que existe:**
- Aprovar material.
- Rejeitar material (com nota).
- Voltar para pendente.
- Ver preview do texto extraído.

**Lacunas:** Sem filtros por status/matéria, sem paginação robusta, sem métricas de tempo de revisão.

#### Fontes externas (`/admin/fontes`)
**Responsabilidade:** Rastreabilidade de origem/licença dos materiais.

**O que existe:**
- Editar fonte e licença de cada material (`FontesList`).

**Lacunas:** Sem validação de licença, sem alerta de materiais sem fonte/licença.

#### Aulas (`/admin/aulas`)
**Responsabilidade:** Geração e gestão de aulas.

**O que existe:**
- Gerar aula (roteiro) por IA (`LessonGenerateForm`).

**Lacunas:** Sem editar/excluir aula, sem preview do roteiro antes de salvar, sem reprocessamento.

#### Avatares (`/admin/avatares`)
**Responsabilidade:** Gestão de professores virtuais.

**O que existe:**
- Criar avatar (`AvatarCreateForm`): nome, slug, personalidade, voz.

**Lacunas:** Sem editar/excluir/ativar-desativar avatar na UI (o schema tem status ativo/inativo mas não há ação).

---

### 1.5 QUESTÕES

#### Questões (`/admin/questoes`)
**Responsabilidade:** Catálogo e moderação de questões.

**O que existe:**
- Lista com filtros por status, matéria e banca.
- Links para gerar e revisar.

**Lacunas:** Sem editar/excluir questão individual, sem visualizar questão completa na lista, sem exportar.

#### Gerar questões (`/admin/questoes/gerar`)
**Responsabilidade:** Gerar questões por IA a partir de apostila.

**O que existe:**
- Gerar questões (`QuestaoGenerateForm`): apostila, matéria, quantidade (1–20), nível, banca.
- Questões entram em `em_revisão` (nunca publicadas automaticamente).

**Lacunas:** Sem custo estimado antes de gerar, sem fila de geração, sem re-tentar falhas.

#### Importar questões (`/admin/questoes/importar`)
**Responsabilidade:** Importar questões prontas (CSV/XLSX/JSON).

**O que existe:**
- Importar questões (`QuestoesImportForm`).
- Baixar modelo CSV.

**Lacunas:** Sem relatório de erros detalhado pós-importação, sem preview antes de importar.

#### Revisão (`/admin/questoes/revisao`)
**Responsabilidade:** Fila de revisão de questões geradas por IA.

**O que existe:**
- Aprovar questão.
- Rejeitar questão.
- Bloquear questão.

**Lacunas:** Sem editar questão durante a revisão, sem filtros avançados, sem métricas de taxa de aprovação.

---

### 1.6 SISTEMA

#### IA (`/admin/ia`)
**Responsabilidade:** Status da infraestrutura de IA e consumo.

**O que existe:**
- Status de configuração (DeepSeek, Kimi, Embeddings).
- Lista de modelos Kimi.
- Uso acumulado (mensagens, tokens entrada/saída) — **totais agregados**.

**Lacunas:** Sem breakdown por aluno, sem custo em BRL, sem alerta de limite, sem histórico temporal.

#### Administradores (`/admin/admins`) — **SUPERADMIN**
**Responsabilidade:** Gestão da allowlist de admins/superadmins.

**O que existe:**
- Listar admins e superadmins.
- Adicionar/remover admin ou superadmin.
- Bloqueia auto-remoção.
- Auditoria de mutações.

**Lacunas:** Sem histórico de quem adicionou/removeu (só auditoria bruta), sem convite por e-mail.

---

## PARTE 2 — ANÁLISE DE LACUNAS E FALHAS CRÍTICAS DE NEGÓCIO

### 2.1 MÓDULO FINANCEIRO/ASSINATURAS — **CRÍTICO, INEXISTENTE NO ADMIN**

**Situação atual:**
- O domínio Billing **existe e funciona** no lado do aluno: `plans`, `subscriptions`, `payments` (schema `src/db/schema/billing.ts`), `CheckoutService`, `EntitlementService`, `SubscriptionService`, `WebhookService`, endpoints `/api/billing/*`.
- Gateway: **Mercado Pago** (Preapproval recorrente mensal).
- **MAS não há NENHUMA tela admin de financeiro.** O admin não consegue ver:
  - Se um aluno pagou ou não.
  - Status do plano (ativo, cancelado, expirado, past_due, suspenso).
  - Histórico de transações.
  - Inadimplência (pagamentos `pending`/`rejected`).
  - Expiração de acesso (`ends_at`).
  - Receita (MRR, receita do mês).
  - Integração com o gateway (cancelar assinatura, reembolsar).

**Impacto comercial:** A operação é **inviável comercialmente** sem visibilidade financeira. Não há como cobrar, acompanhar churn, ou identificar inadimplentes.

**Tabelas disponíveis para construir o módulo:**
- `plans`: `id`, `name`, `code`, `price_cents`, `promo_price_cents`, `limits`, `status`.
- `subscriptions`: `id`, `user_id`, `plan_id`, `status` (`active|cancelled|expired|past_due|suspended`), `preapproval_id`, `starts_at`, `ends_at`.
- `payments`: `id`, `user_id`, `subscription_id`, `provider`, `provider_id`, `amount_cents`, `currency`, `status` (`pending|approved|rejected|cancelled|refunded`), `external_reference`, `paid_at`.

### 2.2 GESTÃO DE ACESSOS E BLOQUEIOS — **CRÍTICO, INEXISTENTE**

**Situação atual:**
- O único mecanismo de controle é `EntitlementService`: assinatura ativa não expirada → plano pago; senão → `free`.
- **Não há** tela admin para:
  - Bloquear aluno inadimplente (suspender acesso).
  - Conceder dias de teste (trial).
  - Liberar cursos específicos (gating por curso).
  - Suspender/reativar assinatura manualmente.

**Impacto:** Sem trial, a conversão free→pago é fraca. Sem bloqueio manual, inadimplentes continuam com acesso. Sem gating por curso, não há como vender cursos avulsos.

### 2.3 AUDITORIA E TELEMETRIA — **PARCIAL, SEM VISÃO ADMIN**

**Situação atual:**
- `ai_usage` registra por usuário/dia: `messages_count`, `tokens_in`, `tokens_out`.
- `UsageService.estimateCost()` calcula custo em BRL por modelo (DeepSeek/Kimi pricing).
- `admin_action_logs` registra ações admin.
- **MAS** a tela `/admin/ia` mostra apenas **totais agregados** — sem breakdown por aluno, sem custo em BRL, sem histórico.

**Impacto:** Não há como saber o custo operacional de IA por aluno, identificar abuso, ou precificar corretamente.

---

## PARTE 3 — PLANO DE AÇÃO E PROPOSTA DE REESTRUTURAÇÃO

### 3.1 NOVO MÓDULO "FINANCEIRO / ASSINATURAS"

**Novo grupo no menu admin:** `Financeiro` (ícone `DollarSign`/`CreditCard`).

#### Telas a criar:

**A) `/admin/financeiro` — Visão geral financeira (Home)**
- Cards: **MRR**, **Receita do mês**, **Assinaturas ativas**, **Inadimplência** (pagamentos pending/rejected), **Churn** (canceladas no mês), **Novos pagamentos** (mês).
- Gráfico de receita por mês (últimos 12 meses).
- Tabela de últimas transações.

**B) `/admin/financeiro/assinaturas` — Lista de assinaturas**
- Filtros: status (`active|cancelled|expired|past_due|suspended`), plano, data.
- Colunas: aluno (email), plano, status, `starts_at`, `ends_at`, `preapproval_id`.
- Ações: **cancelar**, **suspender**, **reativar**, **conceder dias de teste**.

**C) `/admin/financeiro/pagamentos` — Histórico de transações**
- Filtros: status (`pending|approved|rejected|cancelled|refunded`), provedor, período.
- Colunas: aluno, valor (`amount_cents`), moeda, status, `paid_at`, `provider_id`, `external_reference`.
- Ações: **reembolsar** (via gateway), **marcar como pago** (manual).

**D) `/admin/financeiro/planos` — Gestão de planos**
- CRUD de `plans`: nome, código, preço, preço promocional, limites (`limits` jsonb), status.
- Visualização dos limites por plano.

#### Tabelas/relatórios a criar (SQL/query):
- **MRR:** `SUM(plans.price_cents)` de `subscriptions` ativas não expiradas.
- **Receita do mês:** `SUM(payments.amount_cents)` de `payments` `approved` no mês.
- **Inadimplência:** `payments` com status `pending`/`rejected` + `subscriptions` `past_due`.
- **Churn:** `subscriptions` canceladas/expiradas no mês / total ativo no início do mês.
- **LTV:** média de `SUM(payments.amount_cents)` por usuário.

#### Endpoints de API a criar:
- `GET /api/admin/financeiro/summary` — cards financeiros.
- `GET /api/admin/financeiro/assinaturas` — lista com filtros.
- `GET /api/admin/financeiro/pagamentos` — lista com filtros.
- `POST /api/admin/financeiro/assinaturas/{id}/cancel` — cancelar.
- `POST /api/admin/financeiro/assinaturas/{id}/suspend` — suspender.
- `POST /api/admin/financeiro/assinaturas/{id}/reactivate` — reativar.
- `POST /api/admin/financeiro/assinaturas/{id}/trial` — conceder dias de teste.
- `GET/POST/PUT/DELETE /api/admin/financeiro/planos` — CRUD de planos.

### 3.2 AJUSTES NA TELA DE "ALUNOS"

**Novas colunas a adicionar** (`src/app/admin/alunos/page.tsx`):

| Coluna | Fonte | Tipo |
|---|---|---|
| **Plano Ativo** | `subscriptions.plan_id → plans.name` | texto |
| **Status do Pagamento** | `payments.status` (mais recente) | badge colorido |
| **Data de Renovação** | `subscriptions.ends_at` | data |
| **Consumo IA (tokens)** | `SUM(ai_usage.tokens_in + tokens_out)` | número |
| **Custo IA (BRL)** | `UsageService.estimateCost()` | moeda |
| **Última atividade** | `MAX(chat_messages.created_at)` | data |

**Ações rápidas por linha:**
- **Ver perfil** (modal com detalhes completos).
- **Bloquear/Desbloquear** (suspender/reativar assinatura).
- **Conceder teste** (adicionar dias ao `ends_at`).
- **Ver transações** (link para `/admin/financeiro/pagamentos?user_id=`).

**Query sugerida:** JOIN `authUsers` + `profiles` + `subscriptions` (ativa) + `plans` + `payments` (mais recente) + `ai_usage` (agregado).

### 3.3 NOVO LAYOUT DA HOME DO DASHBOARD ADMIN

**Proposta de reestruturação do `/admin`:**

```
┌──────────────────────────────────────────────────────────────┐
│  VISÃO GERAL FINANCEIRA (linha 1)                             │
│  [MRR] [Receita mês] [Assinaturas ativas] [Inadimplência]     │
│  [Churn] [Novos pagamentos]                                   │
├──────────────────────────────────────────────────────────────┤
│  OPERAÇÃO (linha 2)                                           │
│  [Alunos] [Alunos ativos 7d] [Questões] [Aguardando revisão]  │
│  [Apostilas] [Apostilas com erro] [Aulas] [Avatares]          │
├──────────────────────────────────────────────────────────────┤
│  IA & CUSTO (linha 3)                                         │
│  [Tokens consumidos] [Custo IA (BRL)] [Mensagens IA]          │
│  [Custo por aluno (top)]                                      │
├──────────────────────────────────────────────────────────────┤
│  GRÁFICOS (linha 4)                                           │
│  [Receita por mês] [Consumo de IA por dia] [Conversão]        │
└──────────────────────────────────────────────────────────────┘
```

**Novos cards a adicionar ao `AdminDashboardRepository.stats()`:**
- `mrrCents` — `SUM(plans.price_cents)` de assinaturas ativas.
- `revenueMonthCents` — `SUM(payments.amount_cents)` approved no mês.
- `activeSubscriptions` — count de assinaturas ativas.
- `delinquentCount` — count de pagamentos pending/rejected + subs past_due.
- `churnMonth` — canceladas/expiradas no mês.
- `activeUsers7d` — usuários com atividade nos últimos 7 dias.
- `aiTokensTotal` — `SUM(tokens_in + tokens_out)` de `ai_usage`.
- `aiCostBRL` — `UsageService.estimateCost()` agregado.

---

## RESUMO EXECUTIVO

| Área | Status atual | Prioridade |
|---|---|---|
| **Financeiro no admin** | ❌ Inexistente (domínio existe só no lado aluno) | 🔴 Crítica |
| **Bloqueio/liberação de alunos** | ❌ Inexistente | 🔴 Crítica |
| **Trial/dias de teste** | ❌ Inexistente | 🔴 Crítica |
| **Consumo IA por aluno** | ❌ Inexistente (só total agregado) | 🟠 Alta |
| **Tela de alunos** | Somente 4 colunas read-only | 🟠 Alta |
| **Dashboard admin** | 10 cards de conteúdo, zero financeiro | 🟠 Alta |
| **Gating por curso** | ❌ Inexistente (acesso global por plano) | 🟡 Média |
| **Gateway** | Mercado Pago (Preapproval recorrente) | ✅ Funcional |

**Conclusão:** O painel admin cobre bem o **conteúdo** (apostilas, questões, aulas, concursos), mas é **comercialmente inviável** sem o módulo financeiro, gestão de acessos e telemetria de custo. A infraestrutura de dados (tabelas `plans`, `subscriptions`, `payments`, `ai_usage`) **já existe** — falta apenas construir as telas, endpoints e queries admin sobre ela.
