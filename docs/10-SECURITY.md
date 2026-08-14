# 10 — Segurança

**Projeto:** ConcursoAI Platform
**Versão:** 1.0
**Data:** 2026-08-04

---

## 1. Princípios

1. **Defesa em profundidade** — múltiplas camadas (rede, app, banco, dados).
2. **Privacidade por design** — mínima coleta de PII; LGPD.
3. **Least privilege** — cada componente com o menor privilégio necessário.
4. **RLS como fonte da verdade** — segurança no banco, não só na aplicação.

## 2. Autenticação e Sessões

- **NextAuth v5 (Auth.js)** com JWT assinado (`AUTH_SECRET` forte, rotação 90 dias).
- Sessões short-lived com refresh (máx. 7 dias; inatividade 30 dias).
- **Supabase Auth** para credenciais e e-mail; `auth.users` é a fonte da verdade de identidade.
- Senhas com hash (bcrypt/argon2 — via Supabase).
- **MFA** (TOTP) no roadmap para contas Pro/Intensivo.

## 3. Autorização

- **RLS** em todas as tabelas — políticas por `auth.uid()` (ver `policies.sql`).
- Server-side sempre revalida propriedade (`user_id` da sessão == `user_id` do recurso).
- **Server Actions/API** usam `auth()` e nunca confiam em `user_id` vindo do cliente.
- Papéis: `user`, `admin` (campo `role` em `profiles`). Admin via `is_admin` boolean.

## 4. Segredos e Variáveis de Ambiente

| Item | Regra |
| --- | --- |
| `NEXT_PUBLIC_*` | Apenas valores públicos (anon key, URL) |
| `SUPABASE_SERVICE_ROLE_KEY` | Somente servidor; nunca no cliente |
| `DEEPSEEK_API_KEY` | Somente servidor |
| `AUTH_SECRET` | Somente servidor; `openssl rand -base64 32` |
| `.env.local` | Gitignored; nunca commitado |

- Gerenciamento via Vercel Env (com encryption at rest).
- Auditoria de acesso aos segredos no dashboard.

## 5. Segurança da API

- **Validação:** Zod em toda entrada (Server Actions e API routes).
- **Rate limiting:** registro/login (anti brute-force), chat (cotas), API geral.
- **Headers de segurança** via middleware Next.js:

```ts
// Exemplos de headers aplicados no middleware
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=()
Strict-Transport-Security: max-age=63072000
```

- **CSP** restritiva em produção (script-src, object-src 'none').

## 6. Segurança da IA (LLM)

- **Injeção de prompt:** contexto RAG isolado em tags; nunca tratado como instrução.
- **Saída sanitizada:** escapar HTML antes de renderizar (`react-markdown` não executa HTML cru por padrão — manter `skipHtml`/config segura).
- **Guardrails:** bloqueio de conteúdo nocivo; recusa educada em pt-BR.
- **PII:** não enviar dados de outros usuários; anonimizar nos logs.
- **Cotação de custo:** rate limit por plano impede abuso e exaustão de créditos.

## 7. Segurança do Banco

- **RLS ativado** — por padrão tabelas são `REVOKE`/`DENY` até política explícita.
- **Service role** nunca exposto ao cliente; usado só no servidor.
- **Migrations revisadas** (SQL Review em PRs).
- **Backups diários** + restauração testada trimestralmente.
- Conexão via pooler com SSL (`sslmode=require`).

## 8. Storage (R2/Supabase)

- Uploads via **presigned URLs** com TTL curto (5 min).
- Validação de tipo/tamanho (máx. 200 MB por arquivo no MVP).
- Scans de malware no upload (futuro).
- Buckets privados por usuário; políticas de acesso no servidor.

## 9. LGPD e Privacidade

- **Base legal:** consentimento explícito no cadastro; finalidade clara.
- **Direitos:** exportação de dados e exclusão de conta (LGPD — **planejado**, rotas ainda não implementadas).
- **DPO/Contato:** política de privacidade e termos no site.
- **Retenção:** dados de uso anonimizados após 12 meses; contas inativas excluídas após 2 anos (aviso).
- **Cookies:** apenas essenciais (sessão) + analytics com consentimento.

## 10. Logs e Auditoria

- Logs de segurança: login, mudança de senha, exclusão de dados, ações de admin.
- Retenção de logs: 6 meses (logs de auth), 90 dias (logs de app).
- **Não logar PII** sensível (senhas, tokens) em nenhum nível.

## 11. Resposta a Incidentes

| Severidade | Exemplo | Ação |
| --- | --- | --- |
| Crítica | Vazamento de dados / chave exposta | Rotacionar chaves, revogar, notificar afetados, post-mortem |
| Alta | RLS incorreta | Corrigir política, auditar acesso, alertar |
| Média | XSS/CSRF pontual | Patch, testes de regressão |
| Baixa | Versão de dependência vulnerável | Dependabot/renovate + update |

## 12. Checklist de Lançamento

- [ ] `AUTH_SECRET` forte e rotacionado
- [ ] RLS ativo em TODAS as tabelas (query de auditoria em `policies.sql`)
- [ ] Nenhuma `NEXT_PUBLIC` com segredo real
- [ ] Headers de segurança + CSP no middleware
- [ ] Rate limiting ativo (auth, chat, registro)
- [ ] Zod em todas as entradas
- [ ] Auditoria de permissões (nenhum acesso indevido documentado)
- [ ] Backups diários configurados e testados
- [ ] Termos + Política de Privacidade publicados
