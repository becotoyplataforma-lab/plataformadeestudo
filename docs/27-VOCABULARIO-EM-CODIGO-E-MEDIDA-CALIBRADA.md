# 27. Vocabulário de assunto em código e medida calibrada do catálogo
Data: 2026-10-03. Natureza: registro de implementação e de medida. Não introduz regra nova: as
regras de vocabulário e proveniência continuam sendo as de `docs/23`, e a fonte documental do
edital continua sendo `docs/24`. Este arquivo existe porque o código passou a depender de coisas
que só existiam em prosa.
## 0. Por que 27 e não 26
`docs/24` §N.5 reserva `docs/26-REVISAO-DE-VOCABULARIO-E-VINCULO.md` para a FASE 3B — o artefato
em que um humano revisa o vocabulário e escreve a tabela de vínculo exigida por `docs/23` §11
(itens 3 e 4). Este arquivo **não é** esse artefato e não o antecipa.
Quatro comentários no código de catálogo e uma anotação no `.gitignore` prometiam estar "documentados em `docs/26`" sobre três
coisas que nunca foram escritas lá: a decisão de onde moram os detectores de colisão, a
precedência diagnóstica de `classifyCollision` e o registro dos IDs de regra do matcher. Todos
passaram a apontar para cá, onde as três coisas estão de fato descritas (§3 e §4).

A FASE 4B (CourseCatalogAgent: entrada de novo curso, proposta DeepSeek e rota administrativa) está registrada em `docs/28`. Ela não reabre esta numeração, não toma o 26 e não cria artefato concorrente: `docs/26` continua reservado para o humano.
## 1. O que mudou de fato
| ponto | antes | agora |
|---|---|---|
| vocabulário de assunto (`docs/23` §4) | só em prosa, no documento | `catalog-subject-vocabulary.ts`, consumido pelo matcher |
| resolução de assunto | `subjectAliases` só vinha do caller; nenhum caller passava alias → **0** `REUSO_CANONICO`, e todo `Língua Portuguesa` caía em `SUBJ-03` | alias do caller + vocabulário declarado em código → 9 `REUSO_CANONICO` reais |
| IDs de regra | listados em bloco de comentário do matcher, sem registro fora do código | §4 deste arquivo |
| detectores de colisão | `collisionId` enumerava pela posição global na saída | sequência por `kind + chave` do grupo |
| classificação `PUNCTUATION_ONLY` | comparava texto cru removendo pontuação, o que também apagava acento e caixa → prometia "só pontuação" quando a diferença era mista | `punctuationInsensitive` preserva acento e caixa; diferença mista fica no genérico `NORMALIZED_NAME` |
| medida do edital 2021 | `measurements.probe.test.ts` escrevia `probe.json` na raiz e não assertava nada | teste de calibração com os valores medidos; dump só quando `PROBE_OUT` está definido |
## 2. Vocabulário de assunto em código
`src/lib/catalog/services/catalog-subject-vocabulary.ts`:
- `CANONICAL_SUBJECT_ALIASES` reproduz a tabela de `docs/23` §4 sem inventar quarta linha:
  `Língua Portuguesa` → `Português` e `Matemática e Raciocínio Lógico` → `Matemática`.
- A terceira linha de §4 (`Raciocínio Lógico` — "ainda não existe como linha") está
  **desatualizada contra o snapshot atual**: a linha existe (`slug: raciocinio-logico`,
  `status: active`). Por isso esse cabeçalho casa direto por `SUBJ-01` e não entrou como alias.
- `UNMAPPED_PUBLISHED_SUBJECTS` registra `Conhecimentos Específicos` e `Conhecimentos Básicos`
  como cabeçalhos sem alvo canônico. É anotação para o revisor humano; não autoriza alvo.
Contrato que a implementação preserva:
1. **Alias resolve, nunca renomeia.** `uq_knowledge_subjects_name` compara o nome bruto, então
   renomear criaria identidade nova e deixaria a grafia antiga voltar como matéria duplicada
   (`docs/23` §4). Nada aqui escreve em `knowledge_subjects`.
2. **Alias só vale se o alvo existir.** `aliasFor` confirma o alvo com `lookupSubject` no
   snapshot; sem alvo a linha continua `SUBJ-03` / `BLOQUEADO`. Alias não fabrica catálogo.
3. **Precedência: caller primeiro.** Um edital pode declarar mapeamento mais específico que o
   vocabulário geral; o vocabulário em código é linha de base, nunca substitui decisão humana.
4. **Comparação por `normalizeTopicName`.** A grafia do arquivo-fonte não depende de acentuação
   para funcionar, e o nome canônico resolvido continua sendo o do snapshot (`Português`).
O contrato acima e as suas exceções estão fixados em
`src/lib/catalog/services/__tests__/catalog-matcher.service.test.ts`, com snapshot sintético (nada de
banco, nada de arquivo gerado): caller vence o vocabulário, alias sem alvo cede ao
vocabulário, alias que aponta linha inativa para em `TOPIC-07` e cabeçalho sem alvo
para em `SUBJ-03`.
## 3. Normalização e colisão: diagnóstico puro
`src/lib/catalog/services/topic-normalizer.service.ts`:
- Reusa `normalizeTopicName` e `slugifyTopic` de `topic-resolver.service.ts` em vez de
  reimplementar: normalização editorial e normalização de catálogo não podem divergir. Os
  detectores moram neste arquivo porque `topic-resolver` é linha de base protegida (hash
  registrado) e resolve assunto de **questões**, não de edital.
- `buildReducedKey` colapsa as duas grafias de ordinal (`1º`, `1 o`, `2o` → `2`) e troca `&`
  editorial por ` e `. É chave de **diagnóstico**, nunca de unicidade.
- Precedência de `classifyCollision`, na ordem exata:
  1. `rawName` idêntico → `NORMALIZED_NAME`;
  2. `normalizedName` idêntico → `CASE_OR_ACCENT_ONLY` se sobrou só caixa/acento,
     `PUNCTUATION_ONLY` se sobrou só pontuação/espaço, senão `NORMALIZED_NAME`;
  3. `reducedKey` idêntico → `ORDINAL_KEY_DIVERGENCE` / `SLUG` / `REDUCED_KEY_VARIANT`;
  4. só `slug` idêntico → `SLUG`;
  5. nada em comum → `null`.
- `punctuationInsensitive` tolera pontuação e espaçamento **mantendo** acento e caixa;
  `caseAccentInsensitive` tolera caixa e acento **mantendo** a pontuação. Um comparador único
  misto faria `PUNCTUATION_ONLY` afirmar o que não é. O caractere U+00B5 foi removido da
  tolerância: não ocorre na fonte e mascararia diferença real.
- `collisionId` é **estável**: a sequência incrementa por `kind + chave do grupo`. Entrar um
  candidato novo sem relação com um grupo existente não renumera os demais, então o ID pode ser
  citado em revisão humana sem quebrar a cada rodada.
- Todo detector devolve grupos com `deduplicated: false` e `discardedEntries: 0`. Nenhum detector
  remove, funde, descarta ou reescreve o array de tópicos. A política é a de `docs/23` §6:
  colisão é **sinal**, não limpeza.
## 4. Registro dos IDs de regra do matcher
| id | condição | resultado |
|---|---|---|
| `SUBJ-00` | unidade sem disciplina publicada | `PENDENTE_REVISAO` (falta de proveniência, não de matéria: o conflict service registra `PROVENANCE_MISSING`) |
| `SUBJ-01` | cabeçalho publicado já é nome de assunto canônico ativo | segue para o tópico |
| `SUBJ-02` | alias (caller ou vocabulário em código) aponta para assunto existente | segue para o tópico, `subjectAliasApplied = true` |
| `SUBJ-03` | nenhum assunto canônico compatível com o cabeçalho | `BLOQUEADO` |
| `TOPIC-01` | reuso exato por `normalizedName` | `REUSO_CANONICO` |
| `TOPIC-02` | reuso por `slug` | `REUSO_CANONICO` |
| `TOPIC-03` | mais de uma linha canônica responde pela mesma chave | `AMBIGUO` |
| `TOPIC-04` | nome publicado literal ausente no catálogo, assunto com cobertura | `NOVO_CANONICO` |
| `TOPIC-05` | assunto canônico existe com **zero** tópicos | `NOVO_CANONICO` |
| `TOPIC-06` | nome derivado (origin não publicado) sem correspondência | `PENDENTE_REVISAO` |
| `TOPIC-07` | assunto fora do snapshot ou inativo | `BLOQUEADO` |
`ruleApplied` é **uma** regra por linha, avaliada na ordem acima. A IA (`ai-proposal.service`)
pode anotar a linha, nunca reclassificar.
## 5. Medida calibrada do CBMERJ-2021
Fonte: transcrição literal de `docs/24` §E, reproduzida por `cbmerj-2021.fixture.ts` — o fixture
lê o documento, não retranscreve. Alvo: snapshot somente leitura
`database/knowledge/snapshots/2026-10-03-catalogo-atual.json` (33 assuntos, 31 tópicos,
validação `ok`: 0 órfãos, 0 soft-deleted, 33 linhas de análise).
### 5.1 Origem medida
| bloco | páginas | caracteres da transcrição |
|---|---|---|
| E.1 Combatente (+ CNH cat. B) | 22–23 | 3.368 |
| E.2 Técnico de Enfermagem | 23–24 | 3.930 |
| E.3 Guarda-Vidas | 24–25 | 3.285 |
Texto analisado: 6 páginas, 10.585 caracteres, 1.289 palavras,
SHA-256 `a81cb9a69239a1215b4f0f8e19d8eb91c0f359a9e2e4e78f854aec5a2afd7b41`.
Os comprimentos acima são da **transcrição** de §E, não do texto integral do PDF medido em
`docs/24` §G (3.375 / 3.943 / 3.294): a diferença é o espaçamento e as quebras de linha que a
transcrição não recria. Um número não substitui o outro.
### 5.2 Contagem por disciplina
Valores da primeira linha de cada disciplina (bloco E.1). E.2 e E.3 repetem o mesmo número
quando a disciplina é a mesma — consequência da identidade de conteúdo provada caractere a
caractere em `docs/24` §G.1.3.
| disciplina | períodos | rótulos publicados | rótulos sem dois-pontos | unidades soltas | unidades publicadas | termos derivados |
|---|---|---|---|---|---|---|
| Língua Portuguesa | 10 | 6 | 0 | 5 | 11 | 27 |
| Matemática | 1 | 4 | 1 | 0 | 4 | 22 |
| Raciocínio Lógico | 8 | 1 | 0 | 7 | 8 | 3 |
| Conhecimentos Específicos | 29 | 6 | 0 | 23 | 29 | 35 |
`docs/24` §F.2 declara 11 períodos para Português; o extrator mede 10. A divergência é registrada
no resultado como `MEASUREMENT_DIVERGENCE`, não resolvida em silêncio.
### 5.3 Avisos do extrator
| código | ocorrências |
|---|---|
| `PAGE_MARKERS_PRESERVED` | 1 |
| `SOURCE_LABEL_AMBIGUITY` | 3 |
| `MEASUREMENT_DIVERGENCE` | 3 |
### 5.4 Casamento das 278 unidades
| classificação | unidades | regra |
|---|---|---|
| `REUSO_CANONICO` | 9 | `TOPIC-01` 9 |
| `NOVO_CANONICO` | 127 | `TOPIC-04` 27 + `TOPIC-05` 100 |
| `PENDENTE_REVISAO` | 78 | `TOPIC-06` 78 |
| `BLOQUEADO` | 64 | `SUBJ-03` 64 |
| `AMBIGUO` | 0 | — |
Diagnóstico: 78 grupos de colisão, todos de `kind` `NORMALIZED_NAME`, cobrindo 220 das 278
unidades. Acordo de chave completa contra as linhas canônicas do snapshot: **0**.
## 6. O que a medida diz
- **Os 9 reusos são reais e vieram do vocabulário.** Três nomes canônicos do snapshot
  (`Semântica`, `Figuras de Linguagem`, `Pontuação`) aparecem no edital de 2021 dentro de
  `Língua Portuguesa`, repetidos nos 3 cargos. Com `Língua Portuguesa` travado em `SUBJ-03`, a
  contagem era 0 (`docs/24` §F.3). É o único ganho desta rodada que muda catálogo de verdade — e
  ainda assim sem escrever nada.
- **`Pontuação.`** reusa `Pontuação`: prova de que a normalização de pontuação não exige
  transcrição limpa da fonte.
- **Os 64 bloqueados são exatamente `Conhecimentos Específicos`** — assunto que não existe entre
  os 33 canônicos. Não há alias para ele, e não deve haver antes de decisão humana (`docs/23` §11
  itens 3 e 4).
- **Os 78 `PENDENTE_REVISAO` são todos de origem `DERIVED`**: fragmento de período não é tópico
  publicado, então não vira novidade canônica nem reuso. É onde a decomposição de texto corrido
  — interpretação, não estrutura do edital (`docs/24` §F.3) — paga o preço de ser marcada.
- **Os 100 `TOPIC-05` são Matemática e Raciocínio Lógico**: os dois assuntos existem no snapshot
  com **zero** `knowledge_topics` (`docs/24` §N.4). Não há nada a reusar, e a regra certa é
  propor novidade, nunca afirmar cobertura.
- **As colisões altas são estrutura do edital, não defeito de código**: os 3 cargos publicam o
  mesmo programa de Português e de Matemática. O detector mostra isso como grupos de 3, com
  `deduplicated: false`.
- **Zero acordo de chave completa é granularidade, não fracasso.** A chave do detector exige
  `(assunto, pai, nome, ordinal)`; a via de reuso do matcher usa nome + assunto. As 31 linhas
  canônicas do snapshot são de granularidade grossa. Se a granularidade mudar, o zero muda, e o
  teste avisa.
## 7. O que continua proibido
- **Nenhuma escrita.** `refuseCatalogApply()` devolve `APPLY_DISABLED_IN_AUDIT_PHASE`,
  `applied: false`, `databaseOperations: []` e registra as bandeiras recusadas — inclusive quando
  alguém oferece `force` ou `skip-review` (o teste passa `{ force: true, "skip-review": true }`).
- **Banco de teste isolado segue indisponível** (`PROD_SUPABASE_PROJECT_REF` /
  `SAFE_TEST_DATABASE_REFS` vazios): `db:push`, `db:seed`, `db:migrate` e
  `ingest:apostilas --apply` continuam bloqueados por guard (`docs/23` §10,
  `src/lib/db/env-guard.ts`, `scripts/db-guard.ts`).
- Alias **não** renomeia linha, **não** cria assunto, **não** cria tópico, **não** preenche
  `notice_topics.knowledge_topic_id`.
- `Raciocínio Lógico` continua `PENDING` para carga pedagógica (`docs/23` §3): o matcher resolve o
  assunto e as unidades dele terminam em `TOPIC-05`, sem efeito algum.
- O apply não ganhou caminho novo: chamar `applyCatalogPlan` continua recusando antes de olhar
  plano, snapshot, pedido de confirmação ou flag de ambiente.
## 8. Reproduzir a medida
```powershell
cd 'c:\Users\dev\plataforma de estudo'
npx vitest run src/lib/catalog --reporter=dot      # 47 testes de catálogo
$env:PROBE_OUT = Join-Path $env:TEMP 'probe.json'  # dump opcional, para inspeção humana
npx vitest run src/lib/catalog/services/__tests__/measurements.probe.test.ts
```
Sem `PROBE_OUT` o teste não escreve em lugar nenhum. O dump é artefato de inspeção e está
ignorado (`.gitignore`: `/probe.json`, `/*.probe.json`, `/database/knowledge/tmp/`).
## 9. Pendências desta linha
| pendência | de quem | bloqueia |
|---|---|---|
| Revisão humana do vocabulário (`docs/23` §11.3) | quem decide vocabulário | qualquer escrita |
| Tabela `notice_topics` → `knowledge_topics` escrita por humano (§11.4) | revisão | vínculo automático |
| Decidir se `Matemática e Raciocínio Lógico` é uma linha `Matemática` ou duas | revisão | o alias atual segue §4 e **não** é decisão final |
| Conciliar `docs/23` §4 com o snapshot quanto a `Raciocínio Lógico` | revisão de documento | §4 diz "ainda não existe como linha"; o snapshot diz que existe |
| Criar `contests` / `editais` CBMERJ 2021 | fase com escrita | banco de teste isolado |
| `docs/26-REVISAO-DE-VOCABULARIO-E-VINCULO.md` | FASE 3B | entra com §I e §N de `docs/24` |
## 10. Arquivos desta rodada
| arquivo | papel |
|---|---|
| `src/lib/catalog/services/catalog-subject-vocabulary.ts` | vocabulário de assunto de `docs/23` §4 em código |
| `src/lib/catalog/services/catalog-matcher.service.ts` | consome o vocabulário; alias do caller tem precedência; exporta `countByClassification` |
| `src/lib/catalog/services/topic-normalizer.service.ts` | precedência de classificação, `collisionId` estável, comparadores separados |
| `src/lib/catalog/services/__tests__/catalog-matcher.service.test.ts` | contrato de assunto: precedência de alias, alias sem alvo, linha inativa, `SUBJ-00`/`SUBJ-03`, `countByClassification` (15 testes) |
| `src/lib/catalog/services/__tests__/topic-normalizer.service.test.ts` | contrato de não-fusão, ordinais, `&` → ` e `, IDs estáveis |
| `src/lib/catalog/services/__tests__/measurements.probe.test.ts` | calibração do CBMERJ-2021 com os números de §5 |
| `src/lib/catalog/types/catalog-ingestion.ts` | `CatalogSubjectAlias`, `ruleApplied`, `subjectAliasApplied` |
| `docs/27-VOCABULARIO-EM-CODIGO-E-MEDIDA-CALIBRADA.md` | este documento |
## 11. Vocabulário da aprovação humana (FASE 5)

`docs/29` traz a justificativa; aqui entra só o vocabulário, que é onde este documento manda.

| termo | onde vive | o que é |
|---|---|---|
| `aprovado` | `CatalogApprovalStatus` | decisão humana vigente sobre a análise inteira |
| `rejeitado` | `CatalogApprovalStatus` | decisão humana vigente de recusa; também é decisão |
| ausência de registro | gate com `status: null` | "não decidido" — não existe `pendente` persistido aqui |
| `PRP-` + 24 hex | `proposalId` | identidade da **análise inteira** |
| `APR-` + 32 hex | `approvalId` | identidade da **decisão**, derivada do próprio conteúdo |
| `analysisDigest` | registro | cópia de `provenance.analysedTextSha256`, nunca rederivado |
| `proposalDigest` | registro | sha256 do canonical JSON da projeção de decisão |
| `supersedesApprovalId` | registro | correção vira registro novo; o anterior fica legível |

Regras de vocabulário desta fase:

- os dois literais são minúsculos e exatos. A validação **não** faz `trim()` nem `toLowerCase()`:
  `PENDENTE_REVISAO`, `APROVADO`, `"aprovado "` e `pendente` são recusados com `STATUS_INVALID`;
- `documents.review_status` (`aprovado | rejeitado | pendente`, em coluna) e o DTO de conhecimento
  (`pending`, em inglês, na borda) são de **outro domínio**. Nada foi importado de lá: aqui a
  decisão é um registro assinado por digest, e "não decidido" é ausência, não terceiro valor;
- identificador de **linha** não é identificador de **decisão**: `SUB-`, `TOP-` e `AIP-` seguem
  sendo linhas da proposta; a decisão é sempre sobre a análise inteira;
- `sha256Hex` agora tem uma casa só no domínio catálogo (`src/lib/catalog/services/catalog-digest.ts`)
  e `source-validator.service.ts` o re-exporta. Os dois hashes fora do catálogo
  (`scripts/migrate-storage-r2.mjs` e `src/lib/knowledge/storage/migrate-classifier.ts`) ficaram
  onde estavam: não há relação de digest com digest entre eles;
- o que fica fora do vocabulário de decisão fica fora do digest: `audit.*`, `report`, `aiProposal`,
  `aiAssist`, `apply`, `applyStatus`, `requestedMode` e os conflitos de IA e de APPLY. Relógio e
  modelo não são decisão, e não podem desfazer a de um humano.

Continua proibido, e a FASE 5 não pediu exceção: nenhuma escrita em banco, nenhuma migration,
nenhum seed, nenhuma rota, nenhuma UI, nenhuma chamada de rede, nenhum `.env` alterado. O gate
devolve `approved`, e quem manda em `apply` continua sendo `refuseCatalogApply`.