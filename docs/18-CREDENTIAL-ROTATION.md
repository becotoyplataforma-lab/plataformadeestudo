# 18 — Rotação de Credenciais (pós-exposição)

**Projeto:** ConcursoAI Platform
**Versão:** 1.0.0-alpha
**Data:** 2026-08-10

> **Contexto:** credenciais foram expostas durante o processo de deploy (chat/terminal).
> Antes de qualquer acesso público amplo, rotacionar TODAS as chaves abaixo.

## ⚠️ Exposição registrada — 2026-08-26

- **Senha do PostgreSQL** (`DATABASE_URL`) foi compartilhada em texto puro no chat durante a correção do bloqueador de conexão.
- **Ação pendente:** rotacionar a senha do banco (item 1 abaixo) **antes do uso público amplo**.
- A senha atual foi usada apenas para restaurar a conexão; **não é mais considerada segura**.

## Regras de segurança

- **Nunca** colar chaves/senhas no chat ou em logs.
- As novas chaves são digitadas **direto no terminal da VPS** (ex.: `nano`).
- Após cada rotação: atualizar apenas `.env.production` da VPS e **recriar os containers**.
- Não fazer migração nova, a menos que haja mudança de schema real.

## Ordem (exigida)

| # | Item | Onde fazer | Aplicação no `.env.production` |
| --- | --- | --- | --- |
| 1 | Resetar senha do PostgreSQL | Supabase → Settings → Database → Reset database password | `DATABASE_URL` e `DIRECT_URL` |
| 2 | Nova `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → Regenerate | `SUPABASE_SERVICE_ROLE_KEY` |
| 3 | Nova chave DeepSeek (se exposta) | DeepSeek → API Keys → Create | `DEEPSEEK_API_KEY` |
| 4 | Novo `AUTH_SECRET` | gerar na VPS (`openssl rand -base64 32`) | `AUTH_SECRET` |
| 5 | Atualizar `.env.production` na VPS | via `nano`/`sed` (valores digitados no terminal) | — |
| 6 | Recriar containers | `docker compose ... up -d --force-recreate` | — |
| 7 | Testar | `/api/health` 200, login, banco, IA | — |

## Passo a passo

### 1. Resetar a senha do banco (Supabase)
1. Supabase Dashboard → projeto `sqrjovmqupjowyilgbsp` → **Settings → Database → Database Password → Reset**.
2. Copie a nova senha (fica visível **apenas na tela**).

### 2. Nova Service Role Key (Supabase)
1. **Settings → API → Project API keys → Service Role → Regenerate**.
2. Copie a nova `sb_secret_...`.

### 3. Nova chave DeepSeek
1. https://platform.deepseek.com → **API Keys → Create**.
2. Copie a nova `sk-...`.

### 4. Novo AUTH_SECRET (na VPS)
```bash
# gera e já grava (não imprime o valor)
NEW=$(openssl rand -base64 32 | tr -d '\n')
sed -i -E "s|^AUTH_SECRET=.*|AUTH_SECRET=${NEW}|" /opt/apps/plataformadeestudo/.env.production
```
> Já feito nesta release (2026-08-10). Se quiser gerar novamente, rode o comando acima.

### 5. Atualizar `.env.production` na VPS (sem passar pelo chat)
```bash
nano /opt/apps/plataformadeestudo/.env.production
```
Digite os novos valores **direto no editor**:
- `DATABASE_URL` e `DIRECT_URL` → nova senha do banco (mesmo host do pooler IPv4).
- `SUPABASE_SERVICE_ROLE_KEY` → nova service role.
- `DEEPSEEK_API_KEY` → nova chave DeepSeek.

Salve (Ctrl+O, Enter) e saia (Ctrl+X).

> Não envie esses valores no chat.

### 6. Recriar os containers (aplicar novo env)
```bash
cd /opt/apps/plataformadeestudo
docker compose --env-file .env.production -f infra/docker-compose.yml up -d --force-recreate
```

### 7. Testar
```bash
curl -i https://app.becotoy.com/api/health          # 200 + {"status":"ok","app":"ConcursoAI"}
```
- Login (fluxo NextAuth com o novo `AUTH_SECRET`).
- Banco (pooler IPv4 com a nova senha).
- IA (DeepSeek com a nova chave).

### Validação sem expor segredos (opcional)
```bash
grep -cE '^(DATABASE_URL|DIRECT_URL|SUPABASE_SERVICE_ROLE_KEY|DEEPSEEK_API_KEY|AUTH_SECRET)=' /opt/apps/plataformadeestudo/.env.production
# não imprimir valores — apenas conferir que existem
```

## Pós-rotação

- O `v1.0.0-alpha` passa a ser base limpa para a Sprint 20.
- Guardar as novas chaves em cofre (ex.: 1Password / SOPS / GitHub Secrets).
