# ConcursoAI Platform — Notas de Release

## Campanha de finalização B1 → B10 (`a4bbf39` → `9a21365`)

- **Base (pré-campanha):** `a4bbf39` (2026-09-29) — *test: validate topic-aware planner flow*
- **Ponta publicada:** `9a21365` (2026-10-16) — *docs: runbook B7/B8/B9, guard/MCP no AGENTS e guias de teste/ingestao/piloto*
- **Janela de trabalho:** 2026-10-12 → 2026-10-16 (após ~2 semanas de hiato desde 09-29)
- **Commits:** 35 — `feat` 18 · `fix` 9 · `test` 5 · `ci` 1 · `chore` 1 · `docs` 1
- **Diff cumulativo:** 268 ficheiros, **+45.968 / −443** · **182 ficheiros novos, 0 removidos** (campanha puramente aditiva)
- **Estado no GitHub:** `main = 9a21365`; CI `python-agent-ci.yml` **verde**; working tree **clean**

---

### Alterações por área (top-level)

| Área | Ficheiros | +linhas | −linhas |
| --- | ---: | ---: | ---: |
| `src/` | 178 | 28.305 | 318 |
| `agents/` | 35 | 7.470 | 0 |
| `docs/` | 17 | 3.459 | 48 |
| `scripts/` | 16 | 2.520 | 57 |
| (raiz) | 11 | 493 | 16 |
| `tests/` | 3 | 742 | 2 |
| `database/` | 2 | 2.095 | 0 |
| `sql/` | 1 | 536 | 0 |
| `drizzle/` | 1 | 259 | 0 |
| `.github/` | 2 | 59 | 1 |
| `infra/` | 2 | 30 | 1 |
| **Total** | **268** | **45.968** | **443** |

---

### Destaques por tema

- **Banco de questões / Aula-14 + extrator PDF** — `c5549d1`, `5e0c52b`, `084caa7`, `df10b8d`; novo `agents/pdf_question_extractor/` (parser, gabarito, redaction, provenance, hashing + golden hash tests).
- **Guarda de escrita ao banco & paridade Drizzle** — `6def4ba`, `d10ba7e`, `80d5cfc`, `8fda416` (migration `drizzle/0008` de reconciliação), `a5e33b3`, `32fe282`, `ad7d818`; `env-guard`/`cli-db-guard`/`db-guard`.
- **Pipeline de conhecimento / ingestão & CLI** — `f39fa7c` (CLI de ingestão + contratos formato/MCP), `1653372` (estado honesto do pipeline), `64a4a2e` (dry-run de migração R2), `724ba49`, `877e8fa` (autorização + guarda).
- **Servidor MCP + auth + catálogo** — `a5009c7` (servidor MCP + ponte stdio), `5fb9cfa` (recuperação de senha, sem expor nada ao navegador), `f56cc3b` (motor de catálogo + snapshot).
- **Segurança CSP + ModelRouter + RAG/billing** — `adeeeb8` (política CSP Report-Only por omissão), `4b6cefd`, `eed5ced` (cliente ModelRouter com chave fora do navegador), `83009fc` (escopo por documento no RAG), `0b8ec45` (reivindicar evento no ledger antes do efeito), `c449b4c`, `d638b1f` (ligar CSP/headers).
- **Painel admin / storage-R2 & deploy** — `2a57763` (gitignore MCP do editor/worktrees/sucatas), `7746609` (migração de produção só por opt-in amarrado ao ref), `9dfd206` (integrar ModelRouter + download; documentar storage/R2), `1145be0` (deploy dispara por `drizzle/sql/scripts` + rsync source).
- **Agente Python + CI (B10)** — `d0d047d`: `agents/derived_copy_cleaner/` (13 ficheiros), `pytest.ini` e `.github/workflows/python-agent-ci.yml`.
- **Documentação final (pós-B10)** — `9a21365`: `CHECKLIST-DEPLOY.md` (nova §7 de entrega revalidada + §1 com `STORAGE_BACKEND`/`CSP_*`/`PROD_SUPABASE_PROJECT_REF`/`SAFE_TEST_DATABASE_REFS`) e `AGENTS.md` (guard de banco + arquitetura MCP + flags CSP); novos `docs/` `BANCO-TESTE-ISOLADO`, `GUIA-INGESTAO-APOSTILAS`, `ROTEIRO-PILOTO-MVP` + atualização de 7 docs.

> **Nota de proveniência / honestidade:** a numeração interna **B1..B10 não está gravada no git**. Os âncoras **B7–B10 são inequívocos** pelos sujeitos dos commits (B7=CSP `d638b1f`, B8=admin/R2 `9dfd206`, B9=deploy `1145be0`, B10=agents+CI `d0d047d`); os restantes estão **agrupados por tema** sobre o intervalo real `a4bbf39..9a21365`.

---

### Validação & CI

- **`python-agent-ci.yml`** — run `id=38991030475`, `event=push`, `branch=main`, `conclusion=success` (escopo: `agents/derived_copy_cleaner`).
- **`deploy.yml`** presente no `main`; dispara nos gatilhos próprios (passou a observar `drizzle/**`, `sql/**`, `scripts/**`).
- **Suite TS** (revalidada no CHECKLIST §7): `tsc --noEmit` 0 erros · `eslint` 0 · `vitest run` 938 passed / 29 skipped · `npm run build` sucesso.
- **Segredos:** varredura do diff da campanha sem credenciais expostas (0 hits).

### Pendências operacionais (externas, não são defeito de código — CHECKLIST §7)

- Banco de teste/staging isolado (o guard bloqueia escrita por omissão).
- Credenciais Cloudflare R2 + `STORAGE_BACKEND=r2` explícito em produção; rodar `scripts/migrate-storage-r2.mjs` em staging.
- Credenciais de embedding, Google OAuth, `DEEPSEEK_API_KEY`/`KIMI_API_KEY` de produção.
- Segredos de CI/CD do deploy e `MERCADO_PAGO_WEBHOOK_SECRET`.
- Playwright completo; ingestão real das 13 apostilas com `--apply` em banco isolado.
