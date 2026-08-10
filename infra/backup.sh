#!/usr/bin/env bash
# ============================================================
# ConcursoAI — Backup do banco Supabase + .env (Sprint 18.1)
# Requisitos: cliente pg_dump instalado e DATABASE_URL no .env.production
# Uso:   ./backup.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

ENV_FILE=".env.production"
BACKUP_DIR="backups"
KEEP=7

if [[ ! -f "$ENV_FILE" ]]; then
  echo "❌ $ENV_FILE não encontrado." >&2
  exit 1
fi

# Extrai DATABASE_URL sem "sourcar" o arquivo (evita quebra com caracteres especiais)
DB_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -n1 | cut -d= -f2-)"
if [[ -z "$DB_URL" ]]; then
  echo "❌ DATABASE_URL não definida em $ENV_FILE" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT="$BACKUP_DIR/concursoai_${STAMP}.sql.gz"

echo "📦 Backup do banco (${STAMP})..."
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "$DB_URL" --no-owner --no-acl | gzip > "$OUT"
else
  echo "⚠️  pg_dump não encontrado — use: docker compose run --rm app pg_dump ..." >&2
  exit 1
fi
echo "✅ Banco: $OUT ($(du -h "$OUT" | cut -f1))"

# Backup do .env (cópia protegida por permissão)
cp "$ENV_FILE" "$BACKUP_DIR/.env.production.${STAMP}.bak"
chmod 600 "$BACKUP_DIR/.env.production.${STAMP}.bak"
echo "✅ Env:   $BACKUP_DIR/.env.production.${STAMP}.bak"

# Retenção (mantém os KEEP mais recentes)
echo "🧹 Mantendo os últimos $KEEP backups..."
ls -1t "$BACKUP_DIR"/concursoai_*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
ls -1t "$BACKUP_DIR"/.env.production.*.bak 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f

# (Opcional) Enviar para Cloudflare R2 / outro storage
# rclone copy "$OUT" concursoai-r2:concursoai-backups/ --progress

echo "✅ Backup concluído em $(date -u +%Y-%m-%dT%H:%M:%SZ)"
