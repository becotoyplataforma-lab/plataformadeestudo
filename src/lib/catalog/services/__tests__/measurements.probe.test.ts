/**
 * Medida calibrada do catalogo historico CBMERJ-2021 (docs/24, secao E).
 *
 * O arquivo nao retranscreve o edital: o fixture le a transcricao literal de
 * docs/24, entao cada numero abaixo e uma MEDIDA daquela transcricao, nao uma
 * escolha. Se a transcricao, a regra de segmentacao ou o vocabulario de assunto
 * (docs/23 #4) mudar, o numero muda aqui e o teste avisa - que e para isso que
 * ele existe. O dump em PROBE_OUT e opcional e so para inspecao humana; sem a
 * variavel o teste nao escreve em lugar nenhum.
 *
 * Origem dos valores: execugao desta medicao contra o snapshot de leitura-only
 * database/knowledge/snapshots/2026-10-03-catalogo-atual.json (33 assuntos,
 * 31 topicos).
 */
import { writeFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import {
  CBMERJ_2021_BLOCKS,
  CBMERJ_2021_EXTRACTION_OPTIONS,
  CBMERJ_2021_TEXT,
} from "../../agents/__tests__/cbmerj-2021.fixture";
import { validateCatalogSource } from "../source-validator.service";
import { extractCatalogProgram, programCandidates } from "../program-extractor.service";
import { findCatalogKeyAgreements, findCollisions, normalizeTopics } from "../topic-normalizer.service";
import { readCatalogSnapshot, type CatalogSnapshotView } from "../catalog-snapshot.service";
import { countByClassification, matchTopics } from "../catalog-matcher.service";
import { refuseCatalogApply } from "../catalog-apply.service";
import type {
  CatalogClassification,
  CatalogNormalizedTopic,
  CatalogProgram,
  CatalogProgramMeasurement,
  CatalogTopicMatch,
  CatalogValidatedSource,
} from "../../types/catalog-ingestion";
const LP = "L\u00edngua Portuguesa";
const MATEMATICA = "Matem\u00e1tica";
const RL = "Racioc\u00ednio L\u00f3gico";
const ESPECIFICOS = "Conhecimentos Espec\u00edficos";
const CANON_LP = "Portugu\u00eas";
let source: CatalogValidatedSource;
let program: CatalogProgram;
let topics: CatalogNormalizedTopic[];
let view: CatalogSnapshotView;
let matches: CatalogTopicMatch[];
beforeAll(async () => {
  source = await validateCatalogSource({
    kind: "inline-text",
    label: "CBMERJ-2021",
    text: CBMERJ_2021_TEXT,
    extractor: "docs/24 transcricao",
    reviewedByHuman: true,
  });
  program = extractCatalogProgram(source, CBMERJ_2021_EXTRACTION_OPTIONS);
  topics = normalizeTopics(programCandidates(program, CBMERJ_2021_EXTRACTION_OPTIONS));
  view = readCatalogSnapshot();
  matches = matchTopics({ topics, view });
  const out = process.env.PROBE_OUT;
  if (out) {
    writeFileSync(
      out,
      JSON.stringify(
        {
          provenance: source.provenance,
          blocks: CBMERJ_2021_BLOCKS.map((block) => ({
            id: block.block,
            pages: block.pages,
            chars: block.characters,
          })),
          measurements: program.measurements,
          warnings: program.warnings,
          candidates: topics.length,
          classifications: countByClassification(matches),
          rules: matches
            .map((row) => row.ruleApplied)
            .reduce<Record<string, number>>((acc, rule) => {
              acc[rule] = (acc[rule] ?? 0) + 1;
              return acc;
            }, {}),
          reused: matches
            .filter((row) => row.classification === "REUSO_CANONICO")
            .map((row) => ({
              disciplina: row.disciplineName,
              bruto: row.rawName,
              canonico: row.canonicalTopicName,
              assunto: row.canonicalSubjectName,
            })),
          blockedSubjects: Array.from(
            new Set(matches.filter((row) => row.classification === "BLOQUEADO").map((row) => row.disciplineName)),
          ),
          collisions: findCollisions(topics).map((item) => ({ kind: item.kind, key: item.key, ids: item.candidateIds })),
          agreements: findCatalogKeyAgreements(
            topics,
            view.topics.map((topic) => ({ id: topic.id, name: topic.name, slug: topic.slug })),
          ).map((item) => ({ kind: item.kind, key: item.key, ids: item.candidateIds })),
          snapshot: view.validation,
          apply: refuseCatalogApply(),
        },
        null,
        2,
      ),
      "utf8",
    );
  }
});
function measure(discipline: string): CatalogProgramMeasurement {
  const row = program.measurements.find((item) => item.disciplineName === discipline);
  if (!row) throw new Error("medida nao encontrada: " + discipline);
  return row;
}
function byDiscipline(discipline: string): CatalogTopicMatch[] {
  return matches.filter((row) => row.disciplineName === discipline);
}
function classifications(): Record<CatalogClassification, number> {
  return countByClassification(matches);
}
describe("fonte: transcricao literal de docs/24", () => {
  it("preserva os tres blocos e suas paginas publicadas", () => {
    expect(CBMERJ_2021_BLOCKS.map((block) => block.block)).toEqual(["E.1", "E.2", "E.3"]);
    expect(CBMERJ_2021_BLOCKS.map((block) => block.pages)).toEqual([[22, 23], [23, 24], [24, 25]]);
    expect(CBMERJ_2021_BLOCKS.map((block) => block.characters)).toEqual([3368, 3930, 3285]);
  });
  it("conta o texto medido, nao um resumo digitado", () => {
    expect(source.provenance.kind).toBe("inline-text");
    expect(source.provenance.pageCount).toBe(6);
    expect(source.provenance.characters).toBe(10585);
    expect(source.provenance.words).toBe(1289);
    expect(source.provenance.analysedTextSha256).toBe(
      "a81cb9a69239a1215b4f0f8e19d8eb91c0f359a9e2e4e78f854aec5a2afd7b41",
    );
  });
});
describe("extracao: segmentacao deterministica dos tres cargos", () => {
  it("monta as disciplinas publicadas de cada cargo", () => {
    expect(program.positions).toHaveLength(3);
    expect(program.positions.map((row) => row.disciplines.map((d) => d.publishedName))).toEqual([
      [LP, MATEMATICA, RL],
      [LP, MATEMATICA, ESPECIFICOS],
      [LP, MATEMATICA, RL],
    ]);
  });
  it("mede rotulos, periodos e unidades derivadas", () => {
    expect(measure(LP)).toMatchObject({ periodSegments: 10, publishedLabels: 6, labelsWithoutCopula: 0, freeUnits: 5, publishedUnits: 11, derivedTerms: 27 });
    expect(measure(MATEMATICA)).toMatchObject({ periodSegments: 1, publishedLabels: 4, labelsWithoutCopula: 1, freeUnits: 0, publishedUnits: 4, derivedTerms: 22 });
    expect(measure(RL)).toMatchObject({ periodSegments: 8, publishedLabels: 1, labelsWithoutCopula: 0, freeUnits: 7, publishedUnits: 8, derivedTerms: 3 });
    expect(measure(ESPECIFICOS)).toMatchObject({ periodSegments: 29, publishedLabels: 6, labelsWithoutCopula: 0, freeUnits: 23, publishedUnits: 29, derivedTerms: 35 });
  });
  it("registra o que diverge entre declarar e medir, sem silenciar", () => {
    const codes = program.warnings.map((item) => item.code);
    expect(codes.filter((code) => code === "PAGE_MARKERS_PRESERVED")).toHaveLength(1);
    expect(codes.filter((code) => code === "SOURCE_LABEL_AMBIGUITY")).toHaveLength(3);
    expect(codes.filter((code) => code === "MEASUREMENT_DIVERGENCE")).toHaveLength(3);
  });
  it("entrega 278 unidades ao normalizador", () => {
    expect(program.candidateCount).toBe(278);
    expect(topics).toHaveLength(278);
    expect(new Set(topics.map((topic) => topic.candidateId)).size).toBe(278);
  });
});
describe("normalizacao e casamento contra o snapshot", () => {
  it("resolve assunto pelo vocabulario declarado de docs/23 #4", () => {
    for (const row of byDiscipline(LP)) {
      expect(row.subjectAliasApplied).toBe(true);
      expect(row.canonicalSubjectName).toBe(CANON_LP);
    }
    for (const row of byDiscipline(RL)) {
      expect(row.subjectAliasApplied).toBe(false);
      expect(row.canonicalSubjectName).toBe(RL);
    }
  });
  it("so bloquea o assunto que ainda nao tem linha canonica", () => {
    const blocked = matches.filter((row) => row.classification === "BLOQUEADO");
    expect(blocked).toHaveLength(64);
    expect(new Set(blocked.map((row) => row.disciplineName))).toEqual(new Set([ESPECIFICOS]));
    expect(new Set(blocked.map((row) => row.ruleApplied))).toEqual(new Set(["SUBJ-03"]));
  });
  it("alcanca reuso canonicos reais do snapshot", () => {
    const reused = matches.filter((row) => row.classification === "REUSO_CANONICO");
    expect(reused).toHaveLength(9);
    expect(reused.every((row) => row.resolutionMethod === "exact")).toBe(true);
    expect(reused.map((row) => row.rawName)).toContain("Sem\u00e2ntica");
    expect(reused.every((row) => row.canonicalTopicId !== null)).toBe(true);
  });
  it("mantem fragmento derivado como PENDENTE_REVISAO, nunca como reuso", () => {
    const pending = matches.filter((row) => row.classification === "PENDENTE_REVISAO");
    expect(pending).toHaveLength(78);
    expect(pending.every((row) => row.origin === "DERIVED")).toBe(true);
    expect(pending.every((row) => row.canonicalTopicId === null)).toBe(true);
    expect(pending.every((row) => row.ruleApplied === "TOPIC-06")).toBe(true);
  });
  it("fecha a conta das classificacoes", () => {
    const counts = classifications();
    expect(counts).toEqual({
      REUSO_CANONICO: 9,
      NOVO_CANONICO: 127,
      AMBIGUO: 0,
      BLOQUEADO: 64,
      PENDENTE_REVISAO: 78,
    });
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(278);
  });
  it("enxerga a repeticao do mesmo programa entre cargos como colisao", () => {
    const collisions = findCollisions(topics);
    expect(collisions).toHaveLength(78);
    // 220 das 278 unidades estao em grupo de nome repetido: os tres cargos publicam
    // o mesmo programa, e a lista de Matemática/Raciocínio Lógico se repete entre blocos.
    expect(collisions.reduce((total, item) => total + item.candidateIds.length, 0)).toBe(220);
    expect(new Set(collisions.map((item) => item.kind))).toEqual(new Set(["NORMALIZED_NAME"]));
    expect(collisions.every((item) => item.deduplicated === false)).toBe(true);
    expect(collisions.every((item) => item.discardedEntries === 0)).toBe(true);
  });
  it("nao funde nem descarta ao comparar com as linhas canonicas", () => {
    const agreements = findCatalogKeyAgreements(topics, view.topics.map((topic) => ({ id: topic.id, name: topic.name, slug: topic.slug })));
    // Chave de catálogo completa (assunto, pai, nome, ordinal) e mais estrita que a via de
    // reuso do matcher (nome + assunto, TOPIC-01): hoje nenhum candidato fecha a chave
    // completa contra as 31 linhas canônicas do snapshot. Se a granularidade canônica
    // mudar, este numero muda e a diferenca precisa ser revista de proposito.
    expect(agreements).toHaveLength(0);
    expect(agreements.every((item) => item.deduplicated === false)).toBe(true);
    expect(agreements.every((item) => item.discardedEntries === 0)).toBe(true);
    expect(agreements.every((item) => item.candidateIds.length === 2)).toBe(true);
  });
  it("le o snapshot sem validar nada pendente", () => {
    expect(view.validation.ok).toBe(true);
    expect(view.subjects).toHaveLength(33);
    expect(view.topics).toHaveLength(31);
  });
});
describe("FASE 4 e auditoria: nenhuma escrita", () => {
  it("recusa escrita inclusive com bandeira de bypass", () => {
    const refused = refuseCatalogApply({ force: true, "skip-review": true });
    expect(refused.ok).toBe(false);
    expect(refused.applied).toBe(false);
    expect(refused.code).toBe("APPLY_DISABLED_IN_AUDIT_PHASE");
    expect(refused.databaseOperations).toEqual([]);
    expect(refused.refusedBypassFlags).toEqual(["force", "skip-review"]);
  });
});
