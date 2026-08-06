# STACK

## PURPOSE
- Definir a stack oficial e os limites de tecnologia.

## CONTEXT
- Frontend: Next.js 16, TypeScript strict, Tailwind CSS, shadcn/ui.
- Backend: Next.js Route Handlers, Server Actions.
- Dados: Supabase (Postgres, pgvector, Auth, Storage).
- IA: DeepSeek.
- Pagamentos: Mercado Pago.
- Infra: Vercel, Oracle VPS futuro.

## DECISIONS
- Tecnologias aprovadas: as listadas acima.
- Tecnologias proibidas: OpenAI e Gemini como LLM principal, Hubla e Stripe para pagamentos, microsserviços no MVP, uso de any, acesso direto a banco pelo frontend.

## RULES
- Padrões obrigatórios em novas features: DTO, Zod, Repository, Service, Mapper.
- Server Components sempre que possível.
- Variáveis públicas com prefixo NEXT_PUBLIC.
- Segredos apenas no servidor.
- Env validada com Zod em build.

## OUT OF SCOPE
- Adicionar novas tecnologias sem decisão registrada.

## REFERENCES
- .ai/03-STACK.md
- .env.example
- docs/02-SDD.md
