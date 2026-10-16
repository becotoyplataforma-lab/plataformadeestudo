/**
 * Fixture CBMERJ 2021 (FASE 4).
 *
 * Nao retranscreve o edital: le a transcricao literal ja preservada em docs/24
 * (secao E) e devolve o bloco com os marcadores de pagina da captura. Se a secao E
 * mudar, esta fixture falha: o texto publicado e canario de integridade, nao dado
 * opcional do teste. Leitura local de arquivo; nada de rede nem banco.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const DOCS_24_PATH = resolve(
  process.cwd(),
  "docs",
  "24-CATALOGACAO-HISTORICA-CBMERJ-2021.md"
);

const E_HEADING_RE = /^### E\.([123])\s+(.+)$/;
const TRAILING_PAGE_RE = /\u2014\s*p\.\s*\d+\s*$/;
const PAGE_MARKER_LINE_RE = /^\s*={4,6} PAGE (\d+) ={4,6}\s*$/;

export type CbmerjBlockId = "E.1" | "E.2" | "E.3";

export interface CbmerjBlock {
  block: CbmerjBlockId;
  /** Titulo do cargo tal como publicado na transcricao. */
  positionTitle: string;
  /** Texto com os marcadores ===== PAGE n ===== preservados. */
  text: string;
  pages: number[];
  characters: number;
}

function finish(raw: { id: CbmerjBlockId; title: string; rows: string[] }): CbmerjBlock {
  const text = raw.rows.join("\n");
  const pages = raw.rows
    .map((line) => PAGE_MARKER_LINE_RE.exec(line)?.[1])
    .filter((value): value is string => value !== undefined)
    .map(Number);
  return {
    block: raw.id,
    positionTitle: raw.title.replace(TRAILING_PAGE_RE, "").trim(),
    text,
    pages,
    characters: text.length,
  };
}

/** Extrai E.1, E.2 e E.3 da secao E de docs/24, sem alterar nenhuma linha. */
export function readSectionE(): CbmerjBlock[] {
  const raw = readFileSync(DOCS_24_PATH, "utf8");
  const lines = raw.split(/\r?\n/);
  const blocks: CbmerjBlock[] = [];
  let current: { id: CbmerjBlockId; title: string; rows: string[] } | null = null;

  for (const line of lines) {
    if (/^## F\./.test(line)) break;
    const heading = E_HEADING_RE.exec(line);
    if (heading && heading[1] && heading[2]) {
      if (current) blocks.push(finish(current));
      current = { id: ("E." + heading[1]) as CbmerjBlockId, title: heading[2], rows: [] };
      continue;
    }
    if (!current) continue;
    if (/^ {4}/.test(line)) {
      current.rows.push(line.slice(4));
      continue;
    }
    // Nota de prosa entre o cabecalho e o bloco nao encerra a transcricao.
  }
  if (current) blocks.push(finish(current));
  return blocks;
}

export const CBMERJ_2021_BLOCKS: CbmerjBlock[] = readSectionE();

/** Os tres blocos em um so texto, com os marcadores de pagina entre eles. */
export const CBMERJ_2021_TEXT: string = CBMERJ_2021_BLOCKS.map((block) => block.text).join("\n");

export const CBMERJ_2021_SOURCE_LABEL =
  "Anexo VI apos Retificacao 02 (arquivo 4) - transcricao literal de docs/24 secao E";

export const CBMERJ_2021_POSITION_TITLES: string[] = CBMERJ_2021_BLOCKS.map((block) => block.positionTitle);

/** Cabecalhos de disciplina publicados nos tres blocos (escapados, sem acento no fonte). */
export const CBMERJ_2021_DISCIPLINE_VOCABULARY: string[] = [
  "L\u00EDngua Portuguesa",
  "Matem\u00E1tica",
  "Racioc\u00EDnio L\u00F3gico",
  "Conhecimentos Espec\u00EDficos",
];

/**
 * Rotulos de Matematica declarados (docs/24 F.2): "Estatistica e Probabilidade" e
 * publicado SEM dois-pontos, entao so entra como rotulo porque esta declarado aqui.
 */
export const CBMERJ_2021_MATHEMATICS_LABEL_VOCABULARY: string[] = [
  "Geometria",
  "Estat\u00EDstica e Probabilidade",
  "\u00C1lgebra e Fun\u00E7\u00F5es",
  "N\u00FAmeros e Opera\u00E7\u00F5es",
];

/** Rotulos publicados com copula no bloco de Portugues (docs/24 F.2). */
export const CBMERJ_2021_PORTUGUESE_LABELS: string[] = [
  "Elementos de constru\u00E7\u00E3o do texto e seu sentido",
  "Sem\u00E2ntica",
  "Fon\u00E9tica",
  "Morfologia",
  "Sintaxe",
  "Estil\u00EDstica",
];

export const CBMERJ_2021_PORTUGUESE_FREE_UNITS: string[] = [
  "Varia\u00E7\u00E3o Lingu\u00EDstica",
  "Compreens\u00E3o, interpreta\u00E7\u00E3o e organiza\u00E7\u00E3o interna do texto",
  "Encontros voc\u00E1licos e consonantais",
  "Ortografia em vigor",
  "Pontua\u00E7\u00E3o",
];

/**
 * Contagens DECLARADAS em docs/24 F.2. A regra de segmentacao deste agente mede
 * 10 periodos para Portugues (docs conta 11 porque o periodo de Morfologia carrega
 * dois rotulos): a divergencia e registrada, jamais corrigida em silencio.
 */
export const CBMERJ_2021_EXPECTED_MEASUREMENTS = [
  {
    disciplineName: "L\u00EDngua Portuguesa",
    periodSegments: 11,
    publishedLabels: 6,
    freeUnits: 5,
  },
  {
    disciplineName: "Matem\u00E1tica",
    publishedLabels: 4,
    terms: 22,
  },
  {
    disciplineName: "Racioc\u00EDnio L\u00F3gico",
    periodSegments: 8,
  },
];

/** Opcoes de extracao usadas pelo agente no fixture: tudo declarado, nada inferido. */
export const CBMERJ_2021_EXTRACTION_OPTIONS = {
  disciplineVocabulary: CBMERJ_2021_DISCIPLINE_VOCABULARY,
  positionTitles: CBMERJ_2021_POSITION_TITLES,
  labelVocabulary: CBMERJ_2021_MATHEMATICS_LABEL_VOCABULARY,
  includeDerivedTerms: true,
  expectedMeasurements: CBMERJ_2021_EXPECTED_MEASUREMENTS,
};

export function blockOf(id: CbmerjBlockId): CbmerjBlock {
  const block = CBMERJ_2021_BLOCKS.find((item) => item.block === id);
  if (!block) throw new Error("Bloco E." + id + " nao encontrado em docs/24");
  return block;
}

/** Teste negativo de docs/24 G.2: o bloco do Tecnico nao publica Raciocinio Logico. */
export function hasRaciocinioLogico(text: string): boolean {
  return /Racioc/i.test(text);
}

/**
 * Alias de assunto declarado (docs/23 #4): a disciplina publicada se chama
 * Lingua Portuguesa e o assunto canonico se chama Portugues. Sem esta linha o
 * matcher devolve BLOQUEADO, e e exatamente o que a auditoria precisa registrar.
 */
export const CBMERJ_2021_SUBJECT_ALIASES = [
  {
    publishedName: "L\u00EDngua Portuguesa",
    canonicalSubjectName: "Portugu\u00EAs",
    rule: "docs/23 #4: nome publicado da disciplina difere do nome do assunto canonico",
  },
];

/**
 * Baseline medido nesta fase contra a transcricao de docs/24. Se a regra ou a
 * fonte mudar, estes numeros mudam junto e o teste avisa: e o canario E1.
 */
export const CBMERJ_2021_BASELINE = {
  positions: 3,
  combatente: {
    portugues: { periodSegments: 10, publishedLabels: 6, freeUnits: 5, publishedUnits: 11, derivedTerms: 27 },
    matematica: { periodSegments: 1, publishedLabels: 4, labelsWithoutCopula: 1, freeUnits: 0, derivedTerms: 22 },
    raciocinioLogico: { periodSegments: 8, publishedLabels: 1, freeUnits: 7 },
  },
  tecnico: {
    portugues: { periodSegments: 10, publishedLabels: 6, freeUnits: 5 },
    matematica: { periodSegments: 1, publishedLabels: 4, labelsWithoutCopula: 1, derivedTerms: 22 },
    especificos: { periodSegments: 29, publishedLabels: 6, freeUnits: 23 },
    raciocinioLogicoPresent: false,
  },
  guardaVidas: {
    portugues: { periodSegments: 10, publishedLabels: 6, freeUnits: 5 },
    matematica: { periodSegments: 1, publishedLabels: 4, derivedTerms: 22 },
    raciocinioLogico: { periodSegments: 8 },
  },
} as const;
