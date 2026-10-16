# 24 — Catalogação histórica: CBMERJ SMTV 2021 (FASE 3A)

Artefato de evidência documental. Este arquivo **não** grava nada em banco, **não** cria
`knowledge_topics`, **não** cria `notice_topics`, **não** preenche
`notice_topics.knowledge_topic_id`, **não** altera `docs/23` e **não** altera o snapshot de
catálogo. Toda a seção de mapeamento (I) é **proposta**, sujeita a revisão humana.

- Data da verificação: 2026-10-03
- HEAD na execução: `a4bbf39` (`test: validate topic-aware planner flow`)
- Pendências antes: 57 grupos (34 modified + 23 untracked). Depois: 58, sendo a única entrada
  nova exatamente `?? docs/24-CATALOGACAO-HISTORICA-CBMERJ-2021.md`
- Nenhum PDF foi gravado em disco. Fetch em memória, `pdf-parse` recebe `Buffer`,
  SHA-256 via `crypto.createHash('sha256').update(buffer)`.

## A. Identificação e cadeia de custódia

Textos literais extraídos do Edital nº 01/2021 (captura arquivada, item C):

- Cabeçalho do documento: **Governo do Estado do Rio de Janeiro / Secretaria de Estado de
  Defesa Civil / Corpo de Bombeiros Militar do Estado do Rio de Janeiro**
- Objeto: Processo Seletivo de Ingresso para o **Serviço Militar Temporário Voluntário (SMTV)**,
  **Edital nº 01/2021**
- Autuação: **Processo Administrativo SEI nº 270028/000616/2020** — 1 ocorrência no corpo do
  edital
- Base legal citada: **Lei nº 9.027, de 28 de setembro de 2020** — a cadeia `9.027` aparece
  4 vezes; a ocorrência de `DOERJ` no edital se refere à publicação **da lei**
  (`publicada no DOERJ, em 29/09/2020`), não do edital
- Frase de publicação, literal e completa onde relevante:
  `...exarada no Processo Administrativo SEI nº 270028/000616/2020, conforme publicado no
  Diário Oficial do Estado do Rio de Janeiro, de acordo com os preceitos estabelecidos pela
  Lei nº 9.027, de 28 de setembro de 2020, torna público que fará realizar Processo Seletivo
  para provimento de vagas para o serviço de Mi...`
  → a menção ao Diário Oficial **não traz data**. Ver H.
- O edital enumera expressamente os anexos, confirmando que o conteúdo programático é peça do
  edital (6 ocorrências de `Anexo VI` no texto):

      e) Anexo V – Quadro de provas
      f) Anexo VI – Conteúdo Programático
      g) Anexo VII – Modelo de Atestado Médico para o Teste de Aptidão Física (TAF)
      h) Anexo VIII – ...

Cadeia de custódia:

1. O domínio institucional `cbmerj.rj.gov.br` **não hospeda** os PDFs do SMTV 2021; a página de
   notícia do processo existe apenas como registro arquivado (sem o Anexo VI).
2. Os arquivos oficiais do certame estão na infraestrutura da banca: `https://funrioms.selecao.net.br/uploads/310/concursos/8/anexos/<hash>.pdf`.
3. A fonte usada aqui é a **cópia arquivada** dessas URLs no Internet Archive, com modificador
   `if_` (payload original, sem banner do Archive), identificada por timestamp de captura.
4. Não foi usado fac-símile do DOERJ. Ver H.
## B. Proveniência e escopo da verificação

- **Classe da fonte:** cópia arquivada, linkável e verificável, de documento oficial do
  certame (não é resumo de terceiros, não é blog, não é material preparatório de curso).
- **Método:** `fetch` → `arrayBuffer` → `Buffer` → `crypto.createHash('sha256').update(buffer)`
  → `pdf-parse(buffer)`. Nada é gravado em disco; nenhuma conexão com banco foi aberta.
- **Conferido nesta verificação:**
  1. identificação e custódia do Edital nº 01/2021 (item A);
  2. enumeração do Anexo VI pelo próprio edital (item A);
  3. título da página 1 do Anexo VI em cada versão de retificação (item D);
  4. os blocos de conteúdo programático das **Praças** (p. 22–25) com transcrição literal
     (item E);
  5. igualdade/diferença entre versões e entre cargos por comparação de texto (itens D e G).
- **Não conferido (fora do escopo da FASE 3A):** quadro de vagas, pesos por disciplina do
  edital 2021, TAF, redação, provas e gabaritos; o miolo do Anexo VI referente a oficiais
  (médicos, psicólogos, enfermeiros) apenas foi lido para localizar o termo de retificação.
- **O que "verificar" não significa aqui:** não houve exame pericial de tipografia nem
  cotejo com fac-símile do DOERJ. É conferência documental do texto do PDF arquivado.
  Permanece exigida revisão humana antes de qualquer promoção de proveniência (item K).

## C. Documentos-fonte, capturas e hashes

URL no formato `https://web.archive.org/web/<capture>if_/<arquivo FUNRIO>`.

| # | Papel | Capture | Arquivo arquivado | Bytes (payload) | Páginas | Chars (texto) |
|---|---|---|---|---|---|---|
| 1 | Edital nº 01/2021 — original | `20210707150457` | `zIfN0EmK6McqG7BgFKeieN1jtHPdpmBl3kTstlaw.pdf` | 839.237 | 52 | 171.363 |
| 2 | Edital nº 01/2021 — após Retificação 01 | `20210707150432` | `JpU9qgHmZTccu629zK2yHXKI0nz1A0AjAljckrwS.pdf` | *não reproduzido* | *não reproduzido* | *não reproduzido* |
| 3 | Anexo VI — após Retificação 01 | `20210707150437` | `7fJcir2R7dGLKBFWAz1LCgXMSRGoAYpRHp0UX22H.pdf` | 808.291 | 25 | 125.975 |
| 4 | **Anexo VI — após Retificação 02 (vigente)** | `20210814140424` | `QZWn8ElZvzlBjAtR5xiscs5eWRt1pYACCJahHJ9Z.pdf` | 808.646 | 25 | 126.024 |

SHA-256 calculados sobre o Buffer obtido nesta execução:

| # | SHA-256 |
|---|---|
| 1 | `3ec0821bb0bd8fbf1732dca3b22b0af3d4abe37d95e672ddf0b6b11918506b1d` |
| 2 | — (processo interrompido pelo tempo de resposta do Archive; ver C.1) |
| 3 | `498d002a63aec16c283abdbb3ee2c0df511e7b1487f5e95c17c1246c9386151d` |
| 4 | `f946d37482b745e98b5eed610bfcaa310da276ac3d276a87699130aa7c7752f5` |

URLs completas:

1. `https://web.archive.org/web/20210707150457if_/https://funrioms.selecao.net.br/uploads/310/concursos/8/anexos/zIfN0EmK6McqG7BgFKeieN1jtHPdpmBl3kTstlaw.pdf`
2. `https://web.archive.org/web/20210707150432if_/https://funrioms.selecao.net.br/uploads/310/concursos/8/anexos/JpU9qgHmZTccu629zK2yHXKI0nz1A0AjAljckrwS.pdf`
3. `https://web.archive.org/web/20210707150437if_/https://funrioms.selecao.net.br/uploads/310/concursos/8/anexos/7fJcir2R7dGLKBFWAz1LCgXMSRGoAYpRHp0UX22H.pdf`
4. `https://web.archive.org/web/20210814140424if_/https://funrioms.selecao.net.br/uploads/310/concursos/8/anexos/QZWn8ElZvzlBjAtR5xiscs5eWRt1pYACCJahHJ9Z.pdf`

### C.1 Divergências registradas (não corrigidas em silêncio)

- **Bytes.** Os valores previamente identificados (802.070 / 819.347 / 779.251 / 779.702) **não
  batem** com os payloads medidos agora (839.237 / — / 808.291 / 808.646). Interpretação
  documentada: os primeiros são o campo `length` da listagem CDX do Internet Archive, que
  descreve o **registro arquivado** (comprimido, com cabeçalho HTTP); os segundos são o
  **payload descomprimido** devolvido por `if_`. São medidas de objetos diferentes — nenhum é
  troca de arquivo. Página e texto batem, o que descarta documento distinto.
- **Chars e páginas: reproduzidos.** 171.363/52 (edital original), 125.975/25 (Anexo VI Ret. 01)
  e 126.024/25 (Anexo VI Ret. 02) conferem exatamente com os valores previamente identificados.
- **Não reproduzido:** o edital após Retificação 01 (linha 2). As duas tentativas desta sessão
  foram interrompidas (`fetch failed` e término do processo pelo limite de tempo do terminal).
  Nada foi inventado; a linha fica marcada como pendente de repetição.
- **Contagem do bloco de Praças.** O valor previamente registrado era 10.032 caracteres. Nesta
  execução: fatia bruta = 10.612; fatia normalizada (colapso de espaço em branco e sem
  marcadores de página) = 10.031. A diferença de 1 caracter vem do tratamento do espaço final
  na normalização. A conclusão de igualdade entre versões não muda (item D).
## D. Comparação de versões

### D.1 Estados do documento

| Estado | Evidência |
|---|---|
| Edital nº 01/2021 original | arquivo 1 (item C) |
| Anexo VI após Retificação 01 | arquivo 3, capture `20210707150437` |
| Anexo VI após Retificação 02 — **vigente** | arquivo 4, capture `20210814140424` |

O Anexo VI da Retificação 02 abre a página 1 autodeclarando o próprio escopo (literal, com o
marcador de página desta extração):

    ===== PAGE 1 =====
      Retificação 02 – Fundo amarelo (1º Ten. BM Temp. Enfermeiro)  Anexo VI – Conteúdo Programático  1º Ten. BM Temp. Médico Socorrista Língua Po...

Ou seja: **a retificação 02 se restringe ao cargo `1º Ten. BM Temp. Enfermeiro`** (o "fundo
amarelo" é a marca visual de alteração no PDF). Não cabe extrapolar essa alteração para as
Praças.

### D.2 Praças: Retificação 01 × Retificação 02

Reproduzido nesta execução, sobre os buffers das linhas 3 e 4 da tabela C.

| Método | Ret. 01 | Ret. 02 | Iguais? |
|---|---|---|---|
| A — fatia bruta do texto, do título `Soldado BM Temp. Combatente` até o fim do Anexo | 10.612 chars | 10.612 chars | **sim** (`===`), sha256 parcial `27a1fb485548a591` nos dois |
| B — fatia bruta a partir de `Língua Portuguesa` do bloco de Combatente | 10.495 chars | 10.495 chars | **sim**, sha256 parcial `fed625c782b8973e` nos dois |
| C — normalizado (NFD, remoção de acentos, colapso de espaço, minúsculas, sem marcadores) | 10.031 chars | 10.031 chars | **sim**, sha256 parcial `f3028fa5eb80fd1e` nos dois |

**Algoritmo usado:** igualdade por comparação exata de strings (`===`) sobre o texto devolvido
pelo `pdf-parse`; como segundo teste, SHA-256 do trecho (exibidos os 16 primeiros hex, que é o
suficiente para apontar divergência e não serve como identificador global do arquivo).

**Escopo da afirmação:** a igualdade diz respeito **ao trecho de Praças comparado** (p. 22–25),
não ao Anexo inteiro. Os dois arquivos inteiros são diferentes, como se espera:

- bytes: 808.291 (Ret. 01) vs 808.646 (Ret. 02);
- SHA-256 global: `498d002a…386151d` vs `f946d374…c7752f5`;
- chars do texto integral: 125.975 vs 126.024 → **Δ = 49 caracteres** no documento todo,
  **Δ = 0** dentro do bloco de Praças. A alteração de 49 caracteres está fora de Praças, o que
  é consistente com o título da página 1 (Enfermeiro).

**Edital original × Retificação 01:** não reproduzido nesta execução (linha 2 da tabela C
ficou pendente de download). Os valores previamente identificados (171.363 vs 180.806 chars,
Δ = 9.443) ficam registrados como **não conferidos**, não como fato verificado.

## E. Transcrição literal — Praças

Fonte: Anexo VI após Retificação 02 (arquivo 4). Transcrição **sem parafrasear**.

Notas de método para leitura do que segue:

1. `===== PAGE n =====` é marcador **desta verificação**, inserido onde o PDF muda de página;
   não existe no edital.
2. Espaços duplos e espaços no início de linha são efeito da composição justificada do PDF
   capturado; mantidos como saíram do extrator, não são erros de transcrição.
3. Nada foi corrigido: `analise combinatória` (sem acento) e `Proposições conectivos.` (sem
   vírgula) estão assim **no texto publicado/extraído**.
4. Onde a frase é cortada pela quebra de página, ela continua depois do marcador — é artefato
   de layout, não lacuna de conteúdo.

### E.1 Soldado BM Temp. Combatente e Soldado BM Temp. Combatente com CNH (Carteira Nacional de Habilitação) categoria B — p. 22

    ===== PAGE 22 =====
    Soldado BM Temp. Combatente e Soldado BM Temp. Combatente com CNH (Carteira Nacional de Habilitação) categoria B  Língua Portuguesa  Elementos de construção do texto e seu sentido: gênero do texto (literário e não literário; narrativo, descritivo, injuntivo e argumentativo). Variação Linguística. Compreensão, interpretação e organização interna do texto. Semântica: sentido e emprego dos vocábulos; campos semânticos, antonímia, sinonímia, paronímia; emprego de tempos, modos e aspecto dos verbos em Português. Fonética: consoante e vogais; semivogais. Encontros vocálicos  e  consonantais;  acento;  paronímia  e  homonímia;  silabação  (número,  estrutura,  tonicidade). Morfologia: reconhecimento, emprego e sentido das classes gramaticais; processos de formação de palavras; mecanismos de flexão dos nomes e dos verbos (tempos, modos); Sintaxe: frase, oração e período; termos da oração; processos de coordenação e subordinação; concordância nominal e verbal; transitividade e regência
    ===== PAGE 23 =====
      de  nomes  e  verbos;  padrões  gerais  de  colocação  pronominal  no  português;  mecanismos  de  coesão  e coerência textual. Estilística: figuras de linguagem. Ortografia em vigor. Pontuação.   Matemática  Geometria: ângulo, polígonos, triângulos, Teorema de Pitágoras, equação da reta, trigonometria; Estatística e Probabilidade;  amostra,  frequências,  probabilidade;  Álgebra  e  Funções:  função  exponencial,  equação  e inequação exponencial, função linear, função logarítmica, matrizes, sistemas lineares, equação do 2º grau, polinômios;  Números  e  Operações:  juros  simples  e  composto,  porcentagem,  conjuntos,  regra  de  três, proporcionalidade.  Raciocínio Lógico  Entendimento  da  estrutura  lógica  de  relações  arbitrárias  entre  as  pessoas,  lugares,  objetos  ou  eventos fictícios;  dedução  de  novas  relações  fornecidas  e  avaliação  das  condições  usadas  para  estabelecer  a estrutura  daquelas  relações.  Problemas  de  raciocínio:  deduzir  informações  de  relações  arbitrárias  entre objetos, lugares, pessoas e/ou eventos fictícios dados. Compreensão e elaboração da lógica das situações por meio de: raciocínio  verbal; raciocínio matemático (que envolvam, dentre outros,  conjuntos numéricos racionais  e  reais  –  operações,  propriedades,  problemas  envolvendo  as  quatro  operações  nas  formas fracionária e decimal; números de grandezas proporcionais, razão e proporção, divisão proporcional, regra de três simples e composta, porcentagem, grandezas escalares, função do 1º grau, função do 2º grau, função exponencial,  área  de  superfícies  planas,  MDC,  MMC,  produtos  notáveis,  potenciação,  plano  cartesiano: distribuição entre dois pontos e equação da reta, sistemas lineares, probabilidade, analise combinatória); Raciocínio sequencial de números, símbolos, figuras e letras; orientação espacial e temporal; formação de conceitos e discriminação de elementos. Compreensão do processo lógico que, a partir de um conjunto de hipóteses,  conduz,  de  forma  válida,  a  conclusões  determinadas.  Operações  com  conjuntos,  princípio fundamental  da  contagem.  Lógica  sentencial  ou  de  primeira  ordem.  Proposições  conectivos.  Operações lógicas  sobre  proposições;  tabelas-verdade;  equivalências;  leis  de  Morgan;  diagramas  lógicos,  tabelas  e gráficos.
### E.2 Soldado BM Temp. Técnico de Enfermagem — p. 23

Título literal publicado (uma única entrada de conteúdo para dois cargos):

**`Soldado BM Temp. Técnico de Enfermagem Hospitalar/Ambulatorial e Soldado BM Temp. Técnico de
Enfermagem Socorrista`**

    ===== PAGE 23 =====
    Soldado BM Temp. Técnico de Enfermagem Hospitalar/Ambulatorial e Soldado BM Temp. Técnico de Enfermagem Socorrista  Língua Portuguesa  Elementos de construção do texto e seu sentido: gênero do texto (literário e não literário; narrativo, descritivo, injuntivo e argumentativo). Variação Linguística. Compreensão, interpretação e organização interna do texto. Semântica: sentido e emprego dos vocábulos; campos semânticos, antonímia, sinonímia, paronímia; emprego de tempos, modos e aspecto dos verbos em Português. Fonética: consoante e vogais; semivogais. Encontros vocálicos  e  consonantais;  acento;  paronímia  e  homonímia;  silabação  (número,  estrutura,  tonicidade). Morfologia: reconhecimento, emprego e sentido das classes gramaticais; processos de formação de palavras; mecanismos de flexão dos nomes e dos verbos (tempos, modos); Sintaxe: frase, oração e período; termos da oração; processos de coordenação e subordinação; concordância nominal e verbal; transitividade e regência de  nomes  e  verbos;  padrões  gerais  de  colocação  pronominal  no  português;  mecanismos  de  coesão  e coerência textual. Estilística: figuras de linguagem. Ortografia em vigor. Pontuação.  Matemática  Geometria: ângulo, polígonos, triângulos, Teorema de Pitágoras, equação da reta, trigonometria; Estatística e Probabilidade;  amostra,  frequências,  probabilidade;  Álgebra  e  Funções:  função  exponencial,  equação  e inequação exponencial, função linear, função logarítmica, matrizes, sistemas lineares, equação do 2º grau, polinômios;  Números  e  Operações:  juros  simples  e  composto,  porcentagem,  conjuntos,  regra  de  três, proporcionalidade.  Conhecimentos Específicos
    ===== PAGE 24 =====
       Fundamentos  de  Enfermagem.  Lei  do  exercício  profissional.  Ética  e  legislação  profissional.  Noções  de Farmacologia. Admissão, alta, óbito. Assistência de enfermagem ao exame físico. Enfermagem nos exames complementares. Assistência de enfermagem aos pacientes graves e agonizantes e preparo do corpo pós-morte. Tratamento e assistência de enfermagem em: clínica médica, emergências, clínica médico-cirúrgica, pediatria,  psiquiatria,  ginecologia  e  obstetrícia,  neonatologia.  Doenças  infecto-parasitárias.  Programa  de imunização e rede de frios, conservação de vacinas, esquema básico de vacinação, vias de administração. Políticas Públicas de saúde. Saúde do idoso. Procedimentos técnicos relacionados ao conforto e à segurança do  paciente:  higiene,  massagem  de  conforto,  posições  para  exames,  transporte  do  paciente  e  paciente terminal. Técnicas básicas: sinais vitais, medicação, coleta de material para exames, técnicas de curativo, crioterapia  e  termoterapia,  nebulização,  oxigenoterapia  e  sondagens.  Controle  de  infecção  hospitalar: assepsia e antissepsia, esterilização, controle e prevenção de infecção hospitalar. Atuação do técnico de enfermagem  na  unidade  de:  clínica  médica,  cirúrgica,  pré-  e  pós-operatório,  emergências,  hemorragia, envenenamento, choque, queimaduras, insuficiência respiratória e ressuscitação cardiopulmonar. Saúde da mulher:  gravidez  e  suas  complicações,  parto  e  suas  complicações,  assistência  do  puerpério  e  suas complicações, prevenção do câncer cérvico-uterino e mama, planejamento familiar. Conceitos da Atenção Primária em Saúde. Política Nacional de Humanização; Normas e Diretrizes da Estratégia Saúde da Família. Modelos Assistenciais. Ética e Código de Deontologia dos Profissionais de Enfermagem. Lei do exercício profissional. Administração de medicamentos. Assistência à saúde dos grupos humanos: mulher, criança, adolescente,  adulto  e  idoso.  Procedimentos  técnicos  de  enfermagem  no  pré-  e  pós-operatório,  Centro Cirúrgico, Central de Material. Procedimentos de técnica de enfermagem em emergência/urgência. Controle e prevenção das infecções hospitalares. Segurança do Paciente.

**Não há `Raciocínio Lógico` neste bloco.** A terceira disciplina publicada é
`Conhecimentos Específicos`, e entre `proporcionalidade.` e `Conhecimentos Específicos` não
existe nenhum outro rótulo de disciplina.

### E.3 Soldado BM Temp. Guarda-Vidas — p. 24

    ===== PAGE 24 =====
    Soldado BM Temp. Guarda-Vidas  Língua Portuguesa  Elementos de construção do texto e seu sentido: gênero do texto (literário e não literário; narrativo, descritivo, injuntivo e argumentativo). Variação Linguística. Compreensão, interpretação e organização interna do texto. Semântica: sentido e emprego dos vocábulos; campos semânticos, antonímia, sinonímia, paronímia; emprego de tempos, modos e aspecto dos verbos em Português. Fonética: consoante e vogais; semivogais. Encontros vocálicos  e  consonantais;  acento;  paronímia  e  homonímia;  silabação  (número,  estrutura,  tonicidade). Morfologia: reconhecimento, emprego e sentido das classes gramaticais; processos de formação de palavras; mecanismos de flexão dos nomes e dos verbos (tempos, modos); Sintaxe: frase, oração e período; termos da oração; processos de coordenação e subordinação; concordância nominal e verbal; transitividade e regência de  nomes  e  verbos;  padrões  gerais  de  colocação  pronominal  no  português;  mecanismos  de  coesão  e coerência textual. Estilística: figuras de linguagem. Ortografia em vigor. Pontuação.   Matemática  Geometria: ângulo, polígonos, triângulos, Teorema de Pitágoras, equação da reta, trigonometria; Estatística e Probabilidade;  amostra,  frequências,  probabilidade;  Álgebra  e  Funções:  função  exponencial,  equação  e inequação exponencial, função linear, função logarítmica, matrizes, sistemas lineares, equação do 2º grau, polinômios;  Números  e  Operações:  juros  simples  e  composto,  porcentagem,  conjuntos,  regra  de  três, proporcionalidade.  Raciocínio Lógico  Entendimento  da  estrutura  lógica  de  relações  arbitrárias  entre  as  pessoas,  lugares,  objetos  ou  eventos fictícios;  dedução  de  novas  relações  fornecidas  e  avaliação  das  condições  usadas  para  estabelecer  a estrutura  daquelas  relações.  Problemas  de  raciocínio:  deduzir  informações  de  relações  arbitrárias  entre objetos, lugares, pessoas e/ou eventos fictícios dados. Compreensão e elaboração da lógica das situações por meio de: raciocínio  verbal; raciocínio matemático (que envolvam, dentre outros,  conjuntos numéricos racionais  e  reais  –  operações,  propriedades,  problemas  envolvendo  as  quatro  operações  nas  formas fracionária e decimal; números de grandezas proporcionais, razão e proporção, divisão proporcional, regra de três simples e composta, porcentagem, grandezas escalares, função do 1º grau, função do 2º grau, função exponencial,  área  de  superfícies  planas,  MDC,  MMC,  produtos  notáveis,  potenciação,  plano  cartesiano:
    ===== PAGE 25 =====
      distribuição entre dois pontos e equação da reta, sistemas lineares, probabilidade, analise combinatória); Raciocínio sequencial de números, símbolos, figuras e letras; orientação espacial e temporal; formação de conceitos e discriminação de elementos. Compreensão do processo lógico que, a partir de um conjunto de hipóteses,  conduz,  de  forma  válida,  a  conclusões  determinadas.  Operações  com  conjuntos,  princípio fundamental  da  contagem.  Lógica  sentencial  ou  de  primeira  ordem.  Proposições  conectivos.  Operações lógicas  sobre  proposições;  tabelas-verdade;  equivalências;  leis  de  Morgan;  diagramas  lógicos,  tabelas  e gráficos.

O bloco de Guarda-Vidas é o **último do Anexo VI**: termina no caracter 124.902 de um texto de
124.905 caracteres (contagem da extração com marcadores de página).
## F. Contagem e regra de interpretação

### F.1 O que está de fato publicado

| Cargo | Disciplina | Unidade publicada | Conteúdo |
|---|---|---|---|
| Combatente / Guarda-Vidas | Língua Portuguesa | **1 bloco discursivo** | texto corrido, sem numeração |
| Combatente / Guarda-Vidas | Matemática | **1 bloco, 4 rótulos** | Geometria; Estatística e Probabilidade; Álgebra e Funções; Números e Operações |
| Combatente / Guarda-Vidas | Raciocínio Lógico | **1 bloco discursivo** | texto corrido, sem numeração |
| Técnico de Enfermagem | Língua Portuguesa | **1 bloco discursivo** | idem |
| Técnico de Enfermagem | Matemática | **1 bloco, 4 rótulos** | idem |
| Técnico de Enfermagem | Conhecimentos Específicos | **1 bloco discursivo** | texto corrido |

O Anexo VI de 2021 **não numera itens** no bloco de Praças. Não existe, na fonte, item 1,
item 2 ou contagem oficial de tópicos.

### F.2 Critérios de contagem usados neste documento (derivados, não oficiais)

- **Português:** segmentação por período (ponto final + espaço). Resultado: **11 períodos**, dos
  quais **6** no padrão `Rótulo: desenvolvimento` (Elementos de construção do texto e seu
  sentido; Semântica; Fonética; Morfologia; Sintaxe; Estilística) e **5** soltos (Variação
  Linguística; Compreensão, interpretação e organização interna do texto; Encontros vocálicos e
  consonantais; Ortografia em vigor; Pontuação).
- **Matemática:** 4 rótulos. Dividindo os desenvolvimentos por vírgula/ponto-e-vírgula dentro de
  cada rótulo: Geometria 6 termos, Estatística e Probabilidade 3, Álgebra e Funções 8, Números e
  Operações 5, total **22 termos**.
  Observação: `Estatística e Probabilidade` é publicado **sem dois-pontos**; os termos que o
  seguem dependem de leitura do ponto-e-vírgula. Isso é ambiguidade da própria fonte, não da
  extração.
- **Raciocínio Lógico:** segmentação por período. Resultado: **8 períodos**.

### F.3 Sobre a contagem histórica 38 de Português + 24 de Matemática

Esses números **não são estrutura oficial do edital**. São contagem **derivada de fonte
terciária** (planilha ou roteiro de reprocessamento anterior), obtida ao decompor o texto
corrido. Contra a fonte primária:

- Português publicado = 1 bloco (11 períodos / 6 rótulos), não 38 itens;
- Matemática publicada = 4 rótulos (22 termos por separador), não 24 itens.

Qualquer subdivisão em itens menores precisa ser marcada **INTERPRETAÇÃO/MAPEAMENTO**, com a
regra de decomposição declarada. Não usar 38/24 como verdade documental.

## G. Comparação de escopo entre cargos

| Cargo | Título literal publicado | Página | Bloco bruto (chars) |
|---|---|---|---|
| Combatente | `Soldado BM Temp. Combatente e Soldado BM Temp. Combatente com CNH (Carteira Nacional de Habilitação) categoria B` | 22 | 3.375 |
| Técnico de Enfermagem | `Soldado BM Temp. Técnico de Enfermagem Hospitalar/Ambulatorial e Soldado BM Temp. Técnico de Enfermagem Socorrista` | 23 | 3.943 |
| Guarda-Vidas | `Soldado BM Temp. Guarda-Vidas` | 24 | 3.294 |

### G.1 Combatente x Guarda-Vidas

1. **Bruto, do título em diante:** 3.375 contra 3.294. A diferença de 81 caracteres está no
   **título do cargo** (a fórmula `e Soldado BM Temp. Combatente com CNH (Carteira Nacional de
   Habilitação) categoria B` não tem correspondente em Guarda-Vidas).
2. **Bruto, a partir de `Língua Portuguesa`:** 3.258 contra 3.261, `IGUAIS=false`, primeira
   diferença no offset 888. O recorte mostra que a diferença é **exclusivamente espaçamento**:
   em Combatente a frase `...transitividade e regência` é cortada pela virada de página 22 para
   23 (três quebras de linha); em Guarda-Vidas a mesma frase segue contínua. Não há diferença
   de conteúdo.
3. **Normalizado** (marcadores de página removidos, acentos NFD+strip, espaço colapsado,
   minúsculas): Combatente = 3.063, Guarda-Vidas = 3.063, `IDENTICO=true`, SHA-256 parcial
   `f906e47d55193da7` nos dois, e a varredura caractere a caractere só diverge no índice
   3.063, que é o fim da string. **Conteúdo programático idêntico.**
4. Por disciplina (mesma normalização), os dois cargos compartilham:
   - Língua Portuguesa: 1.046 chars, `d0e591786f9aa868` (ambos)
   - Matemática: 446 chars, `aa5bcac520edb038` (ambos)
   - Raciocínio Lógico: 1.571 chars, `58f8ff59478e7ef1` (ambos)
5. Registro da medição anterior: sessões prévias reportaram 3.066 e 3.065; nesta execução,
   3.063/3.063. Os 3 caracteres de diferença são resquício de espaçamento que a normalização
   anterior não colapsava. A conclusão (identidade de conteúdo) é a mesma nos dois cálculos;
   nenhum valor foi ajustado.

**Isto é achado documental, não regra de banco.** Não criar, com base aqui, igualdade
automática entre cargos, alias ou fusão de tópicos.

### G.2 Técnico de Enfermagem

- Disciplinas publicadas: **Língua Portuguesa, Matemática, Conhecimentos Específicos**.
- **Não há Raciocínio Lógico** no bloco: teste negativo sobre o trecho (ausência da cadeia
  `Racioc`) em **Retificação 01 e Retificação 02**, `hasRL=false` nos dois.
- Bloco de 3.824 caracteres de conteúdo; Língua Portuguesa com o mesmo comprimento dos demais
  cargos (1.046) e Matemática com SHA-256 parcial **idêntico** ao de Combatente/Guarda-Vidas
  (`aa5bcac520edb038`); Conhecimentos Específicos = 2.147 chars, `220c2f353293f87e`.
- O hash de LP do Técnico não foi capturado nesta execução (recorte inválido no script), apenas
  o comprimento. Fica como limitação H.5, não como identidade provada.

## H. Limitações

1. **Publicação em 02/07/2021 não comprovada.** O texto do edital não contém `02/07/2021`
   (0 ocorrências) nem `01/07/2021` (0 ocorrências). A única ocorrência de `DOERJ` se refere à
   Lei nº 9.027 (`publicada no DOERJ, em 29/09/2020`). A frase do edital diz `conforme publicado
   no Diário Oficial do Estado do Rio de Janeiro` **sem data**. Não afirmar 02/07/2021.
2. **Cópia arquivada, não fac-símile oficial.** A verificação usou captura do Internet Archive
   sobre o arquivo da banca FUNRIO. Não houve cotejo com o PDF do sítio institucional (que não
   hospeda o material) nem com o Diário Oficial.
3. **Edital após Retificação 01 não reproduzido** nesta sessão (tabela C, linha 2): dois
   timeouts/`fetch failed`. Os números associados (180.806 chars, 52 páginas, delta de 9.443
   chars sobre o original) permanecem **não conferidos**.
4. **Extração de texto não é prova visual.** Ordem e agrupamento podem ser afetados por layout
   justificado e quebras de página; por isso a transcrição preserva os marcadores de página e
   os espaços duplos da extração.
5. **Hash de LP do Técnico de Enfermagem não coletado** (só comprimento).
6. **Escopo restrito a conteúdo programático de Praças.** Pesos, número de questões, redação e
   TAF não foram conferidos nesta fase.
7. **Revisão humana obrigatória.** Nada aqui autoriza promover `provenance` ou gravar vínculo em
   banco. docs/23 seção 2: `official` não convive com ausência de conferência humana.

## I. Mapeamento provisório para o catálogo atual

Base: `database/knowledge/snapshots/2026-10-03-catalogo-atual.json` (`checksum_sha256`
`fa8c2c42686496974bf17fb058fbdd10710bdfd3b7c96084b814f56c46cf491c`), lido **somente leitura**.
Nenhum identificador aqui foi inventado: todos os UUIDs citados existem no snapshot.

### I.0 Classes de proposta (vocabulário fixo)

| classe | significado |
|---|---|
| `REUSO_CANONICO` | já existe `knowledge_topics` que cobre o conteúdo do edital; o vínculo futuro apontaria para ele |
| `NOVO_CANONICO` | não existe tópico canônico; seria preciso criar, com nome e slug decididos por humano |
| `AMBIGUO` | existe candidato, mas o escopo do edital não coincide com o do canônico; exige decisão |
| `BLOQUEADO` | não há como aplicar agora: guard de banco, ausência de linha de edital ou matéria inexistente |
| `PENDENTE_REVISAO` | a proposta está registrada, mas depende de leitura humana antes de qualquer efeito |

**Bloqueio estrutural que vale para todas as linhas desta seção.** O snapshot contém três
`contests` (`Concurso PMERJ — Soldado PM (REAL)`, `Concurso Público MPF 2026`,
`CBMERJ — SMTV 2026 (Praças)`) e dois `editais` (MPF 2026 e CBMERJ SMTV 2026).
**Não existe concurso nem edital CBMERJ 2021 no banco.** Antes de qualquer `notice_topic` de
2021 seria preciso criar `contests` e `editais` correspondentes. Como não há banco de teste
isolado (docs/23 §10: `PROD_SUPABASE_PROJECT_REF` e `SAFE_TEST_DATABASE_REFS` vazios),
toda aplicação proposta está **BLOQUEADO por cascata**, e nada nesta seção autoriza `INSERT`,
`UPDATE` ou preenchimento de `notice_topics.knowledge_topic_id`.

### I.1 Língua Portuguesa (transcrições E.1/E.2/E.3) contra os 13 tópicos canônicos

A matéria `Português` (`aaaaaaaa-0000-4000-8000-000000000001`) é uma das duas únicas com
tópicos no snapshot: **13 canônicos**, todos `active`, todos sem pai.

| Trecho literal do edital (rótulo publicado, ver §E) | Alvo canônico no snapshot | Classe |
|---|---|---|
| `gênero do texto (literário e não literário; narrativo, descritivo, injuntivo e argumentativo)` | `a74f85c9-8e48-4feb-83db-d55859b24e7e` Tipologia Textual | `REUSO_CANONICO` |
| `Variação Linguística` | nenhum dos 13 | `NOVO_CANONICO` + `PENDENTE_REVISAO` |
| `Compreensão, interpretação e organização interna do texto` | `0a6a0acd-4bf9-4cdd-a6a3-e4df4d9d3a17` Interpretação de Texto | `REUSO_CANONICO` (a subfrase `organização interna` também cabe em Tipologia Textual) |
| `Semântica: sentido e emprego dos vocábulos; campos semânticos, antonímia, sinonímia, paronímia` | `19e9cff1-a68c-4bcb-9118-f4ce75fbfb52` Semântica | `REUSO_CANONICO` |
| `emprego de tempos, modos e aspecto dos verbos` (dentro do período de Semântica) | `530b4245-55ff-4c6a-bde1-0a6fe3ed8f89` Morfologia (Classes de Palavras) | `AMBIGUO` (o edital publicou morfologia verbal dentro de Semântica) |
| `Fonética: consoante e vogais; semivogais. Encontros vocálicos e consonantais; silabação` | `1cdf12fc-a5c1-4ba3-a062-723a37d5a38c` Fonologia e Ortografia | `REUSO_CANONICO` |
| `acento` e `tonicidade` (silabação: número, estrutura, tonicidade) | `9641d867-1bcb-40fa-84d7-d07d635983e5` Acentuação Gráfica | `AMBIGUO` (solapa Fonologia e Ortografia) |
| `paronímia` e `homonímia` | `19e9cff1` Semântica **ou** `1cdf12fc` Fonologia e Ortografia | `AMBIGUO` (o edital repete `paronímia` nos dois períodos) |
| `Morfologia: reconhecimento, emprego e sentido das classes gramaticais; mecanismos de flexão dos nomes e dos verbos` | `530b4245-55ff-4c6a-bde1-0a6fe3ed8f89` Morfologia (Classes de Palavras) | `REUSO_CANONICO` |
| `processos de formação de palavras` | `530b4245`, mas o nome canônico não enuncia isso | `PENDENTE_REVISAO` |
| `Sintaxe: frase, oração e período` | `bae5d5c7-12ed-4067-a6f5-e135c795c9ac` Sintaxe da Oração e `62f0f42f-a873-4c15-82b0-00ac8d49fa2d` Sintaxe do Período | `REUSO_CANONICO` (dois alvos para um período do edital) |
| `termos da oração` | `bae5d5c7` Sintaxe da Oração | `REUSO_CANONICO` |
| `processos de coordenação e subordinação` | `62f0f42f` Sintaxe do Período | `REUSO_CANONICO` |
| `concordância nominal e verbal` | `dbef0123-1c51-45fb-8da9-e068936ae820` Concordância Verbal e Nominal | `REUSO_CANONICO` |
| `transitividade e regência de nomes e verbos` | `42d99aed-aeb4-44c2-83fb-0459b4392c59` Regência e Crase | `REUSO_CANONICO` com ressalva: **crase não aparece no texto de 2021**; não afirmar que o edital cobra crase (`PENDENTE_REVISAO`) |
| `padrões gerais de colocação pronominal no português` | nenhum dos 13 | `NOVO_CANONICO` + `PENDENTE_REVISAO` |
| `mecanismos de coesão e coerência textual` | `10f3f8f9-2362-43ec-b815-9baf6830ec06` Coesão e Coerência | `REUSO_CANONICO` |
| `Estilística: figuras de linguagem` | `b8b6104c-3e54-4521-a3d6-d14539644287` Figuras de Linguagem | `REUSO_CANONICO` |
| `Ortografia em vigor` | `1cdf12fc` Fonologia e Ortografia | `REUSO_CANONICO` (segundo período para o mesmo alvo: colisão 2-para-1, documentar) |
| `Pontuação` | `f5b21318-37d8-4bf9-bda5-3e422cf7a2b1` Pontuação | `REUSO_CANONICO` |

Resumo medido: **12 dos 13** tópicos canônicos de Português recebem proposta de reuso direto;
`Acentuação Gráfica` entra apenas como alternativa ambígua; duas expressões do edital
(`Variação Linguística` e `colocação pronominal`) não têm alvo canônico nenhum. Nenhuma das
13 linhas canônicas foi renomeada, movida ou tocada.

### I.2 Matemática (rótulos publicados, ver §E)

A matéria `Matemática` (`95bb8b59-60ad-4c52-bf05-bc718cbb6353`) existe como linha de
`knowledge_subjects`, mas tem **zero `knowledge_topics`**: nenhum reuso canônico é possível
hoje, e toda a coluna de alvo fica em proposta de criação.

| Rótulo publicado em 2021 (literal) | Classe | Comparação com a camada de edital de 2026 (mesma base do snapshot) |
|---|---|---|
| `Geometria: ângulo, polígonos, triângulos, Teorema de Pitágoras, equação da reta, trigonometria` | `NOVO_CANONICO` + `BLOQUEADO` | a linha de edital `Geometria Plana (Cálculo de áreas e perímetros de figuras básicas)` (`4b9ef240-fd19-406c-9ef5-6bb4412dee4a`) **não cobre** o conteúdo de 2021, que inclui trigonometria e equação da reta: `AMBIGUO` |
| `Estatística e Probabilidade; amostra, frequências, probabilidade` | `NOVO_CANONICO` + `BLOQUEADO` | a linha de 2026 `Análise Combinatória e Probabilidade (Princípio multiplicativo, arranjos e combinações)` (`e81e05cc-f1c3-437e-9d65-9b296fa8d747`) inverte o par: em 2021 a combinatória está em **Raciocínio Lógico**, não em Matemática: `AMBIGUO` |
| `Álgebra e Funções: função exponencial, equação e inequação exponencial, função linear, função logarítmica, matrizes, sistemas lineares, equação do 2º grau, polinômios` | `NOVO_CANONICO` + `BLOQUEADO` | a linha `Álgebra (Equações de 1º e 2º graus, sistemas e funções)` (`9052d4ca-3617-47fa-a0e9-1e422dfc8577`) não menciona exponencial, logaritmo, matrizes nem polinômios, e 2021 não menciona equação do 1º grau: `AMBIGUO` |
| `Números e Operações: juros simples e composto, porcentagem, conjuntos, regra de três, proporcionalidade` | `NOVO_CANONICO` + `BLOQUEADO` | 2021 agrupa num rótulo o que 2026 divide em duas linhas: `Aritmética Básica (Operações com números reais, frações e decimais)` (`fb5c8fef-dcf3-4c14-8242-b4ffb8a126e2`) e `Razão e Proporção (Regra de três simples/composta, porcentagem e juros simples)` (`a6ade1ff-b742-4b42-af7d-7804a32ce04a`); `conjuntos` não está em nenhuma das duas: `AMBIGUO` |

Ressalvas medidas:

- 2021 publica **4 rótulos** (22 termos pelo separador de §F.2). A contagem terciária de
  **24 itens** não se reproduz a partir da fonte primária (§F.3) e não serve de justificativa
  para quantidade de tópicos.
- Criar tópico canônico com ordinal (`1º grau`, `2º grau`) reproduz a divergência de chaves já
  medida em docs/23 §6: o ordinal sobrevive em `normalized_name` e desaparece em `slug`. É
  argumento para decisão humana, não para criação automática.
- `Estatística` existe como `knowledge_subjects` separada (`38189cfa-b9a3-4753-b5f5-34554a70257e`,
  zero tópicos). Ancorar o rótulo de 2021 ali ou em `Matemática` é decisão de vocabulário:
  `PENDENTE_REVISAO`.

### I.3 Raciocínio Lógico

Premissa corrigida por esta execução: **o Anexo VI de 2021 foi conferido** (§C, §D, §E). Ele
publica `Raciocínio Lógico` como **disciplina autônoma** para `Soldado BM Temp. Combatente`
(inclusive com CNH categoria B) e para `Soldado BM Temp. Guarda-Vidas`, nas páginas 22 a 25, e
**não** a publica para Técnico de Enfermagem. A proibição de gravar continua valendo, mas por
outro motivo: falta banco de teste isolado e revisão humana, não falta leitura do anexo.

A matéria `Raciocínio Lógico` existe em `knowledge_subjects`
(`aaaaaaaa-0000-4000-8000-000000000004`, slug `raciocinio-logico`) com **zero tópicos**, e não
existe linha de edital só para ela: em 2026 ela está fundida no `notice_subjects`
`a8558000-e47a-40f0-8c60-c4c2451b9688`, cujo `metadata.disciplina` é
`Matemática e Raciocínio Lógico` e cujo `knowledge_subject_id` aponta para `Matemática`. Não há
reuso canônico possível. As unidades abaixo são **interpretação** minha sobre um único bloco
discursivo publicado (8 períodos, ver §F.2), não rótulos do edital:

| Unidade derivada do bloco literal | Classe |
|---|---|
| Estrutura lógica de relações arbitrárias e avaliação das condições que a estabelecem | `NOVO_CANONICO` + `BLOQUEADO` |
| Problemas de raciocínio (deduzir informações de relações arbitrárias entre objetos, lugares, pessoas e eventos fictícios) | `AMBIGUO` (solapa a linha acima, dentro do próprio edital) |
| Raciocínio verbal | `NOVO_CANONICO` + `BLOQUEADO` |
| Raciocínio matemático (lista de conteúdo aritmético-algébrico) | `AMBIGUO` + `PENDENTE_REVISAO` (duplica a disciplina Matemática; decidir se vira tópico de Raciocínio Lógico ou referência cruzada) |
| Raciocínio sequencial de números, símbolos, figuras e letras | `NOVO_CANONICO` + `BLOQUEADO` |
| Orientação espacial e temporal | `NOVO_CANONICO` + `BLOQUEADO` |
| Formação de conceitos e discriminação de elementos | `NOVO_CANONICO` + `BLOQUEADO` |
| Processo lógico de hipóteses a conclusões válidas | `NOVO_CANONICO` + `BLOQUEADO` |
| Operações com conjuntos e princípio fundamental da contagem | `AMBIGUO` (encontra-se com combinatória e estatística de Matemática) |
| Lógica sentencial ou de primeira ordem; proposições e conectivos | `NOVO_CANONICO` + `BLOQUEADO` |
| Operações lógicas, tabelas-verdade, equivalências, leis de Morgan | `NOVO_CANONICO` + `BLOQUEADO` |
| Diagramas lógicos, tabelas e gráficos | `AMBIGUO` (`tabelas e gráficos` também pertence a Estatística) |

Não desdobrar a linha de raciocínio matemático em vinte tópicos sem decisão humana: o edital de
2021 usa essa lista como parêntese do raciocínio, não como catálogo.
### I.4 Conhecimentos Específicos (Técnico de Enfermagem)

Nenhuma das 33 `knowledge_subjects` do snapshot é de Enfermagem ou de Saúde. A composição
medida é: **12 linhas de Direito** (Constitucional, Administrativo, Civil, Penal, Processual
Civil, Processual Penal, Processual do Trabalho, do Trabalho, Tributário, Empresarial,
Ambiental, Previdenciário), **8 linhas de teste ou residuo** (`E2E a73eb286`, `E2E d02819b4`,
`E2E 7c0707db`, `E2E 58f07a7b`, `Matéria 9ef494b9`, `Matéria f72f758c`, `Matéria 1baad6ab`,
`Matéria 5e9f8f3f`) e **13 matérias pedagógicas**: Português, Matemática, Raciocínio Lógico,
Redação, Informática, Ética no Serviço Público, Administração Pública, Contabilidade, Economia,
Estatística, Atualidades, Direitos Humanos e Legislação Especial.

Não há, portanto, onde ancorar o bloco de Conhecimentos Específicos transcrito em §E.2, e criar
matéria nova é decisão de vocabulário mais ampla que a catalogação de um edital.

- Classe: `BLOQUEADO` + `PENDENTE_REVISAO` (nem `NOVO_CANONICO` se aplica ainda, porque o alvo
  seria uma matéria, não um tópico).
- Escopo de cargo: o edital CBMERJ 2026 gravado no banco prevê **apenas**
  `1.122 (Combatentes e Guarda-Vidas)`
  (`editais.aaaaaaaa-0000-4000-8000-000000000305.programmatic_content.vagas`). Técnico de
  Enfermagem não tem equivalente vigente, então a carga de 2021 seria treino histórico, nunca
  cobertura do edital atual.

### I.5 Recorte por cargo (o que o mapeamento não pode fazer)

| Cargo 2021 | Disciplinas publicadas | Alvo do mapeamento |
|---|---|---|
| `Soldado BM Temp. Combatente` e `Soldado BM Temp. Combatente com CNH (Carteira Nacional de Habilitação) categoria B` | Língua Portuguesa, Matemática, Raciocínio Lógico | §I.1 + §I.2 + §I.3 |
| `Soldado BM Temp. Guarda-Vidas` | Língua Portuguesa, Matemática, Raciocínio Lógico | §I.1 + §I.2 + §I.3 (mesmo texto, ver §G.1) |
| `Soldado BM Temp. Técnico de Enfermagem Hospitalar/Ambulatorial` e `Soldado BM Temp. Técnico de Enfermagem Socorrista` | Língua Portuguesa, Matemática, Conhecimentos Específicos | §I.1 + §I.2 + §I.4 |

Identidade de texto entre Combatente e Guarda-Vidas **não** autoriza fundir tópicos, criar
alias de cargo nem compartilhar `notice_topics` entre cargos: cada cargo tem sua camada de
edital, e a igualdade estaria no catálogo pedagógico, se um dia existir vínculo. docs/23 §1
fato 4 registra ainda uma segunda linha de `notice_subjects` de Português a explicar antes de
qualquer vínculo; no snapshot as duas linhas de Português
(`aaaaaaaa-0000-4000-8000-000000000503`, peso 25, zero tópicos, edital MPF 2026
`aaaaaaaa-0000-4000-8000-000000000301`; e `cb5e13b8-5781-4eed-b244-adcc7689be95`, peso 50, 7
tópicos, edital CBMERJ SMTV 2026 `aaaaaaaa-0000-4000-8000-000000000305`) pertencem a editais
distintos — ver §J.3.

### I.6 Nenhum efeito colateral

Nada nesta seção foi escrito em banco. As classes são texto deste arquivo. Não houve `INSERT`,
`UPDATE`, `DELETE`, migração, seed, `db:push`, `db:migrate`, `ingest:apostilas --apply`, nem
alteração de `knowledge_topics`, `notice_topics`, `notice_topics.knowledge_topic_id` ou do
snapshot.
## J. Conflitos e correções em relação a docs/23

`docs/23-CATALOGO-PROVENIENCIA-E-VOCABULARIO.md` **não foi alterado** por esta fase. Os pontos
abaixo registram divergência; corrigir o documento normativo é decisão de quem o mantém.

### J.1 Premissa de Raciocínio Lógico (docs/23 §3) — parcialmente superada

docs/23 §3 afirma: *“Raciocínio Lógico fica `PENDING`: não existe catálogo pedagógico para a
matéria, não existe linha de edital para ela hoje, e não houve conferência do Anexo VI de 2021.”* Confronto com o que foi verificado aqui:

- **não houve conferência do Anexo VI de 2021** — superado: o anexo foi conferido (§C, §D, §E), e
  `Raciocínio Lógico` está publicado como disciplina autônoma para Combatente e para
  Guarda-Vidas.
- **não existe catálogo pedagógico** — confirmado: `knowledge_subjects` tem a linha
  `aaaaaaaa-0000-4000-8000-000000000004` com **zero** `knowledge_topics`.
- **não existe linha de edital para ela hoje** — confirmado com nuance: não há `notice_subjects`
  própria de Raciocínio Lógico; os 5 tópicos de edital estão em
  `a8558000-e47a-40f0-8c60-c4c2451b9688`, cujo `metadata.disciplina` é
  `Matemática e Raciocínio Lógico` e cujo `knowledge_subject_id` aponta para `Matemática`.
- **Conclusão:** a proibição de criar tópico de Raciocínio Lógico continua válida, mas o motivo
  muda de *ausência de leitura do documento* para *ausência de banco de teste isolado e de
  revisão humana*. Manter a redação antiga deixaria a impressão de que o Anexo VI ainda não foi
  verificado, o que é falso.

### J.2 Proveniência do acervo 2021 (docs/23 §2 e §3)

docs/23 §3 manda a carga de 2021 entrar com `source_type: historical`, `source_year: 2021`,
`provenance: unverified`, `status: provisional`. Este documento estabelece outra coisa: existe
agora transcrição literal, conferida byte a byte, de documento oficial arquivado. Isso **não**
promove `provenance` sozinho, porque docs/23 §2 é explícito ao dizer que `official` não convive
com ausência de conferência humana. Portanto:

- hoje o par correto continua `provenance: unverified` com `status: provisional`;
- o que mudou é a **qualidade da evidência disponível para o revisor humano**, não o valor do
  eixo;
- depois da revisão, a promoção prevista é `provenance: official`, mantendo
  `source_type: historical` e `source_year: 2021`;
- docs/23 §2 não define valor de `status` pós-revisão (`verified` não existe no vocabulário),
  então **não invento** valor novo: isso é lacuna do documento normativo, não deste artefato.

### J.3 Fato 4 da §1 de docs/23 contradito pelo próprio snapshot

docs/23 §1 (fato 4) diz que existem duas linhas `notice_subjects` chamadas Português **no mesmo
edital**. O snapshot mostra duas linhas de Português em **editais distintos**:

| `notice_subjects.id` | `edital_id` | `weight` | tópicos |
|---|---|---|---|
| `aaaaaaaa-0000-4000-8000-000000000503` | `aaaaaaaa-0000-4000-8000-000000000301` (MPF 2026) | 25 | 0 |
| `cb5e13b8-5781-4eed-b244-adcc7689be95` | `aaaaaaaa-0000-4000-8000-000000000305` (CBMERJ SMTV 2026) | 50 | 7 |

Consequência prática: a pendência de confirmar se a segunda linha é escopo de cargo ou resto de
carga anterior (docs/23 §11, item 5) **não se aplica** ao edital CBMERJ 2026 lido aqui, porque
não há linha duplicada dentro dele. A decisão continua necessária para a linha do MPF 2026, que
é de outro concurso.

### J.4 docs/23 §11, item 1: snapshot dito commitado

O documento afirma que o snapshot foi “gerado e commitado (feito nesta fase)”. O estado real do
repositório nesta execução é `?? database/knowledge/snapshots/` — **untracked**, portanto não
commitado. Este arquivo registra o estado observado em §L em vez de reescrever docs/23.

### J.5 docs/23 §4: Raciocínio Lógico como “ainda não existe como linha”

Verdadeiro na camada de edital; falso em `knowledge_subjects`, onde a linha
`aaaaaaaa-0000-4000-8000-000000000004` existe. Ler a tabela como “não existe a matéria” levaria
à conclusão errada de que é preciso criar matéria para Raciocínio Lógico. O que faltam são
**tópicos** e **linha de edital**, não a matéria.

### J.6 docs/23 §11, item 6: “até haver documento oficial conferido”

A parte documental passou a existir (Anexo VI Retificação 02, transcrito em §E). Ela não elimina
o segundo requisito — banco de teste isolado — nem dispensa o aceite humano sobre o **nível** de
evidência: o que foi conferido é uma **cópia arquivada** hospedada na infraestrutura da banca
(captura Wayback de `funrioms.selecao.net.br`), não fac-símile do CBMERJ nem do DOERJ (§B, §H).

### J.7 A contagem “38 de Português + 24 de Matemática” não é fato de fonte primária

docs/23 não a registra, mas o plano da fase e anotações derivadas a tratavam como número do
edital. §F.3 mostra que da fonte primária se obtém **1 bloco** por disciplina e **4 rótulos** em
Matemática, e que a base de origem é planilha ou roteiro terciário. Número derivado não pode
entrar como metadado de contagem oficial.

### J.8 docs/23 §11, item 4: ainda não cumprido

docs/23 §11 exige tabela de mapeamento de `notice_topics` para `knowledge_topics` escrita por
humano para os 12 tópicos vigentes antes de qualquer vínculo automático. §I deste documento é
mapeamento de **2021 histórico** e é **proposta não revisada**: não substitui aquela tabela, nem
libera vínculo dos 12 `notice_topics` de 2026, que continuam com `knowledge_topic_id` nulo em
**12 de 12** casos (`link_coverage.notice_topics_linked_to_knowledge = 0`).
## K. Prova de integridade da fonte

Só valores medidos nesta execução e já registrados nas seções C, D, F e G acima. Nada aqui é
número de memória ou de anotação prévia.

### K.1 Documentos conferidos

| Papel | Timestamp da captura | Payload | Páginas | Chars | SHA-256 do payload |
|---|---|---|---|---|---|
| Edital nº 01/2021 (original) | `20210707150457` | 839.237 bytes | 52 | 171.363 | `3ec0821bb0bd8fbf1732dca3b22b0af3d4abe37d95e672ddf0b6b11918506b1d` |
| Anexo VI após Retificação 01 | `20210707150437` | 808.291 bytes | 25 | 125.975 | `498d002a63aec16c283abdbb3ee2c0df511e7b1487f5e95c17c1246c9386151d` |
| **Anexo VI após Retificação 02** (base da transcrição) | `20210814140424` | 808.646 bytes | 25 | 126.024 | `f946d37482b745e98b5eed610bfcaa310da276ac3d276a87699130aa7c7752f5` |
| Edital após Retificação 01 | `20210707150432` | — | — | — | **não reproduzido** (§H.3) |

Diferença Ret. 01 para Ret. 02: 355 bytes, 49 caracteres de texto (`Δ` medido em §D.2), SHA-256
global distinto. Página e texto batem, o que descarta documento diferente sob nome parecido.

### K.2 Identidade dos blocos transcritos (medida em §G.1)

| Bloco (normalizado: sem marcadores de página, acentos removidos por NFD, espaço colapsado, minúsculas) | Chars | SHA-256 (16 hex) |
|---|---|---|
| Conteúdo de Combatente inteiro | 3.063 | `f906e47d55193da7` |
| Conteúdo de Guarda-Vidas inteiro | 3.063 | `f906e47d55193da7` (idêntico) |
| `Língua Portuguesa` de Combatente e de Guarda-Vidas | 1.046 | `d0e591786f9aa868` (idêntico nos dois) |
| `Matemática` de Combatente, de Guarda-Vidas e de Técnico de Enfermagem | 446 | `aa5bcac520edb038` (idêntico nos três) |
| `Raciocínio Lógico` de Combatente e de Guarda-Vidas | 1.571 | `58f8ff59478e7ef1` (idêntico nos dois) |
| `Conhecimentos Específicos` do Técnico de Enfermagem | 2.147 | `220c2f353293f87e` |
| Bloco inteiro de contúudo do Técnico de Enfermagem | 3.824 | hash não coletado (§H.5) |
| `Língua Portuguesa` do Técnico de Enfermagem | 1.046 (mesmo comprimento dos demais cargos) | hash não coletado (§H.5) |

Fato de cadeia que sustenta a transcrição: a fatia bruta do bloco de Praças é 10.612 caracteres;
a fatia normalizada é 10.031. A anotação prévia de 10.032 caracteres estava errada em 1 caractere
por tratamento do espaço final; a conclusão de igualdade entre versões não muda (§C.1).

### K.3 O que NÃO é prova

- **Data de publicação.** `02/07/2021` não aparece no texto do edital; a única referência ao
  DOERJ no corpo do edital é a publicação da Lei nº 9.027/2020, em 29/09/2020 (§A, §H.1).
- **Contagens de tópicos.** “38 de Português / 24 de Matemática” não se reproduz da fonte
  primária; é derivado de planilha/roteiro (§F.3, §J.7).
- **Natureza do documento.** É cópia arquivada do arquivo da banca, extraída por texto. Não é
  fac-símile do CBMERJ nem do DOERJ, e a extração não provou formatação (§H.2, §H.4).
- **Escopo.** Conteúdo programático de Praças apenas. Pesos, número de questões, prova de redação
  e TAF não foram conferidos (§H.6).
- **Snapshot.** `checksum_sha256` do catálogo lido em §I é
  `fa8c2c42686496974bf17fb058fbdd10710bdfd3b7c96084b814f56c46cf491c` — linha de base somente
  leitura, não alterada por esta fase.

## L. Validação do repositório

| Verificação | Resultado |
|---|---|
| `git rev-parse --short HEAD` | `a4bbf39` (inalterado: nada foi commitado) |
| `git status --short` | 34 entradas `M` + 24 entradas `??` = **58 grupos** |
| Diferença para a linha de base (57) | exatamente uma entrada nova: `?? docs/24-CATALOGACAO-HISTORICA-CBMERJ-2021.md` |
| `git diff --check` | saída com código 0; apenas avisos de conversão LF para CRLF nos 34 arquivos **já modificados antes desta fase**; nenhum erro de espaço em branco introduzido aqui |
| `npx tsc --noEmit` | código 0, zero linhas de saída |
| Arquivos alterados por esta fase | **somente** `docs/24-CATALOGACAO-HISTORICA-CBMERJ-2021.md` |
| Estado do snapshot | `?? database/knowledge/snapshots/` (untracked; ver §J.4) |

As demais pendências (34 modificados, 23 untracked preexistentes, incluindo `docs/23`, os
arquivos de código das fases 1 e 2) não foram tocadas: esta fase não abriu, renomeou, formatou
nem commitou nenhum deles.

### L.1 Ausência de operação de banco (afirmação verificável)

Nenhum destes foi executado nesta fase: `db:push`, `db:seed`, `db:migrate`, `drizzle:migrate`,
`db:check`, `scripts/db-guard.ts` com destino de escrita, `supabase` CLI, `drizzle-kit`, client
Postgres, `ingest:apostilas` com `--apply`, seed, cleanup de E2E, `node scripts/catalog-snapshot.mjs`
(o snapshot foi **lido como arquivo**, não regenerado), `npm install`, commit, push ou deploy.

Não houve conexão com o projeto Supabase em nenhum momento desta fase. As únicas operações sobre
o banco foram de leitura de artefato JSON versionado em disco
(`database/knowledge/snapshots/2026-10-03-catalogo-atual.json`) e contagem em memória de suas
chaves. Isso é compatível com o guard do projeto (`src/lib/db/env-guard.ts` e
`scripts/db-guard.ts` seguem bloqueando escrita: `PROD_SUPABASE_PROJECT_REF` e
`SAFE_TEST_DATABASE_REFS` continuam vazios, docs/23 §10).

## M. Reprodutibilidade

Ambiente desta execução: Node `v24.14.1`, extrator `pdf-parse` `^1.1.1` (dependência declarada
em `package.json`), Windows.

Cadeia usada, sem gravar documento em disco:

1. Listar capturas do Internet Archive para a pasta da banca
   (`funrioms.selecao.net.br/uploads/310/concursos/8/...`) e reter os timestamps de §C.
2. `fetch` da URL com modificador `if_` (payload original, sem banner do Archive), corpo em
   `arrayBuffer` para `Buffer`.
3. `crypto.createHash(`sha256`).update(buffer).digest(`hex`)` antes de qualquer parsing.
4. `pdf-parse(buffer)` e contagem de páginas pelo marcador interno `PromptPage`.
5. Recorte dos blocos por rótulo literal (`Língua Portuguesa`, `Matemática`, `Raciocínio Lógico`,
   `Conhecimentos Específicos`) preservando o texto cru, inclusive os espaços duplos da
   composição justificada e os marcadores `===== PAGE n =====` desta verificação.
6. Normalização para comparação: remover marcadores, `normalize(`NFD`)` e descartar
   `\u0300-\u036f`, colapsar espaço em branco, passar para minúsculas.
7. Comparação `===` e SHA-256 do bloco normalizado (é o que produz as tabelas de §D e §G).

Comando de conferência do catálogo, somente leitura, usado em §I:

```powershell
node -e "...leitura de database/knowledge/snapshots/2026-10-03-catalogo-atual.json..."
```

Repetir a verificação com outro timestamp de captura pode mudar o payload (o Archive aceita
re-compressão); se os hashes de §K.1 divergirem, o artefato deve registrar as duas medições em
vez de substituir a anterior.
## N. Estado do artefato e contrato de retomada

### N.1 Classificação deste documento

**Fonte primária arquivada + transcrição literal + mapeamento provisório, sem vínculo em banco e
sem revisão humana.** Nas chaves de docs/23 §2, a carga descrita aqui ainda entra como
`source_type: historical`, `source_year: 2021`, `provenance: unverified`, `status: provisional`.
A transcrição é conferível, mas conferência mecânica não é a validação humana que docs/23 §2
exige para `official` (§J.2).

### N.2 O que a FASE 3B pode assumir deste arquivo

1. O Anexo VI do Edital nº 01/2021 (versão Retificação 02) publica, para os cargos de Praças, as
   disciplinas `Língua Portuguesa`, `Matemática` e `Raciocínio Lógico` (Combatente e
   Guarda-Vidas) e `Língua Portuguesa`, `Matemática` e `Conhecimentos Específicos` (Técnico de
   Enfermagem).
2. O conteúdo programático é **prosa corrida, sem numeração oficial de itens**: qualquer
   subdivisão em tópicos é interpretação nossa (§F.1, §F.2).
3. Depois de normalização, o conteúdo de **Combatente é idêntico ao de Guarda-Vidas**, inclusive
   por hash de bloco (§G.1) — a distinção entre os dois cargos não está no conteúdo programático.
4. **Técnico de Enfermagem não tem `Raciocínio Lógico`** no edital de 2021, compartilha o bloco
   de `Matemática` dos demais cargos e difere por `Conhecimentos Específicos` (§G.2).
5. Há material suficiente para revisão humana de Português, Matemática e Raciocínio Lógico:
   as unidades derivadas de §F.2 — 11 períodos de Português (6 com rótulo, 5
   soltos), 4 rótulos de Matemática (22 termos) e 8 períodos de Raciocínio Lógico —
   mais as transcrições completas de §E.1, §E.2 e §E.3.

### N.3 O que a FASE 3B NÃO pode assumir

1. Que o edital foi publicado em `02/07/2021` no DOERJ — não confirmado (§H.1).
2. Que “38 questões de Português / 24 de Matemática” (ou qualquer contagem de tópicos) venha do
   edital — é derivado terciário (§F.3, §J.7).
3. Que a fonte conferida seja o PDF institucional do CBMERJ: é captura arquivada do arquivo da
   banca, extraída por texto (§H.2).
4. Que o edital **após a Retificação 01** tenha sido conferido — não reproduzido nesta execução
   (§C.1, §H.3).
5. Nada sobre pesos, quantidade de questões, prova de redação, TAF ou critérios de classificação
   (§H.6).
6. Que a tabela §I esteja aprovada, nem que os 12 `notice_topics` vigentes de 2026 estejam
   mapeados: continuam sem `knowledge_topic_id` e a tabela exigida por docs/23 §11 (item 4)
   continua por escrever (§J.8).

### N.4 Bloqueios que permanecem antes de qualquer escrita

| Bloqueio | Estado |
|---|---|
| Banco de teste isolado | indisponível: `PROD_SUPABASE_PROJECT_REF` e `SAFE_TEST_DATABASE_REFS` vazios; `db:push`, `db:seed`, `db:migrate`, `ingest:apostilas --apply` seguem bloqueados por guard (docs/23 §10) |
| Concurso/edital CBMERJ 2021 | inexistente no banco: criar `contests` e `editais` de 2021 é pré-requisito de qualquer `notice_topic` histórico (§I.0) |
| Matemática e Raciocínio Lógico | `knowledge_subjects` existem (`95bb8b59-60ad-4c52-bf05-bc718cbb6353` e `aaaaaaaa-0000-4000-8000-000000000004`) com **zero** tópicos: nada a reusar (§I.2, §I.3) |
| Conhecimentos Específicos de Enfermagem | nenhuma matéria correspondente entre as 33 `knowledge_subjects` (§I.4) |
| Provas da Retificação 01 do edital | pendente de nova tentativa de fetch com tempo maior (§H.3) |
| Data de publicação DOERJ | exige fonte oficial diversa; fora do alcance desta fase (§H.1) |
| Revisão humana do vocabulário | pré-requisito de docs/23 §11 (itens 3 e 4) ainda não cumprido |

### N.5 Encerramento da FASE 3A

Este arquivo está completo em §A a §N. Nenhuma outra via foi alterada: nenhum código, nenhum
SQL, nenhum snapshot, nenhum `docs/23`, nenhum commit, nenhum push, nenhum deploy, nenhuma
conexão de banco (§L, §L.1).

A FASE 3B (revisão humana do vocabulário e vínculo) **não deve abrir `docs/25`**: esse número já
está ocupado por `docs/25-SDD-IMPLEMENTACAO-RECENTE.md`, que é de outra natureza e também está
entre os arquivos modificados desta linha de base. O artefato seguinte deve ser
`docs/26-REVISAO-DE-VOCABULARIO-E-VINCULO.md`, consumindo §I e §N deste documento como entrada e
produzindo, antes de qualquer escrita, a tabela de mapeamento revisada por humano exigida por
docs/23 §11 (item 4).
### N.6 Onde isso virou código (2026-10-03, sem escrita)
O que §I e §N previam passou a existir em código, e a medida deixou de ser estimativa:
`docs/27-VOCABULARIO-EM-CODIGO-E-MEDIDA-CALIBRADA.md` registra o vocabulário de §4 ligado ao
matcher — inclusive `Língua Portuguesa` → `Português`, o gargalo apontado em §F.3 e §N.4 —, a
precedência dos detectores de colisão (diagnóstico puro: `deduplicated: false`,
`discardedEntries: 0`, `collisionId` estável por `kind + chave`) e os IDs de regra do matcher.
A medida calibrada sobre as 278 unidades do §E: 9 `REUSO_CANONICO` (só Português: `Semântica`,
`Figuras de Linguagem`, `Pontuação`, repetidos nos 3 cargos), 127 `NOVO_CANONICO` (27 por
`TOPIC-04`, 100 por `TOPIC-05`), 78 `PENDENTE_REVISAO` (todos `DERIVED`), 64 `BLOQUEADO`
(exatamente `Conhecimentos Específicos`) e 0 `AMBIGUO`; 78 grupos de colisão `NORMALIZED_NAME`
cobrindo 220 unidades; 0 acordo de chave completa com as 31 linhas canônicas do snapshot.
Nada disso autoriza escrita: apply continua `APPLY_DISABLED_IN_AUDIT_PHASE`, `databaseOperations`
segue vazia, e o vínculo humano de §3/§K.1 é FASE 3B com `docs/26` ainda por existir.