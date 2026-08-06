# 03 — STACK

> Stack tecnológica oficial do **ConcursoAI Platform**.

## Frontend

- **Next.js 16** (App Router, Turbopack)
- **TypeScript** (strict)
- **React 19**
- **Tailwind CSS** (config em `tailwind.config.ts`, variáveis CSS em `src/app/globals.css`)
- **shadcn/ui** (componentes em `src/components/ui`, config em `components.json`)

## Backend

- **Next.js Route Handlers** (API routes em `src/app/api/*`)
- **Server Actions** para mutações internas

## Banco de Dados

- **PostgreSQL 15+** via **Supabase**
- **pgvector** para busca vetorial (futuro RAG)
- **RLS** (Row Level Security) ativo em todas as tabelas

## Autenticação

- **NextAuth (Auth.js v5)** com estratégia JWT
- **Supabase Auth** para credenciais (e-mail/senha)
- Verificação de credenciais via cliente admin no servidor

## IA

- **DeepSeek API** (`deepseek-chat` = V4 Flash, `deepseek-reasoner` = V4 Pro)
- Streaming SSE em `/api/chat`
- Prompts versionados em `prompts/`, carregados por `src/lib/ai/prompts.ts`

## Pagamentos

- **Mercado Pago** (checkout, Pix, boleto)
- `src/lib/payments/*` + `/api/payments/checkout` + `/api/payments/webhook`

## Storage (futuro)

- **Cloudflare R2** para documentos (Knowledge Engine)

## Infraestrutura

- **Vercel** (hosting)
- **Oracle Cloud VPS** (futuro — processamento pesado: OCR, Whisper)

## Env (variáveis de ambiente)

Ver `.env.example`. As `NEXT_PUBLIC_*` são públicas; as demais são privadas
(servidor). Validação em `src/lib/env.ts` (Zod, fail-fast em produção).
