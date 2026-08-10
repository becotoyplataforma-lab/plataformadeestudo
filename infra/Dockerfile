# ============================================================
# ConcursoAI Platform — Dockerfile de produção (Sprint 18.1)
# Multi-stage • Node 24 LTS Alpine • Next.js Standalone • não-root
#
# NOTA (desvio da spec): a spec pedia Node 20, porém a árvore de
# dependências atual exige Node >= 22 (@supabase/supabase-js 2.112.0)
# e npm >= 11 para resolver o lock (peer opcional do esbuild).
# Node 24 LTS = mesmo runtime do ambiente local (v24.x, npm 11.11).
# ============================================================

# ---------- BASE ----------
FROM node:24-alpine AS base
# libc6-compat: necessária para algumas libs nativas no Alpine
RUN apk add --no-cache libc6-compat
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

# ---------- DEPS ----------
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- BUILDER ----------
FROM base AS builder
# Variáveis NEXT_PUBLIC_* são embutidas no bundle em build-time.
# Defaults = mesmos do src/lib/env.ts (evitam falha de validação com arg vazio).
# Em deploy real, o docker-compose injeta os valores de .env.production.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_APP_NAME
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL:-http://localhost:3000} \
    NEXT_PUBLIC_APP_NAME=${NEXT_PUBLIC_APP_NAME:-ConcursoAI} \
    NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL:-https://placeholder.supabase.co} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY:-missing-anon-key}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Garante que a pasta public exista (o projeto ainda não tem public/)
RUN mkdir -p public

RUN npm run build

# ---------- RUNNER ----------
FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuário não-root
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

WORKDIR /app

# Conteúdo standalone (server.js + node_modules enxuto)
COPY --from=builder /app/.next/standalone ./
# Assets estáticos gerados no build
COPY --from=builder /app/.next/static ./.next/static
# Pasta public (vazia por enquanto)
COPY --from=builder /app/public ./public
# Prompts usados em runtime (professor-ia, flashcards, etl, analytics)
COPY --from=builder /app/prompts ./prompts

# Permissões para o usuário não-root ler os arquivos
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]

# ---------- MIGRATOR ----------
# Mesmo ambiente da aplicação (mesma base node:24 + mesmo lockfile/deps).
# Usada somente para aplicar migrações — não entra na imagem de runtime.
FROM deps AS migrator
WORKDIR /app
COPY . .
CMD ["npx", "drizzle-kit", "migrate"]
