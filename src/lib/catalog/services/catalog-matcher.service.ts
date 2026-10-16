/**
 * CatalogMatcher (FASE 4) - decisao deterministica entre reuso, novidade e bloqueio.
 *
 * Nada aqui consulta o banco: o catalogo canonico e o snapshot de leitura-only.
 * A IA (ai-proposal.service) pode anotar uma linha com uma proposta, mas jamais
 * trocar a classificacao: quem decide e esta funcao, com regras numeradas e
 * estaveis (SUBJ-xx / TOPIC-xx), documentadas em docs/27.
 */
import "server-only";
import {
  normalizeTopicName,
  resolveTopicInMemory,
  slugifyTopic,
  type TopicCandidate,
} from "@/lib/knowledge/services/topic-resolver.service";
import { CatalogSnapshotError, type CatalogSnapshotView, lookupSubject } from "./catalog-snapshot.service";
import { canonicalKeyView, classifyCollision, type TopicKeyView } from "./topic-normalizer.service";
import { CANONICAL_SUBJECT_ALIASES } from "./catalog-subject-vocabulary";
import type {
  CatalogNormalizedTopic,
  CatalogSubjectAlias,
  CatalogSubjectRow,
  CatalogTopicMatch,
} from "../types/catalog-ingestion";

export interface MatcherInput {
  topics: CatalogNormalizedTopic[];
  view: CatalogSnapshotView;
  subjectAliases?: CatalogSubjectAlias[];
}

const CANONICAL_PUBLISHED_ORIGINS = ["PUBLISHED_LABEL", "PUBLISHED_BLOCK", "PUBLISHED_LIST"];

function matchId(candidateId: string): string {
  return "MAT-" + candidateId;
}

function baseRow(topic: CatalogNormalizedTopic, method: CatalogTopicMatch["resolutionMethod"]) {
  return {
    matchId: matchId(topic.candidateId),
    candidateId: topic.candidateId,
    rawName: topic.rawName,
    normalizedName: topic.normalizedName,
    slug: topic.slug,
    reducedKey: topic.reducedKey,
    origin: topic.origin,
    derivationRule: topic.derivationRule,
    positionTitle: topic.positionTitle,
    disciplineName: topic.disciplineName,
    canonicalSubjectId: null as string | null,
    canonicalSubjectName: null as string | null,
    canonicalTopicId: null as string | null,
    canonicalTopicName: null as string | null,
    resolutionMethod: method,
    ambiguousCanonicalIds: [] as string[],
    proposedAsNewCanonical: false,
    nearMissCanonicalIds: [] as string[],
    subjectAliasApplied: false,
  };
}

function aliasFor(view: CatalogSnapshotView, aliases: CatalogSubjectAlias[], publishedName: string): CatalogSubjectAlias | null {
  const key = normalizeTopicName(publishedName);
  if (key.length === 0) return null;
  for (const alias of aliases) {
    if (normalizeTopicName(alias.publishedName) !== key) continue;
    const target = lookupSubject(view, alias.canonicalSubjectName);
    if (target) return alias;
  }
  return null;
}

function resolveSubject(
  view: CatalogSnapshotView,
  aliases: CatalogSubjectAlias[],
  publishedName: string
): { subject: CatalogSubjectRow | null; rule: string; aliasApplied: boolean; reason: string } {
  if (publishedName.trim().length === 0) {
    return { subject: null, rule: "SUBJ-00", aliasApplied: false, reason: "Unidade sem disciplina publicada: nada a casar." };
  }
  const direct = lookupSubject(view, publishedName);
  if (direct) {
    return { subject: direct, rule: "SUBJ-01", aliasApplied: false, reason: "Cabecalho publicado igual ao nome do assunto canonico." };
  }
  const alias = aliasFor(view, aliases, publishedName);
  if (alias) {
    const mapped = lookupSubject(view, alias.canonicalSubjectName);
    if (mapped) {
      return { subject: mapped, rule: "SUBJ-02", aliasApplied: true, reason: "Alias de assunto aplicado (caller ou vocabulario declarado em codigo): " + alias.rule };
    }
  }
  return { subject: null, rule: "SUBJ-03", aliasApplied: false, reason: "Nenhum assunto canonico compativel com o cabecalho publicado." };
}

/** Identidades canonicas que o candidato enxerga mas o match exato nao alcancou. */
function nearMissIds(topic: CatalogNormalizedTopic, candidates: TopicCandidate[]): string[] {
  const views: TopicKeyView[] = canonicalKeyView(candidates.map((row) => ({ id: row.id, name: row.name, slug: row.slug })));
  const self: TopicKeyView = {
    id: topic.candidateId,
    rawName: topic.rawName,
    normalizedName: topic.normalizedName,
    slug: topic.slug,
    reducedKey: topic.reducedKey,
    ordinalTokens: topic.ordinalTokens,
  };
  const out: string[] = [];
  for (const view of views) {
    const kind = classifyCollision(self, view);
    if (kind === null) continue;
    out.push(view.id);
  }
  return out;
}

function countBy(view: CatalogSnapshotView, subjectId: string): number {
  return (view.topicsBySubject[subjectId] ?? []).length;
}

/**
 * Casamento deterministico. Regras:
 *   TOPIC-01 reuso exato (normalizedName)     -> REUSO_CANONICO
 *   TOPIC-02 reuso por slug                  -> REUSO_CANONICO
 *   TOPIC-03 dois candidatos no mesmo slug    -> AMBIGUO
 *   TOPIC-04 texto publicado sem correspondencia, assunto coberto -> NOVO_CANONICO
 *   TOPIC-05 assunto canonico sem topicos     -> NOVO_CANONICO
 *   TOPIC-06 nome derivado ou mapeado sem correspondencia -> PENDENTE_REVISAO
 *   TOPIC-07 assunto ausente ou inativo       -> BLOQUEADO
 */
export function matchTopics(input: MatcherInput): CatalogTopicMatch[] {
  const { view } = input;
  // Alias do caller primeiro: um edital pode declarar um mapeamento mais
  // especifico que o vocabulario geral (docs/23 #4). O vocabulario declarado entra
  // como linha de base, nunca como substituicao de decisao humana.
  const aliases: CatalogSubjectAlias[] = [...(input.subjectAliases ?? []), ...CANONICAL_SUBJECT_ALIASES];
  return input.topics.map((topic) => {
    const resolution = resolveSubject(view, aliases, topic.disciplineName);
    const row = baseRow(topic, "not-attempted");
    row.subjectAliasApplied = resolution.aliasApplied;
    row.nearMissCanonicalIds = [];

    if (!resolution.subject) {
      const blocking = resolution.rule === "SUBJ-03";
      return {
        ...row,
        ruleApplied: resolution.rule,
        classification: blocking ? "BLOQUEADO" : "PENDENTE_REVISAO",
        reason: resolution.reason,
        resolutionMethod: "not-attempted",
      };
    }

    const subject = resolution.subject;
    row.canonicalSubjectId = subject.id;
    row.canonicalSubjectName = subject.name;

    if (subject.deletedAt !== null || subject.status !== "active") {
      return {
        ...row,
        ruleApplied: "TOPIC-07",
        classification: "BLOQUEADO",
        reason: "Assunto canonico existe mas esta inativo ou removido: reuso proibido, novidade tambem.",
        resolutionMethod: "not-attempted",
      };
    }

    const pool = view.topicsBySubject[subject.id] ?? [];
    const exact = pool.filter((candidate) => normalizeTopicName(candidate.name) === topic.normalizedName);
    const slugged = topic.slug.length === 0 ? [] : pool.filter((candidate) => slugifyTopic(candidate.slug) === topic.slug);

    if (exact.length > 1 || (exact.length === 0 && slugged.length > 1)) {
      const ambiguous = exact.length > 1 ? exact : slugged;
      return {
        ...row,
        ruleApplied: "TOPIC-03",
        classification: "AMBIGUO",
        reason: "Mais de uma linha canonica responde pela mesma chave: decisao humana necessaria.",
        resolutionMethod: "none",
        ambiguousCanonicalIds: ambiguous.map((candidate) => candidate.id),
        nearMissCanonicalIds: nearMissIds(topic, pool),
      };
    }

    const resolved = resolveTopicInMemory({ topicName: topic.rawName, subjectId: subject.id }, pool);
    if (resolved.matchedTopic && (resolved.method === "exact" || resolved.method === "slug")) {
      return {
        ...row,
        ruleApplied: resolved.method === "exact" ? "TOPIC-01" : "TOPIC-02",
        classification: "REUSO_CANONICO",
        reason: "Topico canonico existente alcancado por " + resolved.method + ": reuso, nao criacao.",
        resolutionMethod: resolved.method,
        canonicalTopicId: resolved.matchedTopic.id,
        canonicalTopicName: resolved.matchedTopic.name,
        nearMissCanonicalIds: nearMissIds(topic, pool),
      };
    }

    if (pool.length === 0) {
      return {
        ...row,
        ruleApplied: "TOPIC-05",
        classification: "NOVO_CANONICO",
        reason: "Assunto canonico existe sem nenhuma cobertura de topicos: publicacao nova proposta, sem escrita.",
        resolutionMethod: "none",
        proposedAsNewCanonical: true,
      };
    }

    if (CANONICAL_PUBLISHED_ORIGINS.includes(topic.origin)) {
      return {
        ...row,
        ruleApplied: "TOPIC-04",
        classification: "NOVO_CANONICO",
        reason: "Nome publicado literal na fonte e ausente no catalogo: proposta de novo canonico.",
        resolutionMethod: "none",
        proposedAsNewCanonical: true,
        nearMissCanonicalIds: nearMissIds(topic, pool),
      };
    }

    return {
      ...row,
      ruleApplied: "TOPIC-06",
      classification: "PENDENTE_REVISAO",
      reason: "Nome derivado ou mapeado (" + topic.origin + ") sem correspondencia: revisao humana antes de qualquer proposta.",
      resolutionMethod: "none",
      nearMissCanonicalIds: nearMissIds(topic, pool),
    };
  });
}

/** Contagem por classificacao, sempre com as cinco chaves presentes. */
export function countByClassification(matches: CatalogTopicMatch[]): Record<CatalogTopicMatch["classification"], number> {
  const out: Record<CatalogTopicMatch["classification"], number> = {
    REUSO_CANONICO: 0,
    NOVO_CANONICO: 0,
    AMBIGUO: 0,
    BLOQUEADO: 0,
    PENDENTE_REVISAO: 0,
  };
  for (const match of matches) out[match.classification] += 1;
  return out;
}

/** Cobre o assunto canonico de cobertura nula para o agente nao dizer "topicos" sem base. */
export function subjectTopicCount(view: CatalogSnapshotView, subjectId: string): number {
  if (!(subjectId in view.topicsBySubject)) throw new CatalogSnapshotError("SNAPSHOT_SUBJECT_UNKNOWN", "Assunto fora do snapshot.");
  return countBy(view, subjectId);
}
