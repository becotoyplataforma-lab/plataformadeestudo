/**
 * CatalogProgramExtractor (FASE 4) - segmentacao deterministica do programa.
 *
 * Regras fixas (docs/24 F.2), todas declaradas, nenhuma inferencia:
 *   PERIOD-PONTO-FINAL-MAIS-ESPACO   -> um periodo termina em ponto seguido de espaco
 *   LABEL-COPULA-PUBLICADA           -> "Rotulo:" no comeco de um periodo ou clausula
 *   LABEL-VOCABULARIO-DECLARADO      -> rotulo sem copula, somente se declarado
 *   FREE-PERIOD-SEM-ROTULO           -> periodo inteiro que nao carrega rotulo
 *   TERM-SEPARATOR-VIRGULA-OU-PONTO  -> termos DERIVED dentro do desenvolvimento
 * O que a fonte nao separa, o extrator nao separa: medidas divergentes viram aviso.
 */
import "server-only";
import {
  slugifyTopic,
} from "@/lib/knowledge/services/topic-resolver.service";
import type {
  CatalogDisciplineProgram,
  CatalogExtractionOptions,
  CatalogExtractionWarning,
  CatalogFreeUnit,
  CatalogLabelUnit,
  CatalogPositionProgram,
  CatalogProgram,
  CatalogProgramMeasurement,
  CatalogTermUnit,
  CatalogTopicCandidateInput,
  CatalogValidatedSource,
} from "../types/catalog-ingestion";

/** Cláusula de um período, separada por ponto e vírgula, com offsets no texto limpo. */
export interface Clause {
  text: string;
  start: number;
  end: number;
}

/** Ancorouro de rotulo: nome publicado e onde comeca o desenvolvimento. */
export interface LabelAnchor {
  name: string;
  copulaPublished: boolean;
  start: number;
  developmentStart: number;
  end: number;
}

export interface PhraseOccurrence {
  phrase: string;
  start: number;
  end: number;
}

const MAX_LABEL_NAME = 60;
/** Copula publicada: nome capitalizado de ate 60 caracteres no inicio da clausula. */
const COPULA_RE = /^([A-Z\u00C0-\u0178][^.;:]{1,58}?):(\s|$)/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Palavras unidas pelo espacamento do extrator: duplo espaco nao quebra a ancora. */
function phrasePattern(phrase: string): string {
  return phrase
    .split(/\s+/)
    .filter((word) => word.length !== 0)
    .map(escapeRegExp)
    .join("[\\s\\u00a0]+");
}

/**
 * Ocorrencias exatas de frases publicadas (titulo de cargo, cabecalho de
 * disciplina, rotulo sem copula). Nada e normalizado de forma criativa: so bate
 * o que esta escrito no texto da fonte.
 */
export function findPhraseOccurrences(text: string, phrases: string[]): PhraseOccurrence[] {
  const out: PhraseOccurrence[] = [];
  for (const phrase of phrases) {
    if (phrase.trim().length === 0) continue;
    const pattern = new RegExp(phrasePattern(phrase), "g");
    let match: RegExpExecArray | null = pattern.exec(text);
    while (match !== null) {
      out.push({ phrase, start: match.index, end: match.index + match[0].length });
      match = pattern.exec(text);
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function excerptOf(text: string, start: number, end: number): string {
  const from = Math.max(0, start - 30);
  const to = Math.min(text.length, end + 30);
  return text.slice(from, to).replace(/\s+/g, " ").trim();
}

/** Divide o span de um periodo em clausulas por ponto e virgula, preservando offsets. */
export function splitClauses(text: string, start: number, end: number): Clause[] {
  const span = text.slice(start, end);
  const out: Clause[] = [];
  let from = 0;
  for (let i = 0; i <= span.length; i++) {
    const isEnd = i === span.length;
    if (!isEnd && span[i] !== ";") continue;
    const raw = span.slice(from, i);
    const value = raw.trim();
    if (value.length !== 0) {
      const lead = raw.length - raw.replace(/^\s+/, "").length;
      out.push({
        text: value,
        start: start + from + lead,
        end: start + from + lead + value.length,
      });
    }
    from = i + 1;
  }
  return out;
}

/**
 * Ancora de rotulo em uma clausula: copula publicada ("Nome:") ou nome do
 * labelVocabulary declarado sem copula (caso "Estatistica e Probabilidade" de
 * docs/24 secao E). Devolver null nunca significa inventar um rotulo.
 */
export function anchorOfClause(clause: Clause, vocabulary: string[]): LabelAnchor | null {
  const copula = COPULA_RE.exec(clause.text);
  if (copula && copula[1]) {
    const name = copula[1].trim();
    if (name.length === 0 || MAX_LABEL_NAME < name.length) return null;
    return {
      name,
      copulaPublished: true,
      start: clause.start,
      developmentStart: clause.start + copula[0].length,
      end: clause.end,
    };
  }
  for (const declared of vocabulary) {
    if (declared.length === 0 || MAX_LABEL_NAME < declared.length) continue;
    const pattern = new RegExp("^(" + phrasePattern(declared) + ")(?![\\w])");
    const match = pattern.exec(clause.text);
    if (!match) continue;
    return {
      name: declared,
      copulaPublished: false,
      start: clause.start,
      developmentStart: clause.start + match[0].length,
      end: clause.end,
    };
  }
  return null;
}

/** Termos derivados de um desenvolvimento: virgula ou ponto e virgula (docs/24 F.2). */
export function splitTerms(text: string, start: number, end: number): CatalogTermUnit[] {
  const span = text.slice(start, end);
  const out: CatalogTermUnit[] = [];
  let from = 0;
  for (let i = 0; i <= span.length; i++) {
    const isEnd = i === span.length;
    if (!isEnd && span[i] !== "," && span[i] !== ";") continue;
    const raw = span.slice(from, i);
    const value = raw.replace(/\s+/g, " ").trim().replace(/\.$/, "");
    if (value.length !== 0) {
      const lead = raw.length - raw.replace(/^\s+/, "").length;
      out.push({
        text: value,
        origin: "DERIVED",
        derivationRule: "TERM-SEPARATOR-VIRGULA-OU-PONTO-E-VIRGULA",
        start: start + from + lead,
        end: start + from + lead + value.length,
      });
    }
    from = i + 1;
  }
  return out;
}

/** Marcador de pagina inserido pela captura (docs/24 secao E, nota 1). */
const MARKER_ONLY = /^[ \t]*={4,6} PAGE \d+ ={4,6}[ \t]*$/gm;

export interface CleanText {
  /** Texto sem marcadores de pagina (duplo espaco do PDF preservado). */
  text: string;
  /** Fronteiras de pagina em offsets do texto limpo. */
  boundaries: Array<{ offset: number; page: number }>;
  markersRemoved: number;
}

/**
 * Remove os marcadores preservando a palavra cortada pela quebra de pagina
 * (nota 4 da secao E de docs/24) e devolve as fronteiras de pagina em offsets do
 * texto limpo. Nenhum conteudo publicado e reescrito aqui.
 */
export function deannotatePages(annotated: string): CleanText {
  const pattern = new RegExp(MARKER_ONLY.source, "gm");
  const boundaries: Array<{ offset: number; page: number }> = [];
  let text = "";
  let cursor = 0;
  let markersRemoved = 0;
  let match: RegExpExecArray | null = pattern.exec(annotated);
  while (match !== null) {
    markersRemoved += 1;
    const chunk = annotated.slice(cursor, match.index);
    const after = annotated.slice(match.index + match[0].length);
    const swallowed = after.replace(/^[ \r\n\t]+/, "");
    const skipped = after.length - swallowed.length;
    const before = chunk.length === 0 ? "" : chunk[chunk.length - 1];
    const next = swallowed.length === 0 ? "" : swallowed[0];
    const wordCut = before.length !== 0 && next.length !== 0 && !/^\s$/.test(before) && !/^\s$/.test(next);
    text += wordCut ? chunk : chunk.replace(/[ \r\n\t]+$/, "");
    if (!wordCut) text += " ";
    boundaries.push({ offset: text.length, page: Number(match[1]) });
    cursor = match.index + match[0].length + skipped;
    match = pattern.exec(annotated);
  }
  text += annotated.slice(cursor);
  return { text, boundaries, markersRemoved };
}

/** Pagina de origem de um offset, a partir das fronteiras da captura. */
export function pageForOffset(
  boundaries: Array<{ offset: number; page: number }>,
  offset: number
): number | undefined {
  let page: number | undefined;
  for (const boundary of boundaries) {
    if (offset >= boundary.offset) page = boundary.page;
    else break;
  }
  return page;
}

export interface PeriodSegment {
  text: string;
  start: number;
  end: number;
}

/** Segmentacao por periodo: ponto final seguido de espaco ou fim de bloco (docs/24 F.2). */
export function splitPeriods(body: string, offset = 0): PeriodSegment[] {
  const segments: PeriodSegment[] = [];
  let cursor = 0;
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== ".") continue;
    const next = body[i + 1];
    if (next !== undefined && !/^\s$/.test(next)) continue;
    const raw = body.slice(cursor, i + 1);
    const value = raw.trim();
    if (value.length !== 0) {
      const lead = raw.length - raw.replace(/^\s+/, "").length;
      segments.push({ text: value, start: offset + cursor + lead, end: offset + cursor + raw.trimEnd().length });
    }
    cursor = i + 1;
  }
  const tailRaw = body.slice(cursor);
  const tail = tailRaw.trim();
  if (tail.length !== 0) {
    const lead = tailRaw.length - tailRaw.replace(/^\s+/, "").length;
    segments.push({ text: tail, start: offset + cursor + lead, end: offset + cursor + tailRaw.trimEnd().length });
  }
  return segments;
}

interface DisciplineBuildResult {
  discipline: CatalogDisciplineProgram;
  measurement: CatalogProgramMeasurement;
  warnings: CatalogExtractionWarning[];
}

function seq(id: string, index: number): string {
  return id + "-" + String(index + 1).padStart(2, "0");
}

/** Monta uma disciplina a partir de um span do texto limpo (docs/24 F.2). */
export function buildDiscipline(input: {
  text: string;
  positionSlug: string;
  publishedName: string;
  nameOrigin: CatalogDisciplineProgram["nameOrigin"];
  start: number;
  end: number;
  boundaries: Array<{ offset: number; page: number }>;
  labelVocabulary: string[];
  includeDerivedTerms: boolean;
}): DisciplineBuildResult {
  const { text, publishedName, start, end, boundaries } = input;
  const warnings: CatalogExtractionWarning[] = [];
  const disciplineSlug = slugifyTopic(publishedName) || "sem-nome";
  const disciplineId = "DIS-" + input.positionSlug + "-" + disciplineSlug;
  const periods = splitPeriods(text.slice(start, end), start);
  const labels: CatalogLabelUnit[] = [];
  const freeUnits: CatalogFreeUnit[] = [];

  for (const period of periods) {
    const clauses = splitClauses(text, period.start, period.end);
    let current: { anchor: LabelAnchor; devEnd: number } | null = null;
    let prefixStart: number | null = null;
    let prefixEnd: number | null = null;

    for (const clause of clauses) {
      const anchor = anchorOfClause(clause, input.labelVocabulary);
      if (anchor) {
        if (current) {
          labels.push(finishLabel(text, disciplineId, labels.length, current, boundaries, input.includeDerivedTerms));
        }
        if (prefixStart !== null && prefixEnd !== null && prefixStart < prefixEnd) {
          freeUnits.push(
            freeUnitOf(text, disciplineId, freeUnits.length, prefixStart, prefixEnd, boundaries, "FREE-PERIOD-ANTES-DE-ROTULO")
          );
        }
        prefixStart = null;
        prefixEnd = null;
        current = { anchor, devEnd: clause.end };
        continue;
      }
      if (current) current.devEnd = clause.end;
      else {
        if (prefixStart === null) prefixStart = clause.start;
        prefixEnd = clause.end;
      }
    }

    if (current) {
      labels.push(finishLabel(text, disciplineId, labels.length, current, boundaries, input.includeDerivedTerms));
      continue;
    }
    if (clauses.length === 0) continue;
    freeUnits.push(freeUnitOf(text, disciplineId, freeUnits.length, period.start, period.end, boundaries, "FREE-PERIOD-SEM-ROTULO"));
  }

  const labelsWithoutCopula = labels.filter((label) => !label.copulaPublished).length;
  const derivedTerms = labels.reduce((total, label) => total + label.terms.length, 0);
  const measurement: CatalogProgramMeasurement = {
    positionTitle: input.positionSlug,
    disciplineName: publishedName,
    periodSegments: periods.length,
    publishedLabels: labels.length,
    labelsWithoutCopula,
    freeUnits: freeUnits.length,
    publishedUnits: labels.length + freeUnits.length,
    derivedTerms,
    rules: [
      "PERIOD-PONTO-FINAL-MAIS-ESPACO",
      "LABEL-COPULA-PUBLICADA",
      "LABEL-VOCABULARIO-DECLARADO",
      "FREE-PERIOD-SEM-ROTULO",
      "TERM-SEPARATOR-VIRGULA-OU-PONTO",
    ],
  };

  if (labelsWithoutCopula !== 0) {
    warnings.push({
      code: "SOURCE_LABEL_AMBIGUITY",
      message:
        "Rotulo publicado sem dois-pontos: a contagem depende do vocabulario declarado, nao da pontuacao da fonte.",
      disciplineName: publishedName,
      measured: labelsWithoutCopula,
      rule: "LABEL-VOCABULARIO-DECLARADO",
    });
  }
  if (labels.length === 0 && 2 < periods.length) {
    warnings.push({
      code: "PROSE_BLOCK_NOT_DECOMPOSED",
      message:
        "Bloco discursivo sem rotulo publicado: permanece como unidade inteira, sem decomposicao inventada.",
      disciplineName: publishedName,
      measured: periods.length,
      rule: "FREE-PERIOD-SEM-ROTULO",
    });
  }

  return {
    discipline: {
      disciplineId,
      publishedName,
      nameOrigin: input.nameOrigin,
      page: pageForOffset(boundaries, start),
      start,
      end,
      excerpt: excerptOf(text, start, end),
      periodSegments: periods.length,
      labels,
      freeUnits,
    },
    measurement,
    warnings,
  };
}

function finishLabel(
  text: string,
  disciplineId: string,
  index: number,
  state: { anchor: LabelAnchor; devEnd: number },
  boundaries: Array<{ offset: number; page: number }>,
  includeDerivedTerms: boolean
): CatalogLabelUnit {
  const anchor = state.anchor;
  const terms = includeDerivedTerms ? splitTerms(text, anchor.developmentStart, state.devEnd) : [];
  return {
    labelId: seq(disciplineId + "-LAB", index),
    name: anchor.name,
    origin: "PUBLISHED_LABEL",
    derivationRule: anchor.copulaPublished ? "LABEL-COPULA-PUBLICADA" : "LABEL-VOCABULARIO-DECLARADO",
    copulaPublished: anchor.copulaPublished,
    page: pageForOffset(boundaries, anchor.start),
    start: anchor.start,
    end: state.devEnd,
    excerpt: excerptOf(text, anchor.start, state.devEnd),
    terms,
  };
}

function freeUnitOf(
  text: string,
  disciplineId: string,
  index: number,
  start: number,
  end: number,
  boundaries: Array<{ offset: number; page: number }>,
  derivationRule: string
): CatalogFreeUnit {
  return {
    unitId: seq(disciplineId + "-FRE", index),
    text: text.slice(start, end).replace(/\s+/g, " ").trim(),
    origin: "PUBLISHED_BLOCK",
    derivationRule,
    page: pageForOffset(boundaries, start),
    start,
    end,
    excerpt: excerptOf(text, start, end),
  };
}

function buildPositionProgram(input: {
  text: string;
  boundaries: Array<{ offset: number; page: number }>;
  publishedTitle: string;
  titleOrigin: CatalogPositionProgram["titleOrigin"];
  start: number;
  end: number;
  vocabulary: string[];
  labelVocabulary: string[];
  includeDerivedTerms: boolean;
  warnings: CatalogExtractionWarning[];
  measurements: CatalogProgramMeasurement[];
}): CatalogPositionProgram {
  const { text, boundaries, warnings, measurements } = input;
  const positionSlug = slugifyTopic(input.publishedTitle).slice(0, 40) || "cargo";
  const id = "POS-" + positionSlug;
  const anchors: PhraseOccurrence[] = [];
  let cursor = input.start;
  for (const occurrence of findPhraseOccurrences(text, input.vocabulary)) {
    if (occurrence.start < cursor || occurrence.start >= input.end) continue;
    anchors.push(occurrence);
    cursor = occurrence.end;
  }
  const disciplines: CatalogDisciplineProgram[] = [];
  if (anchors.length === 0) {
    warnings.push({
      code: "DISCIPLINE_VOCABULARY_LIMITATION",
      message: "Nenhum cabecalho de disciplina publicado no trecho: sem vocabulario declarado o texto nao vira topico.",
      positionTitle: input.publishedTitle,
      measured: text.slice(input.start, input.end).trim().length,
      rule: "DISCIPLINE-ANCHOR-EXATO",
    });
    return {
      positionId: id,
      publishedTitle: input.publishedTitle,
      titleOrigin: input.titleOrigin,
      page: pageForOffset(boundaries, input.start),
      start: input.start,
      end: input.end,
      disciplines,
    };
  }
  anchors.forEach((anchor, index) => {
    const next = anchors[index + 1];
    const bodyStart = anchor.end;
    const bodyEnd = next ? next.start : input.end;
    if (bodyEnd <= bodyStart) return;
    const built = buildDiscipline({
      text,
      positionSlug,
      publishedName: anchor.phrase,
      nameOrigin: "PUBLISHED_LABEL",
      start: bodyStart,
      end: bodyEnd,
      boundaries,
      labelVocabulary: input.labelVocabulary,
      includeDerivedTerms: input.includeDerivedTerms,
    });
    built.measurement.positionTitle = input.publishedTitle;
    disciplines.push(built.discipline);
    measurements.push(built.measurement);
    for (const warning of built.warnings) {
      warning.positionTitle = input.publishedTitle;
      warnings.push(warning);
    }
  });
  return {
    positionId: id,
    publishedTitle: input.publishedTitle,
    titleOrigin: input.titleOrigin,
    page: pageForOffset(boundaries, input.start),
    start: input.start,
    end: input.end,
    disciplines,
  };
}

/** Segmentacao deterministica do programa publicado (docs/24 F.2). */
export function extractCatalogProgram(
  source: CatalogValidatedSource,
  options: CatalogExtractionOptions = {}
): CatalogProgram {
  const warnings: CatalogExtractionWarning[] = [];
  const measurements: CatalogProgramMeasurement[] = [];
  const clean = deannotatePages(source.text);
  const text = clean.text;
  if (clean.markersRemoved !== 0) {
    warnings.push({
      code: "PAGE_MARKERS_PRESERVED",
      message: "Marcadores de pagina sao artefato da captura: ficam na proveniencia, saem da analise.",
      measured: clean.markersRemoved,
      rule: "PAGE-MARKER-CAPTURE-ARTIFACT",
    });
  }
  const vocabulary = (options.disciplineVocabulary ?? []).filter((item) => item.trim().length !== 0);
  const labelVocabulary = (options.labelVocabulary ?? []).filter((item) => item.trim().length !== 0);
  const includeDerivedTerms = options.includeDerivedTerms === true;
  const titles = (options.positionTitles ?? []).filter((item) => item.trim().length !== 0);
  const occurrences = findPhraseOccurrences(text, titles);

  /**
   * Um cargo publicado pode aparecer em mais de uma linha de titulo (docs/24 I.5:
   * Tecnico de Enfermagem Hospitalar/Ambulatorial e Socorrista). Ancora que nao
   * introduce disciplina nenhuma nao vira cargo separado: ela abre o grupo do
   * proximo cargo com conteudo, e o texto do titulo permanece dentro do proprio
   * grupo, nunca no bloco do cargo anterior.
   */
  const groups: Array<{ first: PhraseOccurrence; bodyEnd: number }> = [];
  let pending: PhraseOccurrence | null = null;
  occurrences.forEach((occurrence, index) => {
    const next = occurrences[index + 1];
    const sliceEnd = next ? next.start : text.length;
    const hasAnchor = findPhraseOccurrences(text.slice(occurrence.end, sliceEnd), vocabulary).length !== 0;
    if (!hasAnchor) {
      if (pending === null) pending = occurrence;
      return;
    }
    const first = pending ?? occurrence;
    if (groups.length !== 0) groups[groups.length - 1].bodyEnd = first.start;
    groups.push({ first, bodyEnd: text.length });
    pending = null;
  });

  const positions: CatalogPositionProgram[] = [];

  if (groups.length === 0) {
    if (titles.length !== 0) {
      warnings.push({
        code: "POSITION_TITLE_INFERRED",
        message:
          "Titulo declarado mas nenhuma disciplina publicada atras dele: o bloco inteiro e tratado como um cargo rotulado pela fonte.",
        rule: "POSITION-ANCHOR-EXATO",
      });
    }
    positions.push(
      buildPositionProgram({
        text,
        boundaries: clean.boundaries,
        publishedTitle: source.provenance.label,
        titleOrigin: "INTERPRETATION/MAPPING",
        start: 0,
        end: text.length,
        vocabulary,
        labelVocabulary,
        includeDerivedTerms,
        warnings,
        measurements,
      })
    );
  } else {
    for (const group of groups) {
      positions.push(
        buildPositionProgram({
          text,
          boundaries: clean.boundaries,
          publishedTitle: group.first.phrase,
          titleOrigin: "PUBLISHED_LABEL",
          start: group.first.end,
          end: group.bodyEnd,
          vocabulary,
          labelVocabulary,
          includeDerivedTerms,
          warnings,
          measurements,
        })
      );
    }
  }

  for (const expected of options.expectedMeasurements ?? []) {
    const rows = measurements.filter((row) => row.disciplineName === expected.disciplineName);
    for (const row of rows) {
      const checks: Array<{ label: string; expected?: number; measured: number }> = [
        { label: "periodSegments", expected: expected.periodSegments, measured: row.periodSegments },
        { label: "publishedLabels", expected: expected.publishedLabels, measured: row.publishedLabels },
        { label: "freeUnits", expected: expected.freeUnits, measured: row.freeUnits },
        { label: "terms", expected: expected.terms, measured: row.derivedTerms },
      ];
      for (const check of checks) {
        if (check.expected === undefined || check.expected === check.measured) continue;
        warnings.push({
          code: "MEASUREMENT_DIVERGENCE",
          message:
            "Divergencia de contagem registrada, nao corrigida: esperado " + check.expected + " contra " + check.measured + " medidos.",
          positionTitle: row.positionTitle,
          disciplineName: row.disciplineName,
          expected: check.expected,
          measured: check.measured,
          rule: "EXPECTED-" + check.label.toUpperCase(),
        });
      }
    }
  }

  const candidateCount = positions.reduce(
    (total, position) =>
      total +
      position.disciplines.reduce(
        (sub, discipline) =>
          sub + discipline.labels.length + discipline.freeUnits.length + discipline.labels.reduce((terms, label) => terms + label.terms.length, 0),
        0
      ),
    0
  );

  return { positions, measurements, warnings, candidateCount };
}

/** Candidatos a topico: rotulo, unidade livre e termo derivado, com proveniencia. */
export function programCandidates(
  program: CatalogProgram,
  options: CatalogExtractionOptions = {}
): CatalogTopicCandidateInput[] {
  const overrides = new Map((options.unitNameOverrides ?? []).map((item) => [item.unitId, item]));
  const out: CatalogTopicCandidateInput[] = [];
  for (const position of program.positions) {
    for (const discipline of position.disciplines) {
      for (const label of discipline.labels) {
        out.push({
          candidateId: label.labelId,
          rawName: label.name,
          origin: label.origin,
          derivationRule: label.derivationRule,
          positionTitle: position.publishedTitle,
          disciplineName: discipline.publishedName,
          page: label.page,
          start: label.start,
          end: label.end,
          excerpt: label.excerpt,
        });
        label.terms.forEach((term, index) => {
          out.push({
            candidateId: seq(label.labelId, index) + "-T",
            rawName: term.text,
            origin: term.origin,
            derivationRule: term.derivationRule,
            positionTitle: position.publishedTitle,
            disciplineName: discipline.publishedName,
            parentLabel: label.name,
            page: label.page,
            start: term.start,
            end: term.end,
            excerpt: label.excerpt,
          });
        });
      }
      for (const unit of discipline.freeUnits) {
        const override = overrides.get(unit.unitId);
        out.push({
          candidateId: unit.unitId,
          rawName: override ? override.name : unit.text,
          origin: override ? "INTERPRETATION/MAPPING" : unit.origin,
          derivationRule: override ? override.rule : unit.derivationRule,
          positionTitle: position.publishedTitle,
          disciplineName: discipline.publishedName,
          page: unit.page,
          start: unit.start,
          end: unit.end,
          excerpt: unit.excerpt,
        });
      }
    }
  }
  return out;
}
