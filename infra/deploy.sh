#!/usr/bin/env bash
# ============================================================
# ConcursoAI Platform — Deploy de produção (Sprint 18.2C)
# Fluxo: build → up → health → migrate → health
# Uso:   ./deploy.sh          (roda migrações)
#        RUN_MIGRATE=0 ./deploy.sh  (pula migrações)
# Pré:   .env.production preenchido na raiz do projeto + Docker instalado.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# .env.production fica na RAIZ do projeto (padrão Docker/CI), não em infra/
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE não encontrado."
  echo "   Copie de infra/.env.production.example e preencha com os valores reais."
  exit 1
fi

echo "🚀 ConcursoAI — Deploy iniciado em $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# 1) Guarda a imagem atual p/ rollback (se houver container rodando)
PREV_IMAGE_ID="$(docker inspect --format '{{.Image}}' "$(docker compose ps -q app 2>/dev/null)" 2>/dev/null || true)"

# 2) Build da imagem (BuildKit + cache)
# --env-file .env.production: os build args NEXT_PUBLIC_* (embutidos no
# bundle em build-time) são lidos desse arquivo.
echo "📦 Building imagem (BuildKit)..."
docker compose --env-file "$ENV_FILE" build --pull

# 3) Subir / atualizar serviços
echo "⬆️  Subindo serviços..."
docker compose --env-file "$ENV_FILE" up -d --remove-orphans

# 4) Aguardar healthcheck
echo "🩺 Aguardando healthcheck..."
HEALTH_OK=0
for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    HEALTH_OK=1
    echo "✅ App saudável: http://127.0.0.1:3001/api/health"
    break
  fi
  if [[ "$i" -eq 30 ]]; then
    echo "❌ Healthcheck falhou após 30 tentativas. Tentando rollback..."
    docker compose --env-file "$ENV_FILE" logs --tail=50 app || true
    if [[ -n "${PREV_IMAGE_ID:-}" ]]; then
      echo "↩️  Voltando para a imagem anterior ($PREV_IMAGE_ID)..."
      docker tag "$PREV_IMAGE_ID" concursoai-app:latest
      docker compose --env-file "$ENV_FILE" up -d --no-build --force-recreate app
      sleep 10
      if curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
        echo "✅ Rollback OK — app saudável na imagem anterior."
        exit 0
      fi
      echo "❌ Rollback também falhou. Interrompendo."
    else
      echo "❌ Sem imagem anterior para rollback (primeiro deploy)."
    fi
    exit 1
  fi
  sleep 5
done

# 4.5) Migrações Drizzle (mesmo ambiente da app) — pulável com RUN_MIGRATE=0
if [[ "${RUN_MIGRATE:-1}" == "1" ]]; then
  echo "🗄️  Aplicando migrações (mesmo ambiente da aplicação)..."
  if ! bash "$SCRIPT_DIR/migrate.sh"; then
    echo "❌ Migrações falharam. Ver logs acima."
    exit 1
  fi
  echo "🔍 Verificando migrações pendentes (drizzle-kit check)..."
  if ! docker compose -f docker-compose.migrate.yml run --rm migrate npx drizzle-kit check; then
    echo "⚠️  drizzle-kit check apontou divergência/pendência — revise antes do release."
  else
    echo "✅ Sem migrações pendentes/divergências."
  fi
  echo "🩺 Revalidando health após migrações..."
  if ! curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1; then
    echo "❌ App não respondeu após migrações."
    exit 1
  fi
  echo "✅ App saudável após migrações."
else
  echo "⏭️  Migrações puladas (RUN_MIGRATE=0)."
fi

# 5) Limpeza de imagens antigas
echo "🧹 Limpando imagens antigas..."
docker image prune -f >/dev/null 2>&1 || true

echo ""
echo "✅ Deploy concluído em $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "   App:    https://app.becotoy.com"
echo "   Health: https://app.becotoy.com/api/health"
