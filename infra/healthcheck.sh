#!/usr/bin/env bash
# ============================================================
# ConcursoAI — Healthcheck manual / CI (Sprint 18.1)
# Uso:   ./healthcheck.sh [URL]
# ============================================================
set -euo pipefail

URL="${1:-${HEALTHCHECK_URL:-http://127.0.0.1:3000/api/health}}"

code="$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "$URL" 2>/dev/null || true)"

if [[ "$code" == "200" ]]; then
  echo "OK ($code) — $URL"
  exit 0
fi

echo "FALHA ($code) — $URL" >&2
exit 1
