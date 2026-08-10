# Changelog

Todas as mudanças relevantes do **ConcursoAI Platform** serão documentadas aqui.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e o versionamento [SemVer](https://semver.org/lang/pt-BR/).

## [1.0.0-alpha] - 2026-08-10

### Adicionado
- Plataforma de estudos com IA para concursos públicos brasileiros (v1.0.0-alpha).
- Infraestrutura de produção em VPS (Docker + Nginx + Cloudflare):
  - Dockerfile multi-stage (`runner` para o app, `migrator` para migrações).
  - `docker-compose.yml` (app → `target: runner`) e `docker-compose.migrate.yml` (migrações → `target: migrator`).
  - `deploy.sh`, `migrate.sh`, `healthcheck.sh`, `backup.sh`.
  - Nginx: `app.becotoy.com` (porta 80 e 443) → `127.0.0.1:3001` (ConcursoAI).
- Migrações Drizzle aplicadas em produção:
  - `0000_baseline`
  - `0001_romantic_siren`
- Extensão `pgvector` habilitada no Supabase (busca vetorial / RAG).
- Conexão com o banco via **Supabase Pooler IPv4** (`DATABASE_URL` e `DIRECT_URL`).
- `docs/INFRASTRUCTURE.md` com a arquitetura e topologia de produção.
- `CHANGELOG.md` (este arquivo).

### Corrigido
- Build Docker do app passou a usar `target: runner` (antes, o último estágio `migrator` era usado por engano, fazendo o container rodar migrações em vez do servidor Next.js).
- Conexão ao banco: host direto do Supabase (`db.<ref>.supabase.co`) resolve apenas para IPv6 (inalcançável na VPS); substituído pelo pooler IPv4.
- `AUTH_SECRET` gerado e configurado no ambiente de produção.
- Nginx: adicionado server block HTTPS (443) para `app.becotoy.com` → ConcursoAI, mantendo o BecoToy em `becotoy.com`.

### Validado
- Build local e build Docker (VPS) com sucesso.
- Healthcheck `GET /api/health` → `200 OK` (local e externo via `https://app.becotoy.com`).
- Migrações aplicadas e `drizzle-kit check` sem divergências.
- `https://app.becotoy.com` servindo o ConcursoAI.
