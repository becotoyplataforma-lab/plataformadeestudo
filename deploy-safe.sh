#!/usr/bin/env bash
# Deploy seguro do ConcursoAI.
# Uso: sudo ./deploy-safe.sh [--with-migrate]
set -Eeuo pipefail

REPO_DIR="/opt/apps/plataformadeestudo"
INFRA_DIR="$REPO_DIR/infra"
ENV_FILE="$REPO_DIR/.env.production"
BACKUP_DIR="/opt/backups/concursoai"
REMOTE="origin"
BRANCH="main"
WITH_MIGRATE=0

if [[ "${1:-}" == "--with-migrate" ]]; then
  WITH_MIGRATE=1
elif [[ "${1:-}" != "" ]]; then
  echo "Uso: sudo $0 [--with-migrate]" >&2
  exit 2
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Execute como root: sudo $0 [--with-migrate]" >&2
  exit 1
fi

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "Comando obrigatório ausente: $1" >&2
    exit 1
  }
}

for command_name in git docker curl date; do
  require_command "$command_name"
done

for path in "$REPO_DIR" "$INFRA_DIR" "$ENV_FILE" "$INFRA_DIR/deploy.sh"; do
  [[ -e "$path" ]] || {
    echo "Caminho obrigatório ausente: $path" >&2
    exit 1
  }
done

git -C "$REPO_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 || {
  echo "Diretório não é um repositório Git: $REPO_DIR" >&2
  exit 1
}

docker compose version >/dev/null 2>&1 || {
  echo "Docker Compose não está disponível." >&2
  exit 1
}

mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
TIMESTAMP="$(date -u +%Y%m%d-%H%M%S)"
ENV_BACKUP="$BACKUP_DIR/env-production-$TIMESTAMP"
cp --preserve=mode,ownership "$ENV_FILE" "$ENV_BACKUP"
chmod 600 "$ENV_BACKUP"

cd "$REPO_DIR"
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0=safe.directory
export GIT_CONFIG_VALUE_0="$REPO_DIR"

BEFORE_COMMIT="$(git rev-parse HEAD)"
STASH_NAME="auto-deploy-$TIMESTAMP"
STASH_CREATED=0

cleanup() {
  unset GIT_CONFIG_COUNT GIT_CONFIG_KEY_0 GIT_CONFIG_VALUE_0
}
trap cleanup EXIT

rollback() {
  echo "Rollback: restaurando commit $BEFORE_COMMIT..."
  docker compose -f "$INFRA_DIR/docker-compose.yml" down --remove-orphans >/dev/null 2>&1 || true
  git reset --hard "$BEFORE_COMMIT"
  git clean -fd --exclude='.env.production' --exclude='.env.production.local'
  (cd "$INFRA_DIR" && RUN_MIGRATE=0 bash ./deploy.sh)
}

show_status() {
  git status --short
  git status --branch --short
}

echo "== Deploy seguro ConcursoAI =="
echo "Commit antes: $BEFORE_COMMIT"
echo "Backup env: $ENV_BACKUP"
echo "Migrações: $([[ "$WITH_MIGRATE" -eq 1 ]] && echo habilitadas || echo desabilitadas)"
echo

echo "[2/9] Estado inicial do Git"
show_status

if [[ -n "$(git status --porcelain)" ]]; then
  echo "[3/9] Criando stash automático: $STASH_NAME"
  git stash push --include-untracked -m "$STASH_NAME"
  STASH_CREATED=1
else
  echo "[3/9] Nenhuma alteração local para stash"
fi

echo "[4/9] Atualizando $REMOTE/$BRANCH"
git pull --ff-only "$REMOTE" "$BRANCH"

AFTER_COMMIT="$(git rev-parse HEAD)"
[[ "$AFTER_COMMIT" != "$BEFORE_COMMIT" ]] || echo "Aviso: nenhum commit novo foi recebido."
[[ -f "$ENV_FILE" ]] || { cp --preserve=mode,ownership "$ENV_BACKUP" "$ENV_FILE"; chmod 600 "$ENV_FILE"; }

if [[ "$WITH_MIGRATE" -eq 1 ]]; then
  echo "[6/9] Build e deploy com migrações"
  (cd "$INFRA_DIR" && bash ./deploy.sh)
else
  echo "[6/9] Build e deploy sem migrações"
  (cd "$INFRA_DIR" && RUN_MIGRATE=0 bash ./deploy.sh)
fi

echo "[7/9] Healthcheck local e no container"
for attempt in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3001/api/health >/dev/null 2>&1 \
    && docker compose -f "$INFRA_DIR/docker-compose.yml" ps --status running --services | grep -qx app; then
    echo "Healthcheck OK (tentativa $attempt/30)"
    break
  fi
  if [[ "$attempt" -eq 30 ]]; then
    echo "Healthcheck falhou."
    rollback || true
    exit 1
  fi
  sleep 5
done

if [[ "$STASH_CREATED" -eq 1 ]]; then
  echo "Stash preservado: $STASH_NAME"
fi

echo "[9/9] Deploy concluído"
printf 'Commit antes:  %s\n' "$BEFORE_COMMIT"
printf 'Commit depois: %s\n' "$AFTER_COMMIT"
printf 'URL: https://app.becotoy.com\n'
printf 'Status: saudável\n'
