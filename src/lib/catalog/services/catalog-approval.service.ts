/**
 * CatalogApprovalService (FASE 5) - o contrato serializavel da decisao humana.
 *
 * A FASE 4B sabia descrever a decisao em prosa (campo `decision`). Aqui nasce o
 * artefato: o REGISTRO do que um humano decidiu sobre uma analise inteira, assinado
 * por tres vinculos (`proposalId`, `analysisDigest`, `proposalDigest`), conferivel sem
 * banco e produzivel sem rede.
 *
 * O que este modulo deliberadamente nao faz:
 *  - nao escreve em lugar nenhum: sem INSERT/UPDATE/DELETE, sem migration, sem seed, sem
 *    cliente de banco, sem rota, sem UI. Persistir e fase futura; aqui mora a fonte da
 *    verdade do contrato, e e assim que a FASE 5 consegue ser revisada antes de existir
 *    qualquer tela que possa errar;
 *  - nao executa APPLY nem abre caminho para ele. `approved = true` no gate e condicao
 *    necessaria, nunca suficiente: a unica palavra sobre `apply` continua sendo
 *    `refuseCatalogApply` (APPLY_DISABLED_IN_AUDIT_PHASE) em catalog-apply.service.ts,
 *    arquivo que esta fase nao toca;
 *  - nao toca IA: nenhum import de provedor, nenhum call, nenhuma leitura de ambiente. A
 *    decisao de um humano sobre as regras deterministicas nao pode depender do DeepSeek
 *    estar no ar amanha;
 *  - nao muta registro: nao ha `updatedAt` nem `deletedAt`. Corrigir uma decisao e
 *    assinar outro registro com `supersedesApprovalId`, preservando o anterior.
 *
 * O hash vem de catalog-digest.ts, nao de source-validator.service.ts: e o acoplamento
 * que esta fase desfaz, porque o validador de fonte importa extrator de documento e o
 * contrato de aprovacao nao pode carregar isso.
 */
import "server-only";
import { sha256Hex } from "./catalog-digest";
import {
  CATALOG_APPROVAL_SCHEMA_VERSION,
  CATALOG_APPROVAL_STATUSES,
  type CatalogApproval,
  type CatalogApprovalDraft,
  type CatalogApprovalGate,
  type CatalogApprovalIssue,
  type CatalogApprovalIssueCode,
  type CatalogApprovalLookupResult,
  type CatalogApprovalProposalBinding,
  type CatalogApprovalValidation,
  type CatalogDecisionProjection,
} from "../types/catalog-approval";
import type { CatalogAgentAnalysis } from "../types/catalog-agent";

export const CATALOG_APPROVAL_PROPOSAL_PREFIX = "PRP-";
export const CATALOG_APPROVAL_ID_PREFIX = "APR-";
/** Comprimentos fixos: curtos o bastante para caber em log, longos o bastante para nao colidir. */
export const CATALOG_PROPOSAL_ID_HEX = 24;
export const CATALOG_APPROVAL_ID_HEX = 32;
export const CATALOG_APPROVAL_DECIDED_BY_MAX = 200;
export const CATALOG_APPROVAL_NOTE_MAX = 500;

const HEX64_RE = /^[0-9a-f]{64}$/;
const PROPOSAL_ID_RE = /^PRP-[0-9a-f]{24}$/;
const APPROVAL_ID_RE = /^APR-[0-9a-f]{32}$/;
/** ISO-8601 com fuso obrigatorio (Z ou +/-HH:MM). Data nua como "2026-10-03" e recusada. */
const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/;

/**
 * Conflitos que nao pertencem decisao. Sao ruido de reexecucao: nascem da resposta do
 * provedor ou do estado de APPLY e desaparecem sem que nenhuma regra do catalogo mude.
 * Se entrassem no digest, uma reconsulta ao DeepSeek invalidaria a assinatura de um
 * humano - o contrario exato da separacao de camadas que a FASE 4B exige.
 */
const NON_DECISION_CONFLICT_CODES: ReadonlySet<string> = new Set([
  "INVALID_AI_PROPOSAL",
  "AI_OVERREACH",
  "APPLY_DISABLED_IN_AUDIT_PHASE",
]);

/** Identidades de maquina: quem decide e pessoa, e um provedor no campo nunca e revisor. */
const MACHINE_IDENTITIES: ReadonlySet<string> = new Set([
  "deepseek",
  "course-catalog-agent",
  "coursecatalogagent",
  "catalog-agent",
  "agent",
  "ai",
  "ia",
  "modelo",
  "model",
  "ia-proposal",
  "sistema",
  "automation",
]);

/**
 * Provedores, credenciais, caminhos e strings de conexao nao entram num registro de
 * decisao. A busca e literal e barata: o registro pode virar coluna publica um dia, e
 * um token de chave no texto de um revisor nao pode sobreviver a isso.
 */
const FORBIDDEN_NOTE_TOKENS: readonly string[] = [
  "deepseek",
  "supabase",
  "cloudflare",
  "bucket",
  "service_role",
  "service role",
  "anon_key",
  "api_key",
  "apikey",
  "secret",
  "password",
  "bearer",
  "eyj",
  "sk-",
  "http://",
  "https://",
  "postgres://",
  ".env",
  "c:\\",
  "d:\\",
  "/var/",
  "/home/",
  "/usr/",
];

/** Objeto plain aceito pelo canonical JSON: chaves string, valores desconhecidos. */
interface JsonRecord {
  [key: string]: unknown;
}

/** Chave de ordenacao estavel, sem arrow no tipo para o modulo continuar legivel. */
interface KeyFn<T> {
  (item: T): string;
}

/** Relogio injetavel e a porta de teste para `decidedAt` no futuro. */
export interface CatalogApprovalValidationOptions {
  /**Ausente: le o relogio real, unico momento em que este modulo toca relogio. */
  now?(): string;
  /** signApproval valida antes de existir approvalId; por isso a checagem e opcional. */
  checkApprovalId?: boolean;
}

export class CatalogApprovalError extends Error {
  readonly code: CatalogApprovalIssueCode;
  readonly field?: string;

  constructor(code: CatalogApprovalIssueCode, message: string, field?: string) {
    super(message);
    this.name = "CatalogApprovalError";
    this.code = code;
    this.field = field;
  }
}

function issue(code: CatalogApprovalIssueCode, message: string, field?: string): CatalogApprovalIssue {
  return field === undefined ? { code, message } : { code, message, field };
}

/**
 * Ordem UTF-16 pura: `[a, b].sort()` usa unidades de codigo, sem collation e sem locale,
 * entao o mesmo par de chaves ordena igual em qualquer maquina. Evita `localeCompare`,
 * cujo resultado muda com o idioma do host e quebraria o digest.
 */
function compareUtf16(a: string, b: string): number {
  if (a === b) return 0;
  const ordered = [a, b].sort();
  return ordered[0] === a ? -1 : 1;
}

function sortedBy<T>(items: readonly T[], key: KeyFn<T>): T[] {
  return items.slice().sort((a, b) => (compareUtf16(key(a), key(b))));
}

function sortedUnique(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort();
}
/**
 * Canonical JSON do dominio de aprovacao: chaves em ordem UTF-16 ascendente, saida
 * compacta, propriedade com valor `undefined` omitida. Rejeita o que JSON.stringify
 * serializaria de modo enganoso (funcao, symbol, bigint, NaN, Infinity, Date, Map, Set,
 * instancia de classe), porque um digest sobre algo que nao existe no JSON e uma
 * assinatura sobre nada. A raiz `undefined` tambem e recusada: nao ha decisao vazia.
 */
export function canonicalApprovalJson(value: unknown, path = "$"): string {
  if (value === null) return "null";
  const kind = typeof value;
  if (kind === "string" || kind === "boolean") return JSON.stringify(value);
  if (kind === "number") {
    if (!Number.isFinite(value as number)) {
      throw new CatalogApprovalError("NOT_JSON_SAFE", `Valor numerico nao serializavel em ${path}.`, path);
    }
    return JSON.stringify(value);
  }
  if (kind === "undefined") {
    throw new CatalogApprovalError("NOT_JSON_SAFE", `Undefined nao e valor de decisao em ${path}.`, path);
  }
  if (kind === "function" || kind === "symbol" || kind === "bigint") {
    throw new CatalogApprovalError("NOT_JSON_SAFE", `Tipo ${kind} nao existe em JSON: ${path}.`, path);
  }
  if (Array.isArray(value)) {
    const items = value.map((item, index) => (canonicalApprovalJson(item, `${path}[${index}]`)));
    return `[${items.join(",")}]`;
  }
  if (value instanceof Date || value instanceof Map || value instanceof Set) {
    throw new CatalogApprovalError("NOT_JSON_SAFE", `Objeto de API nao existe em JSON: ${path}.`, path);
  }
  const proto = Object.getPrototypeOf(value) as unknown;
  if (proto !== Object.prototype && proto !== null) {
    throw new CatalogApprovalError("NOT_JSON_SAFE", `Instancia de classe nao existe em JSON: ${path}.`, path);
  }
  const record = value as JsonRecord;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const child = record[key];
    if (child === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${canonicalApprovalJson(child, `${path}.${key}`)}`);
  }
  return `{${parts.join(",")}}`;
}

/**
 * A projecao de decisao: o que o humano aprovou. Entri por contrato, sai por contrato.
 *
 * FORA (e nao e esquecimento, e decisao):
 *  - `audit.*` inteiro: timings, startedAt, finishedAt e o `audit.ai` duplicado sao
 *    relogio e custo, mudam a cada execucao e nao mudam a decisao;
 *  - `report`: texto derivado do relogio do audit, jamais uma segunda autoridade;
 *  - `aiProposal` e os `aiAssist` por linha: mesma razao dos conflitos de IA;
 *  - `apply`, `applyStatus`, `requestedMode`: estado de APPLY, que esta fase nao comanda;
 *  - `sourceMapping.note` e `source.capturedAt`: prosa e relogio da borda de ingestao;
 *  - `conflicts` de IA (INVALID_AI_PROPOSAL, AI_OVERREACH) e APPLY_DISABLED_IN_AUDIT_PHASE.
 *
 * FORA por derivacao (o mesmo fato nao pode ser assinado duas vezes):
 *  - `subjects[].weights`, `reason`, `evidence`: os pesos ja vivem em `contest.facts`
 *    (field "weight") e `reason`/`evidence` se deduzem de `origin` + `ruleApplied`;
 *  - `topics[].sourceLabel`, `reason`, `evidence`: `candidateId` + `proposedTopic` ja
 *    nomeiam a unidade publicada;
 *  - `matches[].rawName`/`normalizedName`/`slug`/`reducedKey`/`derivationRule`: chaves de
 *    trabalho do matcher da FASE 4; a decisao casada e `canonicalTopicId` + classificacao;
 *  - `collisions[].rawNames` e os booleans de diagnostico: `key` + `candidateIds` definem
 *    o grupo; `deduplicated`/`discardedEntries` sao constantes false/0 da fase.
 *
 * DENTRO: identidade da analise, fonte mapeada (kind e contagem de caracteres, sem
 * relogio), concurso declarado + publicado SEM slug, e as cinco listas de proposta
 * ordenadas por id estavel, mais o resumo recalculado sobre os conflitos de decisao.
 */
export function decisionProjectionOf(analysis: CatalogAgentAnalysis): CatalogDecisionProjection {
  const conflicts = sortedBy(
    analysis.conflicts.filter((item) => (!NON_DECISION_CONFLICT_CODES.has(item.code))),
    (item) => (item.conflictId)
  );
  return {
    agent: analysis.agent,
    phase: analysis.phase,
    schemaVersion: analysis.schemaVersion,
    mode: analysis.mode,
    sourceMapping: {
      requestedType: analysis.sourceMapping.requestedType,
      kind: analysis.sourceMapping.kind,
      decodedBytes: analysis.sourceMapping.decodedBytes,
      contentCharacters: analysis.sourceMapping.contentCharacters,
    },
    contest: {
      name: analysis.contest.name ?? null,
      organ: analysis.contest.organ ?? null,
      board: analysis.contest.board ?? null,
      position: analysis.contest.position ?? null,
      level: analysis.contest.level ?? null,
      vacancies: analysis.contest.vacancies ?? null,
      questions: analysis.contest.questions ?? null,
      examDate: analysis.contest.examDate ?? null,
      facts: sortedBy(analysis.contest.facts, (item) => (item.factId)).map((item) => ({
        factId: item.factId,
        field: item.field,
        value: item.value,
        evidence: item.evidence,
        origin: item.origin,
        rule: item.rule,
        disciplineName: item.disciplineName ?? null,
      })),
      missingFields: sortedUnique(analysis.contest.missingFields),
    },
    subjects: sortedBy(analysis.subjects, (item) => (item.proposalId)).map((item) => ({
      proposalId: item.proposalId,
      publishedName: item.publishedName,
      origin: item.origin,
      classification: item.classification,
      ruleApplied: item.ruleApplied,
      canonicalSubjectId: item.canonicalSubjectId,
      canonicalSubjectName: item.canonicalSubjectName,
      aliasApplied: item.aliasApplied,
      topicsTotal: item.topicsTotal,
      reusedTopics: item.reusedTopics,
      newTopics: item.newTopics,
      pendingTopics: item.pendingTopics,
      blockedTopics: item.blockedTopics,
    })),
    topics: sortedBy(analysis.topics, (item) => (item.proposalId)).map((item) => ({
      proposalId: item.proposalId,
      candidateId: item.candidateId,
      classification: item.classification,
      ruleApplied: item.ruleApplied,
      origin: item.origin,
      canonicalTopic: item.canonicalTopic,
      canonicalTopicId: item.canonicalTopicId,
      proposedTopic: item.proposedTopic,
      positionTitle: item.positionTitle,
      disciplineName: item.disciplineName,
      parentLabel: item.parentLabel ?? null,
      collisionIds: sortedUnique(item.collisionIds),
    })),
    matches: sortedBy(analysis.matches, (item) => (item.matchId)).map((item) => ({
      matchId: item.matchId,
      candidateId: item.candidateId,
      classification: item.classification,
      ruleApplied: item.ruleApplied,
      origin: item.origin,
      canonicalTopicId: item.canonicalTopicId,
      canonicalSubjectId: item.canonicalSubjectId,
      resolutionMethod: item.resolutionMethod,
      ambiguousCanonicalIds: sortedUnique(item.ambiguousCanonicalIds),
      proposedAsNewCanonical: item.proposedAsNewCanonical,
      subjectAliasApplied: item.subjectAliasApplied,
    })),
    collisions: sortedBy(analysis.collisions, (item) => (item.collisionId)).map((item) => ({
      collisionId: item.collisionId,
      kind: item.kind,
      key: item.key,
      candidateIds: sortedUnique(item.candidateIds),
      severity: item.severity,
    })),
    conflicts: conflicts.map((item) => ({
      conflictId: item.conflictId,
      code: item.code,
      severity: item.severity,
      entities: sortedUnique(item.entities),
    })),
    summary: {
      positions: analysis.summary.positions,
      subjectsFound: analysis.summary.subjectsFound,
      topicsFound: analysis.summary.topicsFound,
      reuseCatalog: analysis.summary.reuseCatalog,
      newCanonical: analysis.summary.newCanonical,
      ambiguous: analysis.summary.ambiguous,
      blocked: analysis.summary.blocked,
      pendingReview: analysis.summary.pendingReview,
      collisions: analysis.summary.collisions,
      collisionGroups: analysis.summary.collisionGroups,
      collisionsMembers: analysis.summary.collisionsMembers,
      conflicts: conflicts.length,
      blockingConflicts: conflicts.filter((item) => (item.severity === "blocking")).length,
      reviewConflicts: conflicts.filter((item) => (item.severity === "review")).length,
      byRule: analysis.summary.byRule,
      byOrigin: analysis.summary.byOrigin,
    },
  };
}

/**
 * O digest da fonte NAO e recomputado do texto: e a copia exata da prova que a FASE 4 ja
 * assinou (`provenance.analysedTextSha256`). Re-derivar do conteudo criaria dois caminhos
 * para o mesmo hash e a possibilidade silenciosa de divergirem.
 */
export function analysisDigestOf(analysis: CatalogAgentAnalysis): string {
  return analysis.source.analysedTextSha256;
}

/** Identidade da analise inteira - nunca de um item: por isso so entra o digest do texto analisado. */
export function proposalIdOf(analysis: CatalogAgentAnalysis): string {
  const material = [
    analysis.agent,
    analysis.phase,
    String(analysis.schemaVersion),
    analysisDigestOf(analysis),
  ].join("|");
  return CATALOG_APPROVAL_PROPOSAL_PREFIX + sha256Hex(material).slice(0, CATALOG_PROPOSAL_ID_HEX);
}

export function proposalDigestOf(analysis: CatalogAgentAnalysis): string {
  return sha256Hex(canonicalApprovalJson(decisionProjectionOf(analysis)));
}

export function proposalBindingOf(analysis: CatalogAgentAnalysis): CatalogApprovalProposalBinding {
  return {
    proposalId: proposalIdOf(analysis),
    analysisDigest: analysisDigestOf(analysis),
    proposalDigest: proposalDigestOf(analysis),
  };
}

/**
 * O approvalId nasce do conteudo, com o proprio campo fora. Editar qualquer letra do
 * registro muda o id: reescrever uma decisao sem quebrar a assinatura e imposible.
 */
export function approvalIdOf(record: CatalogApproval | CatalogApprovalDraft): string {
  const unsigned: JsonRecord = {};
  for (const key of Object.keys(record).sort()) {
    if (key === "approvalId") continue;
    const value = (record as unknown as JsonRecord)[key];
    if (value === undefined) continue;
    unsigned[key] = value;
  }
  return CATALOG_APPROVAL_ID_PREFIX + sha256Hex(canonicalApprovalJson(unsigned)).slice(0, CATALOG_APPROVAL_ID_HEX);
}
/** Vista string para checagem de literal: um payload de fora pode trazer qualquer valor. */
const APPROVAL_STATUS_VALUES: readonly string[] = CATALOG_APPROVAL_STATUSES;

function hasForbiddenToken(text: string): boolean {
  const haystack = text.toLowerCase();
  for (const token of FORBIDDEN_NOTE_TOKENS) {
    if (haystack.indexOf(token) !== -1) return true;
  }
  return false;
}

/** O texto cru do canonical nao ecoa payload de fora: so a frase ja fixada por codigo. */
function notJsonSafeIssue(error: unknown): CatalogApprovalIssue {
  if (error instanceof CatalogApprovalError) return issue("NOT_JSON_SAFE", error.message, error.field);
  return issue("NOT_JSON_SAFE", "O registro contem um valor que nao existe em JSON.");
}

/**
 * Checagem campo a campo. `now` existe para o teste de relogio poder ser deterministico;
 * ausente, le o relogio real - o unico instante em que este modulo toca relogio.
 */
function structuralIssues(
  record: CatalogApproval,
  options: CatalogApprovalValidationOptions
): CatalogApprovalIssue[] {
  const issues: CatalogApprovalIssue[] = [];

  let jsonSafe = true;
  try {
    canonicalApprovalJson(record);
  } catch (error) {
    jsonSafe = false;
    issues.push(notJsonSafeIssue(error));
  }

  if (record.schemaVersion !== CATALOG_APPROVAL_SCHEMA_VERSION) {
    issues.push(issue(
      "SCHEMA_VERSION_INVALID",
      `schemaVersion divergente: somente "${CATALOG_APPROVAL_SCHEMA_VERSION}" e aceito.`,
      "schemaVersion"
    ));
  }
  if (!PROPOSAL_ID_RE.test(String(record.proposalId))) {
    issues.push(issue("PROPOSAL_ID_INVALID", "proposalId precisa ser PRP- seguido de 24 hex minusculos.", "proposalId"));
  }
  if (!HEX64_RE.test(String(record.analysisDigest))) {
    issues.push(issue("ANALYSIS_DIGEST_INVALID", "analysisDigest precisa ser sha256 em 64 hex minusculos.", "analysisDigest"));
  }
  if (!HEX64_RE.test(String(record.proposalDigest))) {
    issues.push(issue("PROPOSAL_DIGEST_INVALID", "proposalDigest precisa ser sha256 em 64 hex minusculos.", "proposalDigest"));
  }
  if (!APPROVAL_ID_RE.test(String(record.approvalId))) {
    issues.push(issue("APPROVAL_ID_INVALID", "approvalId precisa ser APR- seguido de 32 hex minusculos.", "approvalId"));
  } else if (jsonSafe && options.checkApprovalId !== false) {
    if (approvalIdOf(record) !== record.approvalId) {
      issues.push(issue(
        "APPROVAL_ID_MISMATCH",
        "O conteudo do registro nao bate com o approvalId: esta decisao foi editada depois de assinada.",
        "approvalId"
      ));
    }
  }

  // Literal exato: sem trim, sem toLowerCase, sem sinonimo, sem "pendente".
  const rawStatus = typeof record.status === "string" ? record.status : "";
  if (!APPROVAL_STATUS_VALUES.includes(rawStatus)) {
    issues.push(issue(
      "STATUS_INVALID",
      "status aceita exatamente aprovado ou rejeitado: minusculo, sem espaco, sem sinonimo, sem terceiro valor.",
      "status"
    ));
  }

  const rawDecidedBy = typeof record.decidedBy === "string" ? record.decidedBy : "";
  const who = rawDecidedBy.trim().toLowerCase();
  const decidedByTooLong = rawDecidedBy.slice(0, CATALOG_APPROVAL_DECIDED_BY_MAX).length !== rawDecidedBy.length;
  if (who.length === 0 || decidedByTooLong || MACHINE_IDENTITIES.has(who)) {
    issues.push(issue(
      "DECIDED_BY_INVALID",
      "decidedBy precisa ser uma pessoa: nunca vazio, nunca espaco, nunca identidade de maquina ou provedor.",
      "decidedBy"
    ));
  }

  const rawDecidedAt = typeof record.decidedAt === "string" ? record.decidedAt : "";
  const decidedAtMs = ISO_8601_RE.test(rawDecidedAt) ? Date.parse(rawDecidedAt) : Number.NaN;
  if (Number.isNaN(decidedAtMs)) {
    issues.push(issue(
      "DECIDED_AT_INVALID",
      "decidedAt precisa ser ISO-8601 com fuso obrigatorio: Z ou +/-HH:MM. Data nua nao decide nada.",
      "decidedAt"
    ));
  } else {
    const nowIso = options.now === undefined ? new Date().toISOString() : options.now();
    const parsedNow = Date.parse(nowIso);
    const nowMs = Number.isNaN(parsedNow) ? decidedAtMs : parsedNow;
    if (Math.sign(decidedAtMs - nowMs) === 1) {
      issues.push(issue("DECIDED_AT_FUTURE", "decidedAt esta no futuro em relacao ao relogio da conferenca.", "decidedAt"));
    }
  }

  const note = record.note;
  if (note !== undefined && note !== null) {
    const rawNote = typeof note === "string" ? note : " ";
    const noteTooLong = rawNote.slice(0, CATALOG_APPROVAL_NOTE_MAX).length !== rawNote.length;
    if (typeof note !== "string" || noteTooLong || hasForbiddenToken(rawNote)) {
      issues.push(issue(
        "NOTE_INVALID",
        "note aceita prosa curta do revisor: sem URL, sem caminho de disco, sem credencial, sem nome de provedor.",
        "note"
      ));
    }
  }

  const supersedes = record.supersedesApprovalId;
  if (supersedes !== undefined && supersedes !== null) {
    const reference = typeof supersedes === "string" ? supersedes : " ";
    if (reference === record.approvalId) {
      issues.push(issue(
        "SUPERSEDES_SELF",
        "Um registro nao pode substituir a si mesmo: corrigir uma decisao exige registro novo.",
        "supersedesApprovalId"
      ));
    } else if (!APPROVAL_ID_RE.test(reference)) {
      issues.push(issue(
        "SUPERSEDES_UNKNOWN",
        "supersedesApprovalId precisa ter o mesmo formato de um approvalId assinado.",
        "supersedesApprovalId"
      ));
    }
  }

  return issues;
}

/** Validacao estrutural: `ok` somente com zero ocorrencias. */
export function validateApproval(
  record: CatalogApproval,
  options: CatalogApprovalValidationOptions = {}
): CatalogApprovalValidation {
  const issues = structuralIssues(record, { ...options, checkApprovalId: options.checkApprovalId ?? true });
  return { ok: issues.length === 0, issues };
}

/**
 * Assina um rascunho: `schemaVersion` e `approvalId` nascem aqui, nunca do caller, e e
 * assim que a imutabilidade vale sem banco. Rascunho estruturalmente invalido e recusado
 * antes da assinatura: mintar um registro que o proprio gate nao leria seria pior do que
 * devolver o erro agora.
 */
export function signApproval(
  draft: CatalogApprovalDraft,
  options: CatalogApprovalValidationOptions = {}
): CatalogApproval {
  const record: CatalogApproval = {
    schemaVersion: CATALOG_APPROVAL_SCHEMA_VERSION,
    approvalId: "",
    proposalId: draft.proposalId,
    analysisDigest: draft.analysisDigest,
    proposalDigest: draft.proposalDigest,
    status: draft.status,
    decidedBy: draft.decidedBy,
    decidedAt: draft.decidedAt,
    note: draft.note,
    supersedesApprovalId: draft.supersedesApprovalId,
  };
  const approvalId = approvalIdOf(record);
  const signed: CatalogApproval = { ...record, approvalId };
  const first = structuralIssues(signed, { ...options, checkApprovalId: true })[0];
  if (first !== undefined) throw new CatalogApprovalError(first.code, first.message, first.field);
  return signed;
}
/**
 * Os tres vinculos conferidos um a um, para o gate poder apontar qual rompeu em vez de
 * devolver um generico "a decisao nao vale".
 */
function matchingIssues(
  analysis: CatalogAgentAnalysis,
  approval: CatalogApproval
): CatalogApprovalIssue[] {
  const binding = proposalBindingOf(analysis);
  const issues: CatalogApprovalIssue[] = [];
  if (approval.proposalId !== binding.proposalId) {
    issues.push(issue("PROPOSAL_ID_MISMATCH", "A decisao aponta para outra analise: proposalId nao confere.", "proposalId"));
  }
  if (approval.analysisDigest !== binding.analysisDigest) {
    issues.push(issue("ANALYSIS_DIGEST_MISMATCH", "O texto analisado mudou: esta decisao nao cobre esta fonte.", "analysisDigest"));
  }
  if (approval.proposalDigest !== binding.proposalDigest) {
    issues.push(issue("PROPOSAL_DIGEST_MISMATCH", "A proposta mudou depois da decisao: o conteudo aprovado nao e este.", "proposalDigest"));
  }
  return issues;
}

/** Assercao por excecao, com o mesmo codigo estavel que o gate devolve em issues. */
export function assertApprovalMatchesProposal(
  analysis: CatalogAgentAnalysis,
  approval: CatalogApproval
): void {
  const first = matchingIssues(analysis, approval)[0];
  if (first !== undefined) throw new CatalogApprovalError(first.code, first.message, first.field);
}

/**
 * A decisao vigente e o fim da cadeia de supersessao, nao o registro mais recente por
 * relogio: duas decisoes assinadas na mesma hora continuariam ambiguas se a ordem fosse
 * deduzida de timestamp. Sem `pendente`: ausencia devolve `found = false` com
 * APPROVAL_MISSING, e o registro antigo permanece legivel no `chain` para auditoria.
 */
export function findCurrentApproval(
  proposalId: string,
  records: readonly CatalogApproval[]
): CatalogApprovalLookupResult {
  const issues: CatalogApprovalIssue[] = [];
  const candidates = records.filter((item) => (item.proposalId === proposalId));
  if (candidates.length === 0) {
    return {
      found: false,
      approval: null,
      chain: [],
      issues: [issue("APPROVAL_MISSING", `Nao existe decisao registrada para ${proposalId}.`, "proposalId")],
    };
  }

  const byId = new Map<string, CatalogApproval>();
  const children = new Map<string, CatalogApproval[]>();
  const roots: CatalogApproval[] = [];
  for (const item of candidates) {
    if (byId.has(item.approvalId)) {
      issues.push(issue(
        "SUPERSEDES_AMBIGUOUS",
        "Dois registros distintos compartilham o mesmo approvalId: a cadeia nao pode ser ordenada.",
        "approvalId"
      ));
      continue;
    }
    byId.set(item.approvalId, item);
    const parent = item.supersedesApprovalId;
    if (parent === undefined || parent === null) {
      roots.push(item);
      continue;
    }
    if (parent === item.approvalId) {
      issues.push(issue(
        "SUPERSEDES_SELF",
        "Um registro nao pode substituir a si mesmo: corrigir uma decisao exige registro novo.",
        "supersedesApprovalId"
      ));
      continue;
    }
    const siblings = children.get(parent);
    if (siblings === undefined) children.set(parent, [item]);
    else siblings.push(item);
  }

  if (roots.length !== 1) {
    issues.push(issue(
      roots.length === 0 ? "SUPERSEDES_CYCLE" : "SUPERSEDES_AMBIGUOUS",
      roots.length === 0
        ? "Nenhum registro da cadeia esta sem pai: a supersessao fecha sobre si mesma."
        : "A proposta tem mais de um primeiro registro: nao existe ordem unica de decisao.",
      "supersedesApprovalId"
    ));
  }

  const chain: CatalogApproval[] = [];
  const visited = new Set<string>();
  let cursor: CatalogApproval | undefined = roots[0];
  while (cursor !== undefined) {
    if (visited.has(cursor.approvalId)) {
      issues.push(issue("SUPERSEDES_CYCLE", "A cadeia de supersessao reencontra um registro ja lido.", "supersedesApprovalId"));
      break;
    }
    visited.add(cursor.approvalId);
    chain.push(cursor);
    const next = children.get(cursor.approvalId);
    if (next !== undefined && next.length !== 1) {
      issues.push(issue(
        "SUPERSEDES_AMBIGUOUS",
        "Duas decisoes afirmam substituir a mesma decisao vigente.",
        "supersedesApprovalId"
      ));
    }
    cursor = next === undefined ? undefined : next[0];
  }

  const unreachable = candidates.filter((item) => (!visited.has(item.approvalId)));
  if (unreachable.length !== 0) {
    const dangling = unreachable.filter((item) => {
      const parent = item.supersedesApprovalId;
      return parent === undefined || parent === null || !byId.has(parent);
    });
    issues.push(issue(
      dangling.length === 0 ? "SUPERSEDES_CYCLE" : "SUPERSEDES_UNKNOWN",
      dangling.length === 0
        ? "Ha decisao que nunca alcanga da cadeia: a supersessao nao e linear nesta proposta."
        : "Ha decisao cuja supersessao aponta para um approvalId que nao existe nesta proposta.",
      "supersedesApprovalId"
    ));
  }

  const current = chain[chain.length - 1];
  if (current === undefined) {
    return { found: false, approval: null, chain: [], issues };
  }
  const structural = validateApproval(current).issues;
  issues.push(...structural);
  const usable = structural.length === 0;
  return { found: usable, approval: usable ? current : null, chain, issues };
}

/**
 * O gate em memoria. Leitura pura: nao grava, nao chama rota, nao abre IA, nao executa
 * APPLY. `approved = true` autoriza apenas que uma fase futura peca autorizacao de
 * escrita em outro lugar - `refuseCatalogApply` continua mandando.
 */
/**
 * Diagnostico de ausencia. Um registro sobre OUTRA fonte e a explicacao mais provavel
 * de nao haver decisao vigente, e devolver so APPROVAL_MISSING obrigaria o humano a
 * adivinhar. O vinculo continua conferido por proposalId (contrato assinado): isto aqui
 * apenas explica o vazio, nunca afrouxa a busca.
 */
function absenceIssues(
  analysisValue: CatalogAgentAnalysis,
  binding: CatalogApprovalProposalBinding,
  records: readonly CatalogApproval[]
):
 CatalogApprovalIssue[] {
  const encontrados = new Set<string>();
  for (const record of records) {
    if (record.proposalId === binding.proposalId) continue;
    if (record.analysisDigest !== binding.analysisDigest) encontrados.add("ANALYSIS_DIGEST_MISMATCH");
    else encontrados.add("PROPOSAL_ID_MISMATCH");
  }
  const out: CatalogApprovalIssue[] = [];
  if (encontrados.has("ANALYSIS_DIGEST_MISMATCH")) {
    out.push(issue("ANALYSIS_DIGEST_MISMATCH", "Ha decisao registrada, mas sobre outra fonte: o texto analisado nao e o mesmo.", "analysisDigest"));
  }
  if (encontrados.has("PROPOSAL_ID_MISMATCH")) {
    out.push(issue("PROPOSAL_ID_MISMATCH", "Ha decisao registrada, mas sobre outra analise: agente, fase ou schema divergem.", "proposalId"));
  }
  return out;
}
export function buildApprovalGate(
  analysis: CatalogAgentAnalysis,
  records: readonly CatalogApproval[]
): CatalogApprovalGate {
  const binding = proposalBindingOf(analysis);
  const lookup = findCurrentApproval(binding.proposalId, records);
  const issues = lookup.issues.slice();
  const approval = lookup.approval;
  if (approval === null) {
    issues.push(...absenceIssues(analysis, binding, records));
    if (!issues.some((item) => (item.code === "APPROVAL_MISSING"))) {
      issues.push(issue("APPROVAL_MISSING", `Nao existe decisao vigente para ${binding.proposalId}.`, "approval"));
    }
  } else {
    issues.push(...matchingIssues(analysis, approval));
    if (approval.status !== "aprovado") {
      issues.push(issue(
        "APPROVAL_REJECTED",
        "A decisao vigente e rejeitado: esta analise nao segue para lugar nenhum.",
        "status"
      ));
    }
  }
  return {
    approved: approval !== null && approval.status === "aprovado" && issues.length === 0,
    status: approval === null ? null : approval.status,
    approval,
    proposalId: binding.proposalId,
    analysisDigest: binding.analysisDigest,
    proposalDigest: binding.proposalDigest,
    issues,
  };
}
