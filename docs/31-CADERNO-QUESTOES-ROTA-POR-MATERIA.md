# 31. Caderno de questões: rota por matéria, procedência como tag

Decisão de arquitetura tomada na homologação do extrator da Aula 14. Registra o
que foi removido, o modelo que entrou e a regra que impede a volta do
acoplamento com o arquivo físico. Não é tutorial de uso: é fronteira que os
testes passaram a guardar.

## 0. O problema, em uma frase

`"aula-14"` era simultaneamente nome de rota, rótulo de menu, nome de módulo de
dados e identidade do acervo — o sistema estava orientado ao arquivo físico de
origem (`curso-384118-aula-14-somente-em-pdf-089a-completo.pdf`), e não ao
domínio de estudo (matéria, assunto, apostila).

## 1. O que o material declara (e o que não declara)

Medido no cache de linhas limpas do próprio PDF (`.aula14_linhas_limpas.json`,
862 páginas), não presumido:

| Dado | Valor na fonte |
|---|---|
| Cabeçalho corrente (mobília, 861 ocorrências) | `CBM-PE (Soldado) Língua Portuguesa` |
| Capa | `Aula 14 (Somente em PDF)` · `Autor: Equipe Português Estratégia Concursos, Felipe Luccas` · `05 de Junho de 2026` |
| Índice | 33 seções: 17 `Questões Comentadas - <Assunto>` + 16 `Lista de Questões - <Assunto>` |
| Assuntos dos 886 itens importáveis | Compreensão textual, Ortografia, Pronomes, Pontuação, Concordância, Regência, Classes de palavras, Conectivos, Verbos, Semântica, Período Composto, Funções Sintáticas, Coesão e Coerência, Tipologia textual, Redação Oficial, Correlação e vozes verbais, Variação linguística |

Três consequências travaram a decisão:

1. **O material não tem título.** Nenhuma linha do PDF se chama "Pontuação e
   Sintaxe" ou "Módulo 4". "Aula 14 (Somente em PDF)" é a etiqueta da lição no
   curso de terceiro; "MÓDULO 4" só existe em nome de arquivo antigo. Título de
   apostila é declaração editorial, não inferência.
2. **O material não tem assunto único.** São 17 assuntos de revisão. Qualquer
   nome de rota que escolhesse um assunto estaria inventando recorte.
3. **A prova-alvo não é o concurso do aluno.** O PDF diz `CBM-PE (Soldado)`; a
   trilha se chamava `/cbm-rj/...`. Manter concurso no path afirmava algo que a
   fonte não diz e que o conteúdo dispensa: o programa de Língua Portuguesa é
   transversal a edital.

## 2. Modelo adotado

```
DOMÍNIO (navegável)             PROCEDÊNCIA (metadado filtrável)
matéria  → /questoes/<slug>      origem  → ?origem=aula-14
questão  → /questoes/<id>        banca   → ?banca=<sigla>
                                 assunto → ?assunto=<rotulo>
                                 ano     → ?ano=<aaaa>
                                 tipo    → ?tipo=multipla_escolha|certo_errado
                                 
QUALIDADE DO ACERVO (não é procedência)
                                 ?gabarito=confiavel → só item fora de quarentena
```

- Rota de treino: `/questoes/portugues`. Segunda apostila = linha nova de
  catálogo, não rota nova por PDF.
- Rota de questão: `/questoes/[id]`, com `id` sendo **uuid do banco** ou
  **código do lote** (`A14-S01-001`). O código é chave opaca e estável — os
  `content_hash`, a quarentena e os testes dependem dele — e não é nome.
- Título de catálogo e sidebar: **"Português · Banco de Questões"**.
- `/questoes/[ref]` resolve por **forma** (`resolverRef`): uuid → banco, código de
  lote → arquivo, resto → slug de matéria. Nenhuma consulta é precisada para saber
  o que a URL significa.

## 3. Onde cada conceito passou a morar

| Conceito | Antes | Depois |
|---|---|---|
| Identidade do acervo | `aula-14` em path, menu, módulo e env | `Caderno.slug` = `knowledge_subjects.slug` (`portugues`) |
| Número da aula | segmento de rota e rótulo | `LoteProcedencia.origem` (`aula-14`) e `decomporIdLocal().aula`, exibidos só como selo/filtro |
| Arquivo físico | literal em `dados-aula-14.ts` | `LoteProcedencia.arquivo`, declarado no catálogo |
| Pasta do acervo | `QUESTOES_AULA14_DIR` | `MATERIAIS_DATASET_DIR` (legado aceito, precedência menor) |
| Menu lateral | item fixo "Português · Aula 14" | `itensDeMenu()` derivado de `CADERNOS` |
| Concurso no path | `/cbm-rj/...` | removido; redirect permanente em `next.config.ts` |


## 4. Extensão para as próximas apostilas

Para entrar com o lote da apostila seguinte:

1. Rodar o extrator e escrever o JSON no diretório do acervo.
2. Em `src/lib/questoes/cadernos.ts`, acrescentar uma `LoteProcedencia` ao
   `Caderno` da matéria — ou um `Caderno` novo, com o `slug` canônico da matéria.
3. Nada em rota, sidebar, card ou script precisa mudar.

Se a próxima apostila for de matéria ainda sem linha canônica, o caminho é o de
`docs/23` §4: a linha nasce em `knowledge_subjects` por decisão revisada, com o
nome canônico (`Português`) e a grafia publicada (`Língua Portuguesa`) registrada
como transcrição. Alias resolve, não renomeia.

## 5. O que continua em aberto (de propósito)

1. **`source_document_id` não é preenchido na importação.** O importador grava
   `fonte` como texto e não vincula a questão ao `documents` da apostila. Sem
   esse vínculo, "questões desta apostila" só existe no plano do arquivo.
2. **`knowledge_topic_id` idem.** Os rótulos do PDF (`Ortografia`, `Regência`)
   não casam com os tópicos canônicos de Português do snapshot de catálogo
   (`Fonologia e Ortografia`, `Regência e Crase`, `Acentuação Gráfica`), e dois
   colidem entre si por caixa (`Funções Sintáticas` / `Funções sintáticas`). Pela
   política de `docs/23` §6, colisão é diagnóstico: nada é fundido nem criado
   dentro de importação. Falta a tabela assunto-do-PDF → tópico-canônico revisada
   por humano.
3. **O extrator ainda fixa a identidade do material em código.**
   `agents/pdf_question_extractor/artifacts.py` traz `DISCIPLINA`, `ALVO_APOSTILA`
   e `AULA = 14` como constantes, e `pipeline.py` usa o PDF da Aula 14 como padrão.
   Isso é acoplamento de origem no lado da escrita: o lote seguinte deveria nascer
   de um manifesto de extração (arquivo + matéria + alvo + aula), não de código.
4. **O nome físico dos artefatos continua `questoes_aula_14*.json`.** Escolha
   consciente: renomear artefato em disco mexeria na evidência já homologada da
   ata 30. Quem conhece esse nome agora é só o catálogo.

## 6. Guarda de nomenclatura

`src/lib/questoes/__tests__/cadernos.test.ts` trava, sem banco e sem disco:

- nenhum `titulo`/`subtitulo` de catálogo menciona `aula <número>` ou `cbm-`;
- `itensDeMenu()` gera exatamente `rotasQuestoes.caderno(slug)`;
- `resolverRef` distingue uuid, código de lote e slug;
- o filtro vai e volta pela URL com igualdade normalizada (caixa e acento do PDF
  não duplicam faceta);
- `removerCopiasIdenticas` colapsa as duas publicações do mesmo `content_hash` e
  mantém a ordem da primeira aparição;
- `calcularPagina` amarra `?page=`/`?por=` ao total real (fora do intervalo corta
  para a última página, lixo numérico volta para 1, tamanho fora da lista fechada
  cai no padrão);
- `queryDePagina` preserva os filtros e não polui o link da página 1;
- os destinos de redirect do `next.config.ts` espelham a rota que o app gera e
  nenhum destino menciona `aula-`.

## 7. A listagem: acervo medido, filtro em GET, fixtura fora

Segunda rodada, depois de ver a tela em navegador. O que mudou e por quê.

### 7.1 O acervo não é o número de linhas do arquivo

| Medido em `questoes_aula_14.json` pela porta da app (`scripts/lib/audit-acervo.ts`) | Valor |
|---|---|
| Linhas no arquivo | 1.736 |
| Descartadas por violação de forma (enunciado ausente) | 4 |
| Itens lidos pelo carregador | 1.732 |
| Cópias idênticas colapsadas (`content_hash`) | 814 |
| **Questões distintas exibidas** | **918** |
| **Distintas com gabarito que o material sustenta** | **886** |
| Distintas sem resposta confiável (em quarentena: 27) | 32 |
| `disciplina` | 1 valor ("Língua Portuguesa", nas 918) |
| `assunto` | 17 valores |
| `banca` | 144 valores declarados; 464 questões sem banca |
| `ano` | 13 valores |
| `nivel` | nulo em todo o lote |

A tela dizia "1736 itens em revisão" e o filtro de assunto mostrava conta
duplicada. `removerCopiasIdenticas` (em `cadernos.ts`) passou a ser a única
entrada da listagem: uma linha por `content_hash`, preferindo a cópia comentada,
depois a que tem gabarito confiável, depois a de código menor — ordem
determinística, porque link compartilhado tem que mostrar a mesma questão para
qualquer pessoa.

`nivel` é nulo no lote inteiro. **Não existe badge de dificuldade** na UI: sem
dado, badge seria inventado. A lacuna aparece na sanfona de procedência como
"não declarada no material". O mesmo vale para taxa de acerto: sem
`question_attempts` para o lote, a sanfona diz "sem respostas registradas".

### 7.2 Filtro e página vivem na URL

`/questoes/<slug>` renderiza em servidor. A barra é um `<form method="get">` com
`<select>` nativo por faceta (Disciplina, Assunto, Banca, Ano, Modalidade) e
checkbox de qualidade (`gabarito=confiavel`); as opções saem de
`contagemDaFaceta`, com o total observado ao lado do rótulo. Página é `?page=`
com 20 cards por padrão (`?por=10|20|50`).

`disciplina` fica na barra mesmo enquanto tem um valor único só. Não é enfeite do
lote atual: é o nível acima do assunto e a chave pela qual Direito, Informática e
Raciocínio Lógico entram no catálogo (§4) sem tocar em rota, menu ou componente.
Escondê-la por ter uma opção seria trocar o contrato pela conveniência de hoje, e
`cadernos.test.ts` trava as duas pontas — a faceta com valor único e o menu que
cresce com uma linha de catálogo.

Nada disso é estado de cliente: um `Select` do Radix dentro de um client
component quebraria o link compartilhável e arrastaria hidratação para cada
lista. Como o `page` não participa do formulário, trocar filtro devolve
naturalmente à página 1.

### 7.3 O card voltou a ser da plataforma

O card era `bg-white` com `text-slate-*` dentro de um app dark. Agora é
`bg-card`/`border-border` com os tokens de `globals.css`. Três sanfonas
(`<details>`, fechadas por padrão) substituem o rodapé que só existia no
detalhe: **Gabarito e resolução**, **Comentários**, **Procedência e
estatísticas**.

O spoiler saiu: a linha `Gabarito: X` ao lado do botão Responder estava visível
antes de qualquer marcação. A resposta agora aparece dentro da sanfona, e o
feedback de acerto é o estado da alternativa marcada (verde/vermelho) com
`[Refazer]` para desbloquear.

Comentários é nota do aluno em `localStorage` — não existe tabela de comentário,
e criar API de escrita nesta tela violaria a leitura pura que o smoke verifica.
A própria sanfona diz que o texto não sobe para o banco.

### 7.4 O que a tela do aluno não vê mais

`/questoes` listava `questions` (banco) e apareceu com "E2E 58f07a7b" e "Qual é
a pergunta?". A causa é de teste, não de produto: `src/integration/*.test.ts`
insere `knowledge_subjects` e `questions` com `status = publicada` e
`isPublic = true`, e `deleteTestUser()` não alcança essas linhas porque elas não
têm `user_id`. Três frentes:

1. **Leitura**: `src/lib/db/fixturas-de-teste.ts` reconhece firma de teste
   (enunciado `E2E %`, `Qual é a pergunta?`, `P?`; matéria `E2E <hex8>` /
   `Matéria <hex8>`) e o repositório exclui isso de `listQuestions`, `listBancas`,
   `listSubjects` e da contagem publicada do caderno.
2. **Causa**: os testes de integração agora usam `createTestSubject` /
   `deleteTestSubject` e removem o que criaram.
3. **Rotas**: `/questoes` é o caderno da matéria (hoje redireciona para
   `/questoes/portugues`); o navegador do banco foi para `/questoes/banco`.

Medido no banco compartilhado com `scripts/lib/audit-fixturas-db.ts` (leitura):

| | Antes | Depois da exclusão |
|---|---|---|
| Questões publicadas no banco | 44 | **36 visíveis ao aluno** |
| Linhas de teste escondidas | 0 | 8 (`P?` ×4, `Qual é a pergunta?` ×4) |
| Matérias no filtro | 33 | **25** (8 catálogos `E2E …`/`Matéria …` removidos) |

Nenhuma linha foi apagada do banco compartilhado: o guard de ambiente
(`src/lib/db/env-guard.ts`) é fail-closed exatamente porque desenvolvimento e
produção apontam para o mesmo projeto Supabase. Esconder é leitura; apagar é
decisão humana com banco de teste comprovadamente isolado.

### 7.5 O que continua em aberto depois desta rodada

1. **Sem estatística de acerto de verdade.** Taxa por questão só existe depois
   de importar o lote e receber respostas; a sanfona diz isso em vez de chutar.
2. **Dificuldade depende do extrator.** `nivel` é nulo no lote; preencher é
   trabalho de classificação (com homologação humana), não de UI.
3. **Importação segue bloqueada** pelo mesmo guard de ambiente — o acervo
   publicado continua vazio, e é por isso que o caderno em arquivo é a tela do
   aluno hoje.
4. **Nota do aluno é local.** Persistência real pede tabela e API próprias.

