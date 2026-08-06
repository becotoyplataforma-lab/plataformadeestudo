# 16 — ADR

> Architecture Decision Records — decisões de arquitetura do projeto.

## ADR-001 — Monólito Modular no MVP
**Status:** Aceita
**Decisão:** O MVP é um monólito modular (sem microsserviços). Cada módulo é
internamente independente.
**Consequência:** Simplicidade operacional; migração futura para microsserviços
facilitada pela separação lógica (repositories/services por módulo).

## ADR-002 — Supabase como banco principal
**Status:** Aceita
**Decisão:** PostgreSQL gerenciado pelo Supabase (Auth, Storage, RLS, pgvector).
**Consequência:** RLS é a fonte da verdade de permissões; código deve respeitar
as políticas.

## ADR-003 — Cloudflare R2 para documentos (futuro)
**Status:** Aceita (pós-MVP)
**Decisão:** Armazenamento de documentos (PDFs, vídeos, áudios) no Cloudflare R2.
**Consequência:** Upload via presigned URLs; storage econômico e S3-compatível.

## ADR-004 — Oracle VPS para processamento pesado (futuro)
**Status:** Aceita (pós-MVP)
**Decisão:** Processamento pesado (OCR, Whisper, ETL) em workers na Oracle VPS.
**Consequência:** Jobs assíncronos fora do serverless da Vercel (limite de tempo).

## ADR-005 — RAG como mecanismo oficial de IA
**Status:** Aceita (pós-MVP)
**Decisão:** Respostas baseadas em documentos autorizados via RAG (pgvector).
**Consequência:** Menos alucinação; fine-tuning **não** será usado no MVP.

## ADR-006 — DeepSeek como provedor LLM
**Status:** Aceita
**Decisão:** DeepSeek (`deepseek-chat`/`deepseek-reasoner`) como provedor principal.
**Consequência:** Baixo custo por token; abstraído atrás de `src/lib/ai` para
permitir troca futura.

## ADR-007 — Mercado Pago para pagamentos
**Status:** Aceita
**Decisão:** Mercado Pago (checkout, Pix, boleto) para planos/assinaturas.
**Consequência:** Webhook valida pagamento e ativa plano via função
`register_payment` (SECURITY DEFINER).

## ADR-008 — NextAuth v5 (JWT) + Supabase Auth
**Status:** Aceita
**Decisão:** Autenticação com NextAuth (JWT) e credenciais validadas no Supabase Auth.
**Consequência:** Sessão via cookie JWT; `user_id` do Supabase no token para o banco.

## ADR-009 — Streaming SSE no chat
**Status:** Aceita
**Decisão:** `/api/chat` usa Server-Sent Events para entregar tokens em tempo real.
**Consequência:** Melhor UX; API route com `runtime = "nodejs"` e `maxDuration` maior.

## ADR-010 — DTOs validados por Zod nas fronteiras
**Status:** Aceita
**Decisão:** Toda API route e Server Action retorna DTOs validados por Zod
(`src/lib/dto/*`), com mappers `toXxxDto`. Entradas validadas em
`src/lib/validations/*`.
**Consequência:** Contratos explícitos entre camadas; menos acoplamento ao
schema do banco; campos sensíveis nunca vazam. (Infra criada; aplicado a partir
das novas funcionalidades.)
