/**
 * O agente inteiro contra o edital real ja calibrado (FASE 4B, sobre a base da FASE 4).
 *
 * O ponto desta arquivo nao e repetir a medicao do probe: e provar que o fluxo do
 * CourseCatalogAgent (fonte -> extracao -> normalizacao -> casamento -> colisoes ->
 * proposta -> apply recusado) devolve exatamente a calibracao existente. Por isso a
 * referencia e recalculada no proprio teste, servico por servico, e comparada com o
 * resultado do agente; os numeros absolutos ficam em CALIBRACAO como canario de docs/27.
 *
 * Fonte: transcricao literal de docs/24 secao E, lida pela fixture da FASE 4. Nada de
 * PDF, nada de rede, nada de banco.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseCatalogAgent } from "../course-catalog-agent";
import {
  CBMERJ_2021_EXTRACTION_OPTIONS,
  CBMERJ_2021_SOURCE_LABEL,
  CBMERJ_2021_SUBJECT_ALIASES,
  CBMERJ_2021_TEXT,
} from "./cbmerj-2021.fixture";
import { validateCatalogSource } from "../../services/source-validator.service";
import { extractCatalogProgram, programCandidates } from "../../services/program-extractor.service";
import { normalizeTopics } from "../../services/topic-normalizer.service";
import { readCatalogSnapshot } from "../../services/catalog-snapshot.service";
import { countByClassification, matchTopics } from "../../services/catalog-matcher.service";
import { fakeCatalogClient } from "./fake-catalog-client";
import type { CatalogAgentRequest } from "../../types/catalog-agent";
import type { CatalogTopicMatch } from "../../types/catalog-ingestion";

/** Calibracao medida em docs/27 contra o snapshot de leitura-only de 2026-10-03. */
const CALIBRACAO = {
  candidates: 278,
  classification: {
    REUSO_CANONICO: 9,
    NOVO_CANONICO: 127,
    AMBIGUO: 0,
    BLOQUEADO: 64,
    PENDENTE_REVISAO: 78,
  },
  rules: {
    "TOPIC-01": 9,
    "TOPIC-04": 27,
    "TOPIC-05": 100,
    "TOPIC-06": 78,
    "SUBJ-03": 64,
  },
  collisionGroups: 78,
  collisionMembers: 220,
  subjects: 33,
  topics: 31,
} as const;

function request(overrides: Partial<CatalogAgentRequest> = {}): CatalogAgentRequest {
  return {
    source: {
      type: "text",
      content: CBMERJ_2021_TEXT,
      name: "anexo-vi-cbmerj-2021.txt",
      label: CBMERJ_2021_SOURCE_LABEL,
      extractor: "docs/24 transcricao literal",
      capturedAt: "2026-10-03T00:00:00.000Z",
      reviewedByHuman: true,
    },
    mode: "AUDIT",
    extraction: CBMERJ_2021_EXTRACTION_OPTIONS,
    subjectAliases: CBMERJ_2021_SUBJECT_ALIASES,
    ai: { enabled: false },
    ...overrides,
  };
}

function countByRule(matches: CatalogTopicMatch[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const match of matches) out[match.ruleApplied] = (out[match.ruleApplied] ?? 0) + 1;
  return out;
}

/** Referencia recalculada servico por servico: mesma ordem do agente, sem o agente. */
async function reference() {
  const source = await validateCatalogSource({
    kind: "inline-text",
    label: CBMERJ_2021_SOURCE_LABEL,
    text: CBMERJ_2021_TEXT,
    extractor: "docs/24 transcricao literal",
    capturedAt: "2026-10-03T00:00:00.000Z",
    reviewedByHuman: true,
  });
  const program = extractCatalogProgram(source, CBMERJ_2021_EXTRACTION_OPTIONS);
  const topics = normalizeTopics(programCandidates(program, CBMERJ_2021_EXTRACTION_OPTIONS));
  const matches = matchTopics({ topics, view: readCatalogSnapshot(), subjectAliases: CBMERJ_2021_SUBJECT_ALIASES });
  return { topics, matches, classifications: countByClassification(matches), rules: countByRule(matches) };
}

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn(async () => {
    throw new Error("rede nao permitida nesta fase");
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("agente contra o edital calibrado", () => {
  it("reproduz a calibracao medida na FASE 4", async () => {
    const analysis = await new CourseCatalogAgent().analyze(request());
    const referenceRun = await reference();
    expect(analysis.summary.topicsFound).toBe(referenceRun.topics.length);
    expect(analysis.summary.byRule).toEqual(referenceRun.rules);
    expect({
      REUSO_CANONICO: analysis.summary.reuseCatalog,
      NOVO_CANONICO: analysis.summary.newCanonical,
      AMBIGUO: analysis.summary.ambiguous,
      BLOQUEADO: analysis.summary.blocked,
      PENDENTE_REVISAO: analysis.summary.pendingReview,
    }).toEqual(referenceRun.classifications);
  });

  it("fecha os numeros absolutos de docs/27 (canario de calibracao)", async () => {
    const analysis = await new CourseCatalogAgent().analyze(request());
    expect(analysis.summary.topicsFound).toBe(CALIBRACAO.candidates);
    expect({
      REUSO_CANONICO: analysis.summary.reuseCatalog,
      NOVO_CANONICO: analysis.summary.newCanonical,
      AMBIGUO: analysis.summary.ambiguous,
      BLOQUEADO: analysis.summary.blocked,
      PENDENTE_REVISAO: analysis.summary.pendingReview,
    }).toEqual(CALIBRACAO.classification);
    expect(analysis.summary.byRule).toEqual(CALIBRACAO.rules);
    expect(analysis.summary.collisionGroups).toBe(CALIBRACAO.collisionGroups);
    expect(analysis.summary.collisionsMembers).toBe(CALIBRACAO.collisionMembers);
    expect(readCatalogSnapshot().subjects).toHaveLength(CALIBRACAO.subjects);
    expect(readCatalogSnapshot().topics).toHaveLength(CALIBRACAO.topics);
  });

  it("mantem as colisoes como diagnostico, sem fundir entrada", async () => {
    const analysis = await new CourseCatalogAgent().analyze(request());
    expect(new Set(analysis.collisions.map((item) => item.kind))).toEqual(new Set(["NORMALIZED_NAME"]));
    expect(analysis.collisions.every((item) => item.deduplicated === false)).toBe(true);
    expect(analysis.collisions.every((item) => item.discardedEntries === 0)).toBe(true);
    expect(analysis.summary.topicsFound).toBe(CALIBRACAO.candidates);
  });

  it("resolve assunto pelo alias declarado e bloqueia o que nao tem linha canonica", async () => {
    const analysis = await new CourseCatalogAgent().analyze(request());
    const portugues = analysis.subjects.filter((item) => item.publishedName === "L\u00EDngua Portuguesa");
    expect(portugues.length).toBe(3);
    expect(portugues.every((item) => item.aliasApplied)).toBe(true);
    expect(new Set(portugues.map((item) => item.canonicalSubjectName))).toEqual(new Set(["Portugu\u00EAs"]));
    const especificos = analysis.subjects.filter((item) => item.publishedName === "Conhecimentos Espec\u00EDficos");
    expect(especificos).toHaveLength(1);
    expect(especificos[0]?.classification).toBe("BLOQUEADO");
    expect(especificos[0]?.canonicalSubjectId).toBeNull();
  });

  it("proposta de IA nao move nenhuma classificacao da calibracao", async () => {
    const baseline = await new CourseCatalogAgent().analyze(request());
    const analysis = await new CourseCatalogAgent({ aiClient: fakeCatalogClient(0.7) }).analyze(
      request({ ai: { enabled: true, provider: "deepseek", maxCandidates: 300 } })
    );
    expect(analysis.aiProposal.proposals.length).toBeGreaterThan(0);
    expect(analysis.topics.map((item) => item.classification)).toEqual(baseline.topics.map((item) => item.classification));
    expect(analysis.summary.byRule).toEqual(CALIBRACAO.rules);
    expect(analysis.summary.newCanonical).toBe(baseline.summary.newCanonical);
  });

  it("APPLY continua recusado em CBMERJ tambem", async () => {
    const analysis = await new CourseCatalogAgent().analyze(request({ mode: "APPLY" }));
    expect(analysis.applyStatus).toBe("BLOCKED");
    expect(analysis.apply.code).toBe("APPLY_DISABLED_IN_AUDIT_PHASE");
    expect(analysis.apply.databaseOperations).toEqual([]);
    expect(analysis.apply.refusedBypassFlags).toEqual(["mode"]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("gera relatorio humano com o resumo da calibracao", async () => {
    const analysis = await new CourseCatalogAgent().analyze(request());
    expect(analysis.report).toContain("Reuso: 9");
    expect(analysis.report).toContain("Novos: 127");
    expect(analysis.report).toContain("Revisao: 78");
    expect(analysis.report).toContain("Bloqueados: 64");
    expect(analysis.report).toContain("Ambiguos: 0");
    expect(analysis.report).toContain("APPLY:");
    expect(analysis.report).toContain("BLOQUEADO");
  });
});