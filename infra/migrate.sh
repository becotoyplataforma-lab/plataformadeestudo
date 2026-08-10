#!/usr/bin/env bash
# ============================================================
# ConcursoAI — Aplicar migrações Drizzle (Sprint 18.2C)
# Uso:   ./migrate.sh
# Pré:   .env.production preenchido na raiz do projeto
#        (DATABASE_URL obrigatória — Pooler IPv4 do Supabase)
# Usa a imagem `migrator` do MESMO Dockerfile (mesma base node:24 +
# mesmo lockfile/deps da app) — ambiente idêntico ao da aplicação.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ENV_FILE="$PROJECT_DIR/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE não encontrado." >&2
  exit 1
fi

if ! grep -qE '^DATABASE_URL=' "$ENV_FILE"; then
  echo "❌ DATABASE_URL não definida em $ENV_FILE" >&2
  exit 1
fi

echo "🚀 Build da imagem migrator (mesmo ambiente da app)..."
docker compose -f docker-compose.migrate.yml build

echo "🚀 Aplicando migrações..."
START=$(date +%s)
docker compose -f docker-compose.migrate.yml run --rm migrate
END=$(date +%s)
ELAPSED=$((END - START))

# ---- Relatório ----
JOURNAL="$PROJECT_DIR/drizzle/meta/_journal.json"
echo ""
echo "========================="
echo "Drizzle Migration Report"
echo "========================="
if [[ -f "$JOURNAL" ]]; then
  while IFS= read -r tag; do
    printf "Migration %-30s OK\n" "$tag"
  done < <(grep -oE '"tag": *"[^"]+"' "$JOURNAL" | sed -E 's/.*"tag": *"([^"]+)"/\1/')
  COUNT=$(grep -c '"tag"' "$JOURNAL" || true)
  echo "Total migrations: $COUNT"
else
  echo "Journal não encontrado: $JOURNAL"
fi
echo "Execution time: ${ELAPSED}s"
echo "========================="
