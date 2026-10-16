/**
 * CatalogReportService (FASE 4B) - relatorio legivel para revisao humana.
 *
 * Formata o que o agente ja mediu; nao decide nada. Cada linha carrega a regra que a
 * produziu (SUBJ-xx / TOPIC-xx) e o id da colisao, porque revisao humana precisa de
 * trilha, nao de resumo bonito. Listas longas sao cortadas com aviso explicito e o
 * JSON integral continua ao lado - cortar nunca e descartar.
 */
import "server-only";
import type { CatalogClassification } from "../types/catalog-ingestion";
import type { CatalogAgentAnalysis } from "../types/catalog-agent";

export const REPORT_TITLE = "CATALOGO - NOVO CONCURSO";

/** Marca visual por classificacao. O texto nunca depende da marca. */
export const CLASSIFICATION_MARKS: Record<CatalogClassification, string> = {
  REUSO_CANONICO: "\u2713",
  NOVO_CANONICO: "+",
  PENDENTE_REVISAO: "\u26A0",
  AMBIGUO: "?",
  BLOQUEADO: "\u2715",
};

export const CLASSIFICATION_LABELS: Record<CatalogClassification, string> = {
  REUSO_CANONICO: "reuso do catalogo",
  NOVO_CANONICO: "novo canonico proposto",
  PENDENTE_REVISAO: "pendente de revisao",
  AMBIGUO: "ambiguo",
  BLOQUEADO: "bloqueado",
};

export interface CatalogReportOptions {
  /** Topicos por disciplina antes do corte. Padrao 24. */
  maxTopicsPerDiscipline?: number;
}

function line(rows: string[], value: string): void {
  rows.push(value);
}

function truncate(value: string, max = 70): string {
  const compact = value.replace(/\s+/g, " ").trim();
  return compact.length <= max ? compact : compact.slice(0, max - 1) + "\u2026";
}

export function formatCatalogReport(
  analysis: CatalogAgentAnalysis,
  options: CatalogReportOptions = {}
): string {
  const topicCap = options.maxTopicsPerDiscipline ?? 24;
  const rows: string[] = [];
  const contest = analysis.contest;
  const summary = analysis.summary;

  line(rows, REPORT_TITLE);
  line(rows, `Agente: ${analysis.agent} (${analysis.phase}) | modo: ${analysis.requestedMode} | schema: ${analysis.schemaVersion}`);
  line(rows, `Gerado em: ${analysis.audit.startedAt} -> ${analysis.audit.finishedAt}`);
  line(rows, "");
  line(rows, `Concurso: ${contest.name ?? "NAO DECLARADO"}`);
  if (contest.organ) line(rows, `Orgao: ${contest.organ}`);
  line(rows, `Banca: ${contest.board ?? "NAO ENCONTRADA NA FONTE"}`);
  if (contest.position) line(rows, `Cargo: ${contest.position}`);
  if (contest.level) line(rows, `Nivel: ${contest.level}`);
  if (contest.vacancies !== undefined) line(rows, `Vagas: ${contest.vacancies}`);
  if (contest.questions !== undefined) line(rows, `Questoes: ${contest.questions}`);
  if (contest.examDate) line(rows, `Data da prova: ${contest.examDate}`);
  if (contest.missingFields.length > 0) {
    line(rows, `Campos ausentes: ${contest.missingFields.join(", ")}`);
  }
  line(rows, `Fonte: ${truncate(analysis.source.label)} (${analysis.source.format}, ${analysis.source.pageCount} paginas, sha256 ${analysis.source.analysedTextSha256.slice(0, 12)}...)`);
  if (analysis.sourceMapping) line(rows, `Mapeamento da fonte: ${analysis.sourceMapping.requestedType} -> ${analysis.sourceMapping.kind}; ${analysis.sourceMapping.note}`);
  if (analysis.audit.provenance.reviewedByHuman) line(rows, "Proveniencia revisada por humano: sim");

  line(rows, "");
  line(rows, "DISCIPLINAS");
  if (analysis.subjects.length === 0) line(rows, "(nenhuma disciplina publicada encontrada)");
  for (const subject of analysis.subjects) {
    const mark = CLASSIFICATION_MARKS[subject.classification];
    const target = subject.canonicalSubjectName ?? "sem assunto canonico";
    const alias = subject.aliasApplied ? ` [cabecalho publicado: ${truncate(subject.publishedName, 48)}]` : "";
    line(rows, `${mark} ${target}${alias} -> ${CLASSIFICATION_LABELS[subject.classification]} [${subject.ruleApplied}]`);
    line(rows, `    topicos: ${subject.topicsTotal} (reuso ${subject.reusedTopics}, novos ${subject.newTopics}, revisao ${subject.pendingTopics}, bloqueados ${subject.blockedTopics})`);
    for (const weight of subject.weights) {
      line(rows, `    peso publicado: ${weight.value} [${weight.rule}]`);
    }
  }

  line(rows, "");
  line(rows, "TÓPICOS");
  const byDiscipline = new Map<string, typeof analysis.topics>();
  for (const proposal of analysis.topics) {
    const key = proposal.disciplineName || "(sem disciplina)";
    const bucket = byDiscipline.get(key) ?? [];
    bucket.push(proposal);
    byDiscipline.set(key, bucket);
  }
  for (const [discipline, proposals] of byDiscipline) {
    line(rows, `--- ${truncate(discipline, 60)}`);
    const shown = proposals.slice(0, topicCap);
    for (const proposal of shown) {
      const mark = CLASSIFICATION_MARKS[proposal.classification];
      const target = proposal.canonicalTopic ?? proposal.proposedTopic;
      line(rows, `${mark} ${truncate(proposal.sourceLabel, 58)}`);
      line(rows, `    -> ${proposal.classification} [${proposal.ruleApplied}] ${CLASSIFICATION_LABELS[proposal.classification]}: ${truncate(target, 48)}`);
      if (proposal.collisionIds.length > 0) {
        line(rows, `    \u26A0 COLISAO: ${proposal.collisionIds.join(", ")}`);
      }
      if (proposal.aiAssist) {
        const suggested = proposal.aiAssist.suggestedCanonicalTopicName ?? "novo topico";
        line(rows, `    proposta DeepSeek (autoridade nenhuma): ${suggested} @ ${proposal.aiAssist.confidence.toFixed(2)}`);
      }
    }
    const hidden = proposals.length - shown.length;
    if (hidden > 0) line(rows, `    (+${hidden} demais no JSON da auditoria)`);
  }

  line(rows, "");
  line(rows, "CONFLITOS");
  if (analysis.conflicts.length === 0) {
    line(rows, "(nenhum conflito registrado)");
  } else {
    const grouped = new Map<string, number>();
    for (const conflict of analysis.conflicts) {
      grouped.set(conflict.code, (grouped.get(conflict.code) ?? 0) + 1);
    }
    for (const [code, total] of Array.from(grouped).sort((a, b) => a[0].localeCompare(b[0]))) {
      line(rows, `- ${code}: ${total}`);
    }
  }

  line(rows, "");
  line(rows, "RESUMO");
  line(rows, `Disciplinas: ${summary.subjectsFound}`);
  line(rows, `Tópicos: ${summary.topicsFound}`);
  line(rows, `Reuso: ${summary.reuseCatalog}`);
  line(rows, `Novos: ${summary.newCanonical}`);
  line(rows, `Revisao: ${summary.pendingReview}`);
  line(rows, `Bloqueados: ${summary.blocked}`);
  line(rows, `Ambiguos: ${summary.ambiguous}`);
  line(rows, `Colisoes: ${summary.collisionGroups} grupos / ${summary.collisionsMembers} unidades`);
  line(rows, `DeepSeek: ${summary.aiProposals} propostas, ${summary.aiRejections} recusas (autoridade: ${analysis.aiProposal.authority})`);
  if (analysis.aiProposal.skippedReason) line(rows, `IA sem proposta por: ${analysis.aiProposal.skippedReason}`);

  line(rows, "");
  line(rows, "APPLY:");
  line(rows, `BLOQUEADO - ${analysis.apply.code} - requer aprovacao humana`);
  line(rows, `Operacoes de banco no pedido: ${analysis.apply.databaseOperations.length}`);
  if (analysis.apply.refusedBypassFlags.length > 0) {
    line(rows, `Bandeiras recusadas: ${analysis.apply.refusedBypassFlags.join(", ")}`);
  }

  return rows.join("\n");
}