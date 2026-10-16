# 23 — Catálogo: proveniência, vocabulário canônico e regras de colisão

**Fase:** 2D (blindagem do catálogo). **Data da linha de base:** 2026-10-03.
**Natureza deste documento:** normativo e descritivo. Ele não cria, não renomeia e não apaga
nenhum tópico. Nada aqui altera comportamento de produção.

---

## 1. Linha de base verificada (não presumida)

Fonte: `database/knowledge/snapshots/2026-10-03-catalogo-atual.json`, gerado por
`scripts/catalog-snapshot.mjs` dentro de uma transação `SET TRANSACTION READ ONLY` com
confirmação `SHOW transaction_read_only = on`. O artefato declara `seed_compatible: false`,
`destructive: false` e `database.project_ref = REDACTED`.

| tabela | total | live |
|---|---|---|
| contests | 3 | 3 |
| editais | 2 | 2 (ambos vigentes, em concursos distintos) |
| knowledge_subjects | 33 | 33 |
| knowledge_topics | 31 | 31 |
| notice_subjects | 6 | 6 |
| notice_topics | 12 | 12 |

Cobertura de vínculos:

- `notice_topics` ligados a `knowledge_topics`: **0 de 12**;
- `notice_topics` com pai: **0 de 12**;
- `notice_topics` com peso: **0 de 12**;
- matérias pedagógicas sem nenhum tópico: **31 de 33** — só Direito Constitucional (18) e
  Português (13) têm conteúdo, e a soma deles é exatamente os 31 tópicos existentes;
- **Matemática tem zero `knowledge_topics`**: os 5 tópicos de edital da matéria não têm para
  onde apontar.

Quatro fatos que a auditoria anterior descrevia de forma imprecisa e o snapshot corrige:

1. os 12 tópicos de edital **são 7 de Português + 5 de Matemática**, não 6 + 6;
2. os nomes reais são longos e com parênteses (ex.: `Álgebra (Equações de 1º e 2º graus,
   sistemas e funções)`), não as formas curtas usadas em notas de reunião;
3. `notice_topics` **não possui coluna `slug`** — a unicidade é `(notice_subject_id,
   normalized_name)` via `uq_notice_topics_subject_norm`;
4. existem **duas linhas `notice_subjects` chamadas Português no mesmo edital**: uma com
   `weight = 50` e 7 tópicos, outra com `weight = 25` e zero tópicos. Antes de catalogar,
   confirme se a segunda é escopo de cargo (`position_id`) ou resto de carga anterior.

## 2. Vocabulário de proveniência

Quatro valores. `provenance` responde **de onde veio a informação**; `status` responde
**se já foi validada por humano**. São eixos separados e não se substituem.

| valor | definição | pode ser usado como verdade pedagógica? |
|---|---|---|
| `official` | transcription literal de documento oficial do concurso (edital, Anexo VI, retificação) | sim, com documento-fonte linkável |
| `historical` | veio de edital de outro ano, útil para treino e cobertura, não vincula ao edital vigente | sim, marcado com o ano |
| `provisional` | estrutura proposta (por humano, MCP ou plano de estudo) sem documento oficial que a sustente | não até virar `official` ou `historical` |
| `unverified` | ainda não houve conferência humana contra o documento-fonte | nunca; bloqueio de promoção |

Regras de combinação:

- `official` **não** convive com `unverified`: se não foi conferido contra o documento, é
  `provisional` + `unverified`;
- `historical` **exige** `source_year` preenchido;
- conteúdo de 2026 tem precedência sobre conteúdo de 2021 quando descrevem o mesmo edital
  vigente; precedência é de escopo, não de qualidade;
- `unverified` nunca justifica apagar, fundir ou renomear linha existente;
- a marcação vive em JSONB (`notice_topics.metadata`, `documents.metadata`), **sem**
  migração e **sem** coluna nova.

Chaves usadas no metadata: `source_type`, `source_year`, `provenance`, `status`,
`edital`, `disciplina` (nome literal do edital, que nem sempre é o nome canônico).

## 3. Política aplicada ao acervo CBMERJ 2021

Toda carga do edital CBMERJ 2021 entra com:

```json
{
  "source_type": "historical",
  "source_year": 2021,
  "provenance": "unverified",
  "status": "provisional"
}
```

- Enquanto `provenance = unverified`, o conteúdo serve para exercício e cobertura, **não** para
  afirmar peso, nota ou obrigatoriedade no edital vigente;
- **Raciocínio Lógico fica `PENDING`**: não existe catálogo pedagógico para a matéria, não
  existe linha de edital para ela hoje, e não houve conferência do Anexo VI de 2021. Nenhum
  tópico de Raciocínio Lógico pode ser criado nesta condição;
- `Matemática` também está bloqueada para vínculo: tem 5 tópicos de edital e zero
  `knowledge_topics`.

## 4. Vocabulário canônico futuro de matérias

Proposta canônica para o catálogo pedagógico, em português correto e com acento:

| canônico | variação que existe hoje em camada de edital |
|---|---|
| `Português` | `Língua Portuguesa` |
| `Matemática` | `Matemática e Raciocínio Lógico` |
| `Raciocínio Lógico` | (ainda não existe como linha) |

**Nada é renomeado agora.** `knowledge_subjects.Português` e as demais linhas existentes
continuam com o nome atual. O motivo é técnico, não estético:
`uq_knowledge_subjects_name` compara o **nome bruto**, então renomear cria identidade nova e
abre espaço para a grafia antiga voltar como matéria duplicada.

A forma literal do edital (`Língua Portuguesa`, `Matemática e Raciocínio Lógico`) **pode e
deve continuar** em `notice_subjects.metadata`/`notice_topics.metadata` como registro de
transcrição: é o que prova de onde veio a linha. A canonicidade se dá no vínculo
(`notice_subjects.knowledge_subject_id`), não pela reescrita do texto do edital.

## 5. Regras de catalogação para a FASE 3

1. `knowledge_topics` é o **catálogo pedagógico reutilizável**: pertence a uma
   `knowledge_subject` e pode ser compartilhado por vários editais e cargos.
2. `notice_topics` é **camada de edital**: peso, quantidade de questões, ordem,
   transcrição literal. Não é lugar de conteúdo explicativo.
3. Todo `notice_topics` novo deve apontar para um `knowledge_topics` equivalente quando ele
   existir. Hoje são 0 de 12: os nomes de edital trazem detalhe entre parênteses, e nem a
   correspondência exata nem a correspondência por slug do `TopicResolverService` alcançam.
   A FASE 3 precisa de **tabela de mapeamento explícita**, revisada por humano.
4. Conteúdo oficial de 2026 tem precedência sobre conteúdo histórico de 2021 para o edital
   vigente. Precedência não é licença de sobrescrita.
5. Conteúdo histórico **não é apagado automaticamente** por existir equivalente mais novo.
6. `weight = NULL` significa **peso desconhecido**, nunca zero. O CHECK
   `chk_notice_topics_weight` já permite NULL e restringe o intervalo a 0–100 quando presente.
   Confundir ausência com zero distorce plano de estudo e ranking de prioridade.
7. Duplicata descartada, pai inexistente e pai ambíguo **devem produzir diagnóstico** com a
   entrada perdida, a sobrevivente e o critério usado. Silêncio não é idempotência.
8. Subordinação sem pai **não** é promoção a raiz: é erro de origem até que alguém decida.
9. Hierarquia circula: se A é pai de B e B é pai de A, o ciclo deve ser reportado, não
   quebrado por inserção silenciosa dos dois como raiz.
10. Antes de qualquer carga, gere um snapshot novo. Depois dela, gere outro. A comparação
    entre os dois é a prova do que mudou; `git diff` do artefato substitui consulta ad hoc no
    banco compartilhado.
11. Nome canônico de tópico não se decide por slug: dois nomes diferentes podem ter o mesmo
    slug, e isso é conflito de conteúdo, não de escrita.

## 6. Política de colisão de normalização

Medido contra as funções reais `normalizeTopicName` e `slugifyTopic` (arquivo de testes da
FASE 2D). Quatro classes, todas com consequência diferente:

| classe | exemplo | normalized_name | slug | consequência real |
|---|---|---|---|---|
| colisão exata | `Classes de Palavras` × `Classes de palavras!` | igual | igual | `seen.has(norm)` descarta a segunda linha, **sem log e sem contagem** |
| invisível por acento | `Semântica` × `Semantica` (2021) | igual | igual | carga histórica some dentro da matéria já catalogada |
| divergência de chaves | `Morfologia & Sintaxe` × `Morfologia Sintaxe` | **diferente** | **igual** | `notice_topics` aceita os dois; o espelho em `knowledge_topics` viola `uq_knowledge_topics_slug_subject` e o lote morre com 23505 depois de a UI validar |
| ordinal | `Equações de 1º e 2º graus` | conserva `º` | perde `º` | **já presente na linha viva do edital**, provando que a divergência não é hipotética |

Ordem de resolução adotada: pontuação é removida, acento é removido, espaços colapsam —
nessa ordem, o `º` (U+00BA) **não** é decomposto por NFD (só NFKD faria isso), então ele
sobrevive em `normalized_name` e desaparece em `slug`. É o único caractere do conjunto que
as duas funções tratam de forma diferente.

## 7. Diagnósticos exigidos (contratos dos canários)

Seis testes `it.fails` estão registrados como falha esperada. Eles viram falha real quando
a implementação chegar — e isso é o sinal de que a especificação deve ser atualizada aqui.

| canário | exige |
|---|---|
| `E1` | `findTopicNameCollisions` e `findSlugCollisions` exportados pelo `topic-resolver.service` |
| `E2` | round-trip `normalizeTopicName(slugifyTopic(x)) === normalizeTopicName(x)` |
| `A4` | `diagnostics.discarded` com entrada perdida e sobrevivente |
| `B2` | `diagnostics.missingParents` quando o pai não está na lista |
| `C3` | `diagnostics.ambiguousParents` com todos os candidatos equivalentes |
| `D3` | `diagnostics.clampedWeights` quando peso fora de 0–100 é truncado |

## 8. Como gerar e guardar um snapshot

```powershell
node --check scripts/catalog-snapshot.mjs
node scripts/catalog-snapshot.mjs --out database/knowledge/snapshots/2026-10-03-catalogo-atual.json
```

Opções: `--env-file`, `--force` (só conscientemente: o arquivo anterior é a única prova da
linha de base) e `--stdout` (inspecionar sem gravar). Não existe opção de escrita no banco:
o parser recusa flags desconhecidas e o script não contém DML.

O artefato **não é seed** e não tem caminho de aplicação. O projeto também não possui
`database/run-seeds.mjs`; a sementeira real é `sql/seed.sql`, protegida por
`scripts/db-guard.ts`, e ela não cobre o catálogo atual (31 tópicos pedagógicos e 12 de
edital não são reproduzíveis por seed versionado — é exatamente por isso que o snapshot
existe).

## 9. Higiene de project ref (pendência registrada, não incidente ativo)

Três arquivos citam referência de projeto Supabase em texto:

- `database/knowledge/planner-p1p5-minimal.sql`
- `docs/18-CREDENTIAL-ROTATION.md`
- `docs/25-SDD-IMPLEMENTACAO-RECENTE.md`

Nenhum deles contém segredo: são refs identificáveis de projeto, não chave, não token e não
string de conexão. Por isso **não** são incidente ativo e **nada foi alterado** nesta fase —
mexer neles agora poluiria o diff de 52 grupos pendentes com uma mudança de outra natureza.
Fica a regra: artefatos gerados por ferramenta (snapshots, logs, relatórios) nunca devem
conter ref, host ou credencial; o gerador desta fase já redige (`database.project_ref` é
sempre `REDACTED`).

## 10. Estado do guard de banco

`BANCO DE TESTE ISOLADO NÃO CONFIGURADO`, por decisão de projeto, não por falha de código.

- `PROD_SUPABASE_PROJECT_REF`: vazio;
  
- `SAFE_TEST_DATABASE_REFS`: vazio;
- consequência: `db:push`, `db:seed`, `db:migrate`, `drizzle:migrate` e
  `ingest:apostilas --apply` continuam bloqueados por `scripts/db-guard.ts`;
- os testes desta fase não precisam de banco: usam mocks de Drizzle e funções puras;
- o snapshot é o único acesso previsto, e é somente leitura, com abort explícito se
  `transaction_read_only` não for confirmado como `on`.

## 11. Pré-requisitos para executar a FASE 3

1. Snapshot gerado e commitado (feito nesta fase).
2. Testes de colisão e hardening verdes, com os canários registrados (feito).
3. Este documento revisado por quem decide vocabulário (pendente de leitura humana).
4. Tabela de mapeamento `notice_topics` → `knowledge_topics` escrita por humano para os 12
   tópicos vigentes, antes de qualquer vínculo automático.
5. Decisão explícita sobre a segunda linha `notice_subjects` de Português (peso 25, zero
   tópicos): manter como escopo de cargo ou tratar como resíduo.
6. Raciocínio Lógico e Matemática permanecem sem catálogo pedagógico até haver documento
   oficial conferido e banco de teste isolado para aplicar a carga.
7. Cada carga da FASE 3 entra com par de snapshots (antes/depois) e com o relatório de
   diagnósticos dos canários já implementados.

## 12. Arquivos desta fase

| arquivo | papel |
|---|---|
| `src/lib/knowledge/services/__tests__/catalog-normalization-collisions.test.ts` | caracterização das colisões, com nomes reais do banco |
| `src/lib/administration/repositories/__tests__/notice-topic.repository.hardening.test.ts` | caracterização de descarte, pai ausente, ciclo, ambiguidade, peso e replace destrutivo |
| `scripts/catalog-snapshot.mjs` | gerador somente leitura, transação READ ONLY confirmada e redação de credencial |
| `database/knowledge/snapshots/2026-10-03-catalogo-atual.json` | linha de base versionada (não é seed) |
| `database/knowledge/snapshots/README.md` | como gerar, o que é, o que não é |
| `src/lib/catalog/services/catalog-subject-vocabulary.ts` | §4 de vocabulário em código: alias que resolve assunto (nunca renomeia) e cabeçalhos publicados sem alvo canônico |
| `docs/27-VOCABULARIO-EM-CODIGO-E-MEDIDA-CALIBRADA.md` | medida calibrada do CBMERJ-2021 sobre as 278 unidades do edital histórico, IDs de regra e precedência de colisão |
| `docs/23-CATALOGO-PROVENIENCIA-E-VOCABULARIO.md` | este documento |
