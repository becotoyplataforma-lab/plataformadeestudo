/**
 * ConcursoAI — Catálogo de cadernos de questões.
 *
 * Este módulo é a costura entre o material físico e o domínio de estudo. Ele
 * declara o que existe para o aluno (caderno por matéria, título humano, tags
 * de procedência) e nada mais. Nome de arquivo, número de aula, curso de
 * terceiro e prova-alvo moram em `LoteProcedencia`: são metadado filtrável, não
 * identidade de rota nem de menu.
 *
 * É puro de propósito — sem `server-only`, sem `fs`, sem banco — para que o
 * sidebar (client) e a página (server) leiam a mesma fonte e não possam
 * divergir. Apostila nova = uma linha em `CADERNOS`; nenhum outro arquivo
 * precisa saber que ela existe.
 *
 * O slug do caderno é o slug canônico da matéria, não um título inventado:
 * `docs/23` §4 e `catalog-subject-vocabulary.ts` tratam "Língua Portuguesa"
 * como grafia publicada de "Português". A transcrição continua visível
 * (`materiaPublicada`) porque é o que prova de onde veio a linha.
 */
import {
  ehAnulada,
  ehInedita,
  gabaritoConfiavel,
  type QuestaoExtraida,
} from "./procedencia";
import { ehIdLocalValido, ehUuid } from "./rotas";

/** Tag de procedência de um lote extraído. Nunca segmento de rota. */
export interface LoteProcedencia {
  /** Chave estável usada em `?origem=` (`aula-14`). */
  origem: string;
  /** Arquivo físico lido pelo loader de lote: conhecimento do loader, não da UI. */
  arquivo: string;
  /** O que o próprio material declara na capa/cabeçalho, transcrito. */
  descricao: string;
  /** Prova-alvo declarada no material. Não é órgão de banca nem concurso do aluno. */
  alvo?: string | null;
}

export interface Caderno {
  /** `knowledge_subjects.slug` — o segmento de `/questoes/<slug>`. */
  slug: string;
  /** Nome canônico da matéria (`knowledge_subjects.name`). */
  materia: string;
  /** Grafia publicada no material, preservada como transcrição. */
  materiaPublicada: string | null;
  /** Rótulo do menu e do cabeçalho. Nada aqui pode carregar número de PDF. */
  titulo: string;
  subtitulo: string;
  lotes: LoteProcedencia[];
}

export const CADERNOS: readonly Caderno[] = [
  {
    slug: "portugues",
    materia: "Português",
    materiaPublicada: "Língua Portuguesa",
    titulo: "Português · Banco de Questões",
    subtitulo:
      "Caderno de treino de Língua Portuguesa. Banca, ano, assunto e origem são tags de filtro: o conteúdo programático é transversal a qualquer edital.",
    lotes: [
      {
        origem: "aula-14",
        arquivo: "questoes_aula_14.json",
        // O que o PDF declara, e nada além disso: a capa diz "Aula 14
        // (Somente em PDF)" e o cabeçalho corrente diz "CBM-PE (Soldado)
        // Língua Portuguesa". Não existe título de apostila no material, e
        // "módulo" só aparece em nome de arquivo antigo — por isso nada aqui
        // afirma um assunto único (ex. "Pontuação e Sintaxe") como título.
        descricao: "Aula 14 (Somente em PDF) · 17 assuntos",
        alvo: "CBM-PE (Soldado)",
      },
      {
        origem: "aula-02",
        arquivo: "questoes_aula_02.json",
        descricao: "Aula 02 - Classes de Palavras e Pronomes",
        alvo: "CBM-PE (Soldado)",
      },
  "palavra",
  "banca",
  "orgao",
  "cargo",
  "nivel",
  "dificuldade",
  "area_formacao",
  "area_atuacao",
  "origem",
  "ano",
  "tipo",
  "status_resolucao",
  "bloco",
  "gabarito",
  "desatualizadas",
  "anuladas",
  "ineditas",
  "meus_simulados",
  "meus_cadernos",
  "comentado",
  "comentarios",
  "meus_comentarios",
] as const;
export type ChaveFiltro = (typeof CHAVES_FILTRO)[number];

/** Rótulo humano de cada chave — é o que a barra e o chip mostram, nunca a chave. */
export const ROTULO_DAS_CHAVES: Record<ChaveFiltro, string> = {
  disciplina: "Disciplina",
  assunto: "Assunto",
  leis: "Leis",
};

/** Domínio fechado da qualidade: tem valor vigente mesmo quando a URL não diz nada. */
export type EstadoGabarito = "confiavel" | "todos";
/** Domínio fechado das abas. `fixacao` estreita o acervo; `objetivas` é o todo. */
export type BlocoCaderno = "objetivas" | "fixacao";
/** As exclusões de refinamento só têm um modo: tirar o item do resultado. */
export type ModoExclusao = "excluir";

export interface FiltrosCaderno {
  disciplina: string | null;
  assunto: string | null;
  leis: string | null;
  /** Aba ativa (QConcursos: objetivas × fixação). Nunca é segmento de rota. */
  bloco: BlocoCaderno;
  /**
   * Qualidade do acervo, e hoje é o **padrão da tela**: `confiavel` deixa ver só
   * o item cujo gabarito o material sustenta (docs/31 §7.6). `todos` é a única
   * alternativa e é o que o checkbox "Incluir questões em revisão" liga. É filtro
   * de qualidade, não procedência: por isso não casa com banca/ano/assunto.
   */
  gabarito: EstadoGabarito;
  /** `excluir` tira as desatualizadas; ausente deixa como está. */
  desatualizadas: ModoExclusao | null;
}

/** Abaixo disso o texto livre não discrimina nada e só suja a URL. */
export const PALAVRA_MINIMA = 2;

/**
 * As duas abas do topo da barra (forma QConcursos). `objetivas` é o acervo
 * inteiro porque toda questão do material é objetiva — múltipla escolha ou
 * certo/errado —, e `fixacao` estreita para o bloco que o próprio PDF chama de
 * "Lista de Questões": os itens publicados sem versão comentada. O rótulo é
 * transcrição do material, não título inventado (docs/31 §6).
 */
export interface AbaCaderno {
  valor: BlocoCaderno;
  rotulo: string;
  descricao: string;
}

export const ABAS_CADERNO: readonly AbaCaderno[] = [
  {
    valor: "objetivas",
    rotulo: "Questões Objetivas",
    descricao: "Todo o acervo objetivo do caderno: múltipla escolha e certo/errado.",
  },
  {
    valor: "fixacao",
    rotulo: "Exercícios de Fixação",
    descricao:
      "Só o bloco que o material chama de “Lista de Questões” — item publicado sem versão comentada no PDF.",
  },
];

/**
 * Filtros do desenho de referência (QConcursos) que este acervo ainda não pode
 * responder, com o motivo e a fonte da trava. A barra mostra isto no rodapé do
 * filtro avançado em vez de renderizar caixa muda: controle que não filtra nada
 * parece produto, e é lacuna de dados. A lista é verificada em
 * `cadernos.test.ts`; nada aqui é opinião sobre o que o material "deveria" ter.
 */
export interface FiltroTravado {
  rotulo: string;
  /** Por que não há controle: o que falta no lote ou no banco. */
  motivo: string;
  /** Onde a trava é medida: arquivo/coluna, não a tela. */
  fonte: string;
}

export const FILTROS_TRAVADOS: readonly FiltroTravado[] = [
  {
    rotulo: "Nível",
    motivo: "`nivel` é nulo nas 918 questões distintas do lote.",
    fonte: "src/lib/questoes/procedencia.ts (`QuestaoExtraida.nivel`)",
  },
  {
    rotulo: "Dificuldade",
    motivo: "não há coluna no lote nem em `questions`; é classificação, não filtro.",
    fonte: "src/db/schema/study.ts (`questions`)",
  },
  {
    rotulo: "Área de Formação",
    motivo: "sem coluna no lote; a taxonomia de área está no domínio de edital.",
    fonte: "src/db/schema/contest.ts (`positions`, `editais`)",
  },
  {
    rotulo: "Área de Atuação",
    motivo: "sem coluna no lote, pela mesma razão de `Área de Formação`.",
    fonte: "src/db/schema/contest.ts (`positions`, `editais`)",
  },
  {
    rotulo: "Gabarito Comentado",
    motivo: "`explicacao` é sempre `null` no lote: comentário de terceiro não viaja no arquivo.",
    fonte: "src/lib/questoes/dados-caderno.ts (validação de forma)",
  },
  {
    rotulo: "Comentários da comunidade",
    motivo: "não existe tabela de comentário de questão.",
    fonte: "src/db/schema/study.ts",
  },
  {
    rotulo: "Meus Comentários",
    motivo: "a nota do aluno é `localStorage`, não linha consultável.",
    fonte: "src/components/questoes/nota-do-aluno.tsx",
  },
  {
    rotulo: "Minhas Anotações",
    motivo: "idem: anotação local não tem como virar predicado de listagem.",
    fonte: "src/components/questoes/nota-do-aluno.tsx",
  },
  {
    rotulo: "Aulas",
    motivo: "o lote declara `aula` de procedência, mas não há relação questão↔aula do aluno.",
    fonte: "src/db/schema/study.ts (`lessons`)",
  },
  {
    rotulo: "Dos meus cadernos",
    motivo: "não há tabela de caderno do aluno ligada a `id_local`.",
    fonte: "src/db/schema/study.ts",
  },
  {
    rotulo: "Dos meus simulados",
    motivo: "não há tabela de simulado ligada a item de arquivo.",
    fonte: "src/db/schema/study.ts",
  },
  {
    rotulo: "Desatualizadas",
    motivo: "o extrator não marca desatualização; não existe predicado para aplicar.",
    fonte: "agents/pdf_question_extractor/scripts/normalize_questions.py",
  },
  {
    rotulo: "Salvar Filtros",
    motivo: "o filtro é a URL; salvar um pedido precisaria de tabela e API próprias.",
    fonte: "src/lib/questoes/cadernos.ts (`queryDeFiltros`)",
  },
];

/**
 * O que o caderno aplica sem ninguém pedir. Não é "sem filtro": gabarito e aba
 * já são decisões de produto, e `queryDeFiltros` não escreve o padrão na URL
 * para `/questoes/portugues` continuar sendo o link canônico da tela.
 */
export const FILTRO_PADRAO: FiltrosCaderno = {
  disciplina: null,
  assunto: null,
  leis: null,
};

export function filtroEhPadrao(f: FiltrosCaderno): boolean {
  return CHAVES_FILTRO.every((chave) => f[chave] === FILTRO_PADRAO[chave]);
}

/**
 * Devolve `filtros` com uma única chave no valor de padrão — é o contexto da
 * contagem de faceta e o "x" do chip. `switch` exaustivo de propósito: se uma
 * chave entrar em `CHAVES_FILTRO` sem entrar aqui, o tipo reclama em vez de o
 * chip virar botão morto.
 */
export function semAChave(filtros: FiltrosCaderno, chave: ChaveFiltro): FiltrosCaderno {
  switch (chave) {
    case "disciplina":
      return { ...filtros, disciplina: null };
    case "assunto":
      return { ...filtros, assunto: null };
    case "leis":
      return { ...filtros, leis: null };
    case "origem":
      return { ...filtros, origem: null };
    case "ano":
      return { ...filtros, ano: null };
    case "tipo":
      return { ...filtros, tipo: null };
    case "status_resolucao":
      return { ...filtros, status_resolucao: null };
    case "anuladas":
      return { ...filtros, anuladas: null };
    case "ineditas":
      return { ...filtros, ineditas: null };
    case "meus_simulados":
      return { ...filtros, meus_simulados: null };
    case "meus_cadernos":
      return { ...filtros, meus_cadernos: null };
    case "comentado":
      return { ...filtros, comentado: null };
    case "comentarios":
      return { ...filtros, comentarios: null };
    case "meus_comentarios":
      return { ...filtros, meus_comentarios: null };

  const anoTexto = bruto("ano");
  const anoNum = anoTexto === null ? Number.NaN : Number(anoTexto);
  const palavra = bruto("palavra");
  // Mede-se o que sobra depois de desacentuar: "?!?" não é busca, é ruído de URL.
  const agulha = palavra === null ? "" : normalizar(palavra);

  return {
    disciplina: bruto("disciplina"),
    assunto: bruto("assunto"),
    leis: bruto("leis"),
    // Tag fechada, com valor vigente: só `fixacao` estreita. Outro valor volta ao
    // padrão em vez de virar aba que a lista não sabe aplicar.
    bloco: bruto("bloco") === "fixacao" ? "fixacao" : "objetivas",
    // Idem: `confiavel` é o que se aplica quando a URL não diz nada, então a
    // única coisa que um `?gabarito=` pode fazer é ligar `todos`.
    gabarito: bruto("gabarito") === "todos" ? "todos" : "confiavel",
    desatualizadas: exclusao("desatualizadas"),
    anuladas: exclusao("anuladas"),
    ineditas: exclusao("ineditas"),
    meus_simulados: exclusao("meus_simulados"),
    meus_cadernos: exclusao("meus_cadernos"),
    comentado: bruto("comentado"),
    comentarios: bruto("comentarios"),
    meus_comentarios: bruto("meus_comentarios"),
  };
}

/**
 * Serializa os filtros em query string, na ordem fixa de `CHAVES_FILTRO`, e só
 * escreve o que diverge do padrão. A ordem determinística importa: a UI de chips
 * compara a URL gerada para desligar o filtro ativo, e teste de rota não pode
 * depender de ordem de `URLSearchParams` por implementação. O padrão fora da URL
 * é o que mantém `/questoes/portugues` como link canônico da tela de hoje.
 */
export function queryDeFiltros(f: FiltrosCaderno): string {
  const sp = new URLSearchParams();
  for (const chave of CHAVES_FILTRO) {
    const valor = f[chave];
    if (valor === null || valor === FILTRO_PADRAO[chave]) continue;
    sp.set(chave, String(valor));
  }
  return sp.toString();
}

/** Questão + o lote de onde ela veio: o par que permite filtrar por origem. */
export interface ItemCaderno {
  questao: QuestaoExtraida;
  lote: LoteProcedencia;
}

/**
 * Chaves que são tag observável do item — igualdade normalizada, não predicado.
 * `palavra`, `bloco`, `gabarito`, `anuladas` e `ineditas` são perguntas diferentes
 * (contém / deriva / qualidade / exclusão) e por isso ficam fora daqui.
 */
export const CHAVES_DE_TAG = [
  "disciplina",
  "assunto",
  "banca",
  "orgao",
  "cargo",
  "origem",
  "ano",
  "tipo",
  "gabarito",
] as const;
export type ChaveDeTag = (typeof CHAVES_DE_TAG)[number];

export function tagsDoItem(item: ItemCaderno): Record<ChaveDeTag, string | null> {
  const q = item.questao;
  return {
    disciplina: q.disciplina || null,
    assunto: q.assunto || null,
    banca: q.banca,
    orgao: q.orgao,
    cargo: q.cargo,
    ano: q.ano === null ? null : String(q.ano),
    origem: item.lote.origem,
    tipo: q.tipo,
    // Mesma chave que o card usa para mostrar ou esconder a resposta: filtro e
    // selo de quarentena não podem divergir.
    gabarito: gabaritoConfiavel(q) ? "confiavel" : null,
  };
}

const etiquetasMemo = new WeakMap<QuestaoExtraida, Record<ChaveDeTag, string | null>>();

/**
 * `tagsDoItem` já em chave comparável. O cache é por objeto-questão porque o
 * carregador (`dados-caderno.ts`) mantém o lote em memória entre requisições: a
 * barra conta oito facetas sobre 918 itens por renderização, e refazer
 * `normalizar` a cada passada custaria mais que a listagem inteira.
 */
function etiquetasNormalizadas(item: ItemCaderno): Record<ChaveDeTag, string | null> {
  const q = item.questao;
  const pronta = etiquetasMemo.get(q);
  if (pronta) return pronta;
  const brutas = tagsDoItem(item);
  const normais: Record<ChaveDeTag, string | null> = {
    disciplina: brutas.disciplina === null ? null : normalizar(brutas.disciplina),
    assunto: brutas.assunto === null ? null : normalizar(brutas.assunto),
    banca: brutas.banca === null ? null : normalizar(brutas.banca),
    orgao: brutas.orgao === null ? null : normalizar(brutas.orgao),
    cargo: brutas.cargo === null ? null : normalizar(brutas.cargo),
    origem: brutas.origem === null ? null : normalizar(brutas.origem),
    ano: brutas.ano === null ? null : normalizar(brutas.ano),
    tipo: brutas.tipo === null ? null : normalizar(brutas.tipo),
    gabarito: brutas.gabarito,
  };
  etiquetasMemo.set(q, normais);
  return normais;
}

const textoDeBuscaMemo = new WeakMap<QuestaoExtraida, string>();

/**
 * Superfície indexada da busca livre: código, enunciado e metadado declarado.
 * Alternativa e explicação ficam de fora de propósito — a primeira não é o que
 * se busca para identificar questão, a segunda não viaja no lote (`explicacao` é
 * `null` por contrato), e buscar no que não existe seria filtro fantasma.
 */
function textoDeBusca(q: QuestaoExtraida): string {
  const pronto = textoDeBuscaMemo.get(q);
  if (pronto !== undefined) return pronto;
  const indexavel = normalizar(
    [
      q.codigo,
      q.id_local,
      q.enunciado,
      q.tema,
      q.assunto,
      q.disciplina,
      q.banca,
      q.orgao,
      q.cargo,
      q.alvo_apostila,
      q.secao_rotulo,
    ]
      .filter((parte): parte is string => typeof parte === "string" && parte.length > 0)
      .join(" · ")
  );
  textoDeBuscaMemo.set(q, indexavel);
  return indexavel;
}

/**
 * O bloco que o material chama de "Lista de Questões" é a aba de fixação: item
 * que o PDF só publica sem versão comentada. O predicado é só `secao_tipo` porque
 * `removerCopiasIdenticas` sempre prefere a cópia comentada — se a cópia canônica
 * veio da lista, é porque não havia comentada nenhuma.
 */
export function ehExercicioDeFixacao(item: ItemCaderno): boolean {
  return item.questao.secao_tipo === "lista";
}

/**
 * Filtra por igualdade normalizada, sem fuzzy: tag que não casa devolve lista
 * vazia e a tela diz isso em vez de aproximar. Chutar proximidade faria o aluno
 * estudar assunto diferente do que pediu.
 *
 * A ordem do predicado é a do mais barato e mais seletivo para o menos: qualidade
 * do gabarito (padrão da tela), aba, exclusões, busca livre, metadado de prova.
 */
export function aplicarFiltros(
  itens: ItemCaderno[],
  filtros: FiltrosCaderno
): ItemCaderno[] {
  const soConfiavel = filtros.gabarito !== "todos";
  const soFixacao = filtros.bloco === "fixacao";
  const agulha = filtros.palavra === null ? "" : normalizar(filtros.palavra);
  // Cada alvo é calculado uma vez por requisição, não uma vez por item.
  const alvos = {
    disciplina: filtros.disciplina === null ? null : normalizar(filtros.disciplina),
    assunto: filtros.assunto === null ? null : normalizar(filtros.assunto),
    banca: filtros.banca === null ? null : normalizar(filtros.banca),
    orgao: filtros.orgao === null ? null : normalizar(filtros.orgao),
    cargo: filtros.cargo === null ? null : normalizar(filtros.cargo),
    origem: filtros.origem === null ? null : normalizar(filtros.origem),
    tipo: filtros.tipo === null ? null : normalizar(filtros.tipo),
  } as const;

  return itens.filter((item) => {
    const q = item.questao;
    if (soConfiavel && !gabaritoConfiavel(q)) return false;
    if (soFixacao && !ehExercicioDeFixacao(item)) return false;
    if (filtros.anuladas === "excluir" && ehAnulada(q)) return false;
    if (filtros.ineditas === "excluir" && ehInedita(q)) return false;
    if (agulha.length > 0 && !textoDeBusca(q).includes(agulha)) return false;

    if (filtros.ano !== null && q.ano !== filtros.ano) return false;
    if (filtros.leis !== null && !textoDeBusca(q).includes(normalizar(filtros.leis))) return false;
    if (filtros.comentado === "sim" && q.secao_tipo !== "comentada") return false;
    if (filtros.nivel !== null) {
      const nivNorm = normalizar(filtros.nivel);
      const qNiv = q.nivel ? normalizar(q.nivel) : "";
      const qCargo = q.cargo ? normalizar(q.cargo) : "";
      const nivelCasa =
        qNiv === nivNorm ||
        (nivNorm === "medio" && (qCargo.includes("soldado") || qCargo.includes("tecnico"))) ||
        (nivNorm === "superior" && (qCargo.includes("professor") || qCargo.includes("analista") || qCargo.includes("delegado")));
      if (!nivelCasa) return false;
    }
    if (filtros.area_atuacao !== null) {
      const atNorm = normalizar(filtros.area_atuacao);
      const busca = textoDeBusca(q);
      const atuacaoCasa =
        busca.includes(atNorm) ||
        (atNorm.includes("policial") && (busca.includes("cbm") || busca.includes("pm") || busca.includes("soldado"))) ||
        (atNorm.includes("militar") && (busca.includes("cbm") || busca.includes("militar") || busca.includes("soldado")));
      if (!atuacaoCasa) return false;
    }
    if (filtros.area_formacao !== null && !textoDeBusca(q).includes(normalizar(filtros.area_formacao))) {
      return false;
    }
    case "anuladas":
      return { ...base, anuladas: "excluir" };
    case "ineditas":
      return { ...base, ineditas: "excluir" };
    case "meus_simulados":
      return { ...base, meus_simulados: "excluir" };
    case "meus_cadernos":
      return { ...base, meus_cadernos: "excluir" };
    case "comentado":
      return { ...base, comentado: valor };
    case "comentarios":
      return { ...base, comentarios: valor };
    case "meus_comentarios":
      return { ...base, meus_comentarios: valor };
    case "banca":
      return { ...base, banca: valor };
    case "orgao":
      return { ...base, orgao: valor };
    case "cargo":
      return { ...base, cargo: valor };
    case "nivel":
      return { ...base, nivel: valor };
    case "dificuldade":
      return { ...base, dificuldade: valor };
    case "area_formacao":
      return { ...base, area_formacao: valor };
    case "area_atuacao":
      return { ...base, area_atuacao: valor };
  }
}

/** Uma caixa da linha "Filtrar por": o que está ativo e como desligá-lo. */
export interface ChipFiltro {
  chave: ChaveFiltro;
  rotulo: string;
  valor: string;
}

/**
 * Filtros vigentes em ordem de `CHAVES_FILTRO`, já com rótulo legível. O padrão
 * não gera chip: "Qualidade: confiável" não é um filtro que alguém aplicou, é a
 * tela de hoje (docs/31 §7.6), e listá-lo confundiria "o que eu escolhi" com
 * "o que a plataforma garante".
 */
export function chipsDeFiltro(filtros: FiltrosCaderno): ChipFiltro[] {
  const chips: ChipFiltro[] = [];
  for (const chave of CHAVES_FILTRO) {
    const valor = filtros[chave];
    if (valor === null || valor === FILTRO_PADRAO[chave]) continue;
    if (chave === "gabarito") {
      chips.push({ chave, rotulo: ROTULO_DAS_CHAVES[chave], valor: "incluindo revisão" });
      continue;
    }
    if (chave === "bloco") {
      const aba = ABAS_CADERNO.find((a) => a.valor === valor);
      chips.push({ chave, rotulo: ROTULO_DAS_CHAVES[chave], valor: aba?.rotulo ?? String(valor) });
      continue;
    }
    if (
      chave === "desatualizadas" ||
      chave === "anuladas" ||
      chave === "ineditas" ||
      chave === "meus_simulados" ||
      chave === "meus_cadernos"
    ) {
      chips.push({ chave, rotulo: "Excluir questões", valor: ROTULO_DAS_CHAVES[chave] });
      continue;
    }
    if (chave === "comentado" || chave === "comentarios" || chave === "meus_comentarios") {
      chips.push({ chave, rotulo: "Questões com", valor: ROTULO_DAS_CHAVES[chave] });
      continue;
    }
    const texto = String(valor);
    chips.push({
      chave,
      rotulo: ROTULO_DAS_CHAVES[chave],
      valor: chave === "origem" || chave === "tipo" ? rotuloDaTag(chave, texto) : texto,
    });
  }
  return chips;
}

// ============================================================
// CÓPIAS CANÔNICAS (o acervo real, não o número de linhas do arquivo)
// ============================================================

/**
 * Nota de preferência entre cópias do mesmo `content_hash`.
 *
 * O PDF da Aula 14 publica a mesma questão duas vezes: uma na seção comentada,
 * outra na lista de gabaritos. `content_hash` é a firma do enunciado +
 * alternativas, então as duas linhas são a MESMA questão. Somar as duas faria a
 * tela afirmar 1.736 questões quando o acervo tem 920.
 *
 * Ordem de preferência: cópia comentada, depois a que tem gabarito que o
 * material sustenta, depois a de código menor — sempre determinística, para o
 * link compartilhado mostrar a mesma questão para qualquer pessoa.
 */
function notaDaCopia(item: ItemCaderno): number {
  let nota = 0;
  if (item.questao.secao_tipo === "comentada") nota += 2;
  if (gabaritoConfiavel(item.questao)) nota += 1;
  return nota;
}

export interface AcervoDistinto {
  /** Uma cópia por `content_hash`, preservando a ordem da primeira aparição. */
  itens: ItemCaderno[];
  /** Linhas do lote que produziram esta seleção. */
  linhas: number;
  /** Repetições exatas de conteúdo: não são questões a mais. */
  duplicatas: number;
  /** Distintas cujo gabarito o material não sustenta (quarentena inclusa). */
  semGabaritoConfiavel: number;
}

export function removerCopiasIdenticas(itens: ItemCaderno[]): AcervoDistinto {
  const escolhida = new Map<string, { indice: number; item: ItemCaderno }>();
  for (let i = 0; i < itens.length; i++) {
    const item = itens[i]!;
    // Sem firma de conteúdo não há como comparar: a linha fica intacta.
    const chave = item.questao.content_hash || `sem-hash:${item.questao.id_local}`;
    const atual = escolhida.get(chave);
    if (!atual) {
      escolhida.set(chave, { indice: i, item });
      continue;
    }
    const notaNova = notaDaCopia(item);
    const notaAtual = notaDaCopia(atual.item);
    const vence =
      notaNova > notaAtual ||
      (notaNova === notaAtual &&
        item.questao.id_local.localeCompare(atual.item.questao.id_local) < 0);
    // Quem vence fica na posição da primeira aparição: a ordem do material não muda.
    if (vence) escolhida.set(chave, { indice: atual.indice, item });
  }

  const distintos = [...escolhida.values()]
    .sort((a, b) => a.indice - b.indice)
    .map((e) => e.item);

  return {
    itens: distintos,
    linhas: itens.length,
    duplicatas: itens.length - distintos.length,
    semGabaritoConfiavel: distintos.filter(({ questao }) => !gabaritoConfiavel(questao)).length,
  };
}

// ============================================================
// ABAS E CONTAGEM DE FACETA (as opções saem do lote, nunca de lista fixa)
// ============================================================

export interface OpcaoFaceta {
  valor: string;
  total: number;
}

/** Facetas contáveis: tag do item que vira linha de select com total medido. */
export type ChaveDeContagem = Exclude<ChaveDeTag, "gabarito">;

export const CHAVES_DE_CONTAGEM: readonly ChaveDeContagem[] = [
  "disciplina",
  "assunto",
  "banca",
  "orgao",
  "cargo",
  "origem",
  "ano",
  "tipo",
];

export interface AbaComTotal extends AbaCaderno {
  total: number;
}

/**
 * Total de cada aba dentro do contexto vigente (menos a própria aba). É o que o
 * rótulo da aba pode prometer: o número ao lado é o que o clique devolve.
 */
export function totaisDasAbas(itens: ItemCaderno[], filtros: FiltrosCaderno): AbaComTotal[] {
  const contexto = itensExcetoFiltro(itens, filtros, "bloco");
  return ABAS_CADERNO.map((aba) => ({
    ...aba,
    total:
      aba.valor === "fixacao"
        ? contexto.filter((item) => ehExercicioDeFixacao(item)).length
        : contexto.length,
  }));
}

/** Quantos itens cada refinamento tiraria (ou devolveria) no contexto vigente. */
export interface RefinamentosCaderno {
  /** Excluídas pelo padrão de qualidade: ligáveis por `?gabarito=todos`. */
  revisao: number;
  anuladas: number;
  ineditas: number;
}

/**
 * Medições que decidem quais caixas de refinamento existem na barra. `ineditas`
 * é zero no lote de hoje, então a caixa não aparece — e reaparece sozinha quando
 * um material com `inedita_compilador` entrar no catálogo, sem tocar em componente.
 */
export function refinamentosDoContexto(
  itens: ItemCaderno[],
  filtros: FiltrosCaderno
): RefinamentosCaderno {
  const semGabarito = itensExcetoFiltro(itens, filtros, "gabarito");
  const semAnuladas = itensExcetoFiltro(itens, filtros, "anuladas");
  const semIneditas = itensExcetoFiltro(itens, filtros, "ineditas");
  return {
    revisao: semGabarito.filter((item) => !gabaritoConfiavel(item.questao)).length,
    anuladas: semAnuladas.filter((item) => ehAnulada(item.questao)).length,
    ineditas: semIneditas.filter((item) => ehInedita(item.questao)).length,
  };
}

/** Valor que a questão apresenta para uma faceta, ou null quando não declarou. */
function valorDaFaceta(item: ItemCaderno, chave: ChaveDeContagem): string | null {
  if (chave === "ano") {
    const n = item.questao.ano;
    return n === null ? null : String(n);
  }
  const bruto = tagsDoItem(item)[chave];
  return bruto && bruto.length > 0 ? bruto : null;
}

/**
 * Opções de uma faceta contadas sobre a lista recebida.
 *
 * Banca é o que justifica isto: 150 valores observados e muitas questões sem
 * banca declarada. Lista fixa no componente mentiria sobre o acervo; ordenar por
 * ocorrência põe primeiro o que o material realmente tem, e o total ao lado do
 * rótulo antecipa o que o filtro devolve — desde que a contagem seja feita no
 * contexto certo, que é o que `opcoesDoContexto` garante.
 */
export function contagemDaFaceta(itens: ItemCaderno[], chave: ChaveDeContagem): OpcaoFaceta[] {
  const totais = new Map<string, OpcaoFaceta>();
  for (const item of itens) {
    const valor = valorDaFaceta(item, chave);
    if (valor === null) continue;
    // Agrupa pela forma normalizada; o rótulo exibido é a grafia do material.
    const k = normalizar(valor);
    const atual = totais.get(k);
    if (atual) atual.total += 1;
    else totais.set(k, { valor, total: 1 });
  }
  const lista = [...totais.values()];
  if (chave === "ano") return lista.sort((a, b) => Number(b.valor) - Number(a.valor));
  return lista.sort((a, b) => b.total - a.total || a.valor.localeCompare(b.valor, "pt-BR"));
}

/** Quantas questões não declaram aquele metadado — lacuna do PDF, não bug. */
export function semFaceta(itens: ItemCaderno[], chave: ChaveDeContagem): number {
  return itens.filter((item) => valorDaFaceta(item, chave) === null).length;
}

/**
 * Opções de todas as facetas, cada uma contada no contexto em que o clique vai
 * cair: os filtros vigentes, menos a própria faceta. É isso que faz o
 * "Pontuação (68)" ao lado do rótulo continuar sendo o que o aluno recebe depois
 * de já ter escolhido uma banca e uma aba — e é o que a barra não pode prometer
 * se as opções saírem do acervo inteiro. A paginação fica de fora de propósito:
 * trocar de página nunca muda o tamanho do select.
 */
export function opcoesDoContexto(
  itens: ItemCaderno[],
  filtros: FiltrosCaderno
): Record<ChaveDeContagem, OpcaoFaceta[]> {
  const entradas = CHAVES_DE_CONTAGEM.map(
    (chave) =>
      [chave, contagemDaFaceta(itensExcetoFiltro(itens, filtros, chave), chave)] as const
  );
  return Object.fromEntries(entradas) as Record<ChaveDeContagem, OpcaoFaceta[]>;
}

// ============================================================
// PAGINAÇÃO (estado na URL; trocar filtro volta à página 1)
// ============================================================

/** Padrão de tela: 20 cards é o que se rola sem perder o fio da lista. */
export const TAMANHO_DE_PAGINA = 20;
export const TAMANHOS_DE_PAGINA = [10, 20, 50] as const;

export interface Pagina {
  atual: number;
  porPagina: number;
  totalPaginas: number;
  totalItens: number;
  /** 1-based; 0 quando não há nada para exibir. */
  inicio: number;
  /** 1-based inclusive. */
  fim: number;
}

function paginaVazia(porPagina: number): Pagina {
  return {
    atual: 1,
    porPagina,
    totalPaginas: 1,
    totalItens: 0,
    inicio: 0,
    fim: 0,
  };
}

function brutoDaBusca(
  entrada: URLSearchParams | Record<string, string | string[] | undefined>,
  chave: string
): string | null {
  const valor =
    entrada instanceof URLSearchParams ? entrada.get(chave) : entrada[chave];
  const texto = Array.isArray(valor) ? valor[0] : valor;
  return typeof texto === "string" && texto.trim().length > 0 ? texto.trim() : null;
}

/**
 * Lê `?page=` e `?por=` e amarra os dois ao total real.
 *
 * Página acima do último intervalo é cortada para a última página, não para a
 * primeira: quem abre um link antigo `?page=999` recebe conteúdo em vez de
 * surpresa. O que nem é número (`?page=abc`) volta para 1, porque chute aqui
 * seria inventar paginação. `por` só aceita os tamanhos da lista fechada —
 * paginação não é vetor de ataque ao carregar o lote inteiro numa página.
 */
export function calcularPagina(
  entrada: URLSearchParams | Record<string, string | string[] | undefined>,
  totalItens: number
): Pagina {
  const porNum = Number(brutoDaBusca(entrada, "por") ?? Number.NaN);
  const porPagina = (TAMANHOS_DE_PAGINA as readonly number[]).includes(porNum)
    ? porNum
    : TAMANHO_DE_PAGINA;

  if (totalItens <= 0) return paginaVazia(porPagina);

  const totalPaginas = Math.ceil(totalItens / porPagina);
  const pedida = Number(brutoDaBusca(entrada, "page") ?? Number.NaN);
  const atual = Math.min(Number.isInteger(pedida) && pedida >= 1 ? pedida : 1, totalPaginas);

  return {
    atual,
    porPagina,
    totalPaginas,
    totalItens,
    inicio: (atual - 1) * porPagina + 1,
    fim: Math.min(atual * porPagina, totalItens),
  };
}

/** Recorte da página corrente; sem conteúdo devolve vazio em vez de estourar. */
export function fatiarPagina<T>(itens: T[], pagina: Pagina): T[] {
  if (pagina.inicio === 0) return [];
  return itens.slice(pagina.inicio - 1, pagina.fim);
}

/**
 * Query com os filtros vigentes + a página. `page=1` e o tamanho padrão não
 * entram na URL: o link limpo continua sendo o link canônico da primeira
 * página, e é assim que "próxima" presunta assunto/banca/ano sem sujar o
 * histórico de quem só abriu a matéria.
 */
export function queryDePagina(filtros: FiltrosCaderno, pagina: Pagina): string {
  const sp = new URLSearchParams(queryDeFiltros(filtros));
  if (pagina.atual > 1) sp.set("page", String(pagina.atual));
  if (pagina.porPagina !== TAMANHO_DE_PAGINA) sp.set("por", String(pagina.porPagina));
  return sp.toString();
}

/**
 * Janela de páginas visíveis: a atual, as vizinhas, a primeira e a última. O
 * componente decide onde há reticências pela quebra de sequência, então a
 * listagem de 46 páginas não vira uma régua de 46 links.
 */
export function janelaDePaginas(atual: number, totalPaginas: number, raio = 2): number[] {
  if (totalPaginas <= 1) return [1];
  const paginas = new Set<number>([1, totalPaginas, atual]);
  for (let d = 1; d <= raio; d++) {
    if (atual - d >= 1) paginas.add(atual - d);
    if (atual + d <= totalPaginas) paginas.add(atual + d);
  }
  return [...paginas].sort((a, b) => a - b);
}

