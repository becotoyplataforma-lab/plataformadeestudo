# Roteiro de piloto do MVP (fluxo testavel ponta a ponta)

> Como ler este roteiro: cada passo diz **o que executar**, **o que deve
> acontecer** e **o que aquilo prova**. Nenhum passo foi executado de ponta a
> ponta ate hoje: a cadeia completa depende de (a) material real, (b) backend de
> storage configurado e (c) banco onde as migracoes estejam aplicadas. As
> validacoes locais desta rodada (tsc, testes unitarios com mock, dry-run de CLI)
> estao registradas em `CHECKLIST-LANCAMENTO-MVP.md`.

## 0. Escolha do ambiente do piloto

| Cenario | Quando faz sentido | Risco |
| --- | --- | --- |
| Staging com banco isolado (recomendado) | primeiro piloto, usuarios de teste | exige provisionar o banco (ver `docs/BANCO-TESTE-ISOLADO.md`) |
| Producao com allowlist curto | piloto real, sem staging disponivel | escreve no mesmo banco do produto; sem teste de RLS/integracao rodando; rollback manual |

Pre-condicoes de contas (nomes de variavel, valores ficam fora do repositorio):

- `ADMIN_EMAILS` e `PROFESSOR_EMAILS` com 1 professor/admin piloto (ja definidos
  em `.env` e `.env.production`; `ADMIN_EMAILS` aparece em `.env:27` e
  `.env.production:17`).
- 2 contas de aluno criadas pelo fluxo normal (`/cadastro` -> `auth.users` ->
  `profiles`): uma vinculada ao cargo do material, outra de cargo diferente.
- Cargo, edital e materia existentes no catalogo (a UI de upload so aceita ids
  validos porque `validateDocumentScope` e chamado antes de gravar).
- Para a parte automatizada: `E2E_BASE_URL`, `E2E_USER_EMAIL`,
  `E2E_USER_PASSWORD`, `E2E_ADMIN_EMAIL` (lidos em `playwright.config.ts`) e ao
  menos uma credencial de professor. Sem `E2E_USER_EMAIL` os specs de homepage
  sao pulados.

## 1. Login do professor/admin

Executar: acessar `/login` e autenticar com a conta piloto.
Esperado: cookie de sessao, redirecionamento para `/dashboard`;  `/professor-apostilas` e
`/admin/apostilas` e `/professor` (Professor IA) ficam visiveis.
Prova: sessao + gate de perfil (`AdminGuardService.isProfessorOrAdmin`).
**Nao prova** recuperacao de senha (fluxo esta quebrado: ver passo 10).

## 2. Upload de uma apostila com cargo e edital validos

Executar: `/professor-apostilas` (pagina `src/app/(dashboard)/professor-apostilas/page.tsx`, que protege com `isProfessorOrAdmin` e redireciona quem nao e professor/admin; formulario `src/components/apostilas/professor-upload-form.tsx`)
ou `POST /api/knowledge/upload` com `file`, `subject_id`, `edital_id`,
`position_id`, `mcp_provider_id` e, se quiser layout em fases, `transformar=true`.
Lote: `POST /api/admin/apostilas/batch` com os mesmos campos de escopo
(`src/app/api/admin/apostilas/batch/route.ts:52-59`).
Esperado: 201/200 com `documentId`; arquivo no backend de storage; linha em
`documents` com `storage_backend` gravado e `metadata.mcp` carimbado.
Falhas legiveis: 401 sem sessao; 403 `FORBIDDEN` para aluno; 429
`RATE_LIMIT_EXCEEDED` (10/h free, 50/h pro, 100/h intensivo); 422
`MCP_CAPABILITY_UNAVAILABLE` se o provedor nao declara `ingest`; 413/erro de
tamanho acima de 25 MB; 503 se `STORAGE_BACKEND` estiver ausente ou invalido
(`src/lib/knowledge/storage/backend.ts:36-58`).
Bloqueio atual conhecido: `STORAGE_BACKEND` nao esta definido em `.env` nem em
`.env.production`, e as credenciais `R2_*` nao existem - o upload real vai falhar
ate isso ser decidido.

## 3. Confirmacao de processamento

Executar: `GET /api/knowledge/documents/[id]` (ou reprocessar com
`POST /api/knowledge/documents/[id]/process`).
Esperado: progresso `pending -> processing -> chunked/processed`; texto extraido;
chunks com `seq` sequencial e `fts_vector` populado pela coluna GENERATED.
Degradado aceitavel e esperado sem `EMBEDDING_API_URL`/`EMBEDDING_API_KEY`: o
documento para em `chunked` com `embeddingCount: 0`
(`src/app/api/knowledge/upload/route.ts:163,257`) - busca textual continua
funcionando, busca vetorial nao.
Prova: extracao + chunking + FTS. **Nao prova** embedding/indexacao vetorial.

## 4. Aluno do cargo autorizado encontra e le o material

Executar: logar como aluno do cargo, abrir `/apostilas`, filtrar, entrar em
`/apostilas/[id]` e `/apostilas/[id]/visualizar`, e testar
`GET /api/knowledge/documents/[id]/download`.
Esperado: documento listado e legivel; download devolve o arquivo lido do backend
**gravado no documento** (sem fallback entre Supabase e R2); 404 se o objeto nao
existir; 503 `R2_NOT_CONFIGURED`/`STORAGE_BACKEND` invalido se o backend estiver
mal configurado.
Prova: leitura autorizada pelo escopo do curso.

## 5. Aluno de outro cargo recebe acesso negado

Executar: logar como aluno de cargo diferente e abrir a URL direta do documento e
a listagem.
Esperado: ausencia na listagem e negacao na rota (404/`FORBIDDEN`), decidido no
backend - nunca no componente. A decisao fica em
`src/lib/knowledge/security/document-access.ts` e
`src/lib/knowledge/security/document-scope.ts`, com teste unitario
`src/lib/knowledge/services/__tests__/document-access.test.ts` (executado com
mock nesta rodada: passou).
Prova: politica de isolacao de corpus ao nivel de aplicacao. **Nao prova** RLS no
banco: isso so aparece com banco de teste + `src/integration/knowledge.integration.test.ts`.

## 6. Busca textual funcionando sem embeddings

Executar: `POST /api/knowledge/search` com `query`, `subject_id`/`topic_id` opcional
e `top_k` (contrato em `src/app/api/knowledge/search/route.ts:35-53`).
Esperado: resultados rankeados por `ts_rank` em `document_chunks.fts_vector`
(`src/lib/knowledge/services/hybrid-search.service.ts:197-212`); o escopo de
cargo/edital e resolvido no backend a partir da sessao - o cliente **nao** define
`positionId`/`editalId`.
Prova: o piloto entrega busca util sem depender de provedor de embedding.
## 7. RAG permanece desligado por padrao

Executar: `POST /api/ai/rag` sem definir `RAG_API_DISABLED`.
Esperado: 503 `RAG_ENDPOINT_DISABLED` **antes** de sessao, banco, quota e provedor
(`src/app/api/ai/rag/route.ts:10-16,60-75,120-124`). So `true`/`false` sao
reconhecidos; ausente, vazio ou invalido mantem a rota fechada, e o valor
configurado nunca aparece na resposta nem no log.
Estado verificado: `RAG_API_DISABLED` esta ausente de `.env`, `.env.local` e
`.env.production`. O piloto roda com RAG fechado - isso e postura de seguranca,
nao uma falha a corrigir agora.
Prova: nenhuma chamada paga acidental. **Nao prova** a qualidade da resposta RAG
(quando habilitada), que depende de banco + provedor.

## 8. Chat do Professor IA e controle de cota

Executar: `/professor` (chat), depois `GET /api/billing/entitlement` e conferir
o incremento em `ai_usage` (unidade por usuario+dia, indice unico
`uq_ai_usage_user_date` criado em `drizzle/0001_romantic_siren.sql`).
Limites que o contrato de planos espera (fonte
`src/lib/billing/repositories/__tests__/plans.contract.test.ts:32-59`, valores de
`public.plans`):

| Plano | mensagens/dia | tokens/dia | questoes/dia | documentos | preco |
| --- | --- | --- | --- | --- | --- |
| free | 5 | 100.000 | 20 | 3 | R$ 0 |
| pro | 500 | 1.000.000 | 200 | 20 | R$ 19,90 (promocional R$ 9,90) |
| intensivo | 2.000 | 5.000.000 | 1.000 | 100 | R$ 49,90 |

Alerta honesto: essa suite de contrato esta **pulando** localmente porque o gate
dela e a presenca de `DATABASE_URL` e o harness do Vitest nao carrega `.env`. Ou
seja, os numeros acima sao os esperados pelo codigo, nao os conferidos no banco.
Conferir no banco do piloto antes de cobrar.
Prova: quota aplicada por plano. **Nao prova** ativacao de plano pos-pagamento.

## 9. Recuperacao de senha (nao oferecer ao usuario)

Estado verificado: `src/app/api/auth/recuperar-senha/route.ts:46-56` chama
`supabase.auth.admin.generateLink({ type: "recovery", email })`, so degrupa
`error` e devolve `apiOk({ ok: true })` nos dois caminhos. `generateLink` **gera**
o link; nao envia e-mail. Nao existe transporte de e-mail no projeto (0 ocorrencias
de `nodemailer`/`resend`/`sendgrid`/`createTransport`/`SMTP_HOST` em `src` e 0 em
`package.json`) nem consumidor do token: nada em `src` le `action_link`,
`hashed_token` ou `verifyOtp`, e as unicas rotas de auth sao
`api/auth/[...nextauth]` e `api/auth/recuperar-senha`.
O fluxo quebrado esta exposto ao usuario em 4 pontos: `src/app/(auth)/recuperar-senha/page.tsx:16`,
`src/components/auth/forgot-password-form.tsx:22`,
`src/components/auth/login-form.tsx:114` e
`src/components/settings/settings-content.tsx:59`.
Decisao necessaria antes do piloto: concluir o fluxo (transporte + pagina que
consume o token + teste de rota) **ou** desligar esses 4 pontos e comunicar
suporte manual. Deixar a tela ligada e prometer recuperacao que nao acontece.
## 10. Pagamento (somente com credenciais de teste)

Executar: `POST /api/billing/checkout` com `planCode` (pro/intensivo) e
`payment_method` (`pix`/`card`), depois simular notificacao em
`/api/billing/webhook` e `/api/payments/webhook` (as duas rotas existem) e
confirmar `GET /api/billing/entitlement`.
Fatos do codigo: `CheckoutService.createCheckout` usa preapproval do Mercado Pago
(`src/lib/billing/services/checkout.service.ts:35-63`), o `planId` vem de
`system_settings` (`mp_plan_pro_id` / `mp_plan_intensivo_id`, linhas 154-165) e os
limites vem sempre de `public.plans` (`limits.resolver.ts:60-90`), nunca do
client.
Pendencias que impedem o passo hoje: `MERCADO_PAGO_ACCESS_TOKEN` de teste,
`MERCADO_PAGO_PUBLIC_KEY`, `MERCADO_PAGO_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`
de teste, e os `mp_plan_*_id` cadastrados em `system_settings` nao foram confirmados
nesta rodada.

## 11. Saude e segredos nos logs

Executar: `GET /api/health` e `GET /api/health/storage` (as duas rotas declaram
`force-dynamic`, senao o Next congela o JSON no build).
Conferir em cada tela: nenhum log com `token`, `secret`, `service_role`,
`DATABASE_URL`, e-mail de aluno ou conteudo de apostila.
Evidencia desta rodada que merece atencao: durante os testes unitarios apareceu
no stderr a linha `[knowledge/documents] Erro: Error: connection refused at
s3://bucket-private` - ou seja, a rota loga a mensagem crua do erro. O corpo HTTP
esta sanitizado (a resposta e 500 sem detalhe interno), mas a string do backend
de storage vai para o log. A redacao de segredo no `src/lib/observability.ts` e
por disciplina de call-site, nao central.

## 12. Bateria automatizada do piloto

| Camada | Comando | Estado nesta rodada |
| --- | --- | --- |
| Tipos | `npx tsc --noEmit` | executado, exit 0 |
| whitespace/conflict markers | `git --no-pager diff --check` | executado, exit 0 (so avisos CRLF/LF) |
| Unitarios/mocks do nucleo | `npx vitest run src/app/api/ai/rag src/lib/knowledge/mcp src/lib/knowledge/services/__tests__/document-access.test.ts src/lib/ai/__tests__ src/app/api/knowledge` | executado: 17 arquivos, 178 testes passando, 0 pulados |
| Ingestao em lote | `npm run ingest:apostilas -- --source materiais --workspace $ws` | executado em dry-run: 0 arquivos classificados (origem vazia) |
| Suite global | `npm test` | executado: 127 arquivos passando + 11 pulando; 1.484 testes passando, 6 esperado-falhar, 29 pulados, 63,48 s, exit 0 |
| Contrato de planos (gate) | `npx vitest run src/lib/billing/repositories/__tests__/plans.contract.test.ts` | **pula** (4 testes) por gate fail-closed (FASE 1, 2026-10-11): `resolveDatabaseTestGate` recusou a URL de producao e imprimiu a justificativa log-safe; o gate antigo `Boolean(DATABASE_URL)` teria liberado a leitura |
| Integracao real | `npx vitest run src/integration` | **pula inteiro** (25 testes em 10 arquivos): `hasDb` exige `isNonProductionDatabaseUrl(DATABASE_URL)` e nao existe banco de teste |
| E2E | `npx playwright test` | NAO executado: specs dependem de `E2E_USER_EMAIL`/`E2E_USER_PASSWORD` e de ambiente de teste; 12 specs em `tests/e2e/` + `global-setup.ts` |

## 13. Registro de evidencia (preencher durante o piloto)

| # | Passo | Data | Ambiente | Resultado | Evidencia |
| --- | --- | --- | --- | --- | --- |
| 1 | Login professor/admin |  |  |  |  |
| 2 | Upload com cargo/edital |  |  |  |  |
| 3 | Processamento/conteudo |  |  |  |  |
| 4 | Aluno autorizado le |  |  |  |  |
| 5 | Aluno de outro cargo negado |  |  |  |  |
| 6 | Busca textual |  |  |  |  |
| 7 | RAG 503 sem opt-in |  |  |  |  |
| 8 | Cota de IA |  |  |  |  |
| 9 | Recuperacao de senha |  |  |  |  |
| 10 | Checkout + webhook |  |  |  |  |
| 11 | Health e logs sem segredo |  |  |  |  |
| 12 | Bateria automatizada |  |  |  |  |

## 14. Criterio de aceite

Piloto pode comecar com 1-8 e 11-12 verdes, desde que:

1. o upload esteja funcionando (logo, `STORAGE_BACKEND` decidido e configurado);
2. o passo 5 (acesso negado) seja verificado por **rota**, nao por UI;
3. os passos 9 e 10 estejam explicitamente desligados ou concluidos - offering
   broken recovery ou cobrando sem webhook validado e o que nao pode acontecer;
4. exista banco onde as 9 migracoes de `drizzle/` estejam aplicadas e conferidas.