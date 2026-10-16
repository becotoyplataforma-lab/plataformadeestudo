/**
 * CourseCatalogAgent em AUDIT (FASE 4B) - fluxo completo de intake de novo curso.
 *
 * Cobre fonte, extracao, casamento, colisoes, proposta de IA, relatorio humano e apply
 * recusado. A invariant central da fase e testada de proposito: o DeepSeek anota, a
 * regra deterministica decide - as cinco classificacoes nao se movem quando a IA entra.
 *
 * Nada aqui abre banco, roda migracao, faz seed ou toca rede: o catalogo vem do snapshot
 * de leitura-only e o cliente de IA e um fake injetado. Os totais sao MEDIDAS desta
 * fixture (cada linha dela declara o que deve produzir), nao numeros digitados para o
 * teste passar.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CourseCatalogAgent, runCourseCatalogAudit } from "../course-catalog-agent";
import {
  NOVO_CURSO_2026_DECLARED_CONTEST,
  NOVO_CURSO_2026_EXTRACTION,
  NOVO_CURSO_2026_NAMES,
  NOVO_CURSO_2026_SOURCE,
  NOVO_CURSO_2026_TEXT,
} from "./novo-curso-2026.fixture";
import { CATALOG_SNAPSHOT_KIND, loadCatalogSnapshot, readCatalogSnapshot } from "../../services/catalog-snapshot.service";
import { detectOverreachKeys, type CatalogAiClient } from "../../services/ai-proposal.service";
import type {
  CatalogAgentAnalysis,
  CatalogAgentRequest,
  CatalogEvidenceKind,
} from "../../types/catalog-agent";

function agentRequest(overrides: Partial<CatalogAgentRequest> = {}): CatalogAgentRequest {
  return {
    source: NOVO_CURSO_2026_SOURCE,
    contest: NOVO_CURSO_2026_DECLARED_CONTEST,
    mode: "AUDIT",
    extraction: NOVO_CURSO_2026_EXTRACTION,
    ai: { enabled: false },
    ...overrides,
  };
}

type SnapshotReader = () => ReturnType<typeof loadCatalogSnapshot>;

async function analyze(
  overrides: Partial<CatalogAgentRequest> = {},
  client: CatalogAiClient | null = null,
  reader?: SnapshotReader
): Promise<CatalogAgentAnalysis> {
  return new CourseCatalogAgent({ aiClient: client, snapshotReader: reader }).analyze(agentRequest(overrides));
}

function classificationsOf(analysis: CatalogAgentAnalysis, sourceLabel: string): string[] {
  return analysis.topics.filter((item) => item.sourceLabel === sourceLabel).map((item) => item.classification);
}

function collisionKindsOf(analysis: CatalogAgentAnalysis, names: readonly string[]): string[] {
  const wanted = new Set<string>(names);
  const kinds = new Set<string>();
  for (const collision of analysis.collisions) {
    if (collision.rawNames.some((name) => wanted.has(name))) kinds.add(collision.kind);
  }
  return Array.from(kinds).sort();
}

/** Snapshot sintetico: duas linhas canonicas respondem pela mesma chave (caso AMBIGUO). */
const ambiguousSnapshotReader: SnapshotReader = () =>
  loadCatalogSnapshot({
    kind: CATALOG_SNAPSHOT_KIND,
    schema_version: 1,
    generated_at: "2026-10-03T00:00:00.000Z",
    checksum_sha256: "a".repeat(64),
    seed_compatible: false,
    destructive: false,
    data: {
      knowledge_subjects: [
        { id: "sub-portugues", name: "Portugu\u00EAs", slug: "portugues", status: "active", deleted_at: null },
      ],
      knowledge_topics: [
        { id: "top-a", subject_id: "sub-portugues", parent_topic_id: null, name: "Pontua\u00E7\u00E3o", slug: "pontuacao", status: "active", deleted_at: null },
        { id: "top-b", subject_id: "sub-portugues", parent_topic_id: null, name: "pontua\u00E7ao", slug: "pontuacao-2", status: "active", deleted_at: null },
      ],
    },
    analysis: {
      knowledge_topics_per_subject: [
        { knowledge_subject_id: "sub-portugues", name: "Portugu\u00EAs", slug: "portugues", status: "active", live: true, topics_total: 2, topics_live: 2, topics_with_parent: 0 },
      ],
    },
  });

/** Fake deterministico: nunca faz rede. Devolve JSON valido ou erro combinado. */
function fakeClient(payload: unknown, options: { throwError?: boolean } = {}): CatalogAiClient {
  return {
    provider: "deepseek",
    model: "fake-deepseek-catalog",
    async complete() {
      if (options.throwError) throw new Error("falha simulada de provedor");
      return JSON.stringify(payload);
    },
  };
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

describe("A. source validation", () => {
  it("aceita texto inline e registra a proveniencia medida", async () => {
    const analysis = await analyze();
    expect(analysis.sourceMapping.kind).toBe("inline-text");
    expect(analysis.source.format).toBe("txt");
    expect(analysis.source.characters).toBe(NOVO_CURSO_2026_TEXT.length);
    expect(analysis.source.analysedTextSha256).toHaveLength(64);
    expect(analysis.audit.validation.some((item) => item.code === "SOURCE_OK")).toBe(true);
  });

  it("recusa fonte vazia sem inventar programa", async () => {
    const analysis = await analyze({ source: { ...NOVO_CURSO_2026_SOURCE, content: "   " } });
    expect(analysis.summary.topicsFound).toBe(0);
    expect(analysis.audit.validation.some((item) => item.code === "SOURCE_EMPTY" && item.severity === "blocking")).toBe(true);
    expect(analysis.conflicts.some((item) => item.code === "SOURCE_EMPTY")).toBe(true);
  });

  it("recusa payload binario que nao e base64 validido", async () => {
    const analysis = await analyze({
      source: { ...NOVO_CURSO_2026_SOURCE, type: "pdf", name: "edital.pdf", content: "### nao e base64 ###" },
    });
    expect(analysis.sourceMapping.kind).toBe("local-file");
    expect(analysis.sourceMapping.decodedBytes).toBe(false);
    expect(analysis.audit.validation.some((item) => item.code === "SOURCE_TEXT_AND_BYTES_MISSING" && item.severity === "blocking")).toBe(true);
  });

  it("aceita bytes reais pelo contrato de formato existente", async () => {
    const analysis = await analyze({
      source: {
        ...NOVO_CURSO_2026_SOURCE,
        type: "document",
        name: "edital-novo-curso.txt",
        content: Buffer.from(NOVO_CURSO_2026_TEXT, "utf8").toString("base64"),
        mimeType: "text/plain",
        extractor: "fixture-bytes",
      },
    });
    expect(analysis.sourceMapping.decodedBytes).toBe(true);
    expect(analysis.source.extractor).toBe("fixture-bytes");
    expect(analysis.summary.topicsFound).toBeGreaterThan(0);
  });

  it("registra a URL como proveniencia e nao busca nada", async () => {
    const analysis = await analyze({
      source: {
        ...NOVO_CURSO_2026_SOURCE,
        type: "url",
        content: "",
        url: "https://web.archive.org/web/20260101000000/https://exemplo.org/edital.pdf",
      },
    });
    expect(analysis.audit.validation.some((item) => item.code === "SOURCE_URL_NOT_FETCHED")).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("B. extraction", () => {
  it("monta os dois cargos e as tres disciplinas publicadas", async () => {
    const analysis = await analyze();
    expect(analysis.summary.positions).toBe(2);
    expect(new Set(analysis.subjects.map((item) => item.publishedName))).toEqual(
      new Set([
        NOVO_CURSO_2026_NAMES.disciplinePortugues,
        NOVO_CURSO_2026_NAMES.disciplineInformatica,
        NOVO_CURSO_2026_NAMES.disciplineLegislacao,
      ])
    );
  });

  it("separa fato publicado de declaracao do caller", async () => {
    const analysis = await analyze();
    expect(analysis.contest.name).toBe("Prefeitura Municipal de Teste");
    expect(analysis.contest.board).toBe("Instituto Avaliador de Testes");
    expect(analysis.contest.organ).toBe("Secretaria Municipal de Estudos");
    expect(analysis.contest.level).toBe("M\u00E9dio");
    expect(analysis.contest.vacancies).toBe(40);
    expect(analysis.contest.questions).toBe(60);
    expect(analysis.contest.examDate).toBe("08/02/2026");
    const declared = analysis.contest.facts.filter((fact) => fact.evidence === "DETERMINISTIC_MAPPING");
    expect(declared.map((fact) => fact.value)).toContain("Banca Declarada Pelo Caller");
    expect(declared.every((fact) => fact.origin === "INTERPRETATION/MAPPING")).toBe(true);
    expect(analysis.contest.facts.every((fact) => fact.evidence !== "AI_INTERPRETATION")).toBe(true);
  });

  it("mede o peso publicado ao lado do nome da disciplina", async () => {
    const analysis = await analyze();
    const weights = analysis.contest.facts.filter((fact) => fact.field === "weight");
    expect(weights).toHaveLength(3);
    expect(weights.every((fact) => fact.evidence === "SOURCE_FACT")).toBe(true);
    expect(weights.every((fact) => fact.rule === "CONTEST-09")).toBe(true);
    const valuesByDiscipline = new Map<string, string[]>();
    for (const subject of analysis.subjects) {
      valuesByDiscipline.set(subject.publishedName, subject.weights.map((weight) => weight.value));
    }
    expect(valuesByDiscipline.get(NOVO_CURSO_2026_NAMES.disciplinePortugues)).toEqual(["30"]);
    expect(valuesByDiscipline.get(NOVO_CURSO_2026_NAMES.disciplineInformatica)).toEqual(["20"]);
    expect(valuesByDiscipline.get(NOVO_CURSO_2026_NAMES.disciplineLegislacao)).toEqual(["20"]);
  });

  it("registra os cargos publicados", async () => {
    const analysis = await analyze();
    const positions = analysis.contest.facts.filter((fact) => fact.field === "position");
    expect(positions.map((fact) => fact.value)).toEqual(
      expect.arrayContaining(["AGENTE ADMINISTRATIVO", "MOTORISTA"])
    );
  });

  it("entrega cada unidade ao normalizador sem deduplicar", async () => {
    const analysis = await analyze();
    expect(analysis.summary.topicsFound).toBe(analysis.audit.normalizedTopics.length);
    expect(new Set(analysis.topics.map((item) => item.candidateId)).size).toBe(analysis.summary.topicsFound);
    expect(analysis.summary.topicsFound).toBeGreaterThan(0);
  });
});

describe("C. matching", () => {
  it("reusa topico canonico existente", async () => {
    const analysis = await analyze();
    expect(classificationsOf(analysis, NOVO_CURSO_2026_NAMES.topicReuso)).toContain("REUSO_CANONICO");
    const reused = analysis.topics.filter((item) => item.classification === "REUSO_CANONICO");
    expect(reused.length).toBeGreaterThan(0);
    expect(reused.every((item) => item.canonicalTopicId !== null)).toBe(true);
    expect(reused.every((item) => item.ruleApplied === "TOPIC-01" || item.ruleApplied === "TOPIC-02")).toBe(true);
  });

  it("propoe topico novo quando o nome publicado nao existe, com near-miss registrado", async () => {
    const analysis = await analyze();
    const nearMiss = analysis.topics.find((item) => item.sourceLabel === NOVO_CURSO_2026_NAMES.topicNearMiss);
    expect(nearMiss?.classification).toBe("NOVO_CANONICO");
    expect(nearMiss?.ruleApplied).toBe("TOPIC-04");
    expect(nearMiss?.canonicalTopicId).toBeNull();
    expect(nearMiss?.proposedTopic).toBe(NOVO_CURSO_2026_NAMES.topicNearMiss);
    expect(nearMiss?.collisionIds ?? []).toEqual([]);
    // Proximidade semantica nao e colisao de chave: o detector deterministico nao ve
    // vizinho sem identidade comum, e e justamente ai que a proposta DeepSeek entra.
    expect(analysis.matches.find((item) => item.candidateId === nearMiss?.candidateId)?.nearMissCanonicalIds).toEqual([]);
  });

  it("propoe topico novo em assunto canonico sem cobertura", async () => {
    const analysis = await analyze();
    const novo = analysis.topics.find((item) => item.sourceLabel === NOVO_CURSO_2026_NAMES.topicNovo);
    expect(novo?.ruleApplied).toBe("TOPIC-05");
    expect(novo?.classification).toBe("NOVO_CANONICO");
  });

  it("mantem fragmento derivado fora do reuso", async () => {
    const analysis = await analyze();
    const derived = analysis.topics.filter((item) => item.origin === "DERIVED");
    expect(derived.length).toBeGreaterThan(0);
    expect(derived.every((item) => item.evidence === "DETERMINISTIC_MAPPING")).toBe(true);
    expect(derived.every((item) => item.classification !== "REUSO_CANONICO")).toBe(true);
    // Regra da FASE 4 preservada: em assunto com cobertura canonica o fragmento derivado
    // pede revisao humana (TOPIC-06); em assunto sem nenhuma cobertura ele vira proposta
    // de topico novo (TOPIC-05). O modelo nao altera nenhuma das duas saidas.
    const covered = derived.filter((item) => item.disciplineName === NOVO_CURSO_2026_NAMES.disciplinePortugues);
    expect(covered.length).toBeGreaterThan(0);
    expect(covered.every((item) => item.ruleApplied === "TOPIC-06")).toBe(true);
    expect(covered.every((item) => item.classification === "PENDENTE_REVISAO")).toBe(true);
    expect(derived.every((item) => item.ruleApplied === "TOPIC-06" || item.ruleApplied === "TOPIC-05" || item.ruleApplied === "SUBJ-03")).toBe(true);
  });

  it("bloqueia disciplina que nao existe no catalogo", async () => {
    const analysis = await analyze();
    const blocked = analysis.subjects.filter((item) => item.publishedName === NOVO_CURSO_2026_NAMES.disciplineLegislacao);
    expect(blocked).toHaveLength(1);
    expect(blocked[0]?.classification).toBe("BLOQUEADO");
    expect(blocked[0]?.canonicalSubjectId).toBeNull();
    expect(analysis.topics.filter((item) => item.classification === "BLOQUEADO").every((item) => item.ruleApplied === "SUBJ-03")).toBe(true);
    expect(analysis.conflicts.some((item) => item.code === "SUBJECT_NOT_IN_CATALOG")).toBe(true);
  });

  it("fecha a conta das classificacoes com o total de unidades", async () => {
    const analysis = await analyze();
    const total =
      analysis.summary.reuseCatalog +
      analysis.summary.newCanonical +
      analysis.summary.ambiguous +
      analysis.summary.blocked +
      analysis.summary.pendingReview;
    expect(total).toBe(analysis.summary.topicsFound);
  });

  it("marca ambiguidade quando duas linhas canonicas respondem pela mesma chave", async () => {
    const analysis = await analyze({}, null, ambiguousSnapshotReader);
    const ambiguous = analysis.topics.filter((item) => item.classification === "AMBIGUO");
    expect(ambiguous.length).toBeGreaterThan(0);
    expect(ambiguous[0]?.ruleApplied).toBe("TOPIC-03");
    expect(analysis.audit.matches.find((item) => item.classification === "AMBIGUO")?.ambiguousCanonicalIds).toEqual(["top-a", "top-b"]);
  });
});

describe("E. collisions", () => {
  it("emite colisao de nome, pontuacao, caixa, slug e ordinal", async () => {
    const analysis = await analyze();
    expect(collisionKindsOf(analysis, NOVO_CURSO_2026_NAMES.topicColisaoPontuacao)).toEqual(["NORMALIZED_NAME", "PUNCTUATION_ONLY"]);
    expect(collisionKindsOf(analysis, NOVO_CURSO_2026_NAMES.topicColisaoCaixa)).toContain("CASE_OR_ACCENT_ONLY");
    expect(collisionKindsOf(analysis, NOVO_CURSO_2026_NAMES.topicColisaoSlug)).toEqual(["SLUG"]);
    expect(collisionKindsOf(analysis, NOVO_CURSO_2026_NAMES.topicColisaoOrdinal)).toEqual(["ORDINAL_KEY_DIVERGENCE"]);
  });

  it("nunca funde nem descarta entrada", async () => {
    const analysis = await analyze();
    expect(analysis.collisions.every((item) => item.deduplicated === false)).toBe(true);
    expect(analysis.collisions.every((item) => item.discardedEntries === 0)).toBe(true);
    const members = analysis.collisions.reduce((total, item) => total + item.candidateIds.length, 0);
    expect(analysis.summary.collisionsMembers).toBe(members);
    expect(analysis.summary.collisionGroups).toBe(analysis.collisions.length);
    expect(analysis.summary.topicsFound).toBe(analysis.audit.normalizedTopics.length);
  });

  it("cada topico em colisao carrega o id do grupo e aparece no relatorio", async () => {
    const analysis = await analyze();
    const withCollision = analysis.topics.filter((item) => item.collisionIds.length > 0);
    expect(withCollision.length).toBeGreaterThan(0);
    for (const item of withCollision) {
      expect(analysis.collisions.some((collision) => collision.collisionId === item.collisionIds[0])).toBe(true);
    }
    expect(analysis.report).toContain("COLISAO");
  });
});

describe("D. DeepSeek como proposta, nao como autoridade", () => {
  it("anota sem mover nenhuma classificacao", async () => {
    const withoutAi = await analyze();
    const client = fakeClient({
      proposals: withoutAi.topics.slice(0, 5).map((item, index) => ({
        candidate_index: index,
        suggested_canonical_topic_id: null,
        justification: "Nome sem correspondencia canonica nesta fonte.",
        confidence: 0.4,
      })),
    });
    const withAi = await analyze({ ai: { enabled: true, provider: "deepseek", maxCandidates: 5 } }, client);
    expect(withAi.aiProposal.enabled).toBe(true);
    expect(withAi.aiProposal.provider).toBe("deepseek");
    expect(withAi.aiProposal.authority).toBe("none");
    expect(withAi.aiProposal.candidatesSent).toBe(5);
    expect(withAi.aiProposal.proposals).toHaveLength(5);
    const assisted = withAi.topics.filter((item) => item.aiAssist);
    expect(assisted).toHaveLength(5);
    expect(assisted.every((item) => item.aiAssist?.proposesNewTopic === true)).toBe(true);
    expect(assisted.every((item) => item.aiAssist?.authority === "none")).toBe(true);
    expect(withAi.topics.map((item) => item.classification)).toEqual(withoutAi.topics.map((item) => item.classification));
    for (const key of ["reuseCatalog", "newCanonical", "ambiguous", "blocked", "pendingReview", "topicsFound", "collisions"] as const) {
      expect(withAi.summary[key]).toEqual(withoutAi.summary[key]);
    }
    expect(withAi.summary.byRule).toEqual(withoutAi.summary.byRule);
  });

  it("associa assunto a partir da linha canonica sugerida, como anotacao", async () => {
    const analysis = await analyze({ ai: { enabled: true, maxCandidates: 1 } }, fakeClient({
      proposals: [{ candidate_index: 0, suggested_canonical_topic_id: null, justification: "Nada correspondente no catalogo lido.", confidence: 0.2 }],
    }));
    const assisted = analysis.topics.find((item) => item.aiAssist);
    expect(assisted?.aiAssist?.proposesNewTopic).toBe(true);
    expect(assisted?.aiAssist?.suggestedSubjectName).toBeNull();
    expect(assisted?.classification).not.toBe("REUSO_CANONICO");
  });

  it("associa assunto a partir da linha canonica sugerida, sem mover a decisao", async () => {
    const analysis = await analyze();
    const alvo = readCatalogSnapshot().topics.find((topic) => topic.name.includes("Classes de Palavras"));
    const candidate = analysis.topics.find((item) => item.sourceLabel === NOVO_CURSO_2026_NAMES.topicNearMiss);
    if (!alvo || !candidate) throw new Error("fixture ou catalogo mudou: nada a associar");
    const before = candidate.classification;
    const withAi = await analyze(
      { ai: { enabled: true, maxCandidates: 40 } },
      fakeClient({ proposals: [{ candidate_id: candidate.candidateId, suggested_canonical_topic_id: alvo.id, justification: "Mesmo conteudo, nome publicado com outra grafia.", confidence: 0.8 }] })
    );
    expect(withAi.aiProposal.rejections).toEqual([]);
    const assisted = withAi.topics.find((item) => item.candidateId === candidate.candidateId);
    expect(assisted?.aiAssist?.suggestedCanonicalTopicName).toBe(alvo.name);
    expect(assisted?.aiAssist?.suggestedSubjectName).toBe("Portugu\u00EAs");
    expect(assisted?.aiAssist?.proposesNewTopic).toBe(false);
    expect(assisted?.aiAssist?.authority).toBe("none");
    expect(assisted?.classification).toBe(before);
    expect(withAi.summary.newCanonical).toBe(analysis.summary.newCanonical);
  });
  it("registra AI_OVERREACH e nao ecoa o payload", async () => {
    const analysis = await analyze({ ai: { enabled: true, provider: "deepseek" } }, fakeClient({ proposals: [], action: "insert" }));
    expect(analysis.aiProposal.rejections.some((item) => item.code === "AI_OVERREACH")).toBe(true);
    expect(analysis.aiProposal.rejections.some((item) => item.offendingField === "action")).toBe(true);
    expect(analysis.aiProposal.proposals).toEqual([]);
    expect(analysis.conflicts.some((item) => item.code === "AI_OVERREACH")).toBe(true);
    expect(JSON.stringify(analysis.aiProposal)).not.toContain("insert");
  });

  it("recusa resposta que nao e JSON, schema fora do contrato e id inventado", async () => {
    const notJson = await analyze({ ai: { enabled: true } }, { provider: "deepseek", model: "fake", async complete() { return "isto nao e json"; } });
    expect(notJson.aiProposal.rejections.some((item) => item.code === "AI_SCHEMA_INVALID")).toBe(true);

    const badSchema = await analyze({ ai: { enabled: true } }, fakeClient({ proposals: [{ justification: 12 }] }));
    expect(badSchema.aiProposal.rejections.some((item) => item.code === "AI_SCHEMA_INVALID")).toBe(true);

    const unknownId = await analyze(
      { ai: { enabled: true, maxCandidates: 1 } },
      fakeClient({ proposals: [{ candidate_index: 0, suggested_canonical_topic_id: "id-que-nao-existe", justification: "Id inventado fora da lista.", confidence: 0.9 }] })
    );
    expect(unknownId.aiProposal.rejections.some((item) => item.code === "INVALID_AI_PROPOSAL")).toBe(true);
    expect(detectOverreachKeys({ proposals: [] })).toEqual([]);
  });

  it("traduz falha de provedor em rejeicao, nunca em decisao", async () => {
    const analysis = await analyze({ ai: { enabled: true } }, fakeClient({}, { throwError: true }));
    expect(analysis.aiProposal.rejections.some((item) => item.code === "AI_PROVIDER_FAILED")).toBe(true);
    expect(analysis.summary.topicsFound).toBe(analysis.audit.normalizedTopics.length);
  });

  it("sem cliente a secao fica AI_CLIENT_UNAVAILABLE e o resultado nao muda", async () => {
    const baseline = await analyze();
    const analysis = await analyze({ ai: { enabled: true, provider: "deepseek" } }, null);
    expect(analysis.aiProposal.skippedReason).toBe("AI_CLIENT_UNAVAILABLE");
    expect(analysis.aiProposal.proposals).toEqual([]);
    expect(analysis.topics.map((item) => item.classification)).toEqual(baseline.topics.map((item) => item.classification));
  });
});

describe("F. apply", () => {
  it("recusa escrita em AUDIT", async () => {
    const analysis = await analyze();
    expect(analysis.applyStatus).toBe("BLOCKED");
    expect(analysis.apply.code).toBe("APPLY_DISABLED_IN_AUDIT_PHASE");
    expect(analysis.apply.databaseOperations).toEqual([]);
    expect(analysis.summary.applyAllowed).toBe(false);
    expect(analysis.mode).toBe("audit-only");
    expect(analysis.requestedMode).toBe("AUDIT");
  });

  it("modo APPLY e registrado e recusado, sem escrever nada", async () => {
    const analysis = await analyze({ mode: "APPLY" });
    expect(analysis.requestedMode).toBe("APPLY");
    expect(analysis.mode).toBe("audit-only");
    expect(analysis.apply.refusedBypassFlags).toEqual(["mode"]);
    expect(analysis.apply.databaseOperations).toEqual([]);
    expect(analysis.conflicts.some((item) => item.code === "APPLY_DISABLED_IN_AUDIT_PHASE")).toBe(true);
    expect(analysis.report).toContain("BLOQUEADO");
  });
});

describe("seguranca e relatorio", () => {
  it("o agente nao abre conexao nem roda migracao ou seed", async () => {
    const analysis = await analyze();
    expect(analysis.audit.databaseConnected).toBe(false);
    expect(analysis.audit.migrationsRun).toBe(false);
    expect(analysis.audit.seedsRun).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("runCourseCatalogAudit continua aceitando o contrato da FASE 4", async () => {
    const audit = await runCourseCatalogAudit({
      mode: "audit-only",
      source: {
        kind: "inline-text",
        label: NOVO_CURSO_2026_SOURCE.label ?? "",
        text: NOVO_CURSO_2026_TEXT,
        extractor: NOVO_CURSO_2026_SOURCE.extractor ?? "",
        capturedAt: NOVO_CURSO_2026_SOURCE.capturedAt,
        reviewedByHuman: true,
      },
      extraction: NOVO_CURSO_2026_EXTRACTION,
    });
    expect(audit.mode).toBe("audit-only");
    expect(audit.apply.databaseOperations).toEqual([]);
  });

  it("o relatorio humano traz concurso, banca, resumo e apply", async () => {
    const analysis = await analyze();
    expect(analysis.report).toContain("CATALOGO - NOVO CONCURSO");
    expect(analysis.report).toContain("Concurso: Prefeitura Municipal de Teste");
    expect(analysis.report).toContain("Banca: Instituto Avaliador de Testes");
    expect(analysis.report).toContain("Reuso:");
    expect(analysis.report).toContain("APPLY:");
  });

  it("toda proposta declara sua camada de evidencia, e nenhuma nasce de IA", async () => {
    const analysis = await analyze();
    const kinds = new Set<CatalogEvidenceKind>();
    for (const item of analysis.topics) kinds.add(item.evidence);
    for (const item of analysis.subjects) kinds.add(item.evidence);
    for (const fact of analysis.contest.facts) kinds.add(fact.evidence);
    expect(Array.from(kinds).sort()).toEqual(["DETERMINISTIC_MAPPING", "SOURCE_FACT"]);
  });
});