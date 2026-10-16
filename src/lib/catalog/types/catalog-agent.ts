/**
 * Catalog agent contracts (FASE 4B - intake de novos cursos/concursos).
 *
 * Camada ADITIVA: nada aqui substitui os tipos de `catalog-ingestion.ts` (FASE 4),
 * que continuam sendo a fonte da verdade do dominio. Este modulo descreve apenas a
 * borda de utilizacao do agente - o pedido conceitual (fonte, concurso e modo) e o
 * resultado serializavel de proposta - e traduz para os tipos ja existentes.
 *
 * AUDIT-ONLY: nao existe tipo de comando de escrita. `CatalogDatabaseOperation`
 * continua `never` (contrato da FASE 4) e `applyStatus` so produz "BLOCKED".
 *
 * Tudo aqui e JSON-serializavel: strings ISO-8601, sem Map/Set/instancia de classe.
 */
import type {
  CatalogAiSection,
  CatalogApplyResult,
  CatalogAuditMode,
  CatalogAuditRequest,
  CatalogAuditResult,
  CatalogClassification,
  CatalogConflict,
  CatalogExtractionOptions,
  CatalogSourceKind,
  CatalogSourceProvenance,
  CatalogSubjectAlias,
  CatalogTopicCollision,
  CatalogTopicMatch,
  TopicOrigin,
} from "./catalog-ingestion";

export const CATALOG_AGENT_PHASE = "FASE 4B" as const;

/** Bump quando o payload de analise mudar de forma nao aditiva. */
export const CATALOG_ANALYSIS_SCHEMA_VERSION = 1 as const;

/**
 * AUDIT e o unico modo que executa. APPLY e aceito no pedido apenas para ser
 * registrado e recusado pelo `refuseCatalogApply` da FASE 4, exatamente como os
 * flags de bypass ja recusados: nenhum caminho de escrita existe aqui.
 */
export type CatalogAgentMode = "AUDIT" | "APPLY";
export const CATALOG_AGENT_MODES: readonly CatalogAgentMode[] = ["AUDIT", "APPLY"];

/** Tipos de fonte aceitos na borda. Nenhum deles habilita rede. */
export type CatalogAgentSourceType = "pdf" | "text" | "url" | "document";
export const CATALOG_AGENT_SOURCE_TYPES: readonly CatalogAgentSourceType[] = [
  "pdf",
  "text",
  "url",
  "document",
];

/**
 * Borda do pedido. Os campos extras de proveniencia existem porque o validador da
 * FASE 4 exige rotulo, extrator e data de captura para auditar: nada e inventado
 * aqui, so repassado para `CatalogSourceInput`.
 */
export interface CatalogAgentSourceInput {
  type: CatalogAgentSourceType;
  /** Texto puro ja extraido ("text") ou bytes em base64 ("pdf"/"document"). */
  content: string;
  /** Nome do arquivo, quando houver: dirige a decisao do contrato de formato. */
  name?: string;
  /** Rotulo humano da fonte. Ausente, a fonte e recusada por proveniencia incompleta. */
  label?: string;
  /** URL declarada. Registrada como proveniencia, jamais buscada. */
  url?: string;
  capture?: string;
  declaredSha256?: string;
  mimeType?: string;
  extractor?: string;
  capturedAt?: string;
  pageCount?: number;
  reviewedByHuman?: boolean;
  notes?: string;
}

/** Metadados declarados pelo caller sobre o concurso. Declaracao, nunca publicacao. */
export interface CatalogAgentContestInput {
  name?: string;
  board?: string;
  organ?: string;
  position?: string;
  level?: string;
}

/**
 * As tres camadas que o plano exige separadas. Um valor so e SOURCE_FACT quando ha
 * trecho publicado com offset; interpretacao de modelo nunca sobe de camada.
 */
export type CatalogEvidenceKind =
  | "SOURCE_FACT"
  | "AI_INTERPRETATION"
  | "DETERMINISTIC_MAPPING";
export const CATALOG_EVIDENCE_KINDS: readonly CatalogEvidenceKind[] = [
  "SOURCE_FACT",
  "AI_INTERPRETATION",
  "DETERMINISTIC_MAPPING",
];

export type CatalogContestField =
  | "contest_name"
  | "organ"
  | "board"
  | "position"
  | "level"
  | "vacancies"
  | "questions"
  | "weight"
  | "exam_date";

/** Um fato de edital: valor, em que camada entrou e de onde foi medido. */
export interface CatalogContestFact {
  factId: string;
  field: CatalogContestField;
  value: string;
  evidence: CatalogEvidenceKind;
  /** Origem editorial do valor, sempre um dos valores ja definidos na FASE 4. */
  origin: TopicOrigin;
  /** Regra estavel (CONTEST-xx ou CONTEST-DECLARED-01) para a medicao ser reproduce. */
  rule: string;
  /** Texto publicado que ancara o fato; ausente quando o valor foi declarado. */
  publishedText?: string;
  excerpt?: string;
  start?: number;
  end?: number;
  page?: number;
  /** Preenchido quando field === "weight": a disciplina do peso publicado. */
  disciplineName?: string;
}

export interface CatalogContestProfile {
  name?: string;
  organ?: string;
  board?: string;
  position?: string;
  level?: string;
  vacancies?: number;
  questions?: number;
  examDate?: string;
  facts: CatalogContestFact[];
  /** Campos que nem a fonte publicou nem o caller declarou. O agente nao completa. */
  missingFields: CatalogContestField[];
}

/** Proposta por disciplina publicada: resolucao de assunto e contagem dos topicos. */
export interface CatalogSubjectProposal {
  proposalId: string;
  publishedName: string;
  origin: TopicOrigin;
  classification: CatalogClassification;
  ruleApplied: string;
  reason: string;
  canonicalSubjectId: string | null;
  canonicalSubjectName: string | null;
  aliasApplied: boolean;
  /** So DETERMINISTIC_MAPPING quando houve alias; nunca interpretacao de modelo. */
  evidence: CatalogEvidenceKind;
  topicsTotal: number;
  reusedTopics: number;
  newTopics: number;
  pendingTopics: number;
  blockedTopics: number;
  /** Pesos publicados na propria linha do cabecalho, se o edital os imprime. */
  weights: CatalogContestFact[];
}

/** Anotacao de IA: nao decide classificacao, nao escreve. */
export interface CatalogTopicAiAssist {
  proposalId: string;
  suggestedCanonicalTopicId: string | null;
  suggestedCanonicalTopicName: string | null;
  /** O assunto da linha canonica sugerida: associacao de disciplina como anotacao. */
  suggestedSubjectName: string | null;
  /** Id nulo + justificativa = o modelo sugere topico novo, sem criar nada. */
  proposesNewTopic: boolean;
  justification: string;
  confidence: number;
  provider: "deepseek";
  model: string;
  /** Fixo: a decisao continua sendo das regras deterministicas do matcher. */
  authority: "none";
}

/**
 * Proposta por topico. `classification`, `ruleApplied` e `reason` vem do matcher da
 * FASE 4; nenhum campo daqui nasce de modelo. `proposedTopic` e proposta: a criacao
 * fisica permanece bloqueada ate APPLY autorizado.
 */
export interface CatalogTopicProposal {
  proposalId: string;
  candidateId: string;
  sourceLabel: string;
  classification: CatalogClassification;
  canonicalTopic: string | null;
  canonicalTopicId: string | null;
  proposedTopic: string;
  origin: TopicOrigin;
  ruleApplied: string;
  reason: string;
  positionTitle: string;
  disciplineName: string;
  parentLabel?: string;
  collisionIds: string[];
  evidence: CatalogEvidenceKind;
  aiAssist?: CatalogTopicAiAssist;
}

/** Resumo que responde as perguntas de aceitaao do plano. */
export interface CatalogAgentSummary {
  positions: number;
  subjectsFound: number;
  topicsFound: number;
  reuseCatalog: number;
  newCanonical: number;
  ambiguous: number;
  blocked: number;
  pendingReview: number;
  /** Linhas de colisao emitidas pelos detectores (mesmo grupo pode gerar mais de uma). */
  collisions: number;
  collisionGroups: number;
  collisionsMembers: number;
  aiProposals: number;
  aiRejections: number;
  conflicts: number;
  blockingConflicts: number;
  reviewConflicts: number;
  byRule: Record<string, number>;
  byOrigin: Record<TopicOrigin, number>;
  /** Sempre false nesta fase. Existe para responder "o APPLY esta permitido?". */
  applyAllowed: false;
}

/** Unico valor producivel hoje. APPLY autorizado e trabalho de fase futura. */
export type CatalogApplyStatus = "BLOCKED";

/** Resultado do mapeamento da borda para os tipos da FASE 4. */
export interface CatalogSourceMapping {
  requestedType: CatalogAgentSourceType;
  kind: CatalogSourceKind;
  /** True quando o payload virou bytes decodificaveis. */
  decodedBytes: boolean;
  contentCharacters: number;
  /** Nota curta para o humano; nunca texto do provedor nem caminho de disco. */
  note: string;
}

/** Resultado serializavel do agente. */
export interface CatalogAgentAnalysis {
  agent: "CourseCatalogAgent";
  phase: typeof CATALOG_AGENT_PHASE;
  schemaVersion: number;
  /** Sempre "audit-only": o modo interno da FASE 4, independentemente do pedido. */
  mode: CatalogAuditMode;
  /** O modo pedido pelo caller, registrado antes da recusa. */
  requestedMode: CatalogAgentMode;
  applyStatus: CatalogApplyStatus;
  source: CatalogSourceProvenance;
  sourceMapping: CatalogSourceMapping;
  contest: CatalogContestProfile;
  subjects: CatalogSubjectProposal[];
  topics: CatalogTopicProposal[];
  matches: CatalogTopicMatch[];
  collisions: CatalogTopicCollision[];
  aiProposal: CatalogAiSection;
  conflicts: CatalogConflict[];
  summary: CatalogAgentSummary;
  apply: CatalogApplyResult;
  /** Relatorio legivel, sempre ao lado do JSON. */
  report: string;
  /** Auditoria integral da FASE 4, preservada sem reescrita. */
  audit: CatalogAuditResult;
}

/** Pedido conceitual do agente. */
export interface CatalogAgentRequest {
  source: CatalogAgentSourceInput;
  contest?: CatalogAgentContestInput;
  /** Ausente = AUDIT. APPLY e aceito para ser recusado. */
  mode?: CatalogAgentMode;
  extraction?: CatalogExtractionOptions;
  subjectAliases?: CatalogSubjectAlias[];
  /** Mesmo contrato de anotacao da FASE 4: provedor deepseek, sem autoridade. */
  ai?: CatalogAuditRequest["ai"];
}