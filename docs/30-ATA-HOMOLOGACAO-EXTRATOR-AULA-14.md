# 30. Ata de homologação — extrator de questões da Aula 14 e UI de revisão local

**Estado:** artefatos gerados, conferidos em disco por comando reproduzível e aprovados para **revisão
humana**. Sem banco, sem migration, sem INSERT, sem publicação, sem rota de apostila, sem geração de IA.
`status = em_revisao`, `isPublic = false`, `resolucao_status = pendente_geracao` em todos os 1.736 itens.

## 0. O que esta entrega não é

- **não é import:** `questoes_aula_14_import.json` está no formato que o `QuestionImportService` aceita,
  e só. Rodar o import é ato separado, com aprovação explícita, e ainda não aconteceu;
- **não é conteúdo publicado:** nada virou aula, card público ou índice buscável;
- **não é resolução de questões:** `explicacao` é `null` nos 1.736 itens. O comentário do compilador que
  veio no PDF é texto de terceiros e vive isolado, fora dos artefatos públicos e de import;
- **não é prova de gabarito:** gabarito é o que o material diz. Onde o material diverge de si mesmo, o
  item vai para quarentena — não se elege letra por maioria, por posição nem por plausibilidade.

## 1. Números, e de onde cada um sai

Fonte: `curso-384118-aula-14-somente-em-pdf-089a-completo.pdf`, 26.057.794 bytes, 862 páginas.

| grandeza | valor | sai de |
|---|---|---|
| seções no índice | **33** (16 comentadas, 17 listas) | `inventario_aula_14.json` |
| itens corporificados | **1.758** | `contagens.total_itens` |
| por tipo | 1.238 múltipla / 520 certo-errado | `contagens.por_tipo` |
| itens únicos por seção (soma) | 1.702 | `inventario[·].itens_unicos` |
| corpo distinto no artefato rico | 920 | `body_hash` distintos |
| hash de import calculado / distinto / repetido | 1.758 / 932 / 826 | `relatorio.hashes` |
| com gabarito | **1.720** | `contagens.com_gabarito` |
| sem gabarito | 38 | `contagens.sem_gabarito` |
| origem do **veredicto** (inclui quem não virou letra) | bloco 932 · comentário 744 · corpo duplicado 82 | `contagens.por_origem_veredicto` |
| origem do gabarito **com letra** | bloco 920 · comentário 718 · corpo duplicado 82 = **1.720** | `contagens.com_gabarito_por_origem` |
| recuperados por join de corpo | 82, em 761 grupos de cópia | `relatorio.recuperacao_por_corpo` |
| quarentena | **65** | `quarentena_aula_14.json` |
| inéditas do compilador (não entram no rico) | 22 | `contagens.ineditas` |
| artefato rico | **1.736** = 1.758 − 22 | `questoes_aula_14.json` |
| importáveis | **886** = 627 múltipla + 259 certo-errado | `relatorio.importaveis` |
| comentários isolados no arquivo LOCAL | 806 | `comentarios_aula_14_LOCAL.json` |
| procedência | oficial 1.694 · inconclusiva 30 · estrutura incompleta 12 · inédita 22 | `relatorio.procedencia` |

Os dois últimos blocos de origem **não são a mesma contagem** e é precisamente por isso que as chaves
foram separadas: ver §5.

## 2. Como reproduzir tudo abaixo deste teto

```powershell
# regenera artefatos (lê o PDF; cache de linhas limpas evita reprocessar)
agents\.venv\Scripts\python.exe -m agents.pdf_question_extractor.cli extract

# reconfere o que está no disco, sem reabrir o PDF, sem escrever nada
agents\.venv\Scripts\python.exe -m agents.pdf_question_extractor.cli verificar
#   -> VEREDITO: APROVADO | exit 0
#   -> VEREDITO: REPROVADO | exit 1, com cada violação em "artefato / regra / detalhe"

agents\.venv\Scripts\python.exe -m agents.pdf_question_extractor.cli resumo
agents\.venv\Scripts\python.exe -m pytest agents/pdf_question_extractor -q   # 120 passed
```

`verificar` aceita `--dest`, `--cache`, `--pdf` e `--json`. A identidade da mobília é re-derivada do
cache (`Paginas.de_cache` lê o campo `mobilia`), então a conferência não depende do PDF aberto; sem
cache nem PDF ela degrada para os padrões genéricos e **avisa** (`identidade_sem_fonte`) em vez de
fingir que conferiu.

## 3. Decisões de arquitetura que a homologação cobre

**3.1 Gabarito nunca é adivinhado.** Letras aceitas: `A`–`E`. `Certo`/`Errado` viram `C`/`E` no dado e
são exibidos como `Certo`/`Errado` na UI. Uma palavra por extenso no lugar de letra nunca é convertida
por heurística de similaridade: a réplica de `normalizeGabarito` do importador roda na geração, e o que
ela corromperia (`"Correto."` → `"E"`) vira quarentena. Conflito entre cópias do mesmo corpo, item
anulado e letra que não existe no tipo do item também.

**3.2 O portão de PII varre o artefato serializado, não o `enunciado`.** Um CPF no rodapé de página, no
nome do comprador ou em qualquer campo de metadados é vazamento do mesmo jeito. `redaction.vistoriar`
recebe o JSON inteiro de cada artefato antes da escrita; `verificacao.conferir_pii` recebe o texto cru do
arquivo depois.

**3.3 CPF é validado por dígito verificador (módulo 11), não por máscara.** Um bloco de 11 dígitos com
checksum inválido é **aviso**; com checksum válido é **bloqueante**. A mobília estrutural de página
(número de página detectado pela posição da linha, não pelo valor) é o que evita que paginação legítima
vire falso positivo. No dataset atual: 0 bloqueantes; os avisos do artefato rico são 160 sequências de
11 dígitos, 28 padrões de telefone e 229 blocos longos — números de prova (artigos, incisos, datas de
lei), rejeitados como não-CPF pelo próprio checksum.

**3.4 Comentário de terceiros fica isolado.** `comentarios_aula_14_LOCAL.json` (806 unidades) não é
artefato público nem de import, e é o único lugar onde esse texto existe.

**3.5 IDs são secao-escopados** (`A14-S01-001`), porque o número do item reinicia a cada seção e o
número original do PDF não é único. `body_hash` serve só para recuperar gabarito entre cópias — ele não
é, e nunca vira, identidade pública.

**3.6 Proveniência diz o que o material diz.** A pasta de estudo é `cbm-rj/portugues/...`, mas o alvo
escrito na apostila é **CBM-PE (Soldado)**. As duas coisas aparecem separadas na UI. Inventar `orgao`
não existe: `linha_import` manda órgão para `fonte`, que é a coluna que o importador tem.

## 4. O que `verificar` acrescenta sobre o portão de escrita

| checagem | por que não é redundante |
|---|---|
| artefato ausente / JSON inválido / container errado | o portão de escrita só vê o que ele mesmo produziu, e antes de gravar |
| CPF, marca de origem, marca d'água, mobília proibida no texto cru | cobre o arquivo adulterado **depois** da escrita — caso que o portão não pode ver |
| `status`/`isPublic`/`resolucao_status`/`explicacao` item a item | regressão semântica em `item_rico` não é PII, então o portão de escrita não a vê |
| contrato do importador por linha (aliases de `explicacao`, `alt_a`, ≥2 alternativas, letra ∈ alternativas) | `comentario` é sinônimo de `explicacao` no importador: se entrasse no artefato de import, o comentário de terceiros iria ao banco pela porta dos fundos |
| quarentena ∩ import = ∅ **por `content_hash` recomposto** | linha de import não carrega `id_local`; cruzar por id seria checagem vazia |
| somas do relatório vs. arquivos do disco | relatório que afirma número que os arquivos não sustentam é falha, não discrepância |
| `todos_limpos` e `varredura` declarados vs. reescaneio | o relatório não grava veredito de si mesmo; aqui ele é olhado |
| letra fora das alternativas ⇒ **quarentenado** | o defeito é da fonte; o invariante não é "nunca acontece", é "quem assim sozinhou não é importado" |
| texto de alternativa contendo marcador `A)`–`E)` de outra letra ⇒ **reprovado** | sequência contígua a partir de A não prova partição: coluna entrelaçada do PDF engole duas opções numa só, e o gate de disco pega isso mesmo quando o artefato foi escrito por outra mão |

## 5. Correções desta rodada, incluindo as minhas

**5.1 `por_origem_gabarito` foi renomeada e desdobrada.** A chave antiga bucketizava os 1.758 itens por
`origem_gabarito`, campo que é preenchido mesmo quando o item **não** termina em letra (o PDF diz
`ANULADA`, ou a letra dita não existe no tipo do item). Ela somava 1.758, e o nome dizia gabarito. Agora
são duas chaves, cada uma com a sua soma, e `verificar` exige que ambas fechem:

- `por_origem_veredicto` = 932 + 744 + 82 = **1.758** (`total_itens`);
- `com_gabarito_por_origem` = 920 + 718 + 82 = **1.720** (`com_gabarito`).

**5.2 Erro meu de síntese, registrado para não se repetir.** Em relatório anterior apresentei
932/744/82 como decomposição dos itens com gabarito, e "17 comentadas / 16 listas" como divisão de
seções. Os números lidos direto do artefato regenerado são os de §1 e §5.1: **16 comentadas, 17 listas**,
e a decomposição do gabarito com letra é 920/718/82. Todo número citado aqui foi lido do artefato
regenerado, não da memória de quem o gerou — que é, em última análise, a razão de §4 existir.

**5.3 Bug de `Certo`/`Errado` resolvido na origem.** O importador normaliza palavra por extenso; o
artefato agora emite o par sintético `alternativa_c = "Certo"` / `alternativa_e = "Errado"`, que faz
`validateQuestion` aceitar o item e impede a corrupção `"Correto."` → `"E"`. Os 259 itens C/E hoje
passam nessa checagem, e `verificar` reprova qualquer linha C/E cujo par não seja exatamente esse.

**5.4 JSX de `questao-card.tsx` restaurado** (fechos de `</div>` que faltavam antes do rodapé expandido),
e `.gitignore` passou a ignorar artefatos locais-only.

**5.5 Fuga de alternativas coladas, achada depois do primeiro APROVADO.** A checagem de sequência compara
as letras que **restaram** com `A..`: `["A","B"]` é contíguo e passa. Só que as colunas do PDF são lidas
entrelaçadas, então `A) … C) … B) … D) …` vira duas opções cujo texto carrega o marcador da vizinha — o
gabarito passa a apontar para uma alternativa que engoliu outras duas, e nada no lote era reprovado.
Medido: 10 itens de múltipla escolha com marcador interno, dos quais **6 já iam para o banco** (3 questões
canônicas, cada uma com cópia em outra seção). Regra nova, nos dois lados do portão:
`parser._marcas_embutidas` declara `alternativa_com_marca_de_letra` (quarentena, proveniência
`estrutura_incompleta`), e `verificacao._conferir_linhas` reprova a mesma forma lida do disco. Nada foi
realinhado por suposição: item colado sai do lote, não é remendado. Importáveis **889 → 886**, quarentena
**59 → 65**, `verificar` **APROVADO** de novo, `pytest` **125** verdes (5 testes novos).

## 6. Casos que pedem decisão humana antes de qualquer import

| caso | qtde | IDs / nota |
|---|---|---|
| letra de gabarito fora das alternativas, **quarentenadas** | 4 | `A14-S05-033` (E em A–D), `A14-S22-033` (mesmo corpo, mesma queixa), `A14-S23-001` (D em C/E), `A14-S23-005` (o bloco indica letra inexistente e o resolvidor recusa: fica sem gabarito) |
| alternativas fora da sequência | 3 | decisão: exibir com aviso ou excluir do lote de import |
| alternativa embutindo marcador de outra letra (**5.5**) | 8 | `A14-S09-045`, `A14-S26-045`, `A14-S11-057`, `A14-S28-057`, `A14-S17-015`, `A14-S33-015` (saíram do lote); `A14-S10-025`, `A14-S27-025` (já quarentenadas pela sequência). Conserto é do parser, não de digitação: realinhar letra a letra seria chute |
| sem chave no bloco de gabarito | 16 | quarentena; não se inferiu posição |
| conflito entre cópias do mesmo corpo | 5 grupos | quarentena; maioria não elege |
| anulado pelo material | 7 | gabarito não atribuído |
| enunciado vazio | 4 | descartados na carga da UI |
| sem gabarito algum | 38 | não importáveis |
| **total em quarentena** | **65** | `quarentena_aula_14.json` |

## 7. Pendências deliberadas (não são defeitos)

1. **Import no banco:** exige aprovação explícita; `verificar` deve estar verde no momento da decisão.
   **Dry-run feito** (`src/lib/administration/services/__tests__/aula-14-import-dry-run.test.ts`, repositório
   de escrita mocked, nenhum banco tocado): **886** linhas passam por `rowsFromFile` → `parseQuestion` →
   `validateQuestion` sem um único erro e sem `skipped` do próprio lote; **3.531** alternativas gravadas
   (3.013 + 518), `content_hash` único por linha e também entre os dois lotes, payload `status=em_revisao`,
   `isPublic=false`, `needsReview=true`, `explicacao=undefined`.

   1.1 **`tipo` — gap resolvido nesta rodada:** o dry-run anterior expôs que `importQuestions` fixava
   `tipo: "multipla_escolha"`, o que classificaria errado as **259** questões certo/errado
   (`questions.tipo` é `text` com default `multipla_escolha`, src/db/schema/study.ts:170; a UI já distingue
   os dois, src/lib/questoes/procedencia.ts:108). O serviço foi parametrizado:
   `importQuestions`/`importFromBuffer` aceitam `tipo` (`multipla_escolha` | `certo_errado`; o default é o
   primeiro, então lote antigo não muda de comportamento) e `validateQuestion(q, tipo)` virou guarda de
   coerência nos dois sentidos — linha do par `C=Certo`/`E=Errado` só é aceita em lote `certo_errado`, e
   lote `certo_errado` só aceita esse par. Tipo trocado não grava nada: cada linha vira erro nomeado.
   `POST /api/admin/questions/import` lê `tipo` do `formData` (400 `TIPO_INVALIDO` fora da lista) e o
   formulário admin ganhou o seletor de tipo por arquivo.
   1.2 **Execução pronta:** `scripts/importar-aula-14.ts` roda os dois artefatos com o tipo declarado por
   arquivo (627 `multipla_escolha` + 259 `certo_errado`). É dry-run por padrão; com `--aplicar` chama
   `assertNonProductionDatabaseUrl()` antes de qualquer escrita — no `.env.local` atual o destino é o próprio
   projeto de produção (`ref == prodRef`, `safe=false`), então `--aplicar` sai **BLOCKED** aqui, e escrita em
   produção segue pela rota de admin (sessão de admin, fila de revisão). Conferência do script nos artefatos
   reais: `linhas=886 importaveis=886 duplicadasNoLote=0 erros=0`, nenhuma linha escrita.
   1.3 **O que falta para o import:** medir `findByContentHash` contra banco real — as 826 repetições de
   corpo do PDF já cabem num único `content_hash`, mas a colisão com questões **já existentes** só é vista
   com banco conectado, e é esse número que decide entre `skipped` e relatório.
2. **Geração de resolução por IA:** sem credencial de provedor; `resolucao_status` fica em
   `pendente_geracao`.
3. **Rota de apostila da Aula 14:** não criada, por fronteira de escopo.
4. **Navegação:** a rota `/cbm-rj/portugues/questoes/aula-14` só é linkada do dashboard depois do smoke
   test em browser — a verificação desta frente foi por dados e por build, não por renderização.

## 8. Gate do que não entra em commit nem em banco

`comentarios_*_LOCAL.json`, o cache `.aula14_linhas_limpas.json`, despejos ad hoc de linhas, dumps
`_*.txt`/`_*.py`, `__pycache__` e qualquer artefato com bloqueante de PII. Os artefatos de `H:` estão
**fora do repositório**; a regra de `.gitignore` é defesa em profundidade para quem rodar `extract` sem
`--dest`.

## 9. Evidência de verificação

| checagem | resultado |
|---|---|
| `pytest agents/pdf_question_extractor` | **125 passed** (120 da homologação + 5 da regra 5.5: 3 em `test_parser.py`, 2 em `test_verificacao.py`) |
| `extract` regenerado após a regra 5.5 | seções=33 itens=1.758 com_gabarito=1.720 quarentena=65; varredura limpa em 7/7 |
| `verificar` no dataset real | **APROVADO**, exit 0, 7/7 artefatos, 0 bloqueantes, identidade re-derivada do cache; `import_multipla=627`, `import_certo_errado=259`, `rico=1.736`, `ids_unicos=1.736` |
| `verificar` com artefato adulterado após a escrita | exit 1, reprova por regra nomeada (ver testes) |
| dry-run do import (banco mocked) | 8 tests passed — 627+259=886/886 aceitas com o tipo declarado por lote, 0 erros, 0 skipped de lote, 3.531 alternativas, `content_hash` único inclusive entre os dois lotes; ver §7.1 |
| `question-import.service.test.ts` | 17 passed (6 novos: tipo por lote, guard nos dois sentidos, `conferirLote` sem escrita, `importFromBuffer`) |
| `scripts/importar-aula-14.ts` em dry-run nos artefatos reais | exit 0 — `linhas=886 importaveis=886 duplicadasNoLote=0 erros=0`, nenhuma linha escrita; `--aplicar` é BLOCKED porque o `DATABASE_URL` local é o projeto de produção |
| `tsc --noEmit` / ESLint nas rotas e libs tocadas | limpos |
| `npm run build` | exit 0, rotas `/cbm-rj/portugues/questoes` e `/cbm-rj/portugues/questoes/aula-14` geradas |
| `vitest run` | **1609 passed**, 6 expected fail, 29 skipped (147 arquivos; o dry-run fica `skip` sem `QUESTOES_AULA14_DIR`) |

Artefatos em `H:\Meu Drive\plataforma de estudo\cbm-rj\portugues\questoes\`: `questoes_aula_14.json`,
`questoes_aula_14_import.json`, `questoes_aula_14_certo_errado_import.json`, `quarentena_aula_14.json`,
`inventario_aula_14.json`, `relatorio_extracao_aula_14.json`, `comentarios_aula_14_LOCAL.json`
(local-only).

Código desta frente: `agents/pdf_question_extractor/` (`verificacao.py` novo, `cli.py` com subcomando
`verificar`, `artifacts.py` com as duas chaves de origem; regra 5.5 em `parser.py`, `verificacao.py` e
`provenance.py`), `src/lib/questoes/`
(`dados-aula-14.ts`, `procedencia.ts`, `rotas.ts`), `src/app/(dashboard)/cbm-rj/portugues/questoes/aula-14/`
(listagem com `?secao=` e `?filtro=gabarito`, detalhe com navegação entre vizinhos da mesma seção e
`notFound()` para ID malformado ou inexistente), `src/components/questoes/questao-card.tsx`,
`src/lib/administration/services/__tests__/aula-14-import-dry-run.test.ts` (dry-run do §7.1) e, nesta
rodada, o caminho de escrita: `src/lib/administration/services/question-import.service.ts` (tipo por lote,
guarda de coerência nos dois sentidos, `conferirLote` sem escrita e `importFromBuffer` a partir de bytes),
`src/app/api/admin/questions/import/route.ts` e `src/components/admin/questoes-import-form.tsx` (tipo
escolhido por arquivo), `scripts/importar-aula-14.ts` (execução do lote da Aula 14, dry-run por padrão).

Rastro de commits: **C0** = `084caa7` (`fix(extrator): quarentena para alternativas com marcadores
embutidos e dry-run aula-14`, 7 arquivos) e **C1** = este commit (tipo por lote, guarda, script de execução,
testes e esta ata). Os dois em `main` local; `origin/main` segue sem push, e os demais arquivos sujos da
árvore continuam fora porque pertencem a outra frente.

**Assinatura desta ata:** entrega aprovada para revisão humana dos artefatos. Import, publicação e
geração de resolução permanecem gated e exigem decisão explícita, com `verificar` verde no momento da
decisão.
