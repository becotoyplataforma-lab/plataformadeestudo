/**
 * CatalogAnalysisProjection (FASE 4B) - projeta a auditoria em proposta revisavel.
 *
 * Este modulo nao reclassifica nada: ele le o resultado deterministico da FASE 4
 * (`CatalogAuditResult`) e apresenta a mesma decisao em formato de proposta por
 * disciplina e por topico, com resumo e relatorio. A ordem de evidencia do plano e
 * preservada porque cada linha carrega a regra que a produziu (SUBJ-xx / TOPIC-xx)
 * e a anotacao de IA fica num campo aparte, nunca na classificacao.
 *
 * Sem banco, sem rede, sem disco: so leitura do que o agente ja mediu.
 */
import "server-only";
import { normalizeTopicName } from "@/lib/knowledge/services/topic-resolver.service";
import { formatCatalogReport } from "../services/catalog-report.service";
import type {
  CatalogAgentAnalysis,
  CatalogAgentRequest,
  CatalogApplyStatus,
  CatalogContestFact,
  CatalogContestProfile,
  CatalogEvidenceKind,
  CatalogSubjectProposal,
  CatalogAgentSummary,
  CatalogTopicAiAssist,
  CatalogTopicProposal,
  CatalogSourceMapping,
} from "../types/catalog-agent";
import { CATALOG_AGENT_PHASE, CATALOG_ANALYSIS_SCHEMA_VERSION } from "../types/catalog-agent";
import type {
  CatalogAiProposal,
  CatalogAuditResult,
  CatalogClassification,
  CatalogTopicMatch,
  TopicOrigin,
} from "../types/catalog-ingestion";
import { CATALOG_AGENT_NAME } from "../types/catalog-ingestion";

/** Precedencia do rollup de disciplina: a mais grave presente vence. */
export const SUBJECT_ROLLUP_PRECEDENCE: readonly CatalogClassification[] = [
  "BLOQUEADO",
  "AMBIGUO",
  "PENDENTE_REVISAO",
  "NOVO_CANONICO",
  "REUSO_CANONICO",
];

/** Nome e assunto de uma linha canonica do snapshot, por id. */
export interface CanonicalTopicIndexEntry {
  name: string;
  subjectName: string | null;
}

export interface BuildCatalogAnalysisInput {
  request: CatalogAgentRequest;
  audit: CatalogAuditResult;
  mapping: CatalogSourceMapping;
  facts: CatalogContestFact[];
  /** Perfil do concurso: fatos medidos + declaracoes do caller. */
  contest: CatalogContestProfile;
  /** Indexado por id canonico; vazio quando o snapshot nao estiver disponivel. */
  canonicalTopics: Record<string, CanonicalTopicIndexEntry>;
}

/** Camada de evidencia do nome: publicado e fato, derivado ou mapeado e mapeamento. */
export function evidenceOfOrigin(origin: TopicOrigin): CatalogEvidenceKind {
  if (origin === "PUBLISHED_LABEL" || origin === "PUBLISHED_BLOCK" || origin === "PUBLISHED_LIST") {
    return "SOURCE_FACT";
  }
  return "DETERMINISTIC_MAPPING";
}

function rollupOf(rows: CatalogTopicMatch[]): {
  classification: CatalogClassification;
  ruleApplied: string;
  reason: string;
} {
  if (rows.length === 0) {
    return {
      classification: "PENDENTE_REVISAO",
      ruleApplied: "SUBJ-ROLLUP-00",
      reason: "Disciplina publicada sem nenhuma unidade extraida: nada a casar, revisao humana.",
    };
  }
  const counts = new Map<CatalogClassification, number>();
  for (const row of rows) counts.set(row.classification, (counts.get(row.classification) ?? 0) + 1);
  const winner = SUBJECT_ROLLUP_PRECEDENCE.find((item) => (counts.get(item) ?? 0) > 0);
  const detail = Array.from(counts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([item, total]) => item + ":" + total)
    .join(", ");
  return {
    classification: winner ?? "PENDENTE_REVISAO",
    ruleApplied: "SUBJ-ROLLUP-01",
    reason: "Rollup das " + rows.length + " unidades da disciplina (" + detail + ") pela precedencia BLOQUEADO > AMBIGUO > PENDENTE_REVISAO > NOVO_CANONICO > REUSO_CANONICO.",
  };
}

function disciplineKey(positionTitle: string, publishedName: string): string {
  return normalizeTopicName(positionTitle) + "::" + normalizeTopicName(publishedName);
}

function weightsOf(facts: CatalogContestFact[], publishedName: string): CatalogContestFact[] {
  const key = normalizeTopicName(publishedName);
  return facts.filter(
    (fact) => fact.field === "weight" && normalizeTopicName(fact.disciplineName ?? "").includes(key)
  );
}

/** Uma proposta por disciplina publicada por cargo: o edital pode repetir o programa. */
export function projectSubjects(
  audit: CatalogAuditResult,
  facts: CatalogContestFact[]
): CatalogSubjectProposal[] {
  const rowsByDiscipline = new Map<string, CatalogTopicMatch[]>();
  for (const match of audit.matches) {
    const key = disciplineKey(match.positionTitle, match.disciplineName);
    const bucket = rowsByDiscipline.get(key) ?? [];
    bucket.push(match);
    rowsByDiscipline.set(key, bucket);
  }

  const out: CatalogSubjectProposal[] = [];
  for (const position of audit.program.positions) {
    for (const discipline of position.disciplines) {
      const rows = rowsByDiscipline.get(disciplineKey(position.publishedTitle, discipline.publishedName)) ?? [];
      const rollup = rollupOf(rows);
      const resolved = rows.find((row) => row.canonicalSubjectId !== null);
      const count = (classification: CatalogClassification): number =>
        rows.filter((row) => row.classification === classification).length;
      out.push({
        proposalId: "SUB-" + discipline.disciplineId,
        publishedName: discipline.publishedName,
        origin: discipline.nameOrigin,
        classification: rollup.classification,
        ruleApplied: rollup.ruleApplied,
        reason: rollup.reason,
        canonicalSubjectId: resolved?.canonicalSubjectId ?? null,
        canonicalSubjectName: resolved?.canonicalSubjectName ?? null,
        aliasApplied: rows.some((row) => row.subjectAliasApplied),
        evidence: rows.some((row) => row.subjectAliasApplied) ? "DETERMINISTIC_MAPPING" : evidenceOfOrigin(discipline.nameOrigin),
        topicsTotal: rows.length,
        reusedTopics: count("REUSO_CANONICO"),
        newTopics: count("NOVO_CANONICO"),
        pendingTopics: count("PENDENTE_REVISAO"),
        blockedTopics: count("BLOQUEADO"),
        weights: weightsOf(facts, discipline.publishedName),
      });
    }
  }
  return out;
}

function collisionIndex(audit: CatalogAuditResult): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const collision of audit.collisions) {
    for (const candidateId of collision.candidateIds) {
      const bucket = index.get(candidateId) ?? [];
      if (!bucket.includes(collision.collisionId)) bucket.push(collision.collisionId);
      index.set(candidateId, bucket);
    }
  }
  return index;
}

function aiAssistOf(
  proposal: CatalogAiProposal,
  canonicalTopics: Record<string, CanonicalTopicIndexEntry>
): CatalogTopicAiAssist {
  const suggested = proposal.suggestedCanonicalTopicId
    ? canonicalTopics[proposal.suggestedCanonicalTopicId]
    : undefined;
  return {
    proposalId: proposal.proposalId,
    suggestedCanonicalTopicId: proposal.suggestedCanonicalTopicId,
    suggestedCanonicalTopicName: suggested?.name ?? null,
    suggestedSubjectName: suggested?.subjectName ?? null,
    proposesNewTopic: proposal.suggestedCanonicalTopicId === null,
    justification: proposal.justification,
    confidence: proposal.confidence,
    provider: proposal.provider,
    model: proposal.model,
    authority: "none",
  };
}

/** Uma proposta por candidato, com a decisao deterministica intacta. */
export function projectTopics(
  audit: CatalogAuditResult,
  canonicalTopics: Record<string, CanonicalTopicIndexEntry>
): CatalogTopicProposal[] {
  const collisionsByCandidate = collisionIndex(audit);
  const proposalsByCandidate = new Map<string, CatalogAiProposal>();
  for (const proposal of audit.ai.proposals) {
    if (!proposalsByCandidate.has(proposal.candidateId)) {
      proposalsByCandidate.set(proposal.candidateId, proposal);
    }
  }

  return audit.matches.map((match) => {
    const proposal: CatalogTopicProposal = {
      proposalId: "TOP-" + match.candidateId,
      candidateId: match.candidateId,
      sourceLabel: match.rawName,
      classification: match.classification,
      canonicalTopic: match.canonicalTopicName,
      canonicalTopicId: match.canonicalTopicId,
      // NOVO_CANONICO propoe; nao cria. A escrita continua bloqueada.
      proposedTopic: match.canonicalTopicName ?? match.rawName,
      origin: match.origin,
      ruleApplied: match.ruleApplied,
      reason: match.reason,
      positionTitle: match.positionTitle,
      disciplineName: match.disciplineName,
      parentLabel: undefined,
      collisionIds: collisionsByCandidate.get(match.candidateId) ?? [],
      evidence: evidenceOfOrigin(match.origin),
    };
    const normalizedTopic = audit.normalizedTopics.find((item) => item.candidateId === match.candidateId);
    if (normalizedTopic?.parentLabel) proposal.parentLabel = normalizedTopic.parentLabel;
    const ai = proposalsByCandidate.get(match.candidateId);
    if (ai) proposal.aiAssist = aiAssistOf(ai, canonicalTopics);
    return proposal;
  });
}

function countByRule(matches: CatalogTopicMatch[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const match of matches) out[match.ruleApplied] = (out[match.ruleApplied] ?? 0) + 1;
  return out;
}

export function summarizeAudit(
  audit: CatalogAuditResult,
  subjects: CatalogSubjectProposal[],
  topics: CatalogTopicProposal[]
): CatalogAgentSummary {
  const byClassification = audit.counts.byClassification;
  return {
    positions: audit.counts.positions,
    subjectsFound: subjects.length,
    topicsFound: topics.length,
    reuseCatalog: byClassification.REUSO_CANONICO,
    newCanonical: byClassification.NOVO_CANONICO,
    ambiguous: byClassification.AMBIGUO,
    blocked: byClassification.BLOQUEADO,
    pendingReview: byClassification.PENDENTE_REVISAO,
    collisions: audit.collisions.length,
    collisionGroups: new Set(audit.collisions.map((item) => item.collisionId)).size,
    collisionsMembers: audit.collisions.reduce((total, item) => total + item.candidateIds.length, 0),
    aiProposals: audit.ai.proposals.length,
    aiRejections: audit.ai.rejections.length,
    conflicts: audit.conflicts.length,
    blockingConflicts: audit.counts.blockingConflicts,
    reviewConflicts: audit.counts.reviewConflicts,
    byRule: countByRule(audit.matches),
    byOrigin: audit.counts.byOrigin,
    applyAllowed: false,
  };
}

/** Projecao completa: mesmo numero do matcher, em forma de proposta revisavel. */
export function buildCatalogAnalysis(input: BuildCatalogAnalysisInput): CatalogAgentAnalysis {
  const subjects = projectSubjects(input.audit, input.facts);
  const topics = projectTopics(input.audit, input.canonicalTopics);
  const summary = summarizeAudit(input.audit, subjects, topics);
  const applyStatus: CatalogApplyStatus = "BLOCKED";
  const analysis: CatalogAgentAnalysis = {
    agent: CATALOG_AGENT_NAME,
    phase: CATALOG_AGENT_PHASE,
    schemaVersion: CATALOG_ANALYSIS_SCHEMA_VERSION,
    mode: input.audit.mode,
    requestedMode: input.request.mode === "APPLY" ? "APPLY" : "AUDIT",
    applyStatus,
    source: input.audit.provenance,
    sourceMapping: input.mapping,
    contest: input.contest,
    subjects,
    topics,
    matches: input.audit.matches,
    collisions: input.audit.collisions,
    aiProposal: input.audit.ai,
    conflicts: input.audit.conflicts,
    summary,
    apply: input.audit.apply,
    report: "",
    audit: input.audit,
  };
  analysis.report = formatCatalogReport(analysis);
  return analysis;
}