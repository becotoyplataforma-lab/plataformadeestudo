import type { ConfigAula } from "./gerador-motor-matriz";

export const AULA_08_CONFIG: ConfigAula = {
  numero: "08",
  tituloMateria: "Língua Portuguesa",
  tituloAula: "Aula 08 — Regência Verbal e Nominal",
  subtituloCapa: "CBM-RJ — CORPO DE BOMBEIROS MILITAR",
  totalPaginas: "152 Páginas Integrais",
  totalQuestoes: "88+ Questões AOCP & Fixação",
  arquivoPdfOriginal: "curso-384118-aula-08-a7e5-completo.pdf",
  secoesTeoria: [
    {
      id: "s01",
      n: "01",
      title: "Conceito de Regência: Termo Regente e Termo Regido",
      conteudoHtml: `
        <p class="theory-p">A <strong>Regência</strong> é a relação de subordinação sintática que se estabelece entre uma palavra que exige complemento (chamada de <strong>Termo Regente</strong>) e a palavra que funciona como seu complemento subordinado (chamada de <strong>Termo Regido</strong>). Quando o termo regente é um verbo, temos <em>Regência Verbal</em>; quando é um substantivo, adjetivo ou advérbio, temos <em>Regência Nominal</em>.</p>
        <p class="theory-p">O elemento articulador e indispensável na regência é a <strong>preposição</strong> adequada exigida pelo sentido específico do termo.</p>
      `
    },
    {
      id: "s02",
      n: "02",
      title: "Verbos Críticos de Regência no Instituto AOCP",
      conteudoHtml: `
        <p class="theory-p">Quadro completo dos verbos com múltipla regência mais exigidos nas provas militares:</p>
        <table class="table-matriz">
          <thead>
            <tr>
              <th>Verbo</th>
              <th>Sentido / Significado</th>
              <th>Transitividade e Preposição</th>
              <th>Exemplo de Prova</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td rowspan="2"><strong>Assistir</strong></td>
              <td>Presenciar, ver</td>
              <td>VTI (rege preposição 'a')</td>
              <td><em>Assistimos <strong>ao</strong> salvamento das vítimas.</em></td>
            </tr>
            <tr>
              <td>Prestar socorro, ajudar</td>
              <td>VTD (sem preposição) ou VTI</td>
              <td><em>O socorrista assistiu o ferido (ou ao ferido).</em></td>
            </tr>
            <tr>
              <td rowspan="2"><strong>Aspirar</strong></td>
              <td>Sorbitar, inalar ar/gás</td>
              <td>VTD (sem preposição)</td>
              <td><em>Aspirou a fumaça tóxica do incêndio.</em></td>
            </tr>
            <tr>
              <td>Almejar, desejar, pretender</td>
              <td>VTI (rege preposição 'a')</td>
              <td><em>O soldado aspira <strong>à</strong> promoção oficial.</em></td>
            </tr>
            <tr>
              <td rowspan="2"><strong>Visar</strong></td>
              <td>Mirar; apontar arma; rubricar</td>
              <td>VTD (sem preposição)</td>
              <td><em>Visou o alvo; Visou o cheque.</em></td>
            </tr>
            <tr>
              <td>Ter por objetivo, almejar</td>
              <td>VTI (rege preposição 'a')</td>
              <td><em>A instrução visa <strong>ao</strong> aprimoramento físico.</em></td>
            </tr>
            <tr>
              <td><strong>Obedecer / Desobedecer</strong></td>
              <td>Cumprir ordens/leis</td>
              <td>VTI obrigatório (rege preposição 'a')</td>
              <td><em>Todos obedecem <strong>às</strong> ordens do oficial.</em></td>
            </tr>
            <tr>
              <td rowspan="2"><strong>Pagar / Perdoar</strong></td>
              <td>Refere-se a Coisa</td>
              <td>VTD (sem preposição)</td>
              <td><em>Pagou a conta; Perdoou a dívida.</em></td>
            </tr>
            <tr>
              <td>Refere-se a Pessoa</td>
              <td>VTI (rege preposição 'a')</td>
              <td><em>Pagou <strong>ao</strong> fornecedor; Perdoou <strong>ao</strong> irmão.</em></td>
            </tr>
            <tr>
              <td><strong>Preferir</strong></td>
              <td>Dar primazia a algo</td>
              <td>VTDI (rege 'a', NUNCA 'do que'!)</td>
              <td><em>Prefiro o treino <strong>ao</strong> descanso (e nunca "do que o descanso").</em></td>
            </tr>
            <tr>
              <td><strong>Implicar</strong></td>
              <td>Acarretar, ter como consequência</td>
              <td>VTD direto (sem 'em')</td>
              <td><em>A indisciplina implica punição (e nunca "implica em punição").</em></td>
            </tr>
          </tbody>
        </table>
      `
    },
    {
      id: "s03",
      n: "03",
      title: "Verbos Lembrar e Esquecer (Pronominais vs. Não Pronominais)",
      conteudoHtml: `
        <div class="matrix-callout callout-rule">
          <div class="callout-top">REGRA DE OURO — PARIDADE PRONOMINAL</div>
          <div class="callout-text">
            • <strong>Com Pronome (Lembrar-se / Esquecer-se):</strong> exige a preposição <strong>DE</strong> (<em>Esqueci-me <strong>do</strong> compromisso; Lembrei-me <strong>da</strong> lição</em>).<br>
            • <strong>Sem Pronome (Lembrar / Esquecer):</strong> NÃO admite preposição; atua como VTD puro (<em>Esqueci <strong>o</strong> compromisso; Lembrei <strong>a</strong> lição</em>).<br>
            <em>Erro grave de prova:</em> "Esqueci do livro" (mistura as duas construções!).
          </div>
        </div>
      `
    },
    {
      id: "s04",
      n: "04",
      title: "Regência Nominal: Preposições Canônicas",
      conteudoHtml: `
        <p class="theory-p">A <strong>Regência Nominal</strong> estuda a relação entre substantivos, adjetivos e advérbios e seus respectivos complementos nominais preposicionados:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Regem a preposição A:</strong> <em>acessível a, acostumado a, adaptado a, afável a, alheio a, anterior a, apto a, atencioso a, contrário a, favorável a, nocivo a, preferível a, semelhante a</em>.</li>
          <li><strong>Regem a preposição DE:</strong> <em>ávido de, capaz de, cioso de, consciente de, digno de, isento de, livre de, necessitado de, seguro de</em>.</li>
          <li><strong>Regem a preposição EM:</strong> <em>bacharel em, constante em, doutor em, especialista em, fé em, hábil em, perito em</em>.</li>
          <li><strong>Regem a preposição COM:</strong> <em>afável com, compatível com, conivente com, generoso com, impaciente com, solidário com</em>.</li>
        </ul>
      `
    }
  ],
  secoesQuestoes: [
    {
      id: "s05",
      n: "05",
      title: "Questões Comentadas — Regência Verbal e Nominal (AOCP)",
      tipo: "comentada",
      itens: [
        {
          num: "01",
          enunciado: "Assinale a frase redigida em estrita conformidade com a regência verbal da norma-padrão:",
          alternativas: {
            A: "O candidato aspirava o cargo de bombeiro militar com dedicação.",
            B: "O regulamento interno visa o equilíbrio da disciplina na tropa.",
            C: "O oficial preferia estar em campo do que permanecer no quartel.",
            D: "O socorrista assistiu ao ferido prestando-lhe os primeiros socorros.",
            E: "A gravidade do acidente implicou na paralisação temporária da rodovia."
          },
          gabarito: "D",
          comentario: "O verbo 'assistir' no sentido de prestar auxílio admite transitividade direta ou indireta ('ao ferido'). Nas outras alternativas: aspirar (almejar) exige 'a'; visar (almejar) exige 'a'; preferir exige 'a' (e não 'do que'); implicar (acarretar) é VTD e não aceita a preposição 'em'."
        }
      ]
    }
  ]
};

export const AULA_09_CONFIG: ConfigAula = {
  numero: "09",
  tituloMateria: "Língua Portuguesa",
  tituloAula: "Aula 09 — Semântica, Significação das Palavras e Figuras de Linguagem",
  subtituloCapa: "CBM-RJ — CORPO DE BOMBEIROS MILITAR",
  totalPaginas: "148 Páginas Integrais",
  totalQuestoes: "86+ Questões AOCP & Fixação",
  arquivoPdfOriginal: "curso-384118-aula-09-a7c3-completo.pdf",
  secoesTeoria: [
    {
      id: "s01",
      n: "01",
      title: "Relações Semânticas: Sinônimos, Antônimos, Parônimos e Homônimos",
      conteudoHtml: `
        <p class="theory-p">A <strong>Semântica</strong> investiga o significado, o sentido e as transformações semânticas das palavras em seu contexto comunicativo:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Sinônimos:</strong> vocábulos de sentidos próximos ou equivalentes (<em>bravura / coragem; extinguir / apagar</em>).</li>
          <li><strong>Antônimos:</strong> vocábulos de sentidos opostos ou contraditórios (<em>ordem / caos; prudência / temeridade</em>).</li>
          <li><strong>Homônimos:</strong> palavras com a mesma estrutura fonética ou gráfica, mas significados totalmente distintos:
            <br>• <em>Homófonos (mesmo som, grafia diferente):</em> <strong>sessão</strong> (reunião/tempo) vs. <strong>seção</strong> (divisão/repartição) vs. <strong>cessão</strong> (ato de ceder); <strong>acender</strong> (fogo) vs. <strong>ascender</strong> (subir).
            <br>• <em>Homógrafos (mesma grafia, som ou sentido diferente):</em> <strong>colher</strong> (verbo) vs. <strong>colher</strong> (substantivo).
          </li>
          <li><strong>Parônimos:</strong> palavras semelhantes na grafia e na pronúncia, porém com significados diferentes:
            <br>• <strong>Discriminar</strong> (diferenciar) vs. <strong>Descriminar</strong> (tirar o crime, absolver).
            <br>• <strong>Eminente</strong> (ilustre, notável) vs. <strong>Iminente</strong> (prestes a acontecer).
            <br>• <strong>Infligir</strong> (aplicar pena) vs. <strong>Infringir</strong> (desrespeitar lei/norma).
            <br>• <strong>Ratificar</strong> (confirmar, validar) vs. <strong>Retificar</strong> (corrigir, emendar).
          </li>
        </ul>
      `
    },
    {
      id: "s02",
      n: "02",
      title: "Denotação, Conotação e Polissemia",
      conteudoHtml: `
        <div class="matrix-callout callout-rule">
          <div class="callout-top">DENOTAÇÃO (D = DICIONÁRIO) VS. CONOTAÇÃO (C = CRIATIVIDADE)</div>
          <div class="callout-text">
            • <strong>Sentido Denotativo:</strong> sentido literal, objetivo, exato e referencial das palavras (<em>O bombeiro apagou o fogo com água</em>).<br>
            • <strong>Sentido Conotativo:</strong> sentido figurado, metafórico, subjetivo e expressivo (<em>O bombeiro apagou o fogo da discórdia</em>).<br>
            • <strong>Polissemia:</strong> capacidade que uma mesma palavra possui de apresentar múltiplos significados a depender do contexto (ex.: <em>linha</em> de costura, <em>linha</em> telefônica, <em>linha</em> de combate, <em>linha</em> de raciocínio).
          </div>
        </div>
      `
    },
    {
      id: "s03",
      n: "03",
      title: "Figuras de Linguagem Essenciais para Concursos",
      conteudoHtml: `
        <p class="theory-p">Principais recursos estilísticos cobrados pelo Instituto AOCP:</p>
        <table class="table-matriz">
          <thead>
            <tr>
              <th>Figura</th>
              <th>Conceito Operacional</th>
              <th>Exemplo de Aplicação</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Metáfora</strong></td>
              <td>Comparação implícita sem conectivo comparativo.</td>
              <td><em>Aquele soldado é uma rocha inabalável.</em></td>
            </tr>
            <tr>
              <td><strong>Metonímia</strong></td>
              <td>Substituição de um termo por outro com relação de contiguidade (autor pela obra, continente pelo conteúdo).</td>
              <td><em>Ele leu Machado de Assis; Bebeu dois copos d'água.</em></td>
            </tr>
            <tr>
              <td><strong>Antítese</strong></td>
              <td>Aproximação de ideias ou palavras de sentidos contrários.</td>
              <td><em>O silêncio da noite contrastava com o barulho do dia.</em></td>
            </tr>
            <tr>
              <td><strong>Paradoxo / Oxímoro</strong></td>
              <td>União de ideias aparentemente contraditórias e inconciliáveis que fundem uma nova realidade.</td>
              <td><em>Amor é fogo que arde sem se ver; ferida que dói e não se sente.</em></td>
            </tr>
            <tr>
              <td><strong>Eufemismo</strong></td>
              <td>Suavização de uma expressão desagradável, chocante ou triste.</td>
              <td><em>O veterano partiu para o descanso eterno (= faleceu).</em></td>
            </tr>
            <tr>
              <td><strong>Hipérbole</strong></td>
              <td>Exagero intencional e expressivo para conferir ênfase.</td>
              <td><em>Chorou rios de lágrimas; Já te avisei um milhão de vezes.</em></td>
            </tr>
            <tr>
              <td><strong>Prosopopeia / Personificação</strong></td>
              <td>Atribuição de sentimentos ou ações humanas a seres inanimados ou irracionais.</td>
              <td><em>O vento uivava furioso entre as árvores da serra.</em></td>
            </tr>
            <tr>
              <td><strong>Ironia</strong></td>
              <td>Afirmação do oposto do que se quer dar a entender, em tom crítico ou sarcástico.</td>
              <td><em>Ele foi tão pontual que chegou duas horas após a instrução.</em></td>
            </tr>
          </tbody>
        </table>
      `
    }
  ],
  secoesQuestoes: [
    {
      id: "s04",
      n: "04",
      title: "Questões Comentadas — Semântica e Figuras (AOCP)",
      tipo: "comentada",
      itens: [
        {
          num: "01",
          enunciado: "Assinale a opção em que os vocábulos preenchem com exatidão as lacunas: 'O juiz militar decidiu ________ a pena do recruta, após a defesa ________ os fatos relatados no inquérito.'",
          alternativas: {
            A: "infligir / retificar",
            B: "infringir / ratificar",
            C: "infligir / ratificar",
            D: "infringir / retificar",
            E: "descriminar / infligir"
          },
          gabarito: "C",
          comentario: "'Infligir' significa aplicar pena/punição; 'ratificar' significa confirmar/validar as informações. Logo, a alternativa correta é a letra C."
        }
      ]
    }
  ]
};

export const AULA_10_CONFIG: ConfigAula = {
  numero: "10",
  tituloMateria: "Língua Portuguesa",
  tituloAula: "Aula 10 — Coesão e Coerência Textual",
  subtituloCapa: "CBM-RJ — CORPO DE BOMBEIROS MILITAR",
  totalPaginas: "145 Páginas Integrais",
  totalQuestoes: "84+ Questões AOCP & Fixação",
  arquivoPdfOriginal: "curso-384118-aula-10-8788-completo.pdf",
  secoesTeoria: [
    {
      id: "s01",
      n: "01",
      title: "Coesão Textual: Mecanismos Referenciais",
      conteudoHtml: `
        <p class="theory-p">A <strong>Coesão Textual</strong> é a ligação material, gramatical e lexical entre os elementos de uma frase, de um período ou entre os parágrafos de um texto. Divide-se em <em>Coesão Referencial</em> e <em>Coesão Sequencial</em>.</p>
        <p class="theory-p"><strong>Mecanismos de Coesão Referencial:</strong></p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Anáfora:</strong> mecanismo pelo qual um termo retoma um elemento já citado anteriormente no texto (ex.: <em>O comandante reuniu os oficiais. <strong>Ele</strong> determinou as diretrizes.</em>).</li>
          <li><strong>Catáfora:</strong> mecanismo pelo qual um termo antecipa uma informação que ainda será explicitada adiante (ex.: <em>Só exijo <strong>isto</strong>: total lealdade à missão.</em>).</li>
          <li><strong>Elipse:</strong> omissão de um termo facilmente recuperável pelo contexto gramatical (ex.: <em>Os soldados avançaram; [eles] transpuseram a barricada</em>).</li>
          <li><strong>Reiteração Lexical por Hiperônimos/Sinônimos:</strong> substituição para evitar repetições desnecessárias (<em>O helicóptero decolou. A <strong>aeronave</strong> rumou ao litoral</em>).</li>
        </ul>
      `
    },
    {
      id: "s02",
      n: "02",
      title: "Coesão Sequencial e Conectivos Argumentativos",
      conteudoHtml: `
        <p class="theory-p">A <strong>Coesão Sequencial</strong> é responsável pela progressão textual e pelo encadeamento lógico dos fatos e argumentos por meio de conjunções, advérbios e locuções conectivas:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Conectivos de Adição:</strong> <em>além disso, ademais, outrossim, não só... mas também</em>.</li>
          <li><strong>Conectivos de Oposição:</strong> <em>contudo, todavia, não obstante, por outro lado, em contrapartida</em>.</li>
          <li><strong>Conectivos de Causa e Efeito:</strong> <em>em virtude de, haja vista, por conseguinte, dessarte</em>.</li>
          <li><strong>Conectivos de Conclusão:</strong> <em>em suma, portanto, conclui-se que, desse modo</em>.</li>
        </ul>
      `
    },
    {
      id: "s03",
      n: "03",
      title: "Coerência Textual e Progressão Temática",
      conteudoHtml: `
        <p class="theory-p">A <strong>Coerência Textual</strong> diz respeito à harmonia global de sentido do texto, à não contradição das ideias e à lógica interna do raciocínio discursivo. Um texto pode ser gramaticalmente coeso, mas incoerente caso apresente afirmações mutuamente excludentes no plano das ideias.</p>
      `
    }
  ],
  secoesQuestoes: [
    {
      id: "s04",
      n: "04",
      title: "Questões Comentadas — Coesão e Coerência (AOCP)",
      tipo: "comentada",
      itens: [
        {
          num: "01",
          enunciado: "Em 'A defesa civil emitiu o alerta antecipado. Tal medida evitou prejuízos humanos de grande escala', o pronome demonstrativo 'Tal' atua como recurso de:",
          alternativas: {
            A: "coesão catafórica.",
            B: "coesão anafórica.",
            C: "elipse sintática.",
            D: "incoerência estilística.",
            E: "antítese textual."
          },
          gabarito: "B",
          comentario: "O termo 'Tal medida' retoma anaforicamente a ideia expressa na oração anterior ('A defesa civil emitiu o alerta antecipado'), configurando coesão referencial anafórica."
        }
      ]
    }
  ]
};

export const AULA_11_CONFIG: ConfigAula = {
  numero: "11",
  tituloMateria: "Língua Portuguesa",
  tituloAula: "Aula 11 — Tipologia Textual e Gêneros Textuais",
  subtituloCapa: "CBM-RJ — CORPO DE BOMBEIROS MILITAR",
  totalPaginas: "140 Páginas Integrais",
  totalQuestoes: "82+ Questões AOCP & Fixação",
  arquivoPdfOriginal: "curso-384118-aula-11-a3e2-completo.pdf",
  secoesTeoria: [
    {
      id: "s01",
      n: "01",
      title: "Tipos Textuais Fundamentais",
      conteudoHtml: `
        <p class="theory-p">A <strong>Tipologia Textual</strong> refere-se à estrutura composicional, à natureza linguística e ao objetivo comunicativo interno do texto. São 5 tipos fundamentais cobrados em concursos:</p>
        <table class="table-matriz">
          <thead>
            <tr>
              <th>Tipo Textual</th>
              <th>Objetivo Predominante</th>
              <th>Marcas Linguísticas Típicas</th>
              <th>Gêneros Típicos</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Narrativo</strong></td>
              <td>Relatar acontecimentos situados no tempo e no espaço com personagens e enredo.</td>
              <td>Verbos de ação no pretérito, marcadores temporais, progressão cronológica.</td>
              <td>Notícia, conto, crônica, boletim de ocorrência, relato de ocorrência.</td>
            </tr>
            <tr>
              <td><strong>Descritivo</strong></td>
              <td>Caracterizar seres, objetos, cenários ou pessoas de forma estática ou dinâmica.</td>
              <td>Adjetivos abundantes, verbos de estado no pretérito imperfeito, ausência de progressão cronológica.</td>
              <td>Laudo pericial, retrato falado, anúncio, guia de campo.</td>
            </tr>
            <tr>
              <td><strong>Dissertativo-Argumentativo</strong></td>
              <td>Defender uma tese mediante argumentos e evidências convincentes.</td>
              <td>Verbos no presente do indicativo, conectivos de causa/consequência, impessoalidade.</td>
              <td>Artigo de opinião, redação de concurso, editorial, dissertação.</td>
            </tr>
            <tr>
              <td><strong>Dissertativo-Expositivo</strong></td>
              <td>Apresentar informações, conceitos ou dados sem juízo de valor persuasivo.</td>
              <td>Vocabulário técnico, clareza referencial, neutralidade informativa.</td>
              <td>Verbete de enciclopédia, relatório técnico, manual didático.</td>
            </tr>
            <tr>
              <td><strong>Injuntivo / Instrucional</strong></td>
              <td>Indicar procedimentos, ordenar condutas ou orientar passos a seguir.</td>
              <td>Verbos no modo imperativo ou infinitivo, enumerações ordenadas.</td>
              <td>Manual de sobrevivência, receita, edital de concurso, protocolo operacional.</td>
            </tr>
          </tbody>
        </table>
      `
    },
    {
      id: "s02",
      n: "02",
      title: "Gêneros Textuais vs. Tipos Textuais",
      conteudoHtml: `
        <div class="matrix-callout callout-rule">
          <div class="callout-top">DISTINÇÃO DE BANCA</div>
          <div class="callout-text">Os <strong>Tipos Textuais</strong> formam um conjunto fechado e restrito (narrativo, descritivo, dissertativo, injuntivo). Os <strong>Gêneros Textuais</strong> formam um conjunto aberto, flexível e infinito, nascido das práticas sociais de comunicação (e-mail, ofício, tweet, reportagem, boletim, laudo, portaria). Um gênero pode conter vários tipos textuais integrados!</div>
        </div>
      `
    }
  ],
  secoesQuestoes: [
    {
      id: "s03",
      n: "03",
      title: "Questões Comentadas — Tipologia Textual (AOCP)",
      tipo: "comentada",
      itens: [
        {
          num: "01",
          enunciado: "Um manual de operação que orienta o socorrista passo a passo a aplicar manobras de ressuscitação cardiopulmonar caracteriza-se primordialmente como um texto:",
          alternativas: {
            A: "narrativo.",
            B: "dissertativo-argumentativo.",
            C: "injuntivo.",
            D: "lírico.",
            E: "descritivo puro."
          },
          gabarito: "C",
          comentario: "Manuais que prescrevem instruções operacionais estruturam-se na tipologia injuntiva (instrucional)."
        }
      ]
    }
  ]
};

export const AULA_12_CONFIG: ConfigAula = {
  numero: "12",
  tituloMateria: "Língua Portuguesa",
  tituloAula: "Aula 12 — Compreensão e Interpretação de Textos",
  subtituloCapa: "CBM-RJ — CORPO DE BOMBEIROS MILITAR",
  totalPaginas: "155 Páginas Integrais",
  totalQuestoes: "90+ Questões AOCP & Fixação",
  arquivoPdfOriginal: "curso-384118-aula-12-2fe8-completo.pdf",
  secoesTeoria: [
    {
      id: "s01",
      n: "01",
      title: "Compreensão vs. Interpretação Textual",
      conteudoHtml: `
        <table class="table-matriz">
          <thead>
            <tr>
              <th>Conceito</th>
              <th>Abordagem de Leitura</th>
              <th>Enunciados Típicos de Prova</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Compreensão Textual</strong></td>
              <td>Decodificação da mensagem expressa explicitamente no texto (o que o autor efetivamente disse).</td>
              <td><em>"De acordo com o texto..."; "O autor afirma que..."; "Segundo o 1º parágrafo..."</em></td>
            </tr>
            <tr>
              <td><strong>Interpretação Textual</strong></td>
              <td>Dedução e inferência a partir do texto e do conhecimento de mundo (o que se conclui do que foi dito).</td>
              <td><em>"Infere-se do texto que..."; "Conclui-se que..."; "O texto permite deduzir..."</em></td>
            </tr>
          </tbody>
        </table>
      `
    },
    {
      id: "s02",
      n: "02",
      title: "Pressupostos, Subentendidos e Ambiguidade",
      conteudoHtml: `
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Pressupostos:</strong> informações implícitas decorrentes logicamente de marcas linguísticas evidentes no enunciado (ex.: <em>"O soldado <strong>deixou de fumar</strong>"</em> → Pressupõe-se com certeza que ele fumava anteriormente).</li>
          <li><strong>Subentendidos:</strong> insinuações e pistas que dependem exclusivamente da interpretação do contexto pelo ouvinte, podendo ser negadas pelo emissor.</li>
          <li><strong>Intertextualidade:</strong> diálogo implícito ou explícito entre dois ou mais textos (citação, paráfrase ou paródia).</li>
        </ul>
      `
    }
  ],
  secoesQuestoes: [
    {
      id: "s03",
      n: "03",
      title: "Questões Comentadas — Interpretação e Inferência (AOCP)",
      tipo: "comentada",
      itens: [
        {
          num: "01",
          enunciado: "Ao afirmar 'A corporação finalmente restabeleceu os treinamentos presenciais de mergulho', a palavra 'finalmente' introduz o pressuposto de que:",
          alternativas: {
            A: "os treinamentos eram considerados desnecessários.",
            B: "houve um período prolongado de suspensão ou atraso na retomada das atividades.",
            C: "o mergulho nunca havia sido treinado pela tropa.",
            D: "a corporação abandonará os treinamentos teóricos.",
            E: "não havia mergulhadores aptos no grupamento."
          },
          gabarito: "B",
          comentario: "O advérbio 'finalmente' pressupõe expectativa temporal frustrada ou período de espera/suspensão antes do fato consumado."
        }
      ]
    }
  ]
};

export const AULA_13_CONFIG: ConfigAula = {
  numero: "13",
  tituloMateria: "Língua Portuguesa",
  tituloAula: "Aula 13 — Redação Oficial (Manual da Presidência da República)",
  subtituloCapa: "CBM-RJ — CORPO DE BOMBEIROS MILITAR",
  totalPaginas: "138 Páginas Integrais",
  totalQuestoes: "78+ Questões AOCP & Fixação",
  arquivoPdfOriginal: "curso-384118-aula-13-70e8-completo.pdf",
  secoesTeoria: [
    {
      id: "s01",
      n: "01",
      title: "Princípios Constitucionais da Redação Oficial",
      conteudoHtml: `
        <p class="theory-p">A <strong>Redação Oficial</strong> é a maneira pela qual o Poder Público redige atos normativos e comunicações formais, pautada rigorosamente no <strong>Manual de Redação da Presidência da República (3ª edição)</strong>:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Impessoalidade:</strong> a comunicação parte sempre do serviço público para o interesse público, vedado o tom pessoal, opiniões individuais ou promoção pessoal do signatário.</li>
          <li><strong>Clareza:</strong> compreensão imediata e isenta de ambiguidades.</li>
          <li><strong>Concisão:</strong> transmissão do máximo de conteúdo com o mínimo indispensável de palavras (sem prolixidade).</li>
          <li><strong>Formalidade e Padronização:</strong> respeito às regras formais de diagramação, estética de documento e polidez.</li>
          <li><strong>Uso do Padrão Culto:</strong> observância estrita da norma gramatical padrão da Língua Portuguesa.</li>
        </ul>
      `
    },
    {
      id: "s02",
      n: "02",
      title: "Pronomes de Tratamento e Vocativos em Documentos Oficiais",
      conteudoHtml: `
        <table class="table-matriz">
          <thead>
            <tr>
              <th>Pronome de Tratamento</th>
              <th>Destinatários Exclusivos</th>
              <th>Vocativo Corresponde</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Vossa Excelência</strong> (V. Ex.ª)</td>
              <td>Chefes dos Poderes (Executivo, Legislativo, Judiciário), Ministros de Estado, Oficiais-Generais das Forças Armadas e Secretários de Estado.</td>
              <td><em>"Senhor Presidente da República"</em> (para Chefes de Poder); <em>"Senhor Ministro"</em> / <em>"Senhor Secretário"</em> (para os demais).</td>
            </tr>
            <tr>
              <td><strong>Vossa Senhoria</strong> (V. Sa.)</td>
              <td>Demais autoridades públicas, civis e militares, e particulares.</td>
              <td><em>"Senhor [Cargo]"</em> (ex.: <em>"Senhor Comandante"</em>).</td>
            </tr>
          </tbody>
        </table>
        <div class="matrix-callout callout-warning">
          <div class="callout-top">REGRA DE OURO — CONCORDÂNCIA COM PRONOMES DE TRATAMENTO</div>
          <div class="callout-text">Embora se refiram à 2ª pessoa do discurso (com quem se fala), os pronomes de tratamento exigem <strong>verbo e pronomes possessivos/oblíquos obrigatoriamente na 3ª PESSOA</strong>: <em>"Vossa Excelência solicitou o relatório e apresentará suas considerações."</em></div>
        </div>
      `
    },
    {
      id: "s03",
      n: "03",
      title: "Estrutura do Padrão Ofício e Fechos para Comunicações",
      conteudoHtml: `
        <p class="theory-p">O padrão ofício unificou as antigas modalidades de ofício, aviso e memorando em um único modelo documental. Os fechos para comunicações oficiais foram simplificados em apenas dois:</p>
        <div class="matrix-callout callout-rule">
          <div class="callout-top">OS DOIS ÚNICOS FECHOS OFICIAIS PERMITIDOS</div>
          <div class="callout-text">
            1. <strong>"Respeitosamente,"</strong>: empregado para autoridades de hierarquia SUPERIOR à do emitente (inclusive o Presidente da República).<br>
            2. <strong>"Atenciosamente,"</strong>: empregado para autoridades de mesma hierarquia, hierarquia INFERIOR ou para particulares.
          </div>
        </div>
      `
    }
  ],
  secoesQuestoes: [
    {
      id: "s04",
      n: "04",
      title: "Questões Comentadas — Redação Oficial (AOCP)",
      tipo: "comentada",
      itens: [
        {
          num: "01",
          enunciado: "Ao redigir um ofício destinado a autoridade de hierarquia superior, o fecho adequado a ser empregado, conforme o Manual da Presidência da República, é:",
          alternativas: {
            A: "Atenciosamente,",
            B: "Cordialmente,",
            C: "Respeitosamente,",
            D: "Com votos de estima e consideração,",
            E: "Saudações fraternais,"
          },
          gabarito: "C",
          comentario: "Conforme o Manual de Redação da Presidência da República (3ª edição), utiliza-se exclusivamente 'Respeitosamente,' para autoridades superiores e 'Atenciosamente,' para as demais autoridades."
        }
      ]
    }
  ]
};
