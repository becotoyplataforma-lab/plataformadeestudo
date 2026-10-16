# 28. CourseCatalogAgent: catalogar novo curso sem repetir o trabalho manual (FASE 4B)

Data: 2026-10-03. Natureza: registro de implementação e de uso. Este documento não cria regra de
catálogo: as regras de proveniência e vocabulário continuam sendo `docs/23`, a fonte documental do
edital CBMERJ 2021 continua sendo `docs/24`, e os IDs de regra determinística (SUBJ-xx, TOPIC-xx)
bem como a precedência dos detectores de colisão continuam registrados em `docs/27`. O que entra
aqui é o **agente**: como se usa, o que ele mede, o que o DeepSeek pode e não pode fazer, e por que
APPLY continua bloqueado.

## 0. Numeração: por que 28, e o estado do 26

`docs/24` §N.5 reserva `docs/26-REVISAO-DE-VOCABULARIO-E-VINCULO.md` para a **FASE 3B** — a revisão
humana de vocabulário e a tabela de vínculo `notice_topics` → `knowledge_topics` exigida por
`docs/23` §11. O registro da FASE 4 ficou em `docs/27`, que explica no §0 dele por que não 26.

A FASE 4B não cria documento concorrente e não toma o número 26: ela é este arquivo (28).
`docs/26` continua reservado e continua sem existir de propósito; nenhuma linha de código aponta
para lá (verificado em `src/lib/catalog`). Quem precisar do histórico da divergência lê `docs/27`
§0 e §9.

## 1. O que a fase entregou

| arquivo | papel |
|---|---|
| `src/lib/catalog/types/catalog-agent.ts` | contratos da borda: pedido (`source` / `contest` / `mode`), evidência em três camadas, proposta por disciplina e por tópico, resumo, `applyStatus`. Aditivo: não substitui `catalog-ingestion.ts` |
| `src/lib/catalog/services/contest-facts.service.ts` | fatos de edital medidos na fonte (banca, órgão, cargo, nível, vagas, questões, data, peso) com offset e página; IDs CONTEST-xx |
| `src/lib/catalog/services/deepseek-catalog-ai-client.ts` | adapter concreto de `CatalogAiClient` sobre o `DeepSeekProvider` que já existia; nenhuma segunda configuração de IA |
| `src/lib/catalog/services/catalog-report.service.ts` | relatório humano (§7) |
| `src/lib/catalog/agents/catalog-request-mapper.ts` | traduz a borda para `CatalogAuditRequest` / `CatalogSourceInput`; APPLY vira bandeira recusada; URL nunca é buscada |
| `src/lib/catalog/agents/catalog-analysis.ts` | projeção auditoria → proposta: `subjects`, `topics`, `summary` e rollup de disciplina (SUBJ-ROLLUP-00/01) |
| `src/lib/catalog/agents/course-catalog-agent.ts` | `analyze()` (fluxo completo) reusando `run()` intacto; costura de leitura de snapshot para teste |
| `src/app/api/admin/catalog/analyze/route.ts` | `POST /api/admin/catalog/analyze` (admin) |
| `src/lib/catalog/agents/__tests__/novo-curso-2026.fixture.ts` | edital pequeno de **outro** concurso, com disciplina existente, tópico existente, vizinho semântico, tópico novo, colisão e disciplina inexistente |
| `src/lib/catalog/agents/__tests__/fake-catalog-client.ts` | cliente de IA de teste: lê o próprio prompt e responde por candidato, sem rede |
| `src/lib/catalog/agents/__tests__/course-catalog-agent.test.ts` | fonte, extração, casamento, colisões, proposta, apply, relatório (33 testes) |
| `src/lib/catalog/agents/__tests__/cbmerj-2021.agent.test.ts` | agente completo contra a calibração de `docs/27` (7 testes) |
| `src/lib/catalog/services/__tests__/deepseek-catalog-ai-client.test.ts` | adapter: contrato, timeout, falha, resposta vazia, schema, overreach (12 testes) |
| `src/app/api/admin/catalog/analyze/__tests__/api-admin-catalog-analyze.test.ts` | guarda, 400/422/200, APPLY recusado, IA indisponível (9 testes) |

Nada de banco, migração, seed ou deploy foi executado nesta fase.

## 2. Como iniciar uma nova catalogação

Pelo serviço (qualquer código de servidor):

```ts
import { CourseCatalogAgent } from "@/lib/catalog/agents/course-catalog-agent";
import { createDeepSeekCatalogAiClient } from "@/lib/catalog/services/deepseek-catalog-ai-client";

const agent = new CourseCatalogAgent({ aiClient: createDeepSeekCatalogAiClient() });
const analysis = await agent.analyze({
  mode: "AUDIT",
  source: {
    type: "text",
    content: textoDoEdital,
    label: "Edital X 2027 (arquivo 2)",
    extractor: "pdf-parse@1",
    capturedAt: "2026-10-03T00:00:00.000Z",
  },
  contest: { name: "Prefeitura X" },
  extraction: {
    disciplineVocabulary: ["Língua Portuguesa"],
    positionTitles: ["GUARDA MUNICIPAL"],
    includeDerivedTerms: true,
  },
  subjectAliases: [
    { publishedName: "Língua Portuguesa", canonicalSubjectName: "Português", rule: "docs/23 §4" },
  ],
  ai: { enabled: true, provider: "deepseek", maxCandidates: 40 },
});
console.log(analysis.report); // é isto que o humano lê
```

Pela rota administrativa (sessão de admin exigida):

```http
POST /api/admin/catalog/analyze
{ "source": { "type": "text", "content": "...", "label": "...", "extractor": "...", "capturedAt": "..." }, "mode": "AUDIT", "ai": true }
```

Saída de sucesso: `{ status: "AUDIT_COMPLETE", mode: "audit-only", requestedMode, applyStatus:
"BLOCKED", proposal: { source, contest, subjects, topics, collisions, aiProposal, conflicts,
summary }, applyRefusal: { code, databaseOperations: [], refusedBypassFlags }, report }`.

Fonte que não pode ser auditada devolve **422** com `status: "SOURCE_REFUSED"` e `blockingIssue`
legível — a recusa é resposta, não um 500. `type: "url"` sem payload é recusado por definição: esta
fase não busca nada remoto, e `SOURCE_URL_NOT_FETCHED` fica registrado como proveniência.

`source.type` aceita `text`, `pdf`, `document` e `url`. `pdf` e `document` entram em base64 e passam
pelo mesmo contrato de formato da FASE 4 (`src/lib/knowledge/format-contract.ts`): sem extrator, sem
texto, sem auditoria. Payload que não é base64 válido vira fonte vazia e é recusado — nada é
interpretado por engano.

## 3. Fluxo do agente

```text
fonte validada  ->  extracao do programa  ->  normalizacao  ->  colisoes  ->  snapshot (leitura)
  ->  casamento deterministico  ->  proposta DeepSeek (anotacao)  ->  validacao deterministica
  ->  conflitos  ->  apply (recusado)  ->  proposta + resumo + relatorio
```

`analyze()` nao reimplementa nenhuma dessas etapas: ele mapeia a borda para `CatalogAuditRequest`
(`catalog-request-mapper.ts`), chama `run()` — o caminho da FASE 4, intacto —, mede os fatos de
edital sobre o texto ja validado e projeta o resultado (`catalog-analysis.ts`). Por isso os números
da proposta sao literalmente os números da auditoria: `summary.reuseCatalog`, `newCanonical`,
`ambiguous`, `blocked` e `pendingReview` vêm de `audit.counts.byClassification`, e o `audit` completo
continua no payload.

A ordem de evidência do plano é a ordem de execução: TOPIC-01 (exato), TOPIC-02 (normalizado), slug,
vocabulário de assunto (SUBJ-02), proposta DeepSeek e revisão humana por último. Uma camada mais
fraca nunca sobrescreve uma mais forte, porque a classificação nasce só do
`catalog-matcher.service.ts` e a IA escreve apenas em `aiAssist`.

## 4. Fato publicado, valor declarado e campo ausente

Três camadas, nunca misturadas (`CatalogEvidenceKind`):

| camada | o que é | quem preenche |
|---|---|---|
| `SOURCE_FACT` | trecho publicado no edital, com `start`/`end`/`page` medidos | `contest-facts.service.ts` |
| `DETERMINISTIC_MAPPING` | rótulo declarado pelo caller (`contest.name/board/organ/position/level`) e nome de disciplina derivado de rótulo | `buildContestProfile` / `evidenceOfOrigin` |
| `AI_INTERPRETATION` | anotação de modelo, guardada em `aiAssist` | `ai-proposal.service.ts` |

`missingFields` é a terceira saída possível: sem âncora publicada, o campo fica ausente. O agente
**não** completa edital — banca, órgão, nível, vagas, questões, data e peso ou estão na fonte com
offset, ou estão na lista de ausentes.

| regra | campo | âncora publicada exigida |
|---|---|---|
| CONTEST-01 | banca | `Banca [Organizadora]:` |
| CONTEST-02 | órgão | `Órgão [estatal/público]:` |
| CONTEST-03 | nível | `Nível de escolaridade / instrução:` |
| CONTEST-04 | vagas | `Vagas:` / `Total de vagas:` |
| CONTEST-05 | questões | `Quantidade/Número de questões:` |
| CONTEST-06 | data da prova | `Data [provável] da prova: dd/mm/aaaa` |
| CONTEST-07 | nome do concurso | `Concurso público:` / `Concurso [público] para|de …` |
| CONTEST-08 | cargo | `Cargo(s):` |
| CONTEST-09 | peso por disciplina | `Peso [específico]: 30` na linha da disciplina |
| CONTEST-10 | peso por percentual/questões | `(30%)` / `20 questões` na mesma linha |
| CONTEST-DECLARED-01 | qualquer campo escalar | apenas declarado — por isso vale `DETERMINISTIC_MAPPING` |

O peso só entra quando a âncora está na **mesma linha** do nome publicado (janela de leitura de
`WEIGHT_SCAN_WINDOW` = 200 caracteres). Peso nunca se deduz do número de tópicos. No perfil, o
primeiro fato publicado vence; declaração do caller só preenche campo sem fato publicado.

## 5. DeepSeek: proposta, nao autoridade

A porta é a da FASE 4: `CatalogAiClient { complete(prompt): Promise<string> }`. O adapter
`deepseek-catalog-ai-client.ts` é o único ponto do domínio que conhece o provedor, e delega ao
`DeepSeekProvider` que já existia (`@/lib/ai/services/deepseek-provider.service`): não há segunda
base de URL, segundo schema de chave nem nova variável de ambiente. A chave continua sendo
`DEEPSEEK_API_KEY` lida por `@/lib/env`.

O modelo é `flash` (`deepseek-chat`), com temperatura 0 e teto de espera
`CATALOG_AI_TIMEOUT_MS` = 45 s — o mesmo critério prático já registrado em
`apostila-transform.service.ts`: o `deepseek-reasoner` gasta tokens de saída no raciocínio interno e
pode voltar com `content` vazio em prompt longo; anotação de catálogo é extração curta.

| situação | o que acontece |
|---|---|
| sem `ai` no pedido | seção com `skippedReason: "AI_NOT_REQUESTED"` |
| fábrica sem chave | `createDeepSeekCatalogAiClient()` devolve `null`; seção `AI_CLIENT_UNAVAILABLE`; **zero chamadas de rede** |
| cliente real sem chave | `CatalogAiClientError("AI_NOT_CONFIGURED")` |
| provedor lento | `CatalogAiClientError("AI_TIMEOUT")` |
| provedor com erro | `CatalogAiClientError("AI_PROVIDER_FAILED")` com mensagem fixa — o texto cru do provedor fica no log, nunca no relatório |
| resposta sem conteúdo | `CatalogAiClientError("AI_EMPTY_RESPONSE")` |
| resposta que não é JSON ou fora do schema | rejeição `AI_SCHEMA_INVALID` |
| campo proibido na resposta (`classification`, `apply`, `subject_id`, …) | rejeição `AI_OVERREACH`, payload não ecoado |
| id de candidato inventado | rejeição `INVALID_AI_PROPOSAL` |
| falha de provedor na camada de proposta | rejeição `AI_PROVIDER_FAILED` |

Em nenhuma dessas linhas a classificação muda: rejeição é registro, não decisão. Os testes do adapter
usam `vi.mock` sobre o provedor e timers falsos — nenhuma requisição real é feita, e nenhum arquivo
`.env` foi lido ou alterado nesta fase.

## 6. Colisões: diagnóstico, nunca fusão

Os seis tipos continuam os da FASE 4: `NORMALIZED_NAME`, `SLUG`, `PUNCTUATION_ONLY`,
`CASE_OR_ACCENT_ONLY`, `REDUCED_KEY_VARIANT`, `ORDINAL_KEY_DIVERGENCE`. A precedência diagnóstica é a
nota de `docs/27` §3, e o `collisionId` é enumerado por `kind + chave` do grupo (não por posição
global), para que o mesmo edital produza o mesmo identificador em duas execuções.

O contrato de segurança continua explícito e testado: `deduplicated: false`, `discardedEntries: 0` e
toda entrada entregue ao normalizador. Um grupo de colisão é o aviso de que dois rótulos publicados
não podem virar uma linha só sem decisão humana — fundir em silêncio destruiria a prova de onde cada
nome veio. Cada tópico envolvido carrega `collisionIds` na proposta e aparece no relatório.

## 7. Revisão humana

`analysis.report` é texto legível gerado por `catalog-report.service.ts` a partir do mesmo payload —
não é uma segunda fonte de verdade. Ele traz, nesta ordem: concurso e perfil (fatos medidos com
página, e `missingFields`), resumo por classificação e por regra, colisões agrupadas com os rótulos
publicados, a seção de IA com propostas e rejeições, conflitos bloqueantes e de revisão, e o estado
de `apply`. O JSON fica ao lado porque revisão humana precisa decidir, e decisão precisa de id.

O fluxo pretendido é: rodar `AUDIT` → ler o relatório → decidir vocabulário e vínculo → registrar a
decisão no artefato humano (`docs/26`, FASE 3B) → só então existiria escrita. Enquanto `docs/26` não
existir, nada que o agente propõe tem endereço de destino.

## 8. Por que APPLY continua separado e bloqueado

`CatalogApplyStatus` é o literal `"BLOCKED"`: não existe outro valor possível no tipo, então nenhuma
projeção futura consegue "esquecer" o bloqueio. O campo `apply` vem do `refuseCatalogApply` da FASE 4
e traz `code: "APPLY_DISABLED_IN_AUDIT_PHASE"` com `databaseOperations: []` — a lista nunca é populada
em caminho algum deste domínio.

O modo `APPLY` é aceito no pedido **apenas para ser recusado**: `requestedMode` registra o que o
caller pediu, `mode` continua `"audit-only"` e os flags de bypass continuam caindo em
`refusedBypassFlags` em vez de ser ignorados em silêncio. Recusar visivelmente serve a mais do que um
400 mudo: a recusa fica no payload auditável.

O motivo é de projeto, não de código (AGENTS.md, segurança de banco): desenvolvimento e produção
apontam para o **mesmo** projeto Supabase enquanto não houver staging isolado, e toda escrita precisa
passar por `src/lib/db/env-guard.ts`. Sem `SAFE_TEST_DATABASE_REFS` (ou host local) e sem
`PROD_SUPABASE_PROJECT_REF`, não há para onde escrever. Antes de APPLY existir, precisam existir:

1. `docs/26-REVISAO-DE-VOCABULARIO-E-VINCULO.md` revisado por humano;
2. a tabela de vínculo `notice_topics` → `knowledge_topics`;
3. banco de teste isolado destravado no env-guard;
4. decisão sobre os ids canônicos de assunto/tópico a criar (o agente propõe, não cria).

## 9. Como catalogar um curso novo na prática

1. Obter o texto pelo pipeline que já existe (Apostilas → extrator do domínio de conhecimento). A
   fase não baixa nada: `url` é registrado como proveniência e recusado se vier sem payload.
2. Conferir o formato em `src/lib/knowledge/format-contract.ts`: `pdf`, `docx`, `txt`, `md`, `html`.
   `doc`, `epub`, `rtf`, `odt`, `ppt`, `pptx`, `xls`, `xlsx` e imagem são recusados no plano — sem
   extrator, virariam texto lixo indexado.
3. Providenciar proveniência completa: `label`, `extractor`, `capturedAt`. Sem rótulo a fonte é
   recusada; o agente não inventa.
4. Declarar no pedido apenas o que se sabe de fora para dentro: `extraction.disciplineVocabulary` e
   `extraction.positionTitles` com os rótulos publicados, e `contest.*` se houver.
5. Rodar `AUDIT` (rota ou serviço) e ler `report` + `summary`.
6. Tratar as quatro saídas que exigem humano: `missingFields`, `BLOQUEADO` (SUBJ-03, disciplina que
   não existe no catálogo), `AMBIGUO` (duas linhas canônicas pela mesma chave) e grupos de colisão.
7. Vocabulário novo entra em código (`catalog-subject-vocabulary.ts`, regra de `docs/23` §4) com a
   fonte da decisão citada — alias solto no caller é mapeamento, não vocabulário.
8. Repetir a auditoria e comparar os números. Nada escreve em banco.

## 10. Medida desta fase

CBMERJ 2021 passando pelo **agente** reproduz exatamente a calibração de `docs/27` (canário em
`cbmerj-2021.agent.test.ts`):

| métrica | valor medido |
|---|---|
| candidatos | 278 |
| `REUSO_CANONICO` | 9 |
| `NOVO_CANONICO` | 127 |
| `AMBIGUO` | 0 |
| `BLOQUEADO` | 64 |
| `PENDENTE_REVISAO` | 78 |
| regras | TOPIC-01: 9, TOPIC-04: 27, TOPIC-05: 100, TOPIC-06: 78, SUBJ-03: 64 |
| colisões | 78 grupos, 220 unidades |
| snapshot de leitura-only | 33 assuntos, 31 tópicos |

O ponto não é o número em si, é a igualdade: a camada nova é projeção, não decisão. Se `analyze()`
mudasse uma única classificação, o canário grita.

O caso sintético `novo-curso-2026.fixture.ts` (edital curto de **outro** concurso) cobre o que o
CBMERJ não cobre: disciplina publicada que já existe como assunto canônico (`Língua Portuguesa` →
`Português` pelo vocabulário de `docs/23` §4, sem alias do caller), reuso de tópico existente,
near-miss semântico, tópico novo em assunto sem cobertura, cinco tipos de colisão, disciplina
inexistente bloqueada e fragmento derivado de rótulo que nunca vira reuso. Os fatos de edital medidos
ali são `positions: 2`, `vacancies: 40`, `questions: 60` e peso publicado na linha da disciplina.

## 11. Validações e pendências

| checagem | resultado |
|---|---|
| `npx vitest run src/lib/catalog src/app/api/admin/catalog` | 8 arquivos, 123 testes passando |
| `npx vitest run` (repositório inteiro) | 1195 passando, 6 expected fail, 29 skipped |
| `npx tsc --noEmit` | sem erros |
| `npx eslint src/lib/catalog src/app/api/admin/catalog --max-warnings=0` | sem erros |
| escrita em banco | nenhuma: sem `INSERT`/`UPDATE`/`DELETE`, sem migração, sem seed, sem cliente de banco no domínio |
| rede | nenhuma: a IA de teste é fake e o provedor do adapter é mockado |
| `.env` / credenciais | intocados |

Pendências conscientes: (a) `docs/26` continua reservado e inexistente — é artefato de humano; (b) não
há UI de revisão, a rota devolve JSON + relatório; (c) não existe CLI do agente, apenas serviço e
rota; (d) a proveniência é validada duas vezes (no mapper e dentro de `run()`), o que é deliberado
para manter a FASE 4 intocada; (e) APPLY só existe como recusa até haver banco de teste isolado.
