# Infraestrutura — Ecossistema Becotoy (Oracle VPS)

> Documento de referência da infraestrutura de produção.
> Última atualização: Sprint 18.2A (auditoria) — 2026-08-06

## Visão geral

```
                     Cloudflare (DNS + TLS)
                           │
                           ▼
                     Nginx (Ubuntu)
                           │
     ┌─────────────────────┼─────────────────────┐
     ▼                     ▼                     ▼
 becotoy.com         app.becotoy.com      leiseca.becotoy.com
     │                     │                     │
     ▼                     ▼                     ▼
 SisPhoto (PM2)      ConcursoAI (Docker)    Lei Seca (estático)
```

## Servidor (Oracle VPS)

- **Provedor:** Oracle Cloud
- **IP:** `137.131.179.48`
- **SO:** Ubuntu
- **Acesso SSH:** porta 22, chave `ssh-key-2026-05-27.key` (alias `concursoai-vps` no `~/.ssh/config`)
- **Docker:** 29.x + Compose v5.x (daemon ativo)
- **PM2:** v7.x (daemon)

## Arquitetura padrão (todos os projetos)

1. **Cloudflare** — DNS + TLS na borda (os subdomínios proxyados não precisam de certificado no origin).
2. **Nginx do sistema** — reverse proxy multi-tenant (porta 80; cada site encaminha para uma porta local).
3. **Aplicações em Docker** — cada app na sua própria porta `127.0.0.1` (nada exposto publicamente além do nginx).
4. **Banco de dados** — Supabase (PostgreSQL via **Pooler IPv4**).

## Mapa de aplicações

| Aplicação | Domínio | Runtime | Porta | Stack |
|---|---|---|---|---|
| **SisPhoto** | `becotoy.com` (+ IP raw) | PM2 (`sisphoto`, id 0) | `127.0.0.1:3000` | Next.js (next-server) |
| **ConcursoAI** | `app.becotoy.com` | Docker (`concursoai-app`) | `127.0.0.1:3001` | Next.js 16 (standalone, Node 24) |
| **Lei Seca** | `leiseca.becotoy.com` | ~~estático~~ **desativado** (migrando p/ Vercel) | `/var/www/leiseca` | backup: `~/backup-leiseca-nginx.conf` |
| **Hermes** | (sem domínio exposto) | Docker (`hermes`, `hermes-dashboard`) | — | `hermes-agent` |

## Nginx (sistema)

- Sites (`/etc/nginx/sites-enabled/`): `default` (becotoy.com + IP raw), `app.becotoy.com`, `sisphoto`. **Lei Seca desativado** em 2026-08-06 (backup em `~/backup-leiseca-nginx.conf`).
- **Certificados Let's Encrypt:** `becotoy.com`, `leiseca.becotoy.com` (renovação via `cron.d/certbot`).
- `app.becotoy.com` → `proxy_pass http://127.0.0.1:3001` (TLS pela Cloudflare).
- **Regra:** nunca publicar outro nginx nas portas 80/443 — o nginx do sistema é o único proxy.

## Docker

- Containers ativos: `hermes`, `hermes-dashboard` (Hermes), `concursoai-app` (ConcursoAI).
- Imagem ConcursoAI: multi-stage, **Node 24 LTS**, Next.js **standalone**, usuário não-root.
- Deploy: `infra/deploy.sh` (build → up → healthcheck → **rollback** automático).
- Compose: **apenas o serviço `app`** (sem nginx/redis no Docker).

## PM2

- Daemon v7.0.1 — app `sisphoto` (fork, online).
- Comandos: `pm2 list`, `pm2 logs sisphoto`, `pm2 restart sisphoto`, `pm2 save`.

## Cloudflare

- Domínios proxyados: `becotoy.com`, `app.becotoy.com`, `leiseca.becotoy.com` (etc.).
- TLS: borda (sugestão: modo **Full (strict)**).

## Portas em uso (resumo)

| Porta | Serviço | Exposição |
|---|---|---|
| 22 | SSH | pública (UFW) |
| 80/443 | Nginx | pública (UFW) |
| 3000 | SisPhoto | 127.0.0.1 (via nginx) |
| 3001 | ConcursoAI (Docker) | 127.0.0.1 (via nginx) |
| 5901-5903 / 6001-6003 | VNC (Xtightvnc) | **0.0.0.0 — revisar (Sprint 19)** |
| 111 | rpcbind | **0.0.0.0 — revisar (Sprint 19)** |
| 53 / 631 / 9119 | systemd-resolved / CUPS / monitor | local |

## Segurança — pendências (Sprint 19: Hardening)

> 🔴 **ANTES DA PUBLICAÇÃO OFICIAL (prioridade alta):**
> - [ ] **Rotacionar credenciais expostas no chat** (2026-08-06): senha do banco Supabase, Service Role Key, chaves anon/publishable/secret, chave DeepSeek, `OPENAI_API_KEY` (`.env` local) — tratar como comprometidas.

- [ ] Revisar VNC exposto (5901-5903 / 6001-6003)
- [ ] Revisar rpcbind (porta 111)
- [ ] Revisar regras UFW
- [ ] Revisar usuários/grupos e permissões Docker
- [ ] Revisar chaves SSH
- [ ] Revisar certificados
- [ ] Configurar `fail2ban`
- [ ] Configurar backups automáticos
- [ ] Configurar monitoramento (UptimeRobot/Sentry/Better Stack)

## Deploys futuros

- Novos subdomínios seguem o padrão: **Cloudflare → Nginx sistema → Docker em porta própria**.
- Exemplo planejado: `api.becotoy.com` → Docker.

## Visão (padronização do ecossistema)

- **Meta:** todas as aplicações Next.js em **Docker** (sem PM2), cada uma na sua porta `127.0.0.1`, nginx apenas como reverse proxy.
- Próxima migração planejada: **SisPhoto** (PM2 → Docker).
- Hermes já roda em Docker (`hermes`, `hermes-dashboard`).
