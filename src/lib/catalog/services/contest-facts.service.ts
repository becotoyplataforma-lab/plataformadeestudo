/**
 * ContestFactsService (FASE 4B) - fatos de edital, separados de interpretacao.
 *
 * O plano exige distinguir SOURCE_FACT de AI_INTERPRETATION e de
 * DETERMINISTIC_MAPPING. Aqui so nasce SOURCE_FACT: todo valor guarda o trecho
 * publicado, o offset e a pagina de onde foi medido. Valor declarado pelo caller
 * entra como DETERMINISTIC_MAPPING (origem INTERPRETATION/MAPPING) e jamais como
 * publicado. Campo ausente fica em `missingFields`: o agente nao completa edital e
 * nao inventa banca, orgao, vaga ou peso.
 *
 * Nenhum texto e reescrito: os rotulos continuam literais na fonte.
 */
import "server-only";
import { deannotatePages, findPhraseOccurrences, pageForOffset } from "./program-extractor.service";
import type {
  CatalogContestFact,
  CatalogContestField,
  CatalogContestProfile,
  CatalogAgentContestInput,
} from "../types/catalog-agent";

import { slugifyTopic } from "@/lib/knowledge/services/topic-resolver.service";

/** Campos que o agente sabe medir na fonte. */
export const CONTEST_FACT_FIELDS: readonly CatalogContestField[] = [
  "contest_name",
  "organ",
  "board",
  "position",
  "level",
  "vacancies",
  "questions",
  "exam_date",
  "weight",
];

interface FactPattern {
  field: CatalogContestField;
  rule: string;
  re: RegExp;
  /** Grupo do valor publicado. */
  group: number;
}

/**
 * Padroes rotulados: a ancora ("Banca:", "Vagas:") e publicada no edital, entao a
 * correspondencia e um fato medido, nao uma leitura do sentido. Sem ancora, nao ha
 * fato: o campo entra em `missingFields`.
 */
export const CONTEST_FACT_PATTERNS: FactPattern[] = [
  { field: "board", rule: "CONTEST-01", re: /banca\s*(?:organizadora\s*)?[:\-]\s*([^\n.;]{2,120})/gi, group: 1 },
  { field: "organ", rule: "CONTEST-02", re: /[o\u00F3]rg[a\u00E3]o\s*(?:estatal|p[u\u00FA]blico)?\s*[:\-]\s*([^\n.;]{2,120})/gi, group: 1 },
  { field: "level", rule: "CONTEST-03", re: /n[íi]vel\s+(?:de\s+)?(?:escolaridade|instru[çc][ãa]o)\s*[:\-]\s*([^\n.;]{2,60})/gi, group: 1 },
  { field: "vacancies", rule: "CONTEST-04", re: /(?:total\s+de\s+)?vagas?\s*[:\-]\s*([\d.]+)/gi, group: 1 },
  { field: "questions", rule: "CONTEST-05", re: /(?:quantidade|n[úu]mero)\s+de\s+quest[õo]es\s*[:\-]\s*(\d{1,4})/gi, group: 1 },
  { field: "exam_date", rule: "CONTEST-06", re: /data\s+(?:prov[áa]vel\s+)?d[ae]\s+(?:a\s+)?prova\s*[:\-]\s*(\d{1,2}\/\d{1,2}\/\d{2,4})/gi, group: 1 },
  { field: "contest_name", rule: "CONTEST-07", re: /concurso\s+p[u\u00FA]blico\s*[:\-]\s*([^\n.;]{3,140})/gi, group: 1 },
  { field: "contest_name", rule: "CONTEST-07", re: /concurso\s+(?:p[u\u00FA]blico\s+)?(?:para|de)\s+([^\n.;]{3,140})/gi, group: 1 },
  { field: "position", rule: "CONTEST-08", re: /cargos?\s*[:\-]\s*([^\n.;]{2,120})/gi, group: 1 },
];

/**
 * Peso por disciplina: medido na MESMA linha em que o nome publicado aparece, na
 * distancia de leitura de uma tabela de prova. Numa linha do conteudo programatico
 * sem peso, nada casca: peso nao se deduz do numero de topicos.
 */
export const WEIGHT_SCAN_WINDOW = 200;
export const WEIGHT_FACT_PATTERNS: FactPattern[] = [
  { field: "weight", rule: "CONTEST-09", re: /peso\s*(?:espec[íi]fico)?\s*[:\-]?\s*\(?\s*(\d{1,3})\s*(?:%|pontos?)?\)?/i, group: 1 },
  { field: "weight", rule: "CONTEST-10", re: /\(?\s*(\d{1,3})\s*(?:%|quest[õo]es)\s*\)?/i, group: 1 },
];

const DECLARED_RULE = "CONTEST-DECLARED-01";

export interface ContestFactsInput {
  /** Texto validado; marcadores de pagina sao tratados como no extrator da FASE 4. */
  text: string;
  /** Cabecalhos publicados ja conhecidos (vem do programa extraido, nada e inferido). */
  disciplineNames?: string[];
  /** Titulos de cargo publicados declarados pelo caller/fixture. */
  positionTitles?: string[];
  /** Metadados declarados: entram como mapeamento, nunca como publicacao. */
  declared?: CatalogAgentContestInput;
}

function cleanValue(raw: string): string {
  return raw.replace(/\s+/g, " ").replace(/[.;,]+$/, "").trim();
}

function factId(field: CatalogContestField, value: string, rule: string, start: number): string {
  return ["FACT", field, rule, slugifyTopic(value).slice(0, 32) || "vazio", String(start).padStart(6, "0")].join("-");
}

function numberValue(value: string): number | null {
  const parsed = Number(value.replace(/\./g, "").replace(/,/g, "."));
  return Number.isFinite(parsed) ? parsed : null;
}

/** Ate o fim da linha publicada, onde o edital escreve peso, percentual ou questoes. */
function lineWindow(text: string, start: number): string {
  const lineEnd = text.indexOf("\n", start);
  const end = lineEnd === -1 ? text.length : lineEnd;
  return text.slice(start, Math.min(end, start + WEIGHT_SCAN_WINDOW));
}

export function extractContestFacts(input: ContestFactsInput): CatalogContestFact[] {
  const clean = deannotatePages(input.text ?? "");
  const text = clean.text;
  const facts: CatalogContestFact[] = [];
  const seen = new Set<string>();

  // Dedupe por campo + ambito: dois pesos iguais em disciplinas diferentes sao
  // dois fatos publicados, nao um duplicado.
  const push = (fact: CatalogContestFact): void => {
    const dedupe = [fact.field, fact.disciplineName ?? "", fact.value.toLowerCase()].join("|");
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    facts.push(fact);
  };

  for (const pattern of CONTEST_FACT_PATTERNS) {
    for (const match of text.matchAll(pattern.re)) {
      const value = cleanValue(match[pattern.group] ?? "");
      if (value.length === 0) continue;
      const start = match.index ?? 0;
      const published = cleanValue(match[0]);
      push({
        factId: factId(pattern.field, value, pattern.rule, start),
        field: pattern.field,
        value,
        evidence: "SOURCE_FACT",
        origin: "PUBLISHED_LABEL",
        rule: pattern.rule,
        publishedText: published,
        excerpt: published,
        start,
        end: start + match[0].length,
        page: pageForOffset(clean.boundaries, start),
      });
    }
  }

  // Cargo publicado como titulo de grupo do programa: a ancora e a propria linha.
  for (const occurrence of findPhraseOccurrences(text, input.positionTitles ?? [])) {
    const value = cleanValue(occurrence.phrase);
    if (value.length === 0) continue;
    push({
      factId: factId("position", value, "CONTEST-11", occurrence.start),
      field: "position",
      value,
      evidence: "SOURCE_FACT",
      origin: "PUBLISHED_LABEL",
      rule: "CONTEST-11",
      publishedText: value,
      excerpt: value,
      start: occurrence.start,
      end: occurrence.end,
      page: pageForOffset(clean.boundaries, occurrence.start),
    });
  }

  // Peso: na linha do nome publicado, nunca redistribuido a partir de topico.
  for (const occurrence of findPhraseOccurrences(text, input.disciplineNames ?? [])) {
    const window = lineWindow(text, occurrence.start);
    const disciplineName = cleanValue(occurrence.phrase);
    for (const pattern of WEIGHT_FACT_PATTERNS) {
      const match = window.match(pattern.re);
      if (!match) continue;
      const value = cleanValue(match[pattern.group] ?? "");
      if (value.length === 0) continue;
      const offset = occurrence.start + (match.index ?? 0);
      push({
        factId: factId("weight", value, pattern.rule, offset),
        field: "weight",
        value,
        evidence: "SOURCE_FACT",
        origin: "PUBLISHED_LABEL",
        rule: pattern.rule,
        publishedText: cleanValue(window),
        excerpt: cleanValue(window),
        start: offset,
        end: offset + match[0].length,
        page: pageForOffset(clean.boundaries, offset),
        disciplineName,
      });
      break;
    }
  }

  // Declaracoes do caller, sempre por baixo dos fatos publicados.
  const declaredFields: Array<[CatalogContestField, string | undefined]> = [
    ["contest_name", input.declared?.name],
    ["board", input.declared?.board],
    ["organ", input.declared?.organ],
    ["position", input.declared?.position],
    ["level", input.declared?.level],
  ];
  for (const [field, value] of declaredFields) {
    const declaredValue = cleanValue(value ?? "");
    if (declaredValue.length === 0) continue;
    push({
      factId: factId(field, declaredValue, DECLARED_RULE, -1),
      field,
      value: declaredValue,
      evidence: "DETERMINISTIC_MAPPING",
      origin: "INTERPRETATION/MAPPING",
      rule: DECLARED_RULE,
      excerpt: declaredValue,
    });
  }

  return facts.sort((a, b) => (a.start ?? 0) - (b.start ?? 0) || a.field.localeCompare(b.field));
}

/**
 * Perfil do concurso a partir dos fatos. O primeiro fato publicado vence; um valor
 * declarado so preenche campo sem fato publicado, e a camada fica registrada no fato.
 */
export function buildContestProfile(
  facts: CatalogContestFact[]
): CatalogContestProfile {
  const profile: CatalogContestProfile = { facts, missingFields: [] };
  const firstOf = (field: CatalogContestField, evidence: CatalogContestFact["evidence"]): string | undefined =>
    facts.find((fact) => fact.field === field && fact.evidence === evidence)?.value;
  const firstPublished = (field: CatalogContestField): string | undefined =>
    firstOf(field, "SOURCE_FACT") ?? firstOf(field, "DETERMINISTIC_MAPPING");

  profile.name = firstPublished("contest_name");
  profile.organ = firstPublished("organ");
  profile.board = firstPublished("board");
  profile.position = firstPublished("position");
  profile.level = firstPublished("level");
  profile.examDate = firstPublished("exam_date");

  const vacancies = firstPublished("vacancies");
  if (vacancies !== undefined) profile.vacancies = numberValue(vacancies) ?? undefined;
  const questions = firstPublished("questions");
  if (questions !== undefined) profile.questions = numberValue(questions) ?? undefined;

  const covered = new Set<CatalogContestField>();
  for (const fact of facts) {
    if (fact.field !== "weight") covered.add(fact.field);
  }
  const scalarFields: CatalogContestField[] = ["contest_name", "organ", "board", "position", "level", "exam_date"];
  const missing: CatalogContestField[] = scalarFields.filter((field) => !covered.has(field));
  if (profile.vacancies === undefined) missing.push("vacancies");
  if (profile.questions === undefined) missing.push("questions");
  if (facts.every((fact) => fact.field !== "weight")) missing.push("weight");
  profile.missingFields = missing;
  return profile;
}