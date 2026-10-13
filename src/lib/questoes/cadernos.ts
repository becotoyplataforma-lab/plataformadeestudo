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
import { gabaritoConfiavel, type QuestaoExtraida } from "./procedencia";
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
    ],
  },
];

export function cadernoPorSlug(slug: string | null | undefined): Caderno | null {
  if (!slug) return null;
  return CADERNOS.find((c) => c.slug === slug) ?? null;
}

/** Item de navegação derivado do catálogo — o menu não conhece PDF nem aula. */
export interface ItemCadernoNav {
  href: string;
  label: string;
  badge?: string;
}

export function itensDeMenu(cadernos: readonly Caderno[] = CADERNOS): ItemCadernoNav[] {
  return cadernos.map((c) => ({
    href: `/questoes/${encodeURIComponent(c.slug)}`,
    label: c.titulo,
    // Lote local ainda não importado é pendência de conteúdo, não recurso
    // ausente: a rota existe e responde com o que está em arquivo.
    badge: c.lotes.length > 0 ? "Revisão" : undefined,
  }));
}

/**
 * O que `/questoes/[ref]` significa para um segmento recebido.
 *
 * A ordem é por forma, não por tentativa contra fonte: uuid é questão
 * importada, código de lote (`A14-S01-001`) é questão ainda em arquivo, o resto
 * é slug de matéria. As três formas não se sobrepõem, então a página nunca
 * precisa "adivinhar" consultando duas origens.
 */
export type RefResolvido =
  | { tipo: "caderno"; caderno: Caderno }
  | { tipo: "questao-banco"; id: string }
  | { tipo: "questao-lote"; codigo: string }
  | null;

export function resolverRef(ref: string): RefResolvido {
  if (ehUuid(ref)) return { tipo: "questao-banco", id: ref };
  if (ehIdLocalValido(ref)) return { tipo: "questao-lote", codigo: ref };
  const caderno = cadernoPorSlug(ref);
  return caderno ? { tipo: "caderno", caderno } : null;
}

// ============================================================
// TAGS DE PROCEDÊNCIA (filtro por query string)
// ============================================================

/**
 * Chaves de filtro, na ordem em que entram na query string. `disciplina` vem
 * antes de `assunto` porque é o nível acima na taxonomia do material (uma
 * disciplina abre vários assuntos) — e a ordem é contrato: `queryDeFiltros` é
 * usada para montar link compartilhável e para desligar o filtro ativo.
 */
export const CHAVES_FILTRO = [
  "assunto",
  "disciplina",
  "banca",
  "ano",
  "origem",
  "tipo",
  "gabarito",
] as const;
export type ChaveFiltro = (typeof CHAVES_FILTRO)[number];

export interface FiltrosCaderno {
  assunto: string | null;
  disciplina: string | null;
  banca: string | null;
  ano: number | null;
  origem: string | null;
  tipo: string | null;
  /**
   * `confiavel` = só item com gabarito que o material sustenta (fora de
   * quarentena). É filtro de qualidade do acervo, não procedência: por isso não
   * casa com banca/ano/assunto, e por isso também não pode sumir da tela — a
   * lista inteira tem 65 itens em quarentena.
   */
  gabarito: "confiavel" | null;
}

export const FILTRO_VAZIO: FiltrosCaderno = {
  assunto: null,
  disciplina: null,
  banca: null,
  ano: null,
  origem: null,
  tipo: null,
  gabarito: null,
};

export function filtroEstaVazio(f: FiltrosCaderno): boolean {
  return CHAVES_FILTRO.every((chave) => f[chave] === null);
}

/** Degrava, unifica caixa e colapsa espaços: "Funções Sintáticas" ≈ "Funções sintáticas". */
export function normalizar(rotulo: string | null | undefined): string {
  if (!rotulo) return "";
  return rotulo
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?'\"()[\]{}_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Aceita `URLSearchParams` ou o objeto cru do `searchParams` do Next. */
export function lerFiltros(
  entrada: URLSearchParams | Record<string, string | string[] | undefined>
): FiltrosCaderno {
  const bruto = (chave: ChaveFiltro): string | null => {
    const valor =
      entrada instanceof URLSearchParams
        ? entrada.get(chave)
        : (entrada[chave] ?? undefined);
    const texto = Array.isArray(valor) ? valor[0] : valor;
    return typeof texto === "string" && texto.trim().length > 0 ? texto.trim() : null;
  };

  const anoTexto = bruto("ano");
  const anoNum = anoTexto === null ? Number.NaN : Number(anoTexto);

  return {
    assunto: bruto("assunto"),
    disciplina: bruto("disciplina"),
    banca: bruto("banca"),
    ano: Number.isInteger(anoNum) && anoNum > 0 ? anoNum : null,
    origem: bruto("origem"),
    tipo: bruto("tipo"),
    // Tag fechada: só `confiavel` existe. Outro valor é tratado como ausente em
    // vez de virar filtro novo — a lista não aceita filtro que não sabe aplicar.
    gabarito: bruto("gabarito") === "confiavel" ? "confiavel" : null,
  };
}

/**
 * Serializa os filtros de volta em query string, na ordem fixa de
 * `CHAVES_FILTRO`. A ordem determinística importa: a UI de chips compara a URL
 * gerada para desligar o filtro ativo, e teste de rota não pode depender de
 * ordem de `URLSearchParams` por implementação.
 */
export function queryDeFiltros(f: FiltrosCaderno): string {
  const sp = new URLSearchParams();
  for (const chave of CHAVES_FILTRO) {
    const valor = f[chave];
    if (valor !== null) sp.set(chave, String(valor));
  }
  return sp.toString();
}

/** Questão + o lote de onde ela veio: o par que permite filtrar por origem. */
export interface ItemCaderno {
  questao: QuestaoExtraida;
  lote: LoteProcedencia;
}

export function tagsDoItem(item: ItemCaderno): Record<ChaveFiltro, string | null> {
  const q = item.questao;
  return {
    assunto: q.assunto || null,
    disciplina: q.disciplina || null,
    banca: q.banca,
    ano: q.ano === null ? null : String(q.ano),
    origem: item.lote.origem,
    tipo: q.tipo,
    // Mesma chave que o card usa para mostrar ou esconder a resposta: filtro e
    // selo de quarentena não podem divergir.
    gabarito: gabaritoConfiavel(q) ? "confiavel" : null,
  };
}

/**
 * Filtra por igualdade normalizada, sem fuzzy: tag que não casa devolve lista
 * vazia e a tela diz isso em vez de aproximar. Chutar proximidade faria o aluno
 * estudar assunto diferente do que pediu.
 */
export function aplicarFiltros(
  itens: ItemCaderno[],
  filtros: FiltrosCaderno
): ItemCaderno[] {
  if (filtroEstaVazio(filtros)) return itens;
  return itens.filter((item) => {
    if (filtros.origem !== null && normalizar(item.lote.origem) !== normalizar(filtros.origem)) {
      return false;
    }
    if (filtros.tipo !== null && normalizar(item.questao.tipo) !== normalizar(filtros.tipo)) {
      return false;
    }
    if (filtros.assunto !== null && normalizar(item.questao.assunto) !== normalizar(filtros.assunto)) {
      return false;
    }
    if (
      filtros.disciplina !== null &&
      normalizar(item.questao.disciplina) !== normalizar(filtros.disciplina)
    ) {
      return false;
    }
    if (filtros.banca !== null && normalizar(item.questao.banca ?? "") !== normalizar(filtros.banca)) {
      return false;
    }
    if (filtros.ano !== null && item.questao.ano !== filtros.ano) {
      return false;
    }
    if (filtros.gabarito === "confiavel" && !gabaritoConfiavel(item.questao)) {
      return false;
    }
    return true;
  });
}

// ============================================================
// LEITURA PARA A UI (facetas e rótulos)
// ============================================================

/** Valores observados no lote, ordenados para a UI não ficar instável. */
export interface Facetas {
  assunto: string[];
  disciplina: string[];
  banca: string[];
  ano: number[];
  origem: string[];
  tipo: string[];
}

export const FACETA_VAZIA: Facetas = {
  assunto: [],
  disciplina: [],
  banca: [],
  ano: [],
  origem: [],
  tipo: [],
};

export function facetas(itens: ItemCaderno[]): Facetas {
  const assunto = new Map<string, string>();
  const disciplina = new Map<string, string>();
  const banca = new Map<string, string>();
  const origem = new Map<string, string>();
  const tipo = new Map<string, string>();
  const anos = new Set<number>();

  for (const { questao: q, lote } of itens) {
    if (q.assunto) assunto.set(normalizar(q.assunto), q.assunto);
    if (q.disciplina) disciplina.set(normalizar(q.disciplina), q.disciplina);
    if (q.banca) banca.set(normalizar(q.banca), q.banca);
    if (q.ano !== null) anos.add(q.ano);
    origem.set(normalizar(lote.origem), lote.origem);
    tipo.set(normalizar(q.tipo), q.tipo);
  }

  const porTexto = (m: Map<string, string>) =>
    [...m.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));

  return {
    assunto: porTexto(assunto),
    disciplina: porTexto(disciplina),
    banca: porTexto(banca),
    ano: [...anos].sort((a, b) => a - b),
    origem: porTexto(origem),
    tipo: porTexto(tipo),
  };
}

/** Rótulo legível de uma tag. `aula-14` é a chave; o que se mostra é "Aula 14". */
export function rotuloDaTag(chave: ChaveFiltro, valor: string): string {
  if (chave === "tipo") {
    return valor === "certo_errado" ? "Certo/Errado" : "Múltipla escolha";
  }
  if (chave !== "origem") return valor;
  const m = /^aula[-_\s]*(\d+)$/i.exec(valor);
  return m ? `Aula ${Number(m[1])}` : valor;
}

/** Total por assunto, do maior para o menor: é o índice de estudo do caderno. */
export function contagemPorAssunto(
  itens: ItemCaderno[]
): { assunto: string; total: number }[] {
  const totais = new Map<string, { assunto: string; total: number }>();
  for (const { questao: q } of itens) {
    const chave = normalizar(q.assunto);
    if (!chave) continue;
    const atual = totais.get(chave) ?? { assunto: q.assunto, total: 0 };
    atual.total += 1;
    totais.set(chave, atual);
  }
  return [...totais.values()].sort(
    (a, b) => b.total - a.total || a.assunto.localeCompare(b.assunto, "pt-BR")
  );
}

/**
 * Aplica/tira uma tag de filtro. Clicar no valor já ativo o desliga, então a
 * tela não precisa de estado em cliente nem de endpoint: o filtro é a URL.
 */
export function alternarFiltro(
  base: FiltrosCaderno,
  chave: ChaveFiltro,
  valor: string
): FiltrosCaderno {
  const atual = base[chave];
  const mesmo =
    atual === null
      ? false
      : chave === "ano"
        ? Number(valor) === atual
        : normalizar(String(atual)) === normalizar(valor);
  if (mesmo) return { ...base, [chave]: null };
  if (chave === "gabarito") return { ...base, gabarito: valor === "confiavel" ? "confiavel" : null };
  return { ...base, [chave]: chave === "ano" ? Number(valor) : valor };
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
// CONTAGEM DE FACETA (as opções dos selects saem do lote, nunca de lista fixa)
// ============================================================

export interface OpcaoFaceta {
  valor: string;
  total: number;
}

type ChaveDeContagem = Exclude<ChaveFiltro, "gabarito">;

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
 * Opções de filtro contadas sobre o acervo inteiro.
 *
 * Banca é o que justifica isto: 150 valores observados e muitas questões sem
 * banca declarada. Lista fixa no componente mentiria sobre o acervo; ordenar
 * por ocorrência põe primeiro o que o material realmente tem, e o total ao lado
 * do rótulo antecipa o que o filtro devolve.
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

