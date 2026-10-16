/**
 * CatalogApproval (FASE 5) - contrato serializavel da aprovacao humana.
 *
 * A FASE 4B produziu `CatalogAgentAnalysis` e um relatorio que descreve a decisao
 * pendente em prosa. Este modulo cria o artefato que faltava: o REGISTRO da decisao
 * humana sobre a analise inteira. Nada de UI, nada de rota, nada de banco: a FASE 5
 * e o contrato e o gate em memoria; persistencia e tela sao fase separada.
 *
 * Vocabulario local ao catalogo, fechado em alinhamento com a humana:
 *  - status: exatamente "aprovado" | "rejeitado", em minusculas;
 *  - nao existe "pendente" persistido: ausencia de registro significa "nao decidido";
 *  - `documents.review_status` (aprovado | rejeitado | pendente) e outro dominio: la o
 *    valor vive em coluna e a maquina de estados e do fluxo de revisao editorial. O DTO
 *    de conhecimento usa "pending" em ingles no request, traduzido na borda. Aqui nao ha
 *    coluna nem request: ha um registro assinado por digest, entao o tipo e proposital e
 *    nao se importa status de la.
 *
 * Aprovacao da analise INTEIRA: um registro vale para o conjunto de propostas. Ids de
 * item (SUB-, TOP-, AIP-) continuam sendo identificadores de linha, nunca de decisao.
 * O vinculo de integridade e triplo: proposalId + analysisDigest + proposalDigest.
 * `aiProposal` (AIP-) fica FORA dos dois ultimos: reexecutar DeepSeek com saida
 * diferente nao invalida a decisao de um humano sobre as regras deterministicas.
 *
 * Imutabilidade por contrato: sem updatedAt, sem deletedAt, sem UPDATE. Correcao de
 * decisao e um registro novo com supersedesApprovalId apontando para o anterior.
 *
 * AUDIT-ONLY: importar estes tipos nao habilita escrita nenhuma. `apply` continua
 * bloqueado em catalog-apply.service.ts (APPLY_DISABLED_IN_AUDIT_PHASE), intocado.
 * JSON-serializavel de ponta a ponta: strings, numeros, booleanos, null.
 */
import type { CatalogClassification, CatalogSeverity, TopicOrigin } from "./catalog-ingestion";

/** Unica versao de schema aceita. Payload com outro valor e recusado na validacao. */
export const CATALOG_APPROVAL_SCHEMA_VERSION = "catalog-approval-v1" as const;
export type CatalogApprovalSchemaVersion = typeof CATALOG_APPROVAL_SCHEMA_VERSION;

/** Vocabulario de decisao. Minusculo, exato, sem sinonimo e sem "pendente". */
export type CatalogApprovalStatus = "aprovado" | "rejeitado";
export const CATALOG_APPROVAL_STATUSES: readonly CatalogApprovalStatus[] = [
  "aprovado",
  "rejeitado",
];

/**
 * Registro da decisao humana sobre uma analise. `approvalId` e derivado do conteudo
 * (excluindo o proprio campo), entao qualquer edicao do registro muda o id: nao ha
 * como reescrever uma decisao sem quebrar a assinatura.
 */
export interface CatalogApproval {
  schemaVersion: CatalogApprovalSchemaVersion;
  /** "APR-" + 32 hex. Derivado de todo o resto do registro. */
  approvalId: string;
  /** "PRP-" + 24 hex. Identifica a analise inteira, nao um item. */
  proposalId: string;
  /** Copia exata de `provenance.analysedTextSha256` da analise aprovada. */
  analysisDigest: string;
  /** sha256 do canonical JSON da projecao de decisao da analise aprovada. */
  proposalDigest: string;
  status: CatalogApprovalStatus;
  /** Usuario humano que decidiu. Obrigatorio, nunca um provedor de IA. */
  decidedBy: string;
  /** ISO-8601 com fuso. Nao pode estar no futuro em relacao ao relogio injetado. */
  decidedAt: string;
  /** Nota curta do revisor. Nunca texto cru de provedor nem caminho de disco. */
  note?: string | null;
  /** Cadeia de supersessao: primeiro registro nao aponta; o seguinte aponta. */
  supersedesApprovalId?: string | null;
}

/**
 * Formulario de decisao ANTES da assinatura. `approvalId` e `schemaVersion` nascem
 * do servico, nao do caller: e assim que a imutabilidade fica garantida sem banco.
 */
export interface CatalogApprovalDraft {
  proposalId: string;
  analysisDigest: string;
  proposalDigest: string;
  status: CatalogApprovalStatus;
  decidedBy: string;
  decidedAt: string;
  note?: string | null;
  supersedesApprovalId?: string | null;
}

/** Codigo de recusa. Estavel: testes de rota e o gate de fase futura comparam por ele. */
export type CatalogApprovalIssueCode =
  | "SCHEMA_VERSION_INVALID"
  | "APPROVAL_ID_INVALID"
  | "APPROVAL_ID_MISMATCH"
  | "PROPOSAL_ID_INVALID"
  | "ANALYSIS_DIGEST_INVALID"
  | "PROPOSAL_DIGEST_INVALID"
  | "STATUS_INVALID"
  | "DECIDED_BY_INVALID"
  | "DECIDED_AT_INVALID"
  | "DECIDED_AT_FUTURE"
  | "NOTE_INVALID"
  | "SUPERSEDES_SELF"
  | "SUPERSEDES_UNKNOWN"
  | "SUPERSEDES_CYCLE"
  | "SUPERSEDES_AMBIGUOUS"
  | "NOT_JSON_SAFE"
  | "APPROVAL_MISSING"
  | "APPROVAL_REJECTED"
  | "PROPOSAL_ID_MISMATCH"
  | "ANALYSIS_DIGEST_MISMATCH"
  | "PROPOSAL_DIGEST_MISMATCH";

export interface CatalogApprovalIssue {
  code: CatalogApprovalIssueCode;
  /** Mensagem em portugues, para humano. Nunca eco de payload de provedor. */
  message: string;
  /** Campo em causa, quando a recusa se aplica a um campo isolado. */
  field?: string;
}

/** Resultado de validacao estrutural: `ok` somente com zero ocorrencias. */
export interface CatalogApprovalValidation {
  ok: boolean;
  issues: CatalogApprovalIssue[];
}

/**
 * Ligacao da decisao com a analise que ela pretende cobrir. `findCurrentApproval`
 * devolve isso para o gate conferir sem exigir a analise outra vez.
 */
export interface CatalogApprovalProposalBinding {
  proposalId: string;
  analysisDigest: string;
  proposalDigest: string;
}

/**
 * Projeao deterministica da analise: o que o humano aprovou, sem relogio, sem
 * custo de IA e sem estado de APPLY. `proposalDigest` e o sha256 desta estrutura
 * em canonical JSON. Campos excluidos ficam de fora de proposito (docs/29 §5).
 */
export interface CatalogDecisionProjection {
  agent: string;
  phase: string;
  schemaVersion: number;
  mode: string;
  sourceMapping: {
    requestedType: string;
    kind: string;
    decodedBytes: boolean;
    contentCharacters: number;
  };
  contest: {
    /** Declaraao do caller mais o que a fonte publicou; slug derivado, nunca inventado. */
    name: string | null;
    organ: string | null;
    board: string | null;
    position: string | null;
    level: string | null;
    vacancies: number | null;
    questions: number | null;
    examDate: string | null;
    facts: Array<{
      factId: string;
      field: string;
      value: string;
      evidence: string;
      origin: TopicOrigin;
      rule: string;
      disciplineName: string | null;
    }>;
    missingFields: string[];
  };
  subjects: Array<{
    proposalId: string;
    publishedName: string;
    origin: TopicOrigin;
    classification: CatalogClassification;
    ruleApplied: string;
    canonicalSubjectId: string | null;
    canonicalSubjectName: string | null;
    aliasApplied: boolean;
    topicsTotal: number;
    reusedTopics: number;
    newTopics: number;
    pendingTopics: number;
    blockedTopics: number;
  }>;
  topics: Array<{
    proposalId: string;
    candidateId: string;
    classification: CatalogClassification;
    ruleApplied: string;
    origin: TopicOrigin;
    canonicalTopic: string | null;
    canonicalTopicId: string | null;
    proposedTopic: string;
    positionTitle: string;
    disciplineName: string;
    parentLabel: string | null;
    collisionIds: string[];
  }>;
  matches: Array<{
    matchId: string;
    candidateId: string;
    classification: CatalogClassification;
    ruleApplied: string;
    origin: TopicOrigin;
    canonicalTopicId: string | null;
    canonicalSubjectId: string | null;
    resolutionMethod: string;
    ambiguousCanonicalIds: string[];
    proposedAsNewCanonical: boolean;
    subjectAliasApplied: boolean;
  }>;
  collisions: Array<{
    collisionId: string;
    kind: string;
    key: string;
    candidateIds: string[];
    severity: CatalogSeverity;
  }>;
  conflicts: Array<{
    conflictId: string;
    code: string;
    severity: CatalogSeverity;
    entities: string[];
  }>;
  summary: {
    positions: number;
    subjectsFound: number;
    topicsFound: number;
    reuseCatalog: number;
    newCanonical: number;
    ambiguous: number;
    blocked: number;
    pendingReview: number;
    collisions: number;
    collisionGroups: number;
    collisionsMembers: number;
    conflicts: number;
    blockingConflicts: number;
    reviewConflicts: number;
    byRule: Record<string, number>;
    byOrigin: Record<string, number>;
  };
}
/**
 * Leitura do gate. NAO e um comando: `approved = true` apenas autoriza uma fase
 * futura a pedir autorizacao de escrita em outro lugar. Nada aqui executa APPLY;
 * `refuseCatalogApply` continua sendo a unica palavra sobre `apply`.
 *
 * `status` vale `null` quando nao ha decisao vigente. O vocabulario de registro
 * continua sendo exatamente dois valores; ausencia se representa com null, nunca
 * com um terceiro status persistido.
 */
export interface CatalogApprovalGate {
  approved: boolean;
  status: CatalogApprovalStatus | null;
  approval: CatalogApproval | null;
  proposalId: string;
  analysisDigest: string;
  proposalDigest: string;
  issues: CatalogApprovalIssue[];
}

/**
 * Resultado da busca pela decisao vigente de uma proposta, com a cadeia inteira para
 * auditoria. `found = false` com `issues` diz por que nao ha registro aproveitavel:
 * ausencia, cadeia ambigua, ciclo ou referencia inexistente.
 */
export interface CatalogApprovalLookupResult {
  found: boolean;
  approval: CatalogApproval | null;
  /** Ordenada do mais antigo ao mais recente. Vazia quando nao ha cadeia valida. */
  chain: CatalogApproval[];
  issues: CatalogApprovalIssue[];
}