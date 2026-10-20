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

<<<<<<< HEAD
## ADR-011 — StorageAdapter com proxy autenticado para arquivos
**Status:** Aceita (refina o ADR-003)
**Decisão:** O acesso a binários do Knowledge Core passa pela interface única `StorageAdapter`
(`src/lib/storage/`), com dois drivers escolhidos por `STORAGE_DRIVER` — `local` (dev, disco)
e `r2` (Cloudflare R2 via S3-compatível). A leitura pelo cliente é feita pela rota autenticada
`/api/apostilas/[id]/arquivo`, que transmite o stream; `documents.storage_path` nunca sai em
DTO. Presigned URLs continuam disponíveis via `R2StorageAdapter.getUrl()`, mas não são o
caminho padrão do produto.
**Consequência:** Dev funciona sem credenciais de nuvem; trocar de provedor não toca
UI/serviço/repositório; a posse é verificada no servidor a cada leitura; exige
`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` e suporte a HTTP Range (leitores de PDF
pedem blocos do arquivo). Não há fallback silencioso: `STORAGE_DRIVER=r2` sem credenciais
falha com `CONFIG_MISSING` em vez de ler do disco. Desde a **Fase 2** o mesmo adaptador também
**grava** os bytes na ingestão e os **remove** na exclusão de documento (com rollback quando o
banco falha); scripts de dev que importem `@/lib/storage` precisam de
`--conditions=react-server` por causa do guard `server-only`.
=======
## ADR-011 — Backend de storage local para desenvolvimento e ingestão offline
**Status:** Aceita
**Decisão:** Além de Supabase Storage e R2, existe o backend `local`
(`STORAGE_BACKEND=local`), que grava os bytes em `STORAGE_LOCAL_DIR`
(default `.storage/documents`) com a MESMA chave de objeto
`{userId}/{documentId}/{fileName}` e um sidecar `.meta.json` com contentType e
sha256. É proibido em produção (`LOCAL_BACKEND_FORBIDDEN`). Enquanto o registro
no banco não é possível, a ingestão guarda a metade já concluída na fila
`.storage/pending-ingest.json` (idempotente por sha256).
**Consequência:** Desenvolver e ingerir apostila sem credenciais e sem banco de
teste disponível; a migração local → R2/Supabase é cópia de chave para chave e
`documents.storage_path` continua válida. Ver
`.ai/adr/ADR-011-LOCAL-STORAGE-INGEST.md`.
>>>>>>> 477edfa3d4cab3171c49db8fa48b1dfb1a7dbcd6
