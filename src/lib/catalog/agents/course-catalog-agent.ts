/**
 * CourseCatalogAgent (FASE 4) - orquestracao de AUDITORIA, sem escrita.
 *
 * O agente recebe uma fonte de edital ja capturada, segmenta o programa publicado,
 * normaliza os candidatos, roda os detectores de colisao, casa contra o snapshot de
 * leitura-only, agrega conflitos, colhe propostas de IA quando houver cliente
 * injetado, e devolve um relatorio serializavel em JSON. Nunca abre conexao com
 * banco, nunca roda migracao ou seed, nunca regenera snapshot e nunca escreve
 * arquivo.
 *
 * Ordem fixa: fonte, extrator, normalizador, colisoes, snapshot, matcher, IA
 * (anotacao), conflitos, apply (recusado). Nenhuma etapa pula a anterior e nenhuma
 * saida de modelo sobrescreve decisao deterministica.
 */
import "server-only";
import {
  CATALOG_AGENT_NAME,
  CATALOG_AUDIT_SCHEMA_VERSION,
  CATALOG_PHASE,
  TOPIC_ORIGINS,
  type CatalogAiProposal,
  type CatalogAiSection,
  type CatalogAuditCounts,
  type CatalogAuditRequest,
  type CatalogAuditResult,
  type CatalogConflict,
  type CatalogNormalizedTopic,
  type CatalogProgram,
  type CatalogTopicCollision,
  type CatalogTopicMatch,
  type CatalogValidatedSource,
  type TopicOrigin,
} from "@/lib/catalog/types/catalog-ingestion";
import { validateCatalogSource } from "@/lib/catalog/services/source-validator.service";
import {
  extractCatalogProgram,
  programCandidates,
} from "@/lib/catalog/services/program-extractor.service";
import {
  findCatalogKeyAgreements,
  findCollisions,
  normalizeTopics,
  type CanonicalTopicRow,
} from "@/lib/catalog/services/topic-normalizer.service";
import {
  CatalogSnapshotError,
  readCatalogSnapshot,
  type CatalogSnapshotView,
} from "@/lib/catalog/services/catalog-snapshot.service";
import { countByClassification, matchTopics } from "@/lib/catalog/services/catalog-matcher.service";
import {
  requestCatalogAiProposals,
  type CatalogAiClient,
} from "@/lib/catalog/services/ai-proposal.service";
import {
  buildCatalogConflicts,
  countConflictsBySeverity,
} from "@/lib/catalog/services/catalog-conflict.service";
import { applyConflictOf, refuseCatalogApply } from "@/lib/catalog/services/catalog-apply.service";

import type {
  CatalogAgentAnalysis,
  CatalogAgentRequest,
} from "@/lib/catalog/types/catalog-agent";
import {
  buildContestProfile,
  extractContestFacts,
} from "@/lib/catalog/services/contest-facts.service";
import { buildCatalogAnalysis, type CanonicalTopicIndexEntry } from "./catalog-analysis";
import { toCatalogAuditRequest } from "./catalog-request-mapper";

export interface CourseCatalogAgentDeps {
  /** Cliente de IA injetado. Sem cliente, a secao de IA fica desabilitada. */
  aiClient?: CatalogAiClient | null;
  /** Caminho do snapshot de leitura-only. Somente leitura, sempre. */
  snapshotPath?: string;
  /** Costura de leitura do snapshot para teste; nunca e uma conexao de banco. */
  snapshotReader?: () => CatalogSnapshotView;
  /** Fonte de tempo injetavel para testes deterministicos. */
  now?: () => string;
}

type Timings = Record<string, number>;
type OriginCount = Record<TopicOrigin, number>;
type CanonicalRows = CatalogTopicMatch[];

function emptyProgram(): CatalogProgram {
  return { positions: [], measurements: [], warnings: [], candidateCount: 0 };
}

function zeroOrigins(): OriginCount {
  const out: OriginCount = {
    PUBLISHED_LABEL: 0,
    PUBLISHED_BLOCK: 0,
    PUBLISHED_LIST: 0,
    DERIVED: 0,
    "INTERPRETATION/MAPPING": 0,
  };
  return out;
}

function disabledAiSection(reason: string, model: string): CatalogAiSection {
  return {
    enabled: false,
    role: "AI_PROPOSAL",
    authority: "none",
    provider: "none",
    model,
    proposals: [],
    rejections: [],
    candidatesSent: 0,
    skippedReason: reason,
    timingsMs: { request: 0, validate: 0 },
  };
}

function snapshotConflictOf(error: CatalogSnapshotError): CatalogConflict {
  return {
    conflictId: "CNF-METADATA_MISMATCH-90",
    code: "METADATA_MISMATCH",
    severity: "blocking",
    message: "O snapshot de leitura-only nao pode ser lido: nada foi casado com o catalogo.",
    entities: ["catalog-snapshot", error.code],
    suggestion: "Conferir o arquivo de snapshot; o agente nao regenera nem escreve.",
    autoFixed: false,
    detail: { code: error.code, errors: error.errors },
  };
}

export class CourseCatalogAgent {
  private readonly now: () => string;

  constructor(private readonly deps: CourseCatalogAgentDeps = {}) {
    this.now = deps.now ?? (() => new Date().toISOString());
  }

  async run(request: CatalogAuditRequest): Promise<CatalogAuditResult> {
    const startedAt = this.now();
    const origin = Date.now();
    const timings: Timings = {};
    const mark = (label: string) => {
      timings[label] = Date.now() - origin;
    };

    const validated: CatalogValidatedSource = await validateCatalogSource(request.source);
    mark("validate");

    const extraction = request.extraction ?? {};
    const program = validated.ok
      ? extractCatalogProgram(validated, extraction)
      : emptyProgram();
    mark("extract");

    const candidates = validated.ok ? programCandidates(program, extraction) : [];
    const normalizedTopics: CatalogNormalizedTopic[] = normalizeTopics(candidates);
    mark("normalize");

    const collisions: CatalogTopicCollision[] = findCollisions(normalizedTopics);
    mark("collisions");

    let view: CatalogSnapshotView | null = null;
    let snapshotConflict: CatalogConflict | null = null;
    try {
      view = this.deps.snapshotReader
        ? this.deps.snapshotReader()
        : readCatalogSnapshot(this.deps.snapshotPath ?? undefined);
    } catch (error) {
      snapshotConflict =
        error instanceof CatalogSnapshotError
          ? snapshotConflictOf(error)
          : snapshotConflictOf(new CatalogSnapshotError("SNAPSHOT_READ_FAILED", "Falha ao ler o snapshot."));
    }
    mark("snapshot");

    const canonicalAgreements: CatalogTopicCollision[] = [];
    let matches: CanonicalRows = [];
    if (view) {
      const canonicalRows: CanonicalTopicRow[] = view.topics.map((topic) => ({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
      }));
      canonicalAgreements.push(...findCatalogKeyAgreements(normalizedTopics, canonicalRows));
      matches = matchTopics({
        topics: normalizedTopics,
        view,
        subjectAliases: request.subjectAliases ?? [],
      });
    }
    mark("match");

    let ai: CatalogAiSection = disabledAiSection(
      view ? "AI_NOT_REQUESTED" : "SNAPSHOT_UNAVAILABLE",
      request.ai?.model ?? ""
    );
    if (view && request.ai?.enabled === true) {
      ai = await requestCatalogAiProposals({
        candidates: normalizedTopics,
        view,
        request: request.ai,
        client: this.deps.aiClient ?? null,
        now: () => startedAt,
      });
    }
    mark("ai");

    const proposalsByCandidate = new Map<string, CatalogAiProposal>();
    for (const proposal of ai.proposals) {
      if (!proposalsByCandidate.has(proposal.candidateId)) {
        proposalsByCandidate.set(proposal.candidateId, proposal);
      }
    }
    const annotatedMatches: CanonicalRows = matches.map((match) => {
      const proposal = proposalsByCandidate.get(match.candidateId);
      return proposal ? { ...match, aiProposalRef: proposal.proposalId } : match;
    });

    const apply = refuseCatalogApply(request.bypass);
    const applyConflict = applyConflictOf(apply);
    const conflicts: CatalogConflict[] = buildCatalogConflicts({
      validationIssues: validated.issues,
      warnings: program.warnings,
      collisions,
      canonicalAgreements,
      matches: annotatedMatches,
      ai,
      apply,
      applyConflict,
    });
    if (snapshotConflict) conflicts.push(snapshotConflict);
    mark("conflicts");

    const byOrigin = zeroOrigins();
    for (const topic of normalizedTopics) byOrigin[topic.origin] += 1;

    const severity = countConflictsBySeverity(conflicts);
    const counts: CatalogAuditCounts = {
      positions: program.positions.length,
      disciplines: program.positions.reduce((total, item) => total + item.disciplines.length, 0),
      publishedLabels: program.measurements.reduce((total, item) => total + item.publishedLabels, 0),
      labelsWithoutCopula: program.measurements.reduce((total, item) => total + item.labelsWithoutCopula, 0),
      freeUnits: program.measurements.reduce((total, item) => total + item.freeUnits, 0),
      derivedTerms: program.measurements.reduce((total, item) => total + item.derivedTerms, 0),
      candidates: normalizedTopics.length,
      collisions: collisions.length + canonicalAgreements.length,
      matches: annotatedMatches.length,
      conflicts: conflicts.length,
      blockingConflicts: severity.blocking,
      reviewConflicts: severity.review,
      aiProposals: ai.proposals.length,
      aiRejections: ai.rejections.length,
      byClassification: countByClassification(annotatedMatches),
      byOrigin,
    };

    timings.total = Date.now() - origin;
    return {
      agent: CATALOG_AGENT_NAME,
      phase: CATALOG_PHASE,
      schemaVersion: CATALOG_AUDIT_SCHEMA_VERSION,
      mode: "audit-only",
      applyBlocked: true,
      databaseConnected: false,
      migrationsRun: false,
      seedsRun: false,
      startedAt,
      finishedAt: this.now(),
      timingsMs: timings,
      provenance: validated.provenance,
      validation: validated.issues,
      program,
      normalizedTopics,
      collisions: [...collisions, ...canonicalAgreements],
      matches: annotatedMatches,
      conflicts,
      ai,
      counts,
      apply,
    };
  }

  /**
   * Le o snapshot pela costura injetada ou pelo arquivo de leitura-only da FASE 4.
   * Nunca e uma conexao de banco: o unico efeito de borda possivel e a leitura do
   * snapshot versionado. Falha devolve null e o conflito ja fica registrado pelo run().
   */
  private readSnapshotView(): CatalogSnapshotView | null {
    try {
      return this.deps.snapshotReader
        ? this.deps.snapshotReader()
        : readCatalogSnapshot(this.deps.snapshotPath ?? undefined);
    } catch {
      return null;
    }
  }

  /**
   * Fluxo completo de intake de um novo curso/concurso (FASE 4B), sempre em AUDIT.
   *
   * run() continua sendo a autoridade deterministic e nao e reescrito aqui: o que se
   * acrescenta e a medida dos fatos do edital e a projecao em proposta revisavel mais
   * relatorio humano. APPLY nunca sobe para escrita: o modo pedido apenas decide se
   * uma bandeira de bypass entra no registro de recusa.
   *
   * Custo conhecido: a mesma fonte e validada de novo para medir os fatos (banca,
   * orgao, vagas, pesos). validateCatalogSource e deterministico, nao abre rede nem
   * banco; para binario grande isso reextrai o texto uma segunda vez.
   */
  async analyze(request: CatalogAgentRequest): Promise<CatalogAgentAnalysis> {
    const mapped = toCatalogAuditRequest(request);
    const audit = await this.run(mapped.audit);
    const validated = await validateCatalogSource(mapped.audit.source);

    const disciplineNames: string[] = [];
    for (const position of audit.program.positions) {
      for (const discipline of position.disciplines) {
        if (!disciplineNames.includes(discipline.publishedName)) {
          disciplineNames.push(discipline.publishedName);
        }
      }
    }

    const facts = extractContestFacts({
      text: validated.text,
      disciplineNames,
      positionTitles: audit.program.positions.map((position) => position.publishedTitle),
      declared: request.contest,
    });
    const contest = buildContestProfile(facts);

    const view = this.readSnapshotView();
    const canonicalTopics: Record<string, CanonicalTopicIndexEntry> = {};
    if (view) {
      const subjectNameById = new Map(view.subjects.map((subject) => [subject.id, subject.name]));
      for (const topic of view.topics) {
        canonicalTopics[topic.id] = {
          name: topic.name,
          subjectName: subjectNameById.get(topic.subjectId) ?? null,
        };
      }
    }

    return buildCatalogAnalysis({
      request,
      audit,
      mapping: mapped.mapping,
      facts,
      contest,
      canonicalTopics,
    });
  }
}

/** Atalho usado pelos testes e pela CLI de leitura da proxima fase. */
export async function runCourseCatalogAudit(
  request: CatalogAuditRequest,
  deps: CourseCatalogAgentDeps = {}
): Promise<CatalogAuditResult> {
  return new CourseCatalogAgent(deps).run(request);
}

/** Origens conhecidas, exposta para o teste afirmar que nenhuma sumiu. */
export const AGENT_TOPIC_ORIGINS = TOPIC_ORIGINS;
