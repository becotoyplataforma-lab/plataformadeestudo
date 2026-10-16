/**
 * CatalogTopicNormalizer (FASE 4) - casa dos detectores de colisao.
 *
 * Decisao arquitetural (registrada em docs/27): os detectores vivem AQUI e nao
 * em topic-resolver.service.ts, porque aquele modulo e linha de base protegida
 * (hash registrado) e resolve assunto de questoes, nao de edital. Reusamos por
 * import as mesmas funcoes puras (normalizeTopicName / slugifyTopic) para que a
 * normalizacao editorial e a normalizacao de catalogo nunca divirjam.
 *
 * reducedKey e diagnostico. Nenhum detector remove, funde ou descarta entrada:
 * o contrato devolve grupos com `deduplicated: false` e `discardedEntries: 0`.
 */
import "server-only";
import {
  normalizeTopicName,
  slugifyTopic,
} from "@/lib/knowledge/services/topic-resolver.service";
import type {
  CatalogNormalizedTopic,
  CatalogTopicCandidateInput,
  CatalogTopicCollision,
  TopicCollisionKind,
} from "../types/catalog-ingestion";

/** Ordinal publicado com simbolo (1o / 2o) - U+00BA e U+00B0. */
export const ORDINAL_SYMBOL_RE = /(\d+)\s*[\u00ba\u00b0]/g;
/** Ordinal abreviado com letra: "2o grau", "1 o grau". */
export const ORDINAL_LETTER_RE = /(\d+)\s*o(?=\s|$)/g;

export interface CanonicalTopicRow {
  id: string;
  name: string;
  slug?: string;
}

/**
 * Chave diagnostica: parte do normalizedName (ja minusculo e sem acento) e
 * colapsa as duas variantes de ordinal e troca o "&" editorial por "e". O objetivo e tornar
 * visiveis pares que slugifyTopic ja trata como iguais ou trata como diferentes
 * sem explicacao aparente; nunca e chave de unicidade.
 */
export function buildReducedKey(normalizedName: string): string {
  return normalizedName
    .replace(/\s*&\s*/g, " e ")
    .replace(/\s+/g, " ")
    .replace(ORDINAL_SYMBOL_RE, "$1")
    .replace(ORDINAL_LETTER_RE, "$1")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ordinais tais como publicados, para o detector de divergencia de chave. */
export function ordinalTokensOf(rawName: string): string[] {
  const tokens: string[] = [];
  for (const match of rawName.matchAll(ORDINAL_SYMBOL_RE)) tokens.push(match[0].trim());
  for (const match of rawName.matchAll(ORDINAL_LETTER_RE)) tokens.push(match[0].trim());
  return tokens;
}

/** Comparacao sem acento e sem caixa, isolando diferenca de caixa/acentuacao. */
function caseAccentInsensitive(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Comparacao que tolera apenas pontuacao e espacamento: acento e caixa seguem
 * valendo. Coincidencia aqui significa diferenca exclusivamente de pontuacao.
 * Sem coincidencia a diferenca e mista (acento + pontuacao) e o detector devolve
 * o generico NORMALIZED_NAME em vez de prometer "so pontuacao" quando nao e.
 */
function punctuationInsensitive(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u00ff]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTopic(input: CatalogTopicCandidateInput): CatalogNormalizedTopic {
  const normalizedName = normalizeTopicName(input.rawName);
  return {
    candidateId: input.candidateId,
    rawName: input.rawName,
    normalizedName,
    slug: slugifyTopic(input.rawName),
    reducedKey: buildReducedKey(normalizedName),
    ordinalTokens: ordinalTokensOf(input.rawName),
    origin: input.origin,
    derivationRule: input.derivationRule,
    positionTitle: input.positionTitle,
    disciplineName: input.disciplineName,
    parentLabel: input.parentLabel,
    page: input.page,
    start: input.start,
    end: input.end,
    excerpt: input.excerpt,
  };
}

export function normalizeTopics(
  inputs: CatalogTopicCandidateInput[]
): CatalogNormalizedTopic[] {
  return inputs.map((input) => normalizeTopic(input));
}
/** Visao minima de chave: vale para candidato extraido e para linha canonica. */
export interface TopicKeyView {
  id: string;
  rawName: string;
  normalizedName: string;
  slug: string;
  reducedKey: string;
  ordinalTokens: string[];
}

function keyOf(topic: CatalogNormalizedTopic): TopicKeyView {
  return {
    id: topic.candidateId,
    rawName: topic.rawName,
    normalizedName: topic.normalizedName,
    slug: topic.slug,
    reducedKey: topic.reducedKey,
    ordinalTokens: topic.ordinalTokens,
  };
}

/** Linhas canonicas do snapshot reduzidas as mesmas chaves dos candidatos. */
export function canonicalKeyView(rows: CanonicalTopicRow[]): TopicKeyView[] {
  return rows.map((row) => {
    const normalizedName = normalizeTopicName(row.name);
    return {
      id: row.id,
      rawName: row.name,
      normalizedName,
      slug: row.slug ?? slugifyTopic(row.name),
      reducedKey: buildReducedKey(normalizedName),
      ordinalTokens: ordinalTokensOf(row.name),
    };
  });
}

/**
 * Precedencia diagnostica (documentada em docs/27):
 *   1. texto cru identico      -> NORMALIZED_NAME (duplicidade real de publicacao)
 *   2. normalizedName identico -> CASE_OR_ACCENT_ONLY ou PUNCTUATION_ONLY
 *      diferenca mista de acento e pontuacao fica no generico NORMALIZED_NAME
 *   3. reducedKey identico     -> ORDINAL_KEY_DIVERGENCE / SLUG / REDUCED_KEY_VARIANT
 *   4. apenas o slug identico  -> SLUG
 *   5. nada em comum           -> null (sem colisao)
 */
export function classifyCollision(a: TopicKeyView, b: TopicKeyView): TopicCollisionKind | null {
  if (a.rawName === b.rawName) return "NORMALIZED_NAME";
  if (a.normalizedName === b.normalizedName) {
    if (caseAccentInsensitive(a.rawName) === caseAccentInsensitive(b.rawName)) {
      return "CASE_OR_ACCENT_ONLY";
    }
    if (punctuationInsensitive(a.rawName) === punctuationInsensitive(b.rawName)) return "PUNCTUATION_ONLY";
    return "NORMALIZED_NAME";
  }
  if (a.reducedKey === b.reducedKey) {
    if (a.ordinalTokens.length > 0 || b.ordinalTokens.length > 0) return "ORDINAL_KEY_DIVERGENCE";
    if (a.slug === b.slug) return "SLUG";
    return "REDUCED_KEY_VARIANT";
  }
  if (a.slug === b.slug) return "SLUG";
  return null;
}

interface CollisionGroup {
  key: string;
  entries: TopicKeyView[];
}

function groupsBy(items: TopicKeyView[], pick: (item: TopicKeyView) => string): CollisionGroup[] {
  const buckets: Record<string, TopicKeyView[]> = {};
  for (const item of items) {
    const key = pick(item);
    if (!key) continue;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push(item);
  }
  const groups: CollisionGroup[] = [];
  for (const key of Object.keys(buckets).sort()) {
    const entries = buckets[key] ?? [];
    if (entries.length > 1) groups.push({ key, entries });
  }
  return groups;
}

function severityFor(
  kind: TopicCollisionKind,
  entries: TopicKeyView[]
): CatalogTopicCollision["severity"] {
  if (kind === "NORMALIZED_NAME") {
    const raws = new Set(entries.map((entry) => entry.rawName));
    return raws.size === 1 ? "blocking" : "review";
  }
  if (kind === "REDUCED_KEY_VARIANT") return "informational";
  return "review";
}

function messageFor(kind: TopicCollisionKind, entries: TopicKeyView[]): string {
  const names = entries.map((entry) => entry.rawName).join(" | ");
  if (kind === "NORMALIZED_NAME") return "Mesmo normalizedName para entradas: " + names;
  if (kind === "CASE_OR_ACCENT_ONLY") return "Diferenca apenas de caixa ou acentuacao: " + names;
  if (kind === "PUNCTUATION_ONLY") return "Diferenca apenas de pontuacao ou espacamento: " + names;
  if (kind === "SLUG") return "Mesmo slug para nomes distintos: " + names;
  if (kind === "ORDINAL_KEY_DIVERGENCE") {
    return "Ordinais publicados de formas distintas colapsam na mesma chave: " + names;
  }
  return "Chave reduzida identica com slug diferente: " + names;
}

/**
 * Contador por tipo e chave: a sequencia so avanca quando o mesmo tipo
 * reaparece na mesma chave, assim o collisionId nao muda quando um candidato
 * estranho ao grupo entra na lista.
 */
type SeqBy = Map<string, number>;

function collisionOf(
  kind: TopicCollisionKind,
  group: CollisionGroup,
  seqBy: SeqBy
): CatalogTopicCollision {
  const entries = group.entries;
  const first = entries[0];
  const composite = kind + ":" + group.key;
  const seq = (seqBy.get(composite) ?? 0) + 1;
  seqBy.set(composite, seq);
  return {
    collisionId: ["COL", kind, slugifyTopic(group.key) || "vazio", String(seq).padStart(2, "0")].join("-"),
    kind,
    key: group.key,
    candidateIds: entries.map((entry) => entry.id),
    rawNames: entries.map((entry) => entry.rawName),
    normalizedNameAgrees: entries.every((entry) => entry.normalizedName === first?.normalizedName),
    slugAgrees: entries.every((entry) => entry.slug === first?.slug),
    reducedKeyAgrees: entries.every((entry) => entry.reducedKey === first?.reducedKey),
    severity: severityFor(kind, entries),
    message: messageFor(kind, entries),
    deduplicated: false,
    discardedEntries: 0,
  };
}

function pairsWithKind(
  entries: TopicKeyView[],
  wanted: TopicCollisionKind,
  pickKey: (item: TopicKeyView) => string
): CollisionGroup[] {
  const out: CollisionGroup[] = [];
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i];
      const b = entries[j];
      if (a && b && classifyCollision(a, b) === wanted) out.push({ key: pickKey(a), entries: [a, b] });
    }
  }
  return out;
}

/**
 * Detectores publicos. Cada um devolve grupos e nunca remove, funde ou descarta
 * entrada: `deduplicated: false` e `discardedEntries: 0` vem do contrato
 * CatalogTopicCollision e nenhuma chamada abaixo reescreve o array de topicos.
 */
export function findTopicNameCollisions(topics: CatalogNormalizedTopic[]): CatalogTopicCollision[] {
  const items = topics.map((topic) => keyOf(topic));
  const seqBy: SeqBy = new Map();
  const out: CatalogTopicCollision[] = [];
  groupsBy(items, (item) => item.normalizedName).forEach((group) => {
    out.push(collisionOf("NORMALIZED_NAME", group, seqBy));
    const refinements: TopicCollisionKind[] = ["CASE_OR_ACCENT_ONLY", "PUNCTUATION_ONLY"];
    for (const kind of refinements) {
      for (const pair of pairsWithKind(group.entries, kind, (item) => item.normalizedName)) {
        out.push(collisionOf(kind, pair, seqBy));
      }
    }
  });
  return out;
}

/** Slug igual para nomes normatizados distintos (o detector de nome nao cobre). */
export function findSlugCollisions(topics: CatalogNormalizedTopic[]): CatalogTopicCollision[] {
  const items = topics.map((topic) => keyOf(topic));
  const seqBy: SeqBy = new Map();
  const out: CatalogTopicCollision[] = [];
  groupsBy(items, (item) => item.slug).forEach((group) => {
    const names = new Set(group.entries.map((entry) => entry.normalizedName));
    if (names.size < 2) return;
    out.push(collisionOf("SLUG", group, seqBy));
  });
  return out;
}

/**
 * Chave reduzida igual sem nome igual: o caso dos ordinais ("2o grau" / "2 grau")
 * e do "&" editorial. Diagnostico: nao autoriza fusao de nenhuma especie.
 */
export function findReducedKeyVariants(topics: CatalogNormalizedTopic[]): CatalogTopicCollision[] {
  const items = topics.map((topic) => keyOf(topic));
  const seqBy: SeqBy = new Map();
  const out: CatalogTopicCollision[] = [];
  groupsBy(items, (item) => item.reducedKey).forEach((group) => {
    const kinds: TopicCollisionKind[] = ["ORDINAL_KEY_DIVERGENCE", "REDUCED_KEY_VARIANT"];
    for (const kind of kinds) {
      for (const pair of pairsWithKind(group.entries, kind, (item) => item.reducedKey)) {
        out.push(collisionOf(kind, pair, seqBy));
      }
    }
  });
  return out;
}

/** Todos os detectores sobre o mesmo conjunto de candidatos, em ordem estavel. */
export function findCollisions(topics: CatalogNormalizedTopic[]): CatalogTopicCollision[] {
  return [
    ...findTopicNameCollisions(topics),
    ...findSlugCollisions(topics),
    ...findReducedKeyVariants(topics),
  ];
}

/**
 * Acordo de chave entre candidato extraido e linha canonica do snapshot quando o
 * nome normatizado NAO coincide: e o risco de insercao duplicada nas fases com
 * escrita. Nada aqui decide reuso -- o matcher continua authoritative.
 */
export function findCatalogKeyAgreements(
  candidates: CatalogNormalizedTopic[],
  canonicalRows: CanonicalTopicRow[]
): CatalogTopicCollision[] {
  const canonical = canonicalKeyView(canonicalRows);
  const kinds: TopicCollisionKind[] = ["SLUG", "ORDINAL_KEY_DIVERGENCE", "REDUCED_KEY_VARIANT"];
  const seqBy: SeqBy = new Map();
  const out: CatalogTopicCollision[] = [];
  for (const candidate of candidates.map((topic) => keyOf(topic))) {
    for (const row of canonical) {
      const kind = classifyCollision(candidate, row);
      if (!kind) continue;
      if (!kinds.includes(kind)) continue;
      out.push(collisionOf(kind, { key: candidate.reducedKey, entries: [candidate, row] }, seqBy));
    }
  }
  return out;
}
