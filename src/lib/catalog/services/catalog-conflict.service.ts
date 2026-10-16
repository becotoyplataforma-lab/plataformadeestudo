/**
 * CatalogConflictService (FASE 4) - agregacao do que um humano precisa ler.
 *
 * Junta questoes da fonte, avisos da extracao, colisoes dos detectores,
 * ambiguidade do matcher, bloqueios de assunto, excesso de autoridade da IA e a
 * recusa de aplicacao. Nada aqui conserta: toda linha tem autoFixed false e uma
 * sugestao de proximo passo. Silenciar divergencia e o unico erro imperdoavel.
 */
import "server-only";
import type {
  CatalogAiRejection,
  CatalogAiSection,
  CatalogApplyResult,
  CatalogConflict,
  CatalogConflictCode,
  CatalogExtractionWarning,
  CatalogTopicCollision,
  CatalogTopicMatch,
  CatalogValidationIssue,
  ExtractionWarningCode,
  SourceValidationCode,
  TopicCollisionKind,
} from "../types/catalog-ingestion";

export interface CatalogConflictInput {
  validationIssues: CatalogValidationIssue[];
  warnings: CatalogExtractionWarning[];
  collisions: CatalogTopicCollision[];
  canonicalAgreements: CatalogTopicCollision[];
  matches: CatalogTopicMatch[];
  ai: CatalogAiSection;
  apply: CatalogApplyResult;
  applyConflict?: CatalogConflict;
}

type CollisionCodeMap = Record<TopicCollisionKind, CatalogConflictCode>;
type WarningCodeMap = Partial<Record<ExtractionWarningCode, CatalogConflictCode>>;
type ValidationCodeMap = Record<SourceValidationCode, CatalogConflictCode>;
type RejectionCodeMap = Record<CatalogAiRejection["code"], CatalogConflictCode>;
type SuggestionMap = Partial<Record<CatalogConflictCode, string>>;
type SeverityRankMap = Record<CatalogConflict["severity"], number>;
type MatchGroups = Map<string, CatalogTopicMatch[]>;
type SeverityCount = Record<CatalogConflict["severity"], number>;

/**
 * Codigo de cada aviso da extracao. PAGE_MARKERS_PRESERVED fica fora: e artefato
 * conhecido da captura, ja registrado na proveniencia, e nao e conflito.
 */
const COLLISION_CODE: CollisionCodeMap = {
  NORMALIZED_NAME: "NORMALIZED_NAME_COLLISION",
  SLUG: "SLUG_COLLISION",
  PUNCTUATION_ONLY: "PUNCTUATION_ONLY_COLLISION",
  CASE_OR_ACCENT_ONLY: "CASE_OR_ACCENT_ONLY_COLLISION",
  REDUCED_KEY_VARIANT: "REDUCED_KEY_VARIANT",
  ORDINAL_KEY_DIVERGENCE: "ORDINAL_KEY_DIVERGENCE",
};

const WARNING_CODE: WarningCodeMap = {
  MEASUREMENT_DIVERGENCE: "MEASUREMENT_DIVERGENCE",
  SOURCE_LABEL_AMBIGUITY: "SOURCE_LABEL_AMBIGUITY",
  POSITION_TITLE_INFERRED: "PROVENANCE_MISSING",
  DISCIPLINE_VOCABULARY_LIMITATION: "SUBJECT_NOT_IN_CATALOG",
  PROSE_BLOCK_NOT_DECOMPOSED: "METADATA_MISMATCH",
};

const VALIDATION_CODE: ValidationCodeMap = {
  SOURCE_EMPTY: "SOURCE_EMPTY",
  SOURCE_TEXT_AND_BYTES_MISSING: "SOURCE_EMPTY",
  SOURCE_PROVENANCE_INCOMPLETE: "SOURCE_PROVENANCE_INCOMPLETE",
  SOURCE_URL_NOT_FETCHED: "SOURCE_URL_NOT_FETCHED",
  SOURCE_UNSAFE_PROVENANCE: "SOURCE_UNSAFE_PROVENANCE",
  SOURCE_FORMAT_UNSUPPORTED: "SOURCE_FORMAT_UNSUPPORTED",
  SOURCE_FORMAT_REJECTED_BY_CONTRACT: "SOURCE_FORMAT_UNSUPPORTED",
  SOURCE_EXTRACTOR_UNAVAILABLE: "SOURCE_FORMAT_UNSUPPORTED",
  SOURCE_EXTRACTION_FAILED: "SOURCE_FORMAT_UNSUPPORTED",
  SOURCE_OK: "METADATA_MISMATCH",
};

const REJECTION_CODE: RejectionCodeMap = {
  INVALID_AI_PROPOSAL: "INVALID_AI_PROPOSAL",
  AI_OVERREACH: "AI_OVERREACH",
  AI_PROVIDER_FAILED: "METADATA_MISMATCH",
  AI_SCHEMA_INVALID: "INVALID_AI_PROPOSAL",
};

const SUGGESTIONS: SuggestionMap = {
  NORMALIZED_NAME_COLLISION: "Conferir se as duas linhas publicam o mesmo conteudo; se sim, escolher um nome canonico na fase de escrita.",
  SLUG_COLLISION: "Ajustar o slug de uma das linhas ou declarar alias explicito; nunca apagar entrada.",
  PUNCTUATION_ONLY_COLLISION: "Decidir a grafia editorial preferida e registrar a variante como alias de busca.",
  CASE_OR_ACCENT_ONLY_COLLISION: "A grafia com acento e a da fonte; manter as duas e decidir na revisao humana.",
  REDUCED_KEY_VARIANT: "Diagnostico: nenhuma fusao e automatica. Verificar se existe topico duplicado no catalogo.",
  ORDINAL_KEY_DIVERGENCE: "Escolher um padrao de ordinal e registrar a regra editorial correspondente.",
  MEASUREMENT_DIVERGENCE: "Revisar a regra de contagem declarada; a divergencia fica registrada, nao corrigida.",
  SOURCE_LABEL_AMBIGUITY: "Confirmar na fonte quais sequencias sao rotulos publicados sem dois-pontos.",
  AMBIGUOUS_CANONICAL_CANDIDATE: "Escolher a linha canonica correta; o matcher nao decide por sorteio.",
  SUBJECT_NOT_IN_CATALOG: "Declarar alias explicito ou criar o assunto em fase futura aprovada.",
  SUBJECT_WITHOUT_CANONICAL_TOPICS: "Planejar a carga de topicos desse assunto; nada foi criado aqui.",
  MANY_PUBLISHED_TO_ONE_CANONICAL: "Revisar a subdivisao: nomes publicados diferentes nao viram um topico sozinho.",
  PROVENANCE_MISSING: "Completar a proveniencia da fonte antes de qualquer decisao de catalogo.",
  PARENT_NAME_MISSING: "A unidade derivada ficou sem rotulo pai: verificar a regra de segmentacao.",
  PARENT_NAME_CYCLE: "Ha ciclo de pai e filho no texto publicado; reportar a edicao da fonte.",
  METADATA_MISMATCH: "Conferir os metadados declarados contra o snapshot de leitura-only.",
  INVALID_AI_PROPOSAL: "Sugestao de IA fora do contrato: descartada, sem efeito no resultado deterministico.",
  AI_OVERREACH: "A resposta tentou expressar decisao ou escrita: registrada e descartada por seguranca.",
  SOURCE_EMPTY: "A fonte nao produz texto analisavel; refazer a captura do documento arquivado.",
  SOURCE_URL_NOT_FETCHED: "URL registrada como proveniencia; esta fase nao faz requisicoes remotas.",
  SOURCE_PROVENANCE_INCOMPLETE: "Completar rotulo, extractor e data de captura da fonte auditada.",
  SOURCE_UNSAFE_PROVENANCE: "Usar copia arquivada: a URL declarada esta fora do acervo esperado.",
  SOURCE_FORMAT_UNSUPPORTED: "Converter para formato aceito pelo contrato de formato antes de auditar.",
  APPLY_DISABLED_IN_AUDIT_PHASE: "Nenhum passo de escrita: abrir nova fase aprovada com banco de teste isolado.",
};

function conflictOf(
  code: CatalogConflictCode,
  severity: CatalogConflict["severity"],
  message: string,
  entities: string[],
  detail?: CatalogConflict["detail"]
): CatalogConflict {
  return {
    conflictId: "CNF-" + code,
    code,
    severity,
    message,
    entities,
    suggestion: SUGGESTIONS[code] ?? "Revisar com a fonte primaria antes de qualquer escrita.",
    autoFixed: false,
    detail,
  };
}

function withSequence(conflicts: CatalogConflict[]): CatalogConflict[] {
  const seen: Record<string, number> = {};
  return conflicts.map((conflict) => {
    const next = (seen[conflict.code] ?? 0) + 1;
    seen[conflict.code] = next;
    return { ...conflict, conflictId: conflict.conflictId + "-" + String(next).padStart(2, "0") };
  });
}

function entityList(items: Array<string | null | undefined>): string[] {
  return items.filter((item): item is string => item !== undefined && item !== null && item.length !== 0);
}

/** Agrega todas as fontes de conflito, ordenado por severidade e depois por codigo. */
export function buildCatalogConflicts(input: CatalogConflictInput): CatalogConflict[] {
  const out: CatalogConflict[] = [];

  for (const issue of input.validationIssues) {
    if (issue.code === "SOURCE_OK") continue;
    out.push(
      conflictOf(VALIDATION_CODE[issue.code], issue.severity, issue.message, ["source:" + issue.code], issue.detail)
    );
  }

  for (const warning of input.warnings) {
    const code = WARNING_CODE[warning.code];
    if (!code) continue;
    const severity = warning.code === "MEASUREMENT_DIVERGENCE" ? "review" : "informational";
    out.push(
      conflictOf(code, severity, warning.message, entityList([warning.positionTitle, warning.disciplineName]), {
        expected: warning.expected ?? 0,
        measured: warning.measured ?? 0,
        rule: warning.rule ?? "",
      })
    );
  }

  for (const collision of [...input.collisions, ...input.canonicalAgreements]) {
    out.push(
      conflictOf(COLLISION_CODE[collision.kind], collision.severity, collision.message, collision.candidateIds, {
        key: collision.key,
        deduplicated: collision.deduplicated,
        discardedEntries: collision.discardedEntries,
      })
    );
  }

  const groups: MatchGroups = new Map<string, CatalogTopicMatch[]>();
  for (const match of input.matches) {
    if (match.classification === "AMBIGUO") {
      out.push(
        conflictOf(
          "AMBIGUOUS_CANONICAL_CANDIDATE",
          "review",
          "Candidato com mais de uma linha canonica possivel: " + match.rawName,
          [match.candidateId, ...match.ambiguousCanonicalIds],
          { rule: match.ruleApplied }
        )
      );
      continue;
    }
    if (match.classification === "BLOQUEADO") {
      out.push(
        conflictOf(
          match.ruleApplied === "SUBJ-00" ? "PROVENANCE_MISSING" : "SUBJECT_NOT_IN_CATALOG",
          "blocking",
          match.reason,
          [match.candidateId],
          { rule: match.ruleApplied, disciplineName: match.disciplineName }
        )
      );
      continue;
    }
    if (match.classification === "PENDENTE_REVISAO") {
      out.push(
        conflictOf("PROVENANCE_MISSING", "review", match.reason, [match.candidateId], {
          rule: match.ruleApplied,
          origin: match.origin,
        })
      );
      continue;
    }
    if (match.classification === "NOVO_CANONICO" && match.ruleApplied === "TOPIC-05") {
      out.push(
        conflictOf("SUBJECT_WITHOUT_CANONICAL_TOPICS", "review", match.reason, entityList([match.candidateId, match.canonicalSubjectId]), {
          disciplineName: match.disciplineName,
        })
      );
      continue;
    }
    if (match.canonicalTopicId === null) continue;
    const list = groups.get(match.canonicalTopicId) ?? [];
    list.push(match);
    groups.set(match.canonicalTopicId, list);
  }

  for (const [canonicalTopicId, group] of [...groups.entries()].sort()) {
    const distinct = new Set(group.map((match) => match.rawName));
    if (distinct.size === 1) continue;
    out.push(
      conflictOf("MANY_PUBLISHED_TO_ONE_CANONICAL", "review", "Nomes publicados diferentes resolvidos para o mesmo topico canonico.", [
        canonicalTopicId,
        ...group.map((match) => match.candidateId),
      ], { publishedNames: [...distinct] })
    );
  }

  for (const rejection of input.ai.rejections) {
    out.push(
      conflictOf(
        REJECTION_CODE[rejection.code],
        "review",
        rejection.message,
        rejection.candidateId ? [rejection.candidateId] : ["ai:" + input.ai.provider],
        rejection.offendingField ? { offendingField: rejection.offendingField } : undefined
      )
    );
  }

  if (input.applyConflict) out.push(input.applyConflict);

  const rank: SeverityRankMap = { blocking: 0, review: 1, informational: 2 };
  return withSequence(
    out.sort(
      (a, b) =>
        rank[a.severity] - rank[b.severity] ||
        a.code.localeCompare(b.code) ||
        a.entities.join(",").localeCompare(b.entities.join(","))
    )
  );
}

/** Contagem por severidade, sempre com as tres chaves presentes. */
export function countConflictsBySeverity(conflicts: CatalogConflict[]): SeverityCount {
  const out: SeverityCount = { blocking: 0, review: 0, informational: 0 };
  for (const conflict of conflicts) out[conflict.severity] += 1;
  return out;
}
