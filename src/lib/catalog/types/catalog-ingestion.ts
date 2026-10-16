/**
 * Catalog ingestion contracts (FASE 4 - CourseCatalogAgent).
 *
 * AUDIT-ONLY layer: these types describe read-only analysis results. There is
 * intentionally no write/command type in this module (no insert/update/upsert
 * payload, no repository DTO), because the agent must not be able to express a
 * mutation in its own vocabulary.
 *
 * Every shape here is JSON-serializable: ISO-8601 strings instead of Date,
 * plain objects, no Map/Set, no class instances.
 */

export const CATALOG_PHASE = "FASE 4" as const;
export const CATALOG_AGENT_NAME = "CourseCatalogAgent" as const;

/** Bump when the audit payload shape changes in a non additive way. */
export const CATALOG_AUDIT_SCHEMA_VERSION = 1 as const;

/** The only mode FASE 4 accepts. There is no "apply" mode to select. */
export type CatalogAuditMode = "audit-only";

export type CatalogClassification =
  | "REUSO_CANONICO"
  | "NOVO_CANONICO"
  | "AMBIGUO"
  | "BLOQUEADO"
  | "PENDENTE_REVISAO";

export const CATALOG_CLASSIFICATIONS: readonly CatalogClassification[] = [
  "REUSO_CANONICO",
  "NOVO_CANONICO",
  "AMBIGUO",
  "BLOQUEADO",
  "PENDENTE_REVISAO",
];

/**
 * Provenance of the extracted text, kept distinct from the classification:
 * PUBLISHED_* means the string is literally in the source; DERIVED means a
 * published block was split by a declared rule; INTERPRETATION/MAPPING means
 * a name was attached to content by an explicit mapping (never inferred).
 */
export type TopicOrigin =
  | "PUBLISHED_LABEL"
  | "PUBLISHED_BLOCK"
  | "PUBLISHED_LIST"
  | "DERIVED"
  | "INTERPRETATION/MAPPING";

export const TOPIC_ORIGINS: readonly TopicOrigin[] = [
  "PUBLISHED_LABEL",
  "PUBLISHED_BLOCK",
  "PUBLISHED_LIST",
  "DERIVED",
  "INTERPRETATION/MAPPING",
];

export type CatalogSeverity = "blocking" | "review" | "informational";

/** Where the audited text came from. Only archived/local payloads are accepted. */
export type CatalogSourceKind = "archived-document" | "inline-text" | "local-file";

export interface CatalogSourceInput {
  kind: CatalogSourceKind;
  /** Human readable label, e.g. "Anexo VI - Retificacao 02 (arquivo 4)". */
  label: string;
  /** Captured/declared URL of the archived payload. Never fetched in FASE 4. */
  url?: string;
  /** Internet Archive capture timestamp (YYYYMMDDHHMMSS or ISO). */
  capture?: string;
  /** Declared sha256 of the original payload, when the source states one. */
  declaredSha256?: string;
  /** Original file name (drives format validation for local-file sources). */
  fileName?: string;
  mimeType?: string;
  /** Text already produced by a declared extractor (archived-document path). */
  text?: string;
  /** Raw bytes for the local-file path (PDF/DOCX/etc go through the extractor). */
  bytes?: Uint8Array;
  /** Name of the extractor that produced `text`, e.g. "pdf-parse@1". */
  extractor?: string;
  /** Declared page markers preserved by the extractor. */
  pageCount?: number;
  capturedAt?: string;
  reviewedByHuman?: boolean;
  notes?: string;
}

export interface CatalogSourceProvenance {
  kind: CatalogSourceKind;
  label: string;
  url?: string;
  capture?: string;
  declaredSha256?: string;
  /** sha256 computed over the text actually analysed (not the remote payload). */
  analysedTextSha256: string;
  extractor?: string;
  format: string;
  mimeType?: string;
  fileName?: string;
  pageCount: number;
  characters: number;
  words: number;
  capturedAt?: string;
  reviewedByHuman: boolean;
  notes?: string;
  /** Declared by docs/24: page markers belong to the capture, not to the edital. */
  pageMarkerFormat?: string;
}

export type SourceValidationCode =
  | "SOURCE_EMPTY"
  | "SOURCE_TEXT_AND_BYTES_MISSING"
  | "SOURCE_URL_NOT_FETCHED"
  | "SOURCE_PROVENANCE_INCOMPLETE"
  | "SOURCE_FORMAT_UNSUPPORTED"
  | "SOURCE_FORMAT_REJECTED_BY_CONTRACT"
  | "SOURCE_EXTRACTOR_UNAVAILABLE"
  | "SOURCE_EXTRACTION_FAILED"
  | "SOURCE_UNSAFE_PROVENANCE"
  | "SOURCE_OK";

export interface CatalogValidationIssue {
  code: SourceValidationCode;
  severity: CatalogSeverity;
  message: string;
  detail?: Record<string, string | number | boolean>;
}

export interface CatalogValidatedSource {
  ok: boolean;
  text: string;
  format: string;
  provenance: CatalogSourceProvenance;
  issues: CatalogValidationIssue[];
  validatedAt: string;
}

export type ExtractionWarningCode =
  | "MEASUREMENT_DIVERGENCE"
  | "SOURCE_LABEL_AMBIGUITY"
  | "POSITION_TITLE_INFERRED"
  | "DISCIPLINE_VOCABULARY_LIMITATION"
  | "PAGE_MARKERS_PRESERVED"
  | "PROSE_BLOCK_NOT_DECOMPOSED";

export interface CatalogExtractionWarning {
  code: ExtractionWarningCode;
  message: string;
  positionTitle?: string;
  disciplineName?: string;
  /** What docs/24 (or the caller) declares, kept next to what we measured. */
  expected?: number;
  measured?: number;
  /** The rule that produced the number, so the divergence is reproducible. */
  rule?: string;
}

export interface CatalogExtractionOptions {
  /**
   * Discipline names recognised as block headers. Names outside this list are
   * treated as published label text, never silently promoted to discipline.
   */
  disciplineVocabulary?: string[];
  /** Explicit position titles; when absent they are inferred from anchors. */
  positionTitles?: string[];
  /** Split published label developments into DERIVED term units. */
  includeDerivedTerms?: boolean;

  /**
   * Published label names declared by the caller (docs/24 section E). Used only to
   * attach a label that the edital prints WITHOUT the colon copula, so the count
   * of labels is a declared rule, never an inference.
   */
  labelVocabulary?: string[];
  /**
   * Renomeacao declarada de uma unidade ja publicada (unidade livre para nome de
   * topico). Sem este campo o extrator NUNCA inventa nome: unidade sem nome
   * publicado continua PUBLISHED_BLOCK.
   */
  unitNameOverrides?: Array<{ unitId: string; name: string; rule: string }>; 
   /** Expected measurements used only to emit MEASUREMENT_DIVERGENCE warnings. */
  expectedMeasurements?: Array<{
    disciplineName: string;
    periodSegments?: number;
    publishedLabels?: number;
    freeUnits?: number;
    terms?: number;
  }>;
}

export interface CatalogTermUnit {
  /** Name exactly as published (no normalisation, no paraphrase). */
  text: string;
  origin: TopicOrigin;
  derivationRule: string;
  start: number;
  end: number;
}

export interface CatalogLabelUnit {
  labelId: string;
  /** Label name as published, including the case and accents of the source. */
  name: string;
  origin: TopicOrigin;
  derivationRule: string;
  /** False when the source publishes the label without the ":" copula. */
  copulaPublished: boolean;
  page?: number;
  start: number;
  end: number;
  excerpt: string;
  terms: CatalogTermUnit[];
}

export interface CatalogFreeUnit {
  unitId: string;
  /** Sentence published as a period without any "Rotulo:" copula. */
  text: string;
  origin: TopicOrigin;
  derivationRule: string;
  page?: number;
  start: number;
  end: number;
  excerpt: string;
}

export interface CatalogDisciplineProgram {
  disciplineId: string;
  /** Published discipline header, e.g. "Lingua Portuguesa". */
  publishedName: string;
  nameOrigin: TopicOrigin;
  page?: number;
  start: number;
  end: number;
  excerpt: string;
  periodSegments: number;
  labels: CatalogLabelUnit[];
  freeUnits: CatalogFreeUnit[];
}

export interface CatalogPositionProgram {
  positionId: string;
  /** Literal title of the cargo as published (or declared by the caller). */
  publishedTitle: string;
  titleOrigin: TopicOrigin;
  page?: number;
  start: number;
  end: number;
  disciplines: CatalogDisciplineProgram[];
}

export interface CatalogProgramMeasurement {
  positionTitle: string;
  disciplineName: string;
  periodSegments: number;
  publishedLabels: number;
  labelsWithoutCopula: number;
  freeUnits: number;
  /** periodSegments reproduced by label + free units (labels may share a period). */
  publishedUnits: number;
  derivedTerms: number;
  rules: string[];
}

export interface CatalogProgram {
  positions: CatalogPositionProgram[];
  measurements: CatalogProgramMeasurement[];
  warnings: CatalogExtractionWarning[];
  /** Units fed to the normalizer: labels + free units (+ derived terms). */
  candidateCount: number;
}

/** One extracted string handed to the normalizer, with its provenance. */
export interface CatalogTopicCandidateInput {
  candidateId: string;
  rawName: string;
  origin: TopicOrigin;
  derivationRule: string;
  positionTitle: string;
  disciplineName: string;
  parentLabel?: string;
  page?: number;
  start: number;
  end: number;
  excerpt: string;
}

export interface CatalogNormalizedTopic {
  candidateId: string;
  rawName: string;
  /** normalizeTopicName(rawName) - reused, never reimplemented. */
  normalizedName: string;
  /** slugifyTopic(rawName) - reused, never reimplemented. */
  slug: string;
  /**
   * Diagnostic key only. Collapsing ordinals and "&" makes near-duplicates
   * visible; it MUST NOT deduplicate, merge or delete any entry.
   */
  reducedKey: string;
  ordinalTokens: string[];
  origin: TopicOrigin;
  derivationRule: string;
  positionTitle: string;
  disciplineName: string;
  parentLabel?: string;
  page?: number;
  start: number;
  end: number;
  excerpt: string;
}

export type TopicCollisionKind =
  | "NORMALIZED_NAME"
  | "SLUG"
  | "PUNCTUATION_ONLY"
  | "CASE_OR_ACCENT_ONLY"
  | "REDUCED_KEY_VARIANT"
  | "ORDINAL_KEY_DIVERGENCE";

export interface CatalogTopicCollision {
  collisionId: string;
  kind: TopicCollisionKind;
  /** Key that the group shares under that kind (never a raw credential/path). */
  key: string;
  candidateIds: string[];
  rawNames: string[];
  /** True when the collision is also visible in normalizedName (diagnostic). */
  normalizedNameAgrees: boolean;
  slugAgrees: boolean;
  reducedKeyAgrees: boolean;
  severity: CatalogSeverity;
  message: string;
  /** Always false: collision detection never removes an entry. */
  deduplicated: false;
  discardedEntries: 0;
}

/** Canonical subject line as read from the read-only snapshot. */
export interface CatalogSubjectRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  deletedAt: string | null;
  topicCount: number;
}

/** Mapping declared by the caller: published header -> canonical subject. */
export interface CatalogSubjectAlias {
  publishedName: string;
  canonicalSubjectName: string;
  rule: string;
}

export interface CatalogTopicMatch {
  matchId: string;
  candidateId: string;
  rawName: string;
  normalizedName: string;
  slug: string;
  reducedKey: string;
  origin: TopicOrigin;
  derivationRule: string;
  positionTitle: string;
  disciplineName: string;
  canonicalSubjectId: string | null;
  canonicalSubjectName: string | null;
  canonicalTopicId: string | null;
  canonicalTopicName: string | null;
  resolutionMethod: "id" | "exact" | "slug" | "none" | "not-attempted";
  classification: CatalogClassification;
  /** Deterministic rule id (see docs/27), e.g. "SUBJ-02". */
  ruleApplied: string;
  reason: string;
  ambiguousCanonicalIds: string[];
  /** True when the unit is published text that could not hit any canonical row. */
  proposedAsNewCanonical: boolean;
  /** Diagnostic: canonical rows sharing a token with the published unit. */
  nearMissCanonicalIds: string[];
  subjectAliasApplied: boolean;
  /** AI never reaches this object as a classification; only as `aiProposal`. */
  aiProposalRef?: string;
}
export type CatalogConflictCode =
  | "NORMALIZED_NAME_COLLISION"
  | "SLUG_COLLISION"
  | "PUNCTUATION_ONLY_COLLISION"
  | "CASE_OR_ACCENT_ONLY_COLLISION"
  | "REDUCED_KEY_VARIANT"
  | "ORDINAL_KEY_DIVERGENCE"
  | "SOURCE_EMPTY"
  | "SOURCE_URL_NOT_FETCHED"
  | "SOURCE_PROVENANCE_INCOMPLETE"
  | "SOURCE_UNSAFE_PROVENANCE"
  | "SOURCE_FORMAT_UNSUPPORTED"
  | "MEASUREMENT_DIVERGENCE"
  | "SOURCE_LABEL_AMBIGUITY"
  | "AMBIGUOUS_CANONICAL_CANDIDATE"
  | "SUBJECT_NOT_IN_CATALOG"
  | "SUBJECT_WITHOUT_CANONICAL_TOPICS"
  | "MANY_PUBLISHED_TO_ONE_CANONICAL"
  | "PROVENANCE_MISSING"
  | "PARENT_NAME_MISSING"
  | "PARENT_NAME_CYCLE"
  | "METADATA_MISMATCH"
  | "INVALID_AI_PROPOSAL"
  | "AI_OVERREACH"
  | "APPLY_DISABLED_IN_AUDIT_PHASE";

export interface CatalogConflict {
  conflictId: string;
  code: CatalogConflictCode;
  severity: CatalogSeverity;
  message: string;
  /** Stable entity references (candidateId / positionId / collisionId). */
  entities: string[];
  /** Human next step. Never an automatic fix. */
  suggestion: string;
  autoFixed: false;
  detail?: Record<string, string | number | boolean | string[]>;
}

export interface CatalogAiProposalRequest {
  enabled: boolean;
  provider?: "deepseek";
  model?: string;
  /** Cap on candidates sent to the provider (prompt size + cost guard). */
  maxCandidates?: number;
}

export interface CatalogAiProposal {
  proposalId: string;
  candidateId: string;
  rawName: string;
  suggestedCanonicalTopicId: string | null;
  justification: string;
  confidence: number;
  provider: "deepseek";
  model: string;
  requestedAt: string;
}

export interface CatalogAiRejection {
  code: "INVALID_AI_PROPOSAL" | "AI_OVERREACH" | "AI_PROVIDER_FAILED" | "AI_SCHEMA_INVALID";
  message: string;
  candidateId?: string;
  /** Only the offending field name, never the raw provider payload. */
  offendingField?: string;
}

export interface CatalogAiSection {
  enabled: boolean;
  role: "AI_PROPOSAL";
  /** Deterministic rules stay authoritative; the model can only propose. */
  authority: "none";
  provider: "deepseek" | "none";
  model: string;
  proposals: CatalogAiProposal[];
  rejections: CatalogAiRejection[];
  candidatesSent: number;
  skippedReason?: string;
  timingsMs: { request: number; validate: number };
}

export type CatalogDatabaseOperation = never;

export interface CatalogApplyResult {
  ok: false;
  applied: false;
  code: "APPLY_DISABLED_IN_AUDIT_PHASE";
  message: string;
  /** Always empty: this phase cannot express a database operation. */
  databaseOperations: CatalogDatabaseOperation[];
  /** Bypass flags offered by the caller, recorded and refused, never honoured. */
  refusedBypassFlags: string[];
  attemptedAt: string;
}

export interface CatalogAuditCounts {
  positions: number;
  disciplines: number;
  publishedLabels: number;
  labelsWithoutCopula: number;
  freeUnits: number;
  derivedTerms: number;
  candidates: number;
  collisions: number;
  matches: number;
  conflicts: number;
  blockingConflicts: number;
  reviewConflicts: number;
  aiProposals: number;
  aiRejections: number;
  byClassification: Record<CatalogClassification, number>;
  byOrigin: Record<TopicOrigin, number>;
}

export interface CatalogAuditResult {
  agent: typeof CATALOG_AGENT_NAME;
  phase: typeof CATALOG_PHASE;
  schemaVersion: number;
  mode: CatalogAuditMode;
  applyBlocked: true;
  databaseConnected: false;
  migrationsRun: false;
  seedsRun: false;
  startedAt: string;
  finishedAt: string;
  timingsMs: Record<string, number>;
  provenance: CatalogSourceProvenance;
  validation: CatalogValidatedSource["issues"];
  program: CatalogProgram;
  normalizedTopics: CatalogNormalizedTopic[];
  collisions: CatalogTopicCollision[];
  matches: CatalogTopicMatch[];
  conflicts: CatalogConflict[];
  ai: CatalogAiSection;
  counts: CatalogAuditCounts;
  apply: CatalogApplyResult;
}

export interface CatalogAuditRequest {
  mode?: CatalogAuditMode;
  source: CatalogSourceInput;
  extraction?: CatalogExtractionOptions;
  subjectAliases?: CatalogSubjectAlias[];
  ai?: CatalogAiProposalRequest;
  /**
   * Accepted only so that it can be recorded and refused. Passing any of these
   * never enables a write.
   */
  bypass?: Record<string, unknown>;
}
