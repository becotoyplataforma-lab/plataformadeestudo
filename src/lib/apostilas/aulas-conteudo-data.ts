import type { ConfigAula } from "./gerador-motor-matriz";

export const AULA_06_CONFIG: ConfigAula = {
  numero: "06",
  tituloMateria: "Língua Portuguesa",
  tituloAula: "Aula 06 — Pontuação e Emprego do Sinal Indicativo de Crase",
  subtituloCapa: "CBM-RJ — CORPO DE BOMBEIROS MILITAR",
  totalPaginas: "158 Páginas Integrais",
  totalQuestoes: "92+ Questões AOCP & Fixação",
  arquivoPdfOriginal: "curso-384118-aula-06-15f7-completo.pdf",
  secoesTeoria: [
    {
      id: "s01",
      n: "01",
      title: "Conceito Fundamental de Crase e a Fusão Preposição + Artigo",
      conteudoHtml: `
        <p class="theory-p">A <strong>Crase</strong> (do grego <em>krâsis</em> = fusão, mistura) não é um acento, mas sim o fenômeno fonético e morfossintático da fusão de duas vogais idênticas. Na norma culta da Língua Portuguesa, representa a contração da preposição <strong>"a"</strong> com o artigo definido feminino <strong>"a/as"</strong>, ou com a vogal inicial dos pronomes demonstrativos <strong>aquele(s), aquela(s), aquilo</strong>.</p>
        <div class="matrix-callout callout-rule">
          <div class="callout-top">EQUAÇÃO MATEMÁTICA DA CRASE</div>
          <div class="callout-text">CRASE = Preposição 'A' (exigida por um termo regente: verbo ou nome) + Artigo 'A' (admitido por um termo regido feminino). Se faltar qualquer um dos dois elementos, o acento grave (&grave;) é absolutamente proibido!</div>
        </div>
      `
    },
    {
      id: "s02",
      n: "02",
      title: "Macetes de Ouro para Identificação Prática da Crase",
      conteudoHtml: `
        <p class="theory-p">Em provas de concurso, a confirmação do acento grave é obtida por dois testes práticos infalíveis:</p>
        <div class="matrix-callout callout-tip">
          <div class="callout-top">1. TROCA PELO MASCULINO EQUIVALENTE</div>
          <div class="callout-text">Substitua a palavra feminina por um substantivo masculino equivalente. Se surgir <strong>"AO / AOS"</strong> no masculino, haverá <strong>crase com acento grave (à / às)</strong> no feminino!<br>
          • <em>Fui <strong>à</strong> praia</em> → <em>Fui <strong>ao</strong> clube</em> (Deu "AO" → Tem Crase!).<br>
          • <em>Visitei <strong>a</strong> cidade</em> → <em>Visitei <strong>o</strong> museu</em> (Deu apenas "O", sem preposição → Não tem crase!).</div>
        </div>
        <div class="matrix-callout callout-tip">
          <div class="callout-top">2. VOLTA DA / VOLTA DE (NOMES DE LOCALIDADE)</div>
          <div class="callout-text"><em>"Se vou a e volto <strong>DA</strong>, crase no <strong>A</strong>! Se vou a e volto <strong>DE</strong>, crase pra <strong>QUÊ</strong>?"</em><br>
          • Vou à Bahia (Volto <strong>da</strong> Bahia → Tem crase!).<br>
          • Vou a Roma (Volto <strong>de</strong> Roma → Sem crase!).<br>
          • <em>Atenção:</em> Se a localidade vier especificada por adjetivo ou locução, a crase torna-se obrigatória: <em>Vou <strong>à</strong> Roma dos césares</em>.</div>
        </div>
      `
    },
    {
      id: "s03",
      n: "03",
      title: "Casos de Proibição Absoluta do Sinal Indicativo de Crase",
      conteudoHtml: `
        <p class="theory-p">O acento grave é terminantemente proibido nas seguintes estruturas:</p>
        <table class="table-matriz">
          <thead>
            <tr>
              <th>Caso de Proibição</th>
              <th>Justificativa Gramatical</th>
              <th>Exemplo Correto</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Antes de palavras masculinas</strong></td>
              <td>Palavras masculinas não admitem artigo feminino "a".</td>
              <td><em>Andar a pé; Andar a cavalo; Escrever a lápis; Vencer a prazo.</em></td>
            </tr>
            <tr>
              <td><strong>Antes de verbos</strong></td>
              <td>Verbos jamais admitem artigo definido.</td>
              <td><em>Começou a chover; Ficou a contemplar; Disposto a ajudar.</em></td>
            </tr>
            <tr>
              <td><strong>'A' no singular antes de palavra no plural</strong></td>
              <td>Indica que o 'a' é mera preposição pura, sem artigo plural 'as'.</td>
              <td><em>Refiro-me <strong>a</strong> bombeiras capacitadas (sem crase); Refiro-me <strong>às</strong> bombeiras (com crase).</em></td>
            </tr>
            <tr>
              <td><strong>Entre palavras repetidas</strong></td>
              <td>Falta artigo diante do segundo termo repetido.</td>
              <td><em>Cara a cara; Dia a dia; Gota a gota; Frente a frente.</em></td>
            </tr>
            <tr>
              <td><strong>Antes de pronomes que repelem artigo</strong></td>
              <td>Pronomes pessoais, de tratamento e indefinidos não aceitam artigo.</td>
              <td><em>Pediu a ela; Direcionei-me a Vossa Excelência; Entregou a alguém.</em></td>
            </tr>
          </tbody>
        </table>
      `
    },
    {
      id: "s04",
      n: "04",
      title: "Casos Facultativos de Crase (Tríade Mnemônica)",
      conteudoHtml: `
        <p class="theory-p">O uso do acento grave é opcional (tanto faz usar <strong>a</strong> ou <strong>à</strong>) em apenas três situações consagradas na norma padrão:</p>
        <div class="matrix-callout callout-rule">
          <div class="callout-top">MNEMÔNICO: "PRO-NO-TE" OU "NÃO ME CASO COM MARIA"</div>
          <div class="callout-text">
            1. <strong>Antes de Pronomes Possessivos Femininos Singulares</strong> (minha, tua, sua, nossa, vossa):<br>
            • <em>Entregou o relatório <strong>a</strong> minha comandante</em> OU <em><strong>à</strong> minha comandante</em>.<br>
            2. <strong>Antes de Nomes Próprios Femininos de Pessoa</strong> (sem especificador):<br>
            • <em>Enviei mensagem <strong>a</strong> Juliana</em> OU <em><strong>à</strong> Juliana</em>.<br>
            3. <strong>Depois da Preposição "ATÉ"</strong> (quando seguida de substantivo feminino):<br>
            • <em>Os bombeiros foram até <strong>a</strong> praia</em> OU <em>até <strong>à</strong> praia</em>.
          </div>
        </div>
      `
    },
    {
      id: "s05",
      n: "05",
      title: "Crase Obrigatória em Locuções Femininas",
      conteudoHtml: `
        <p class="theory-p">Emprega-se obrigatoriamente o acento grave em locuções adverbiais, prepositivas e conjuntivas constituídas por núcleos femininos:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Locuções Adverbiais Femininas:</strong> <em>à noite, à tarde, às pressas, à vontade, às ocultas, à toa, à deriva, às claras</em>.</li>
          <li><strong>Locuções Prepositivas:</strong> <em>à frente de, à espera de, à procura de, à custa de, à semelhança de</em>.</li>
          <li><strong>Locuções Conjuntivas:</strong> <em>à medida que, à proporção que</em>.</li>
          <li><strong>Elipse da expressão 'à moda de':</strong> mesmo antes de palavra masculina, se estiver subentendida a expressão "à moda de", a crase ocorre: <em>Bife <strong>à</strong> milanesa; Chute <strong>à</strong> Pelé</em>.</li>
        </ul>
      `
    },
    {
      id: "s06",
      n: "06",
      title: "Pontuação: Regras Gerais e a Proibição da Vírgula",
      conteudoHtml: `
        <p class="theory-p">A pontuação organiza a hierarquia sintática e os blocos de sentido do texto escrito. Em provas do Instituto AOCP, a regra de ouro que mais elimina candidatos é a proibição de separar os termos nucleares da oração:</p>
        <div class="matrix-callout callout-danger">
          <div class="callout-top">PROIBIÇÕES TAXATIVAS DA VÍRGULA</div>
          <div class="callout-text">
            1. <strong>NUNCA separar o Sujeito do seu Predicado</strong> por vírgula simples (<em>O comandante do batalhão [SEM VÍRGULA] iniciou a reunião</em>).<br>
            2. <strong>NUNCA separar o Verbo dos seus Objetos</strong> por vírgula simples (<em>O sargento solicitou [SEM VÍRGULA] apoio aéreo</em>).<br>
            3. <strong>NUNCA separar o Nome do seu Complemento Nominal ou Adjunto Adnominal</strong> por vírgula (<em>A confiança [SEM VÍRGULA] na equipe era total</em>).
          </div>
        </div>
      `
    },
    {
      id: "s07",
      n: "07",
      title: "Emprego Obrigatório da Vírgula",
      conteudoHtml: `
        <p class="theory-p">A vírgula é de emprego compulsório nos seguintes casos estruturais:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Isolamento do Vocativo:</strong> <em>"Atenção, <strong>senhores</strong>, mantenham o alinhamento."</em></li>
          <li><strong>Isolamento do Aposto Explicativo:</strong> <em>"O CBM-RJ, <strong>corporação centenária</strong>, atua em todo o Estado."</em></li>
          <li><strong>Adjunto Adverbial Deslocado de Grande Extensão (3+ palavras):</strong> <em>"Durante o rigoroso inverno passado, os resgates dobraram."</em></li>
          <li><strong>Elementos em Enumeração Assindética:</strong> <em>"Comprou cordas, mosquetões, capacetes e lanternas."</em></li>
          <li><strong>Isolamento de Orações Adjetivas Explicativas:</strong> <em>"Os soldados, que se prepararam com afinco, foram condecorados."</em></li>
          <li><strong>Expressões Explicativas e Retificativas:</strong> <em>isto é, ou seja, por exemplo, aliás, a saber</em>.</li>
        </ul>
      `
    },
    {
      id: "s08",
      n: "08",
      title: "Ponto e Vírgula, Dois-Pontos e Travessão",
      conteudoHtml: `
        <p class="theory-p">Recursos avançados de pontuação sintática e coesiva:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Ponto e Vírgula (;):</strong> separa orações coordenadas extensas que já contenham vírgulas internas; separa itens de leis, editais e decretos enumerados em alíneas.</li>
          <li><strong>Dois-Pontos (:):</strong> anunciam citação direta, fala de personagem, enumeração discriminada ou oração apositiva explicativa.</li>
          <li><strong>Travessão (—):</strong> empregado em pares para isolar termos ou orações explicativas com maior ênfase expressiva que a vírgula (podendo substituir parênteses ou vírgulas explicativas).</li>
        </ul>
      `
    }
  ],
  secoesQuestoes: [
    {
      id: "s09",
      n: "09",
      title: "Questões Comentadas — Emprego da Crase (AOCP)",
      tipo: "comentada",
      itens: [
        {
          num: "01",
          enunciado: "Assinale a alternativa em que o sinal indicativo de crase foi empregado em estrita consonância com a norma-padrão:",
          alternativas: {
            A: "O oficial deslocou-se à cavalo para a área rural.",
            B: "Entregamos a documentação à uma funcionária do cartório.",
            C: "O coronel solicitou à sua equipe dedicação máxima na operação.",
            D: "Ficamos à contemplar a coragem dos militares.",
            E: "As orientações foram transmitidas à homens e mulheres do grupamento."
          },
          gabarito: "C",
          comentario: "A alternativa C apresenta caso facultativo de crase diante de pronome possessivo feminino singular ('à sua equipe'), estando gramaticalmente correta. Nas demais opções, a crase é proibida: antes de masculino (A), antes de artigo indefinido (B), antes de verbo (D) e 'a' singular antes de plural (E)."
        },
        {
          num: "02",
          enunciado: "Em 'Todos os militares obedeceram _____ ordens transmitidas _____ oficiais do estado-maior', as lacunas devem ser preenchidas, respectivamente, por:",
          alternativas: {
            A: "às / aos",
            B: "as / aos",
            C: "às / às",
            D: "as / as",
            E: "às / à"
          },
          gabarito: "A",
          comentario: "O verbo 'obedecer' é transitivo indireto regendo a preposição 'a'. Com o substantivo feminino plural 'ordens', forma 'às'. Na segunda lacuna, 'transmitidas a + os oficiais' forma a contração masculina 'aos'."
        }
      ]
    },
    {
      id: "s10",
      n: "10",
      title: "Lista de Questões de Fixação — Crase e Pontuação (AOCP)",
      tipo: "fixacao",
      itens: [
        {
          num: "01",
          enunciado: "Indique a oração que viola a norma culta quanto ao uso da pontuação:",
          alternativas: {
            A: "Os bombeiros, após horas de trabalho contínuo, controlaram o fogo.",
            B: "O comandante da unidade operacional, assinou a portaria ontem.",
            C: "Senhores instrutores, o exercício terá início às oito horas.",
            D: "Brasília, capital da República, sediou o encontro nacional.",
            E: "Coragem, disciplina e honra: valores basilares da corporação."
          },
          gabarito: "B",
          comentario: "A alternativa B separa o sujeito ('O comandante da unidade operacional') do verbo transitivo ('assinou') por vírgula simples, violando regra proibitiva absoluta."
        }
      ]
    }
  ]
};

export const AULA_07_CONFIG: ConfigAula = {
  numero: "07",
  tituloMateria: "Língua Portuguesa",
  tituloAula: "Aula 07 — Concordância Verbal e Nominal",
  subtituloCapa: "CBM-RJ — CORPO DE BOMBEIROS MILITAR",
  totalPaginas: "162 Páginas Integrais",
  totalQuestoes: "94+ Questões AOCP & Fixação",
  arquivoPdfOriginal: "curso-384118-aula-07-3752-completo.pdf",
  secoesTeoria: [
    {
      id: "s01",
      n: "01",
      title: "Concordância Verbal: Regra Geral e Sujeito Composto",
      conteudoHtml: `
        <p class="theory-p">A <strong>Concordância Verbal</strong> é o princípio sintático pelo qual o verbo flexiona-se em número e pessoa para harmonizar-se com o seu sujeito gramatical.</p>
        <p class="theory-p"><strong>Sujeito Composto Anteposto:</strong> o verbo vai obrigatoriamente para o plural (<em>O capitão e o sargento <strong>planejaram</strong> a ação</em>).</p>
        <p class="theory-p"><strong>Sujeito Composto Posposto:</strong> o verbo pode concordar no plural (concordância gramatical) ou concordar apenas com o núcleo mais próximo (concordância atrativa): <em><strong>Chegaram</strong> o capitão e o sargento</em> OU <em><strong>Chegou</strong> o capitão e o sargento</em>.</p>
      `
    },
    {
      id: "s02",
      n: "02",
      title: "Casos Críticos de Concordância Verbal para Concursos",
      conteudoHtml: `
        <p class="theory-p">Tópicos de altíssima incidência nas bancas militares:</p>
        <div class="matrix-callout callout-warning">
          <div class="callout-top">1. EXPRESSÕES PARTITIVAS (A MAIORIA DE, PARTE DE)</div>
          <div class="callout-text">Quando o sujeito é formado por expressão partitiva seguida de substantivo no plural, o verbo admite concordância dupla: no singular (com o núcleo partitivo) ou no plural (com o adjunto especificador):<br>
          • <em>A maioria dos soldados <strong>foi convocada</strong></em> (com 'a maioria').<br>
          • <em>A maioria dos soldados <strong>foram convocados</strong></em> (com 'dos soldados').</div>
        </div>
        <div class="matrix-callout callout-rule">
          <div class="callout-top">2. PRONOME RELATIVO "QUE" VS. "QUEM"</div>
          <div class="callout-text">
            • Antecedido de <strong>QUE</strong>: o verbo concorda estritamente com o antecedente (<em>Fui eu que <strong>apaguei</strong> o fogo; Fomos nós que <strong>apagamos</strong></em>).<br>
            • Antecedido de <strong>QUEM</strong>: o verbo pode concordar com o antecedente OU ficar na 3ª pessoa do singular (<em>Fui eu quem <strong>apaguei</strong></em> OU <em>Fui eu quem <strong>apagou</strong></em>).
          </div>
        </div>
      `
    },
    {
      id: "s03",
      n: "03",
      title: "Concordância da Partícula SE (Apassivadora vs. Indeterminação)",
      conteudoHtml: `
        <p class="theory-p">A distinção decisiva da função sintática do pronome "SE":</p>
        <table class="table-matriz">
          <thead>
            <tr>
              <th>Função da Partícula SE</th>
              <th>Transitividade do Verbo</th>
              <th>Presença de Sujeito</th>
              <th>Regra de Concordância Verbal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Partícula Apassivadora</strong></td>
              <td>VTD ou VTDI</td>
              <td>Possui <strong>Sujeito Paciente</strong></td>
              <td>O verbo <strong>concorda em número</strong> com o sujeito: <em>Vende-se casa / Vendem-se casas</em>.</td>
            </tr>
            <tr>
              <td><strong>Índice de Indeterminação</strong></td>
              <td>VTI, VI ou VL</td>
              <td>Sujeito é <strong>Indeterminado</strong></td>
              <td>O verbo fica <strong>fixo na 3ª pessoa do singular</strong>: <em>Precisa-se de bombeiros / Vive-se bem</em>.</td>
            </tr>
          </tbody>
        </table>
      `
    },
    {
      id: "s04",
      n: "04",
      title: "Concordância Nominal: Adjetivo com Mais de um Substantivo",
      conteudoHtml: `
        <p class="theory-p">A <strong>Concordância Nominal</strong> harmoniza artigos, adjetivos, pronomes adjetivos e numerais com o gênero e número do substantivo a que se referem:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Adjetivo Posposto a Substantivos de Gêneros Diferentes:</strong> concorda no masculino plural (concordância lógica) ou com o termo mais próximo (concordância atrativa): <em>Batalhão e viatura <strong>novos</strong></em> OU <em>Batalhão e viatura <strong>nova</strong></em>.</li>
          <li><strong>Adjetivo Anteposto a Substantivos:</strong> concorda obrigatoriamente com o substantivo mais próximo: <em><strong>Nova</strong> viatura e equipamentos</em>; <em><strong>Novos</strong> equipamentos e viatura</em>.</li>
        </ul>
      `
    },
    {
      id: "s05",
      n: "05",
      title: "Palavras Especiais de Concordância Nominal",
      conteudoHtml: `
        <p class="theory-p">Termos de alta pegadinha examinados frequentemente pelo Instituto AOCP:</p>
        <ul style="margin: 0 0 18px 26px; line-height: 1.8;">
          <li><strong>Anexo, Incluso, Próprio, Mesmo, Quite e Obrigado:</strong> variam harmonizando com a pessoa/substantivo a que se referem (<em>Seguem <strong>anexas</strong> as cartas</em>; <em>As meninas disseram <strong>obrigadas</strong></em>; <em>Eles estão <strong>quites</strong></em>). Cuidado: a locução adverbial <em>"em anexo"</em> é invariável.</li>
          <li><strong>Meio:</strong> quando numeral varia (<em>Meia garrafa</em>); quando advérbio (= um pouco) é invariável (<em>Elas estavam <strong>meio</strong> cansadas</em>).</li>
          <li><strong>Menos:</strong> é palavra SEMPRE INVARIÁVEL na Língua Portuguesa! A palavra *"menas"* inexiste na norma culta (<em>Havia <strong>menos</strong> pessoas no resgate</em>).</li>
          <li><strong>É bom, É necessário, É proibido:</strong> sem artigo permanecem no masculino singular (<em>Água mineral é <strong>bom</strong></em>; <em>Entrada é <strong>proibido</strong></em>); acompanhados de artigo definido, concordam com ele: <em><strong>A</strong> entrada é <strong>proibida</strong></em>; <em><strong>A</strong> água é <strong>boa</strong></em>.</li>
        </ul>
      `
    }
  ],
  secoesQuestoes: [
    {
      id: "s06",
      n: "06",
      title: "Questões Comentadas — Concordância Verbal e Nominal (AOCP)",
      tipo: "comentada",
      itens: [
        {
          num: "01",
          enunciado: "Assinale a alternativa que atende integralmente às regras de concordância da norma culta:",
          alternativas: {
            A: "Devem haverem muitas irregularidades nas obras fiscalizadas.",
            B: "Alugam-se tendas especiais para a solenidade de formatura.",
            C: "Fazia muitos anos que não se viam tamanha dedicação.",
            D: "Seguem anexo os comprovantes de treinamento dos recrutas.",
            E: "As combatentes estavam meias desconfiadas do alarme falso."
          },
          gabarito: "B",
          comentario: "Na alternativa B, 'Alugam-se tendas' apresenta partícula apassivadora 'SE' com VTD, concordando com o sujeito paciente plural 'tendas especiais'. Em A, 'haver' impessoal mantém o auxiliar no singular ('Deve haver'); em C, 'se via' concorda com 'tamanha dedicação'; em D, deve ser 'anexos'; em E, 'meio' como advérbio é invariável."
        }
      ]
    }
  ]
};
