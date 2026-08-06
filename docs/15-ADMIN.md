# 15 — Painel Admin

**Projeto:** ConcursoAI Platform
**Versão:** 1.0 (design)
**Data:** 2026-08-04

---

## 1. Visão Geral

O **Painel Admin** permite à equipe gerenciar usuários, conteúdo (questões, matérias), documentos da Knowledge Engine, cotas de IA e observar métricas de plataforma. Acesso restrito a `profiles.role = 'admin'` com **verificação dupla** (sessão + service role).

## 2. Acesso

- Rota: `/admin` (fora dos route groups de usuário) — protegida por:
  1. `auth()` do NextAuth.
  2. Check `profiles.is_admin = true` no servidor.
- Lista de e-mails permitidos (allowlist) como camada extra no MVP.

## 3. Módulos

### 3.1 Usuários
- Lista com busca (nome, e-mail, plano).
- Detalhes: plano, uso de IA, atividade recente, streak.
- Ações: alterar plano, suspender/banir, reenviar e-mail, excluir (LGPD).
- Export CSV.

### 3.2 Questões (Curadoria)
- Lista com filtros (banca, matéria, ano, nível, fonte).
- CRUD completo: enunciado, alternativas, gabarito, explicação.
- **Validação de qualidade:** flag `status` (`rascunho` / `publicada` / `bloqueada`).
- Dupes: revisar hash duplicado.
- Bulk import (CSV/JSON) e export.

### 3.3 Matérias/Conteúdo
- CRUD de `content_subjects` (catálogo global de disciplinas).
- Mapa de sinônimos (ex.: "Dir. Constitucional" → "Constitucional").

### 3.4 Knowledge Engine (futuro)
- Filas e jobs (status, retries, erros).
- Documentos do usuário (status de processamento).
- Testar busca semântica.

### 3.5 Cotas e IA
- Visão geral de uso (mensagens/dia, tokens, custo estimado).
- Ajustar limites por plano (gratuito/pro/intensivo).
- Alertas de custo elevado.

### 3.6 Métricas da Plataforma
- DAU/MAU, retenção, conversão por plano.
- Questões resolvidas, flashcards criados, mensagens de IA.
- Gráficos de evolução (ver `16-ANALYTICS.md`).

## 4. Segurança do Admin

- Rota `_middleware` bloqueia `/admin` para não-admins (redirect para `/dashboard`).
- **Auditoria:** toda ação administrativa registrada em `admin_audit_log` (quem, o quê, quando, IP).
- CSRF: mutações via Server Actions com proteção de origem.
- Rate limit específico em ações sensíveis (banir, excluir, alterar plano).

## 5. Tabela de Auditoria

```sql
CREATE TABLE admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES profiles(id),
  action      text NOT NULL,        -- ex.: 'user.ban', 'question.publish'
  entity_type text NOT NULL,
  entity_id   uuid,
  details     jsonb,
  ip          inet,
  created_at  timestamptz DEFAULT now()
);
```

## 6. Rotas do Admin (design)

| Rota | Método | Descrição |
| --- | --- | --- |
| `/api/admin/usuarios` | GET | Lista usuários |
| `/api/admin/usuarios/[id]` | PATCH/DELETE | Alterar plano / suspender / excluir |
| `/api/admin/questoes` | POST | Criar/importar questões |
| `/api/admin/questoes/[id]` | PATCH | Publicar/bloquear |
| `/api/admin/metricas` | GET | Métricas agregadas |
| `/api/admin/ia/uso` | GET | Uso de IA e custos |

## 7. Telas (UI)

| Tela | Conteúdo |
| --- | --- |
| `/admin` | Overview com KPIs da plataforma |
| `/admin/usuarios` | Tabela de usuários + ações |
| `/admin/questoes` | Curadoria de questões |
| `/admin/materias` | Catálogo de matérias |
| `/admin/ia` | Uso e cotas de IA |
| `/admin/auditoria` | Log de ações administrativas |

## 8. Permissões Mínimas (Princípio do Menor Privilégio)

- Service role só no servidor admin.
- Funções RPC dedicadas com validação (`is_admin()`).
- Nenhuma função admin exposta ao cliente.

## 9. Implementação (Fase)

O painel admin entra na **V1.1** (backlog #46). No MVP, o cadastro de questões pode ser feito via seed e uma rota simples de curadoria protegida.
