/**
 * CatalogApprovalService (FASE 5) - o contrato da decisao humana, sem banco e sem IA.
 *
 * O payload e construido a mao, campo a campo, por um motivo: este arquivo nao testa o
 * agente (isso e o teste de integracao), testa o CONTRATO. Um fixture manual permite
 * mover uma linha do audit para o futuro sem mover a decisao, e provar que o digest nao
 * se move -- o contrario seria testar a calibracao da FASE 4 outra vez.
 *
 * Nada aqui abre banco, roda migracao, faz seed, chama rede ou toca APPLY.
 */
import { describe, expect, it } from "vitest";
import {
  CATALOG_APPROVAL_ID_HEX,
  CATALOG_APPROVAL_ID_PREFIX,
  CATALOG_APPROVAL_PROPOSAL_PREFIX,
  CatalogApprovalError,
  analysisDigestOf,
  approvalIdOf,
  assertApprovalMatchesProposal,
  buildApprovalGate,
  canonicalApprovalJson,
  decisionProjectionOf,
  findCurrentApproval,
  proposalBindingOf,
  proposalDigestOf,
  proposalIdOf,
  signApproval,
  validateApproval,
} from "../catalog-approval.service";
import { sha256Hex } from "../catalog-digest";
import {
  CATALOG_AGENT_PHASE,
  CATALOG_ANALYSIS_SCHEMA_VERSION,
  type CatalogAgentAnalysis,
} from "../../types/catalog-agent";
import {
  CATALOG_APPROVAL_SCHEMA_VERSION,
  CATALOG_APPROVAL_STATUSES,
  type CatalogApproval,
  type CatalogApprovalDraft,
  type CatalogApprovalIssue,
  type CatalogApprovalStatus,
} from "../../types/catalog-approval";
import type {
  CatalogAiSection,
  CatalogApplyResult,
  CatalogConflict,
  CatalogSourceProvenance,
  CatalogTopicCollision,
  CatalogTopicMatch,
} from "../../types/catalog-ingestion";

const SHA_A = sha256Hex("edital municipal 2026 - texto efetivamente analisado");
const SHA_B = sha256Hex("edital municipal 2026 - outra captura da mesma fonte");
const DECIDED_AT = "2026-10-02T12:00:00.000Z";
const REVIEWER = "Maria Andrade (coordenacao pedagogica)";

/** Relogio fixo: a unica porta deste modulo para o tempo, e o teste a controla. */
function clock(): string {
  return "2026-10-03T00:00:00.000Z";
}

function codes(issues: CatalogApprovalIssue[]): string[] {
  return issues.map((item) => (item.code));
}

function provenanceOf(sha: string): CatalogSourceProvenance {
  return {
    kind: "inline-text",
    label: "Anexo VI - Edital Municipal 2026",
    analysedTextSha256: sha,
    extractor: "fixture de teste",
    format: "text/plain",
    pageCount: 2,
    characters: 1200,
    words: 180,
    capturedAt: "2026-10-01T00:00:00.000Z",
    reviewedByHuman: true,
  };
}

function aiSection(): CatalogAiSection {
  return {
    enabled: false,
    role: "AI_PROPOSAL",
    authority: "none",
    provider: "none",
    model: "sem-provedor",
    proposals: [],
    rejections: [],
    candidatesSent: 0,
    timingsMs: { request: 0, validate: 0 },
  };
}

function applyResult(): CatalogApplyResult {
  return {
    ok: false,
    applied: false,
    code: "APPLY_DISABLED_IN_AUDIT_PHASE",
    message: "APLY esta bloqueado nesta fase.",
    databaseOperations: [],
    refusedBypassFlags: [],
    attemptedAt: DECIDED_AT,
  };
}

/**
 * O audit inteiro entra aqui com cast deliberado: ele fica FORA do digest por contrato,
 * entao sua completude nao e o que esta em teste. O que importa e poder mover as horas
 * dele sem mover a decisao -- e a linha a linha isso acontece abaixo.
 */
function auditOf(sha: string, startedAt: string, finishedAt: string): CatalogAgentAnalysis["audit"] {
  return {
    agent: "CourseCatalogAgent",
    phase: "FASE 4",
    schemaVersion: 1,
    mode: "audit-only",
    applyBlocked: true,
    databaseConnected: false,
    migrationsRun: false,
    seedsRun: false,
    startedAt,
    finishedAt,
    timingsMs: { total: 3000 },
    provenance: provenanceOf(sha),
    validation: [],
    program: { positions: [] },
    normalizedTopics: [],
    collisions: [],
    matches: [],
    conflicts: [],
    ai: aiSection(),
    counts: { positions: 2 },
    apply: applyResult(),
  } as unknown as CatalogAgentAnalysis["audit"];
}
/**
 * Linhas inseridas fora da ordem de proposalId de proposito: a projecao ordena, entao
 * embaralhar a lista de entrada nao pode mover o digest. Quem digitasse a ordem "certa"
 * nao provaria nada.
 */
function subjects(): CatalogAgentAnalysis["subjects"] {
  return [
    {
      proposalId: "SUB-02",
      publishedName: "Legislacao Municipal",
      origin: "PUBLISHED_LABEL",
      classification: "BLOQUEADO",
      ruleApplied: "SUBJ-03",
      reason: "Sem linha canonica no catalogo lido.",
      canonicalSubjectId: null,
      canonicalSubjectName: null,
      aliasApplied: false,
      evidence: "SOURCE_FACT",
      topicsTotal: 2,
      reusedTopics: 0,
      newTopics: 0,
      pendingTopics: 0,
      blockedTopics: 2,
      weights: [],
    },
    {
      proposalId: "SUB-01",
      publishedName: "Lingua Portuguesa",
      origin: "PUBLISHED_LABEL",
      classification: "REUSO_CANONICO",
      ruleApplied: "SUBJ-01",
      reason: "Assunto canonico encontrado por slug exato.",
      canonicalSubjectId: "11111111-1111-4111-8111-111111111111",
      canonicalSubjectName: "Portugues",
      aliasApplied: true,
      evidence: "DETERMINISTIC_MAPPING",
      topicsTotal: 3,
      reusedTopics: 2,
      newTopics: 1,
      pendingTopics: 0,
      blockedTopics: 0,
      weights: [],
    },
  ];
}

function topics(): CatalogAgentAnalysis["topics"] {
  return [
    {
      proposalId: "TOP-02",
      candidateId: "CAND-02",
      sourceLabel: "Editores de texto",
      classification: "NOVO_CANONICO",
      canonicalTopic: null,
      canonicalTopicId: null,
      proposedTopic: "Editores de texto",
      origin: "PUBLISHED_BLOCK",
      ruleApplied: "TOPIC-05",
      reason: "Nada correspondente no catalogo lido.",
      positionTitle: "AGENTE ADMINISTRATIVO",
      disciplineName: "Informatica",
      collisionIds: ["COL-01", "COL-02"],
      evidence: "SOURCE_FACT",
    },
    {
      proposalId: "TOP-01",
      candidateId: "CAND-01",
      sourceLabel: "Pontuacao",
      classification: "REUSO_CANONICO",
      canonicalTopic: "Pontuacao",
      canonicalTopicId: "22222222-2222-4222-8222-222222222222",
      proposedTopic: "Pontuacao",
      origin: "PUBLISHED_LABEL",
      ruleApplied: "TOPIC-01",
      reason: "Reuso por id canonico.",
      positionTitle: "AGENTE ADMINISTRATIVO",
      disciplineName: "Lingua Portuguesa",
      parentLabel: "Morfossintaxe",
      collisionIds: ["COL-02", "COL-01"],
      evidence: "SOURCE_FACT",
    },
  ];
}

function matches(): CatalogTopicMatch[] {
  return [
    {
      matchId: "MAT-02",
      candidateId: "CAND-02",
      rawName: "Editores de texto",
      normalizedName: "editores de texto",
      slug: "editores-de-texto",
      reducedKey: "editor texto",
      origin: "PUBLISHED_BLOCK",
      derivationRule: "NORM-02",
      positionTitle: "AGENTE ADMINISTRATIVO",
      disciplineName: "Informatica",
      canonicalSubjectId: "33333333-3333-4333-8333-333333333333",
      canonicalSubjectName: "Informatica",
      canonicalTopicId: null,
      canonicalTopicName: null,
      resolutionMethod: "none",
      classification: "NOVO_CANONICO",
      ruleApplied: "TOPIC-05",
      reason: "Proposta como novo canonico.",
      ambiguousCanonicalIds: [],
      proposedAsNewCanonical: true,
      nearMissCanonicalIds: ["44444444-4444-4444-8444-444444444444"],
      subjectAliasApplied: false,
    },
    {
      matchId: "MAT-01",
      candidateId: "CAND-01",
      rawName: "Pontuacao",
      normalizedName: "pontuacao",
      slug: "pontuacao",
      reducedKey: "pontuacao",
      origin: "PUBLISHED_LABEL",
      derivationRule: "NORM-01",
      positionTitle: "AGENTE ADMINISTRATIVO",
      disciplineName: "Lingua Portuguesa",
      canonicalSubjectId: "11111111-1111-4111-8111-111111111111",
      canonicalSubjectName: "Portugues",
      canonicalTopicId: "22222222-2222-4222-8222-222222222222",
      canonicalTopicName: "Pontuacao",
      resolutionMethod: "id",
      classification: "REUSO_CANONICO",
      ruleApplied: "TOPIC-01",
      reason: "Reuso de linha canonica.",
      ambiguousCanonicalIds: ["55555555-5555-4555-8555-555555555555", "66666666-6666-4666-8666-666666666666"],
      proposedAsNewCanonical: false,
      nearMissCanonicalIds: [],
      subjectAliasApplied: true,
    },
  ];
}

function collisions(): CatalogTopicCollision[] {
  return [
    {
      collisionId: "COL-02",
      kind: "NORMALIZED_NAME",
      key: "pontuacao virgula",
      candidateIds: ["CAND-03", "CAND-04"],
      rawNames: ["Pontuacao (virgula)", "Pontuacao - virgula"],
      normalizedNameAgrees: true,
      slugAgrees: false,
      reducedKeyAgrees: true,
      severity: "review",
      message: "Duas unidades publicadas colidem por nome normalizado.",
      deduplicated: false,
      discardedEntries: 0,
    },
    {
      collisionId: "COL-01",
      kind: "SLUG",
      key: "ortografia-acentuacao",
      candidateIds: ["CAND-05", "CAND-06"],
      rawNames: ["Ortografia Acentuacao", "Ortografia, Acentuacao"],
      normalizedNameAgrees: false,
      slugAgrees: true,
      reducedKeyAgrees: true,
      severity: "review",
      message: "Mesmo slug para nomes publicados diferentes.",
      deduplicated: false,
      discardedEntries: 0,
    },
  ];
}

function conflicts(): CatalogConflict[] {
  return [
    {
      conflictId: "CNF-01",
      code: "SUBJECT_NOT_IN_CATALOG",
      severity: "blocking",
      message: "Disciplina publicada sem assunto canonico.",
      entities: ["SUB-02", "CAND-07"],
      suggestion: "Decidir entre criar assunto canonico ou declarar alias.",
      autoFixed: false,
    },
    {
      conflictId: "CNF-02",
      code: "INVALID_AI_PROPOSAL",
      severity: "review",
      message: "Proposta de IA recusada pelo validador de schema.",
      entities: ["AIP-01"],
      suggestion: "Reexecutar a proposta se desejado; a regra ja decidiu.",
      autoFixed: false,
    },
    {
      conflictId: "CNF-03",
      code: "APPLY_DISABLED_IN_AUDIT_PHASE",
      severity: "informational",
      message: "APLY bloqueado nesta fase.",
      entities: ["apply"],
      suggestion: "Nada a fazer: a fase nao escreve.",
      autoFixed: false,
    },
  ];
}

function analysisBase(sha: string): CatalogAgentAnalysis {
  return {
    agent: "CourseCatalogAgent",
    phase: CATALOG_AGENT_PHASE,
    schemaVersion: CATALOG_ANALYSIS_SCHEMA_VERSION,
    mode: "audit-only",
    requestedMode: "AUDIT",
    applyStatus: "BLOCKED",
    source: provenanceOf(sha),
    sourceMapping: {
      requestedType: "text",
      kind: "inline-text",
      decodedBytes: false,
      contentCharacters: 1200,
      note: "borda apenas: prosa de ingestao",
    },
    contest: {
      name: "Prefeitura Municipal de Teste 2026",
      organ: "Secretaria Municipal de Estudos",
      board: "Instituto Avaliador de Testes",
      position: "Agente Administrativo",
      level: "Medio",
      vacancies: 40,
      questions: 60,
      examDate: "08/02/2026",
      facts: [
        {
          factId: "FAT-02",
          field: "weight",
          value: "20",
          evidence: "SOURCE_FACT",
          origin: "PUBLISHED_LABEL",
          rule: "CONTEST-04",
          disciplineName: "Informatica",
        },
        {
          factId: "FAT-01",
          field: "vacancies",
          value: "40",
          evidence: "SOURCE_FACT",
          origin: "PUBLISHED_BLOCK",
          rule: "CONTEST-02",
          publishedText: "Vagas: 40",
          start: 120,
          end: 128,
        },
      ],
      missingFields: ["weight", "exam_date"],
    },
    subjects: subjects(),
    topics: topics(),
    matches: matches(),
    collisions: collisions(),
    aiProposal: aiSection(),
    conflicts: conflicts(),
    summary: {
      positions: 2,
      subjectsFound: 2,
      topicsFound: 2,
      reuseCatalog: 1,
      newCanonical: 1,
      ambiguous: 0,
      blocked: 1,
      pendingReview: 0,
      collisions: 2,
      collisionGroups: 2,
      collisionsMembers: 4,
      aiProposals: 0,
      aiRejections: 1,
      conflicts: 3,
      blockingConflicts: 1,
      reviewConflicts: 1,
      byRule: { "SUBJ-01": 1, "SUBJ-03": 1, "TOPIC-01": 1, "TOPIC-05": 1 },
      byOrigin: {
        PUBLISHED_LABEL: 2,
        PUBLISHED_BLOCK: 1,
        PUBLISHED_LIST: 0,
        DERIVED: 0,
        "INTERPRETATION/MAPPING": 0,
      },
      applyAllowed: false,
    },
    apply: applyResult(),
    report: "Analise concluida em 2026-10-02T10:00:00.000Z com 3 conflitos.",
    audit: auditOf(sha, "2026-10-02T10:00:00.000Z", "2026-10-02T10:00:03.000Z"),
  };
}

function analysis(): CatalogAgentAnalysis {
  return analysisBase(SHA_A);
}

interface JsonPatch {
  [key: string]: unknown;
}

function draftFor(analysisValue: CatalogAgentAnalysis, patch: Partial<CatalogApprovalDraft>): CatalogApprovalDraft {
  const binding = proposalBindingOf(analysisValue);
  return {
    proposalId: binding.proposalId,
    analysisDigest: binding.analysisDigest,
    proposalDigest: binding.proposalDigest,
    status: "aprovado",
    decidedBy: REVIEWER,
    decidedAt: DECIDED_AT,
    ...patch,
  };
}

function approvalOf(analysisValue: CatalogAgentAnalysis): CatalogApproval {
  return signApproval(draftFor(analysisValue, {}), { now: clock });
}

/**
 * Edita o registro e remonta a assinatura. Assim a unica ocorrencia que sobre e a regra
 * violada, e nao um APPROVAL_ID_MISMATCH que encobriria o teste.
 */
function tamper(record: CatalogApproval, patch: JsonPatch): CatalogApproval {
  const next = { ...record, ...patch } as unknown as CatalogApproval;
  return { ...next, approvalId: approvalIdOf(next) };
}

/** Edita sem remontar a assinatura: a ocorrencia esperada e justamente a quebra dela. */
function forge(record: CatalogApproval, patch: JsonPatch): CatalogApproval {
  return { ...record, ...patch } as unknown as CatalogApproval;
}

function validRecord(): CatalogApproval {
  return approvalOf(analysis());
}
interface Thunk {
  (): unknown;
}

/** Aspas por codigo: a expectativa do canonical JSON sai sem escape de string. */
const Q = String.fromCharCode(34);

function par(nome: string): string {
  return Q + nome + Q;
}

function captureError(thunk: Thunk): CatalogApprovalError | null {
  try {
    thunk();
  } catch (error) {
    if (error instanceof CatalogApprovalError) return error;
    throw error;
  }
  return null;
}

describe("canonicalApprovalJson", () => {
  it("ordena chaves e compacta a saida", () => {
    expect(canonicalApprovalJson({ b: 1, a: 2 })).toBe("{" + par("a") + ":2," + par("b") + ":1}");
    expect(canonicalApprovalJson({ b: { d: 1, c: [1, 2] }, a: "x" })).toBe(
      "{" + par("a") + ":" + par("x") + "," + par("b") + ":{" + par("c") + ":[1,2]," + par("d") + ":1}}"
    );
  });

  it("omite propriedade com valor undefined e preserva null", () => {
    expect(canonicalApprovalJson({ a: 1, b: undefined, c: null })).toBe("{" + par("a") + ":1," + par("c") + ":null}");
  });

  it("mantem ordem de array, porque array e ordem", () => {
    expect(canonicalApprovalJson([2, 1])).toBe("[2,1]");
  });

  it("embaralhar a insercao de chaves nao move o resultado", () => {
    const um = canonicalApprovalJson({ z: 1, m: { y: 2, x: 3 }, a: 4 });
    const dois = canonicalApprovalJson({ a: 4, m: { x: 3, y: 2 }, z: 1 });
    expect(um).toBe(dois);
  });

  it("recusa o que JSON.stringify mentiria", () => {
    const proibidos: Thunk[] = [
      () => (canonicalApprovalJson(undefined)),
      () => (canonicalApprovalJson(Number.NaN)),
      () => (canonicalApprovalJson(Number.POSITIVE_INFINITY)),
      () => (canonicalApprovalJson(() => (1))),
      () => (canonicalApprovalJson(Symbol("s"))),
      () => (canonicalApprovalJson(10n)),
      () => (canonicalApprovalJson(new Date("2026-01-01T00:00:00Z"))),
      () => (canonicalApprovalJson(new Map([["a", 1]]))),
      () => (canonicalApprovalJson(new Set(["a"]))),
      () => (canonicalApprovalJson(new (class Assunto {})())),
    ];
    for (const thunk of proibidos) {
      expect(captureError(thunk)?.code).toBe("NOT_JSON_SAFE");
    }
  });

  it("aponta o caminho exato do valor inseguro", () => {
    const erro = captureError(() => (canonicalApprovalJson({ a: [{ b: new Date("2026-01-01T00:00:00Z") }] })));
    expect(erro?.code).toBe("NOT_JSON_SAFE");
    expect(erro?.field).toBe("$.a[0].b");
  });

  it("aceita objeto criado sem prototype", () => {
    const nu = Object.create(null) as JsonPatch;
    nu.b = 2;
    nu.a = 1;
    expect(canonicalApprovalJson(nu)).toBe("{" + par("a") + ":1," + par("b") + ":2}");
  });
});
describe("analysisDigest e proposalId", () => {
  it("analysisDigest e copia exata da prova da FASE 4, nao rederivacao", () => {
    const analysisValue = analysis();
    expect(analysisDigestOf(analysisValue)).toBe(SHA_A);
    expect(analysisDigestOf(analysisValue)).toBe(analysisValue.source.analysedTextSha256);
  });

  it("proposalId e PRP- mais 24 hex e nasce de agente|fase|schema|analysisDigest", () => {
    const material = [
      "CourseCatalogAgent",
      CATALOG_AGENT_PHASE,
      String(CATALOG_ANALYSIS_SCHEMA_VERSION),
      SHA_A,
    ].join("|");
    const esperado = CATALOG_APPROVAL_PROPOSAL_PREFIX + sha256Hex(material).slice(0, 24);
    expect(proposalIdOf(analysis())).toBe(esperado);
    expect(proposalIdOf(analysis())).toMatch(/^PRP-[0-9a-f]{24}$/);
  });

  it("identifica a analise inteira: duas executas iguais dao o mesmo id e digest", () => {
    expect(proposalIdOf(analysis())).toBe(proposalIdOf(analysis()));
    expect(proposalDigestOf(analysis())).toBe(proposalDigestOf(analysis()));
    expect(proposalDigestOf(analysis())).toMatch(/^[0-9a-f]{64}$/);
  });

  it("trocar a fonte move analysisDigest e proposalId, mas nao proposalDigest", () => {
    const outro = analysisBase(SHA_B);
    expect(analysisDigestOf(outro)).toBe(SHA_B);
    expect(proposalIdOf(outro)).not.toBe(proposalIdOf(analysis()));
    expect(proposalDigestOf(outro)).toBe(proposalDigestOf(analysis()));
  });

  it("fase e schemaVersion tambem mudam o proposalId", () => {
    const v2 = analysis();
    v2.schemaVersion = CATALOG_ANALYSIS_SCHEMA_VERSION + 1;
    expect(proposalIdOf(v2)).not.toBe(proposalIdOf(analysis()));
    const outraFase = analysis();
    outraFase.phase = "FASE 5" as typeof CATALOG_AGENT_PHASE;
    expect(proposalIdOf(outraFase)).not.toBe(proposalIdOf(analysis()));
  });

  it("os tres vinculos vem juntos pelo binding", () => {
    const binding = proposalBindingOf(analysis());
    expect(binding).toEqual({
      proposalId: proposalIdOf(analysis()),
      analysisDigest: SHA_A,
      proposalDigest: proposalDigestOf(analysis()),
    });
  });
});
describe("projecao de decisao", () => {
  it("exclui relogio, IA, relatorio, apply e prosa de borda", () => {
    const projeo = decisionProjectionOf(analysis()) as unknown as JsonPatch;
    for (const proibido of ["report", "audit", "aiProposal", "apply", "applyStatus", "requestedMode", "startedAt", "finishedAt", "source"]) {
      expect(Object.keys(projeo)).not.toContain(proibido);
    }
    expect(Object.keys(projeo.sourceMapping as JsonPatch)).not.toContain("note");
  });

  it("nao inventa slug de concurso", () => {
    const projeo = decisionProjectionOf(analysis()) as unknown as JsonPatch;
    const contest = projeo.contest as JsonPatch;
    expect(Object.keys(contest)).not.toContain("slug");
    expect(contest.name).toBe("Prefeitura Municipal de Teste 2026");
    expect(contest.organ).toBe("Secretaria Municipal de Estudos");
    expect(contest.board).toBe("Instituto Avaliador de Testes");
    expect(projeo.sourceMapping as JsonPatch).toHaveProperty("kind", "inline-text");
  });

  it("relogio e timing do audit nao movem o digest da proposta", () => {
    const tarde = analysis();
    const audit = tarde.audit as unknown as JsonPatch;
    audit.startedAt = "2027-01-01T00:00:00.000Z";
    audit.finishedAt = "2027-01-01T04:00:00.000Z";
    audit.timingsMs = { total: 999999 };
    expect(proposalDigestOf(tarde)).toBe(proposalDigestOf(analysis()));
  });

  it("saida e custo de IA nao movem o digest", () => {
    const comIa = analysis();
    comIa.aiProposal = {
      ...aiSection(),
      enabled: true,
      provider: "deepseek",
      model: "outro-modelo",
      candidatesSent: 7,
      timingsMs: { request: 4200, validate: 12 },
      rejections: [{ code: "AI_OVERREACH", message: "a resposta crua do provedor mudou" }],
    };
    const alvo = comIa.topics.find((item) => (item.proposalId === "TOP-01"));
    if (alvo === undefined) throw new Error("fixture mudou");
    alvo.aiAssist = {
      proposalId: "AIP-01",
      suggestedCanonicalTopicId: null,
      suggestedCanonicalTopicName: null,
      suggestedSubjectName: null,
      proposesNewTopic: true,
      justification: "texto do modelo",
      confidence: 0.11,
      provider: "deepseek",
      model: "outro-modelo",
      authority: "none",
    };
    expect(proposalDigestOf(comIa)).toBe(proposalDigestOf(analysis()));
  });

  it("relatorio, modo pedido, apply e nota de borda nao movem o digest", () => {
    const baguncado = analysis();
    baguncado.report = "relatorio reescrito com outro relogio";
    baguncado.requestedMode = "APPLY";
    baguncado.apply = { ...applyResult(), attemptedAt: "2027-01-01T00:00:00.000Z", message: "outra mensagem" };
    baguncado.sourceMapping = { ...baguncado.sourceMapping, note: "outra prosa" };
    expect(proposalDigestOf(baguncado)).toBe(proposalDigestOf(analysis()));
  });

  it("conflito de IA e de apply ficam fora, inclusive na contagem", () => {
    const semRuido = analysis();
    semRuido.conflicts = semRuido.conflicts.filter((item) => (item.conflictId === "CNF-01"));
    semRuido.summary = { ...semRuido.summary, conflicts: 1, reviewConflicts: 0 };
    expect(proposalDigestOf(semRuido)).toBe(proposalDigestOf(analysis()));
    const projeo = decisionProjectionOf(analysis());
    expect(projeo.conflicts.map((item) => (item.conflictId))).toEqual(["CNF-01"]);
    expect(projeo.summary.conflicts).toBe(1);
    expect(projeo.summary.reviewConflicts).toBe(0);
    expect(projeo.summary.blockingConflicts).toBe(1);
  });

  it("peso publicado vive em contest.facts, nao duplicado no assunto", () => {
    const projeo = decisionProjectionOf(analysis());
    const assunto = projeo.subjects.find((item) => (item.proposalId === "SUB-01"));
    if (assunto === undefined) throw new Error("fixture mudou");
    expect(Object.keys(assunto)).not.toContain("weights");
    expect(projeo.contest.facts.map((item) => (item.factId))).toEqual(["FAT-01", "FAT-02"]);
  });

  it("ordena listas por id e deduplica referencias", () => {
    const projeo = decisionProjectionOf(analysis());
    expect(projeo.subjects.map((item) => (item.proposalId))).toEqual(["SUB-01", "SUB-02"]);
    expect(projeo.topics.map((item) => (item.proposalId))).toEqual(["TOP-01", "TOP-02"]);
    expect(projeo.matches.map((item) => (item.matchId))).toEqual(["MAT-01", "MAT-02"]);
    expect(projeo.collisions.map((item) => (item.collisionId))).toEqual(["COL-01", "COL-02"]);
    expect(projeo.contest.missingFields).toEqual(["exam_date", "weight"]);
    const topic = projeo.topics.find((item) => (item.proposalId === "TOP-02"));
    if (topic === undefined) throw new Error("fixture mudou");
    expect(topic.collisionIds).toEqual(["COL-01", "COL-02"]);
    expect(projeo.topics[0]).toBeDefined();
  });

  it("embaralhar a entrada nao move o digest", () => {
    const virado = analysis();
    virado.subjects = virado.subjects.slice().reverse();
    virado.topics = virado.topics.slice().reverse();
    virado.matches = virado.matches.slice().reverse();
    virado.collisions = virado.collisions.slice().reverse();
    virado.contest.facts = virado.contest.facts.slice().reverse();
    virado.contest.missingFields = virado.contest.missingFields.slice().reverse();
    expect(proposalDigestOf(virado)).toBe(proposalDigestOf(analysis()));
  });

  it("mudar a decisao move o digest", () => {
    const base = proposalDigestOf(analysis());
    const mudancas: Array<Thunk> = [];
    const classificacao = analysis();
    const topic = classificacao.topics.find((item) => (item.proposalId === "TOP-02"));
    if (topic === undefined) throw new Error("fixture mudou");
    topic.classification = "AMBIGUO";
    mudancas.push(() => (proposalDigestOf(classificacao)));
    const canonico = analysis();
    const match = canonico.matches.find((item) => (item.matchId === "MAT-01"));
    if (match === undefined) throw new Error("fixture mudou");
    match.canonicalTopicId = "77777777-7777-4777-8777-777777777777";
    mudancas.push(() => (proposalDigestOf(canonico)));
    const concurso = analysis();
    concurso.contest.name = "Outro nome publicado";
    mudancas.push(() => (proposalDigestOf(concurso)));
    const alias = analysis();
    const assunto = alias.subjects.find((item) => (item.proposalId === "SUB-01"));
    if (assunto === undefined) throw new Error("fixture mudou");
    assunto.aliasApplied = false;
    mudancas.push(() => (proposalDigestOf(alias)));
    const decisaoPerdida = analysis();
    decisaoPerdida.conflicts = decisaoPerdida.conflicts.filter((item) => (item.conflictId !== "CNF-01"));
    mudancas.push(() => (proposalDigestOf(decisaoPerdida)));
    for (const thunk of mudancas) {
      expect(thunk()).not.toBe(base);
    }
  });
});
describe("validateApproval", () => {
  it("um registro assinado sobre a analise passa", () => {
    expect(validRecord().schemaVersion).toBe(CATALOG_APPROVAL_SCHEMA_VERSION);
    const resultado = validateApproval(validRecord(), { now: clock });
    expect(resultado.ok).toBe(true);
    expect(resultado.issues).toEqual([]);
  });

  it("aceita exatamente os dois literais, e so eles", () => {
    expect(CATALOG_APPROVAL_STATUSES).toEqual(["aprovado", "rejeitado"]);
    for (const status of ["aprovado", "rejeitado"]) {
      const record = tamper(validRecord(), { status });
      expect(codes(validateApproval(record, { now: clock }).issues)).toEqual([]);
    }
  });

  it("recusa sinonimo, maiusculo, espaco e todo terceiro valor", () => {
    for (const status of ["pendente", "PENDING", "PENDENTE_REVISAO", "APROVADO", "aprovado ", " Aprovado", "Aprovado", "", "rejeitado\n"]) {
      const record = tamper(validRecord(), { status });
      expect(codes(validateApproval(record, { now: clock }).issues)).toEqual(["STATUS_INVALID"]);
    }
  });

  it("signApproval nao mintar registro pendente", () => {
    const recusa = captureError(() => (signApproval(draftFor(analysis(), { status: "pendente" as CatalogApprovalStatus }))));
    expect(recusa?.code).toBe("STATUS_INVALID");
  });

  it("decidedBy e pessoa, nunca maquina", () => {
    for (const decidedBy of ["", "   ", "deepseek", "DeepSeek", "CourseCatalogAgent", "ia", "IA", "sistema"]) {
      expect(codes(validateApproval(tamper(validRecord(), { decidedBy }), { now: clock }).issues)).toEqual(["DECIDED_BY_INVALID"]);
    }
    expect(validateApproval(tamper(validRecord(), { decidedBy: "Joao Pereira (revisao)" }), { now: clock }).ok).toBe(true);
  });

  it("decidedAt exige ISO-8601 com fuso e nao pode estar no futuro", () => {
    for (const decidedAt of ["2026-10-02", "ontem", "2026-13-45T99:99:99Z", "2026-10-02T12:00:00", ""]) {
      expect(codes(validateApproval(tamper(validRecord(), { decidedAt }), { now: clock }).issues)).toEqual(["DECIDED_AT_INVALID"]);
    }
    expect(codes(validateApproval(tamper(validRecord(), { decidedAt: "2026-10-04T00:00:00.000Z" }), { now: clock }).issues)).toEqual(["DECIDED_AT_FUTURE"]);
    expect(validateApproval(tamper(validRecord(), { decidedAt: "2026-10-02T09:00:00-03:00" }), { now: clock }).ok).toBe(true);
  });

  it("aceita relogio padrao para decisao do passado", () => {
    const antigo = signApproval(draftFor(analysis(), { decidedAt: "2020-01-01T00:00:00.000Z" }));
    expect(validateApproval(antigo).ok).toBe(true);
  });

  it("recusa schemaVersion divergente", () => {
    const record = tamper(validRecord(), { schemaVersion: "catalog-approval-v2" });
    expect(codes(validateApproval(record, { now: clock }).issues)).toEqual(["SCHEMA_VERSION_INVALID"]);
  });

  it("recusa digest e id fora de forma", () => {
    expect(codes(validateApproval(tamper(validRecord(), { analysisDigest: "a".repeat(63) }), { now: clock }).issues)).toEqual(["ANALYSIS_DIGEST_INVALID"]);
    expect(codes(validateApproval(tamper(validRecord(), { analysisDigest: SHA_A.toUpperCase() }), { now: clock }).issues)).toEqual(["ANALYSIS_DIGEST_INVALID"]);
    expect(codes(validateApproval(tamper(validRecord(), { analysisDigest: "g".repeat(64) }), { now: clock }).issues)).toEqual(["ANALYSIS_DIGEST_INVALID"]);
    expect(codes(validateApproval(tamper(validRecord(), { proposalDigest: "a".repeat(65) }), { now: clock }).issues)).toEqual(["PROPOSAL_DIGEST_INVALID"]);
    expect(codes(validateApproval(tamper(validRecord(), { proposalId: CATALOG_APPROVAL_PROPOSAL_PREFIX + "a".repeat(23) }), { now: clock }).issues)).toEqual(["PROPOSAL_ID_INVALID"]);
  });

  it("recusa approvalId fora de forma, e detecta edicao pos-assinatura", () => {
    const torto = forge(validRecord(), { approvalId: CATALOG_APPROVAL_ID_PREFIX + "a".repeat(31) });
    expect(codes(validateApproval(torto, { now: clock }).issues)).toContain("APPROVAL_ID_INVALID");
    const forjado = forge(validRecord(), { status: "rejeitado" });
    expect(codes(validateApproval(forjado, { now: clock }).issues)).toEqual(["APPROVAL_ID_MISMATCH"]);
  });

  it("note aceita prosa e recusa URL, credencial, caminho e provedor", () => {
    expect(validateApproval(tamper(validRecord(), { note: null }), { now: clock }).ok).toBe(true);
    expect(validateApproval(tamper(validRecord(), { note: "Catalogo confere com o anexo publicado." }), { now: clock }).ok).toBe(true);
    for (const note of ["ver https://edital.gov.br/anexo", "chave service_role vazou", "arquivo em C:\\temp\\edital.txt", "deepseek sugeriu assim", "x".repeat(501)]) {
      expect(codes(validateApproval(tamper(validRecord(), { note }), { now: clock }).issues)).toEqual(["NOTE_INVALID"]);
    }
  });

  it("um valor nao JSON nao chega nem a ser assinado", () => {
    const forjado = forge(validRecord(), { note: new Date("2026-01-01T00:00:00Z") });
    expect(codes(validateApproval(forjado, { now: clock }).issues)).toContain("NOT_JSON_SAFE");
    expect(captureError(() => (tamper(validRecord(), { note: new Date("2026-01-01T00:00:00Z") })))).toBeInstanceOf(CatalogApprovalError);
  });

  it("supersedesApprovalId tem de ser id valido e nao pode ser o proprio", () => {
    const record = validRecord();
    expect(codes(validateApproval(tamper(record, { supersedesApprovalId: CATALOG_APPROVAL_ID_PREFIX + "a".repeat(31) }), { now: clock }).issues)).toEqual(["SUPERSEDES_UNKNOWN"]);
    const auto = forge(record, { supersedesApprovalId: record.approvalId });
    expect(codes(validateApproval(auto, { now: clock }).issues)).toContain("SUPERSEDES_SELF");
  });

  it("o approvalId nasce do conteudo: qualquer edicao muda a assinatura", () => {
    const record = validRecord();
    expect(record.approvalId.startsWith(CATALOG_APPROVAL_ID_PREFIX)).toBe(true);
    expect(record.approvalId.slice(4)).toHaveLength(CATALOG_APPROVAL_ID_HEX);
    expect(record.approvalId).toBe(approvalIdOf(record));
    const outroRevisor = signApproval(draftFor(analysis(), { decidedBy: "Joao Pereira (revisao)" }), { now: clock });
    expect(outroRevisor.approvalId).not.toBe(record.approvalId);
    const mesmaDecisao = signApproval(draftFor(analysis(), { decidedBy: REVIEWER }), { now: clock });
    expect(mesmaDecisao.approvalId).toBe(record.approvalId);
  });
});

describe("cadeia de supersessao", () => {
  function segundaVersao(primeira: CatalogApproval, status: CatalogApprovalStatus): CatalogApproval {
    return signApproval(draftFor(analysis(), {
      status,
      decidedBy: "Joao Pereira (revisao)",
      decidedAt: "2026-10-02T18:00:00.000Z",
      supersedesApprovalId: primeira.approvalId,
    }), { now: clock });
  }

  it("sem registro nao ha decisao, e isso nao e um status", () => {
    const vazio = findCurrentApproval(proposalIdOf(analysis()), []);
    expect(vazio.found).toBe(false);
    expect(vazio.approval).toBeNull();
    expect(vazio.chain).toEqual([]);
    expect(codes(vazio.issues)).toEqual(["APPROVAL_MISSING"]);
  });

  it("proposta diferente nao encontra a decisao", () => {
    const primeira = validRecord();
    const outra = CATALOG_APPROVAL_PROPOSAL_PREFIX + "b".repeat(24);
    expect(codes(findCurrentApproval(outra, [primeira]).issues)).toEqual(["APPROVAL_MISSING"]);
  });

  it("um registro valido e a decisao vigente", () => {
    const primeira = validRecord();
    const um = findCurrentApproval(primeira.proposalId, [primeira]);
    expect(um.found).toBe(true);
    expect(um.approval?.approvalId).toBe(primeira.approvalId);
    expect(um.chain).toHaveLength(1);
    expect(codes(um.issues)).toEqual([]);
  });

  it("a corregao vira registro novo, e o anterior continua legivel", () => {
    const primeira = validRecord();
    const segunda = segundaVersao(primeira, "rejeitado");
    const dois = findCurrentApproval(primeira.proposalId, [segunda, primeira]);
    expect(dois.found).toBe(true);
    expect(dois.approval?.approvalId).toBe(segunda.approvalId);
    expect(dois.chain.map((item) => (item.approvalId))).toEqual([primeira.approvalId, segunda.approvalId]);
    expect(dois.chain[0]?.supersedesApprovalId).toBeUndefined();
    expect(codes(dois.issues)).toEqual([]);
  });

  it("duas raizes dao cadeia ambigua", () => {
    const primeira = validRecord();
    const solta = signApproval(draftFor(analysis(), { status: "rejeitado", decidedBy: "Joao Pereira (revisao)" }), { now: clock });
    const raizDupla = findCurrentApproval(primeira.proposalId, [primeira, solta]);
    expect(codes(raizDupla.issues)).toContain("SUPERSEDES_AMBIGUOUS");
  });

  it("supersedes para id que nao existe quebra a cadeia", () => {
    const primeira = validRecord();
    const orfa = signApproval(draftFor(analysis(), {
      decidedBy: "Ana Nogueira",
      supersedesApprovalId: CATALOG_APPROVAL_ID_PREFIX + "c".repeat(32),
    }), { now: clock });
    const quebrada = findCurrentApproval(primeira.proposalId, [primeira, orfa]);
    expect(codes(quebrada.issues)).toContain("SUPERSEDES_UNKNOWN");
    expect(quebrada.chain).toHaveLength(1);
  });

  it("ciclo mutuo nao tem decisao vigente", () => {
    const primeiro = validRecord();
    const segundo = segundaVersao(primeiro, "rejeitado");
    const ciclo = forge(primeiro, { supersedesApprovalId: segundo.approvalId });
    const res = findCurrentApproval(ciclo.proposalId, [ciclo, segundo]);
    expect(codes(res.issues)).toContain("SUPERSEDES_CYCLE");
    expect(res.found).toBe(false);
    expect(res.approval).toBeNull();
  });

  it("registro que substitui a si mesmo e recusado", () => {
    const primeiro = validRecord();
    const auto = forge(primeiro, { supersedesApprovalId: primeiro.approvalId });
    expect(codes(findCurrentApproval(auto.proposalId, [auto]).issues)).toContain("SUPERSEDES_SELF");
  });

  it("corrente invalida nao e decisao, mas a cadeia continua legivel", () => {
    const primeiro = validRecord();
    const segundo = segundaVersao(primeiro, "aprovado");
    const corrompido = forge(segundo, { proposalDigest: "d".repeat(64) });
    const res = findCurrentApproval(primeiro.proposalId, [primeiro, corrompido]);
    expect(res.found).toBe(false);
    expect(res.approval).toBeNull();
    expect(res.chain).toHaveLength(2);
    expect(codes(res.issues)).toContain("APPROVAL_ID_MISMATCH");
  });
});
describe("buildApprovalGate", () => {
  it("sem decisao e ausencia, nao um status", () => {
    const analysisValue = analysis();
    const gate = buildApprovalGate(analysisValue, []);
    expect(gate.approved).toBe(false);
    expect(gate.status).toBeNull();
    expect(gate.approval).toBeNull();
    expect(codes(gate.issues)).toEqual(["APPROVAL_MISSING"]);
    expect(gate.proposalId).toBe(proposalIdOf(analysisValue));
  });

  it("a decisao vale para a analise inteira", () => {
    const analysisValue = analysis();
    const record = approvalOf(analysisValue);
    const gate = buildApprovalGate(analysisValue, [record]);
    expect(gate.approved).toBe(true);
    expect(gate.status).toBe("aprovado");
    expect(gate.issues).toEqual([]);
    expect(gate.analysisDigest).toBe(SHA_A);
    expect(gate.proposalDigest).toBe(proposalDigestOf(analysisValue));
  });

  it("rejeicao vigente e decisao tomada: nada segue", () => {
    const analysisValue = analysis();
    const aprovado = approvalOf(analysisValue);
    const rejeitado = signApproval(draftFor(analysisValue, {
      status: "rejeitado",
      decidedBy: "Joao Pereira (revisao)",
      supersedesApprovalId: aprovado.approvalId,
    }), { now: clock });
    const gate = buildApprovalGate(analysisValue, [aprovado, rejeitado]);
    expect(gate.approved).toBe(false);
    expect(gate.status).toBe("rejeitado");
    expect(codes(gate.issues)).toContain("APPROVAL_REJECTED");
  });

  it("relogio, custo de IA e relatorio nao invalidam a decisao do humano", () => {
    const analysisValue = analysis();
    const record = approvalOf(analysisValue);
    const audit = analysisValue.audit as unknown as JsonPatch;
    audit.startedAt = "2030-01-01T00:00:00.000Z";
    audit.timingsMs = { total: 8000000 };
    analysisValue.report = "outra prosa, em outro dia";
    analysisValue.aiProposal = {
      ...aiSection(),
      enabled: true,
      provider: "deepseek",
      model: "deepseek-v3",
      candidatesSent: 9,
      timingsMs: { request: 9000, validate: 30 },
    };
    const gate = buildApprovalGate(analysisValue, [record]);
    expect(gate.approved).toBe(true);
    expect(gate.issues).toEqual([]);
  });

  it("classificacao adulterada rompe o vinculo da proposta", () => {
    const analysisValue = analysis();
    const record = approvalOf(analysisValue);
    const topic = analysisValue.topics.find((item) => (item.proposalId === "TOP-02"));
    if (topic === undefined) throw new Error("fixture mudou");
    topic.classification = "AMBIGUO";
    const gate = buildApprovalGate(analysisValue, [record]);
    expect(gate.approved).toBe(false);
    expect(codes(gate.issues)).toContain("PROPOSAL_DIGEST_MISMATCH");
    const erro = captureError(() => (assertApprovalMatchesProposal(analysisValue, record)));
    expect(erro?.code).toBe("PROPOSAL_DIGEST_MISMATCH");
  });

  it("fonte diferente rompe o vinculo da analise", () => {
    const record = approvalOf(analysis());
    const gate = buildApprovalGate(analysisBase(SHA_B), [record]);
    expect(gate.approved).toBe(false);
    expect(codes(gate.issues)).toContain("ANALYSIS_DIGEST_MISMATCH");
  });

  it("o gate e leitura pura e nao carrega comando de escrita", () => {
    const analysisValue = analysis();
    const record = approvalOf(analysisValue);
    const antes = JSON.stringify(analysisValue);
    const registros = [record];
    const gate = buildApprovalGate(analysisValue, registros);
    expect(JSON.stringify(analysisValue)).toBe(antes);
    expect(registros).toHaveLength(1);
    for (const proibido of ["apply", "applyStatus", "databaseOperations", "requestedMode", "report"]) {
      expect(Object.keys(gate)).not.toContain(proibido);
    }
    expect(gate.approved).toBe(true);
  });

  it("approved verdadeiro nao destrava APPLY: o audit continua audit-only", () => {
    const analysisValue = analysis();
    const gate = buildApprovalGate(analysisValue, [approvalOf(analysisValue)]);
    expect(gate.approved).toBe(true);
    expect(analysisValue.apply.ok).toBe(false);
    expect(analysisValue.apply.applied).toBe(false);
    expect(analysisValue.apply.code).toBe("APPLY_DISABLED_IN_AUDIT_PHASE");
    expect(analysisValue.applyStatus).toBe("BLOCKED");
    expect(analysisValue.summary.applyAllowed).toBe(false);
  });
});