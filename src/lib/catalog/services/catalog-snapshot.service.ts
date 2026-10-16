/**
 * CatalogSnapshotReader (FASE 4).
 *
 * Le o snapshot JSON marcado como somente leitura. Este modulo nao abre conexao,
 * nao importa Drizzle/Postgres/Supabase e nao escreve em lugar nenhum: o unico
 * efeito de borda permitido e o readFileSync do proprio snapshot, quando o
 * caller pede. Regenerar o snapshot e atribuicao do script da FASE 2D, nao daqui.
 */
import "server-only";
import { readFileSync } from "node:fs";
import {
  normalizeTopicName,
  slugifyTopic,
  type TopicCandidate,
} from "@/lib/knowledge/services/topic-resolver.service";
import type { CatalogSubjectRow } from "../types/catalog-ingestion";

export const CATALOG_SNAPSHOT_KIND = "catalog-read-only-snapshot";
export const CATALOG_SNAPSHOT_PATH =
  "database/knowledge/snapshots/2026-10-03-catalogo-atual.json";

export interface SnapshotSubjectRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  deleted_at: string | null;
}

export interface SnapshotTopicRow {
  id: string;
  subject_id: string;
  parent_topic_id: string | null;
  name: string;
  slug: string;
  status: string;
  deleted_at: string | null;
}

export interface SnapshotTopicsPerSubject {
  knowledge_subject_id: string;
  name: string;
  slug: string;
  status: string;
  live: boolean;
  topics_total: number;
  topics_live: number;
  topics_with_parent: number;
}

export interface CatalogSnapshotValidation {
  ok: boolean;
  /** Codigos estaveis: nada aqui contem caminho, host ou credencial. */
  errors: string[];
  warnings: string[];
  checked: Record<string, number>;
}

export interface CatalogSnapshotView {
  meta: {
    schemaVersion: number;
    kind: string;
    generatedAt: string;
    phase: string;
    generator: string;
    checksumSha256: string;
    seedCompatible: boolean;
    destructive: boolean;
  };
  subjects: CatalogSubjectRow[];
  topics: TopicCandidate[];
  topicsBySubject: Record<string, TopicCandidate[]>;
  /** chave = normalizeTopicName(name) do catalogo */
  subjectByName: Record<string, CatalogSubjectRow>;
  subjectBySlug: Record<string, CatalogSubjectRow>;
  analysisCounts: SnapshotTopicsPerSubject[];
  validation: CatalogSnapshotValidation;
}

export class CatalogSnapshotError extends Error {
  readonly code: string;
  readonly errors: string[];
  constructor(code: string, message: string, errors: string[] = []) {
    super(message);
    this.name = "CatalogSnapshotError";
    this.code = code;
    this.errors = errors;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rowsOf(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item) => isRecord(item));
}

/**
 * Validacao de forma, nao de conteudo: um snapshot com linhas estranhas continua
 * snapshot. O que se exige e a marca de leitura-only e a presenca das tabelas
 * que o agente precisa.
 */
export function validateSnapshotShape(raw: unknown): CatalogSnapshotValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const checked: Record<string, number> = {};
  if (!isRecord(raw)) {
    return { ok: false, errors: ["SNAPSHOT_NOT_OBJECT"], warnings, checked };
  }
  if (raw.kind !== CATALOG_SNAPSHOT_KIND) errors.push("SNAPSHOT_KIND_MISMATCH");
  if (raw.seed_compatible !== false) errors.push("SNAPSHOT_MUST_NOT_BE_SEED_COMPATIBLE");
  if (typeof raw.schema_version !== "number") errors.push("SNAPSHOT_SCHEMA_VERSION_MISSING");
  if (typeof raw.generated_at !== "string") warnings.push("SNAPSHOT_GENERATED_AT_MISSING");
  if (typeof raw.checksum_sha256 !== "string") warnings.push("SNAPSHOT_CHECKSUM_MISSING");

  const data = isRecord(raw.data) ? raw.data : undefined;
  if (!data) {
    errors.push("SNAPSHOT_DATA_MISSING");
    return { ok: false, errors, warnings, checked };
  }
  const subjectRows = rowsOf(data.knowledge_subjects);
  const topicRows = rowsOf(data.knowledge_topics);
  if (!Array.isArray(data.knowledge_subjects)) errors.push("SNAPSHOT_SUBJECTS_MISSING");
  if (!Array.isArray(data.knowledge_topics)) errors.push("SNAPSHOT_TOPICS_MISSING");
  checked.subjects = subjectRows.length;
  checked.topics = topicRows.length;

  const analysis = isRecord(raw.analysis) ? raw.analysis : undefined;
  const perSubject = analysis ? rowsOf(analysis.knowledge_topics_per_subject) : [];
  if (!Array.isArray(analysis?.knowledge_topics_per_subject)) {
    warnings.push("SNAPSHOT_ANALYSIS_MISSING");
  }
  checked.analysisRows = perSubject.length;

  const subjectIds = new Set(subjectRows.map((row) => String(row.id ?? "")));
  let orphans = 0;
  let softDeleted = 0;
  for (const topic of topicRows) {
    if (!subjectIds.has(String(topic.subject_id ?? ""))) orphans += 1;
    if (topic.deleted_at) softDeleted += 1;
  }
  for (const subject of subjectRows) {
    if (subject.deleted_at) softDeleted += 1;
  }
  checked.orphans = orphans;
  checked.softDeleted = softDeleted;
  if (orphans !== 0) warnings.push("SNAPSHOT_ORPHAN_TOPICS");
  if (softDeleted !== 0) warnings.push("SNAPSHOT_SOFT_DELETED_ROWS");

  const recomputed = new Map<string, number>();
  for (const topic of topicRows) {
    const key = String(topic.subject_id ?? "");
    recomputed.set(key, (recomputed.get(key) ?? 0) + 1);
  }
  let mismatch = 0;
  for (const row of perSubject) {
    const declared = Number(row.topics_total ?? 0);
    const measured = recomputed.get(String(row.knowledge_subject_id ?? "")) ?? 0;
    if (declared !== measured) mismatch += 1;
  }
  checked.analysisMismatch = mismatch;
  if (mismatch !== 0) warnings.push("SNAPSHOT_COUNT_MISMATCH");

  return { ok: errors.length === 0, errors, warnings, checked };
}

/** Carrega o snapshot em estruturas de memoria deterministicas. Nao escreve nada. */
export function loadCatalogSnapshot(raw: unknown): CatalogSnapshotView {
  const validation = validateSnapshotShape(raw);
  if (!validation.ok) {
    throw new CatalogSnapshotError(
      "INVALID_READ_ONLY_SNAPSHOT",
      "O arquivo fornecido nao e um snapshot de leitura-only valido para auditoria.",
      validation.errors
    );
  }
  const record = raw as Record<string, unknown>;
  const data = record.data as Record<string, unknown>;
  const analysis = record.analysis as Record<string, unknown> | undefined;

  const perSubject: SnapshotTopicsPerSubject[] = Array.isArray(
    analysis?.knowledge_topics_per_subject
  )
    ? (analysis?.knowledge_topics_per_subject as SnapshotTopicsPerSubject[])
    : [];
  const countBySubject = new Map(perSubject.map((row) => [row.knowledge_subject_id, row.topics_total]));

  const subjects: CatalogSubjectRow[] = (data.knowledge_subjects as SnapshotSubjectRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug || slugifyTopic(row.name),
    status: row.status,
    deletedAt: row.deleted_at ?? null,
    topicCount: countBySubject.get(row.id) ?? 0,
  }));

  const topics: TopicCandidate[] = (data.knowledge_topics as SnapshotTopicRow[]).map((row) => ({
    id: row.id,
    subjectId: row.subject_id,
    name: row.name,
    slug: row.slug || slugifyTopic(row.name),
  }));

  const topicsBySubject: Record<string, TopicCandidate[]> = {};
  const subjectByName: Record<string, CatalogSubjectRow> = {};
  const subjectBySlug: Record<string, CatalogSubjectRow> = {};
  for (const subject of subjects) {
    topicsBySubject[subject.id] = [];
    const key = normalizeTopicName(subject.name);
    if (key.length !== 0 && !subjectByName[key]) subjectByName[key] = subject;
    if (subject.slug.length !== 0 && !subjectBySlug[subject.slug]) subjectBySlug[subject.slug] = subject;
  }
  for (const topic of topics) {
    if (!topicsBySubject[topic.subjectId]) topicsBySubject[topic.subjectId] = [];
    topicsBySubject[topic.subjectId].push(topic);
  }

  return {
    meta: {
      schemaVersion: Number(record.schema_version ?? 0),
      kind: String(record.kind ?? ""),
      generatedAt: String(record.generated_at ?? ""),
      phase: String(record.phase ?? ""),
      generator: String(record.generator ?? ""),
      checksumSha256: String(record.checksum_sha256 ?? ""),
      seedCompatible: record.seed_compatible === true,
      destructive: record.destructive === true,
    },
    subjects,
    topics,
    topicsBySubject,
    subjectByName,
    subjectBySlug,
    analysisCounts: perSubject,
    validation,
  };
}

/**
 * Le o snapshot do disco. Sem cache e sem escrita: cada chamada rele o arquivo
 * para que a auditoria seja reproduzivel depois de qualquer regeneracao.
 */
export function readCatalogSnapshot(path: string = CATALOG_SNAPSHOT_PATH): CatalogSnapshotView {
  let content: string;
  try {
    content = readFileSync(path, "utf8");
  } catch {
    throw new CatalogSnapshotError("SNAPSHOT_FILE_UNREADABLE", "O arquivo de snapshot nao esta legivel.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new CatalogSnapshotError("SNAPSHOT_FILE_UNPARSEABLE", "O snapshot nao e JSON valido.");
  }
  return loadCatalogSnapshot(parsed);
}

/** Assunto canonico pelo nome publicado, com slug como segunda chance. */
export function lookupSubject(
  view: CatalogSnapshotView,
  publishedName: string
): CatalogSubjectRow | null {
  return (
    view.subjectByName[normalizeTopicName(publishedName)] ??
    view.subjectBySlug[slugifyTopic(publishedName)] ??
    null
  );
}
