#!/usr/bin/env node
/**
 * ConcursoAI - Snapshot read-only do catalogo de conhecimento e editais (FASE 2D).
 *
 * IMPORTANTE: isto NAO e um seed. O artefato gerado e uma representacao historica
 * e reprodutivel do estado encontrado na auditoria. Este arquivo NAO contem INSERT,
 * UPDATE ou DELETE e nao pode ser aplicado como migracao.
 *
 * SEGURANCA DE LEITURA:
 *   - todo o trabalho ocorre dentro de UMA transacao;
 *   - a primeira instrucao e SET TRANSACTION READ ONLY;
 *   - SHOW transaction_read_only e conferido logo em seguida;
 *   - se a confirmacao nao for on, o snapshot aborta sem gravar nada;
 *   - apenas as 6 tabelas da allowlist sao lidas, sempre com ORDER BY id ASC.
 *
 * REDACAO: a string de conexao, host, project ref, usuario, senha e tokens nunca
 * sao impressos nem gravados no artefato.
 *
 * Uso:
 *   node scripts/catalog-snapshot.mjs [--out <arquivo.json>] [--env-file <arquivo>] [--force]
 *   node scripts/catalog-snapshot.mjs --stdout
 */
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import {
  SCRIPT_DB_BLOCKED_EXIT_CODE,
  guardScriptDatabaseTargetOrExit,
  mergeDatabaseEnv,
} from "./lib/db-safety.mjs";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Allowlist hardcoded: nada vindo de argv chega ao SQL. */
const TABLES = [
  "contests",
  "editais",
  "knowledge_subjects",
  "knowledge_topics",
  "notice_subjects",
  "notice_topics",
];

const DEFAULT_OUT = path.join("database", "knowledge", "snapshots", "catalogo-atual.json");

function redact(text) {
  if (text === null || text === undefined) return "";
  return String(text)
    .replace(/:\/\/[^@/]+@/g, "://***@")
    .replace(/\b[a-z0-9-]{10,}\.supabase\.(co|in)\b/gi, "REF-REDIGIDO.supabase.")
    .replace(/(postgres(ql)?|postgresql):\/\/\S+/gi, "<string de conexao redigida>");
}

function fail(message, code) {
  console.error("ERRO: " + redact(message));
  process.exit(code);
}

function readEnvValue(file, key) {
  const abs = path.isAbsolute(file) ? file : path.join(ROOT, file);
  if (!fs.existsSync(abs)) return null;
  const raw = fs.readFileSync(abs, "utf8");
  const found = raw.match(new RegExp("^" + key + "=(.+)$", "m"));
  if (!found) return null;
  return found[1].trim().replace(/^"|"$/g, "").replace(/^\x27|\x27$/g, "");
}

function parseArgs(argv) {
  const args = { out: null, envFile: null, force: false, stdout: false };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    if (flag === "--out") args.out = argv[i + 1] || fail("--out exige caminho", 2);
    else if (flag === "--env-file") args.envFile = argv[i + 1] || fail("--env-file exige caminho", 2);
    else if (flag === "--force") args.force = true;
    else if (flag === "--stdout") args.stdout = true;
    else fail("opcao desconhecida: " + flag + " (permitidas: --out, --env-file, --force, --stdout)", 2);
    if (flag !== "--force" && flag !== "--stdout") i += 1;
  }
  return args;
}

function resolveUrl(args) {
  const candidates = [];
  if (args.envFile) candidates.push(args.envFile);
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  candidates.push(".env", ".env.production");
  for (const file of candidates) {
    if (!file.startsWith("." + "/" + ".") && !file.startsWith(".")) continue;
    const value = readEnvValue(file, "DATABASE_URL");
    if (value) return value;
  }
  return null;
}

function isLive(row) {
  return row.deleted_at === null || row.deleted_at === undefined;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = canonical(value[key]);
    return out;
  }
  return value;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const url = resolveUrl(args);
  if (!url) fail("DATABASE_URL indisponivel (process.env, --env-file, .env ou .env.production). Nada foi lido ou gravado.", 1);

  const target = args.out ? path.resolve(ROOT, args.out) : path.join(ROOT, DEFAULT_OUT);
  const rel = path.relative(ROOT, target);
  if (rel.startsWith("..") || path.isAbsolute(rel)) fail("--out precisa ficar dentro do repositorio", 2);
  if (fs.existsSync(target) && !args.force && !args.stdout) fail("snapshot ja existe em " + rel + "; use --force para substituir explicitamente", 3);

  const startedAt = new Date().toISOString();
  // Guarda fail-closed antes de qualquer conexao: o destino precisa ser banco de teste
  // isolado; ver scripts/lib/db-safety.mjs e src/lib/db/env-guard.ts.
  const decisionEnv = mergeDatabaseEnv(fs, process.env, ROOT, [".env", ".env.production"]);
  const dbVerdict = guardScriptDatabaseTargetOrExit("catalog-snapshot", url, decisionEnv);
  if (!dbVerdict.safe) {
    process.exit(SCRIPT_DB_BLOCKED_EXIT_CODE);
  }
  
  const sql = postgres(url, { max: 1, connect_timeout: 20 });
  const data = {};
  let readOnlyConfirmed = "";
  let fks = [];

  try {
    await sql.begin(async (tx) => {
      await tx.unsafe("SET TRANSACTION READ ONLY");
      const flag = await tx.unsafe("SHOW transaction_read_only");
      readOnlyConfirmed = String((flag && flag[0] && flag[0].transaction_read_only) || "").toLowerCase();
      if (readOnlyConfirmed !== "on") throw new Error("READ_ONLY_NOT_ENFORCED: transacao nao confirmou leitura somente");

      for (const table of TABLES) {
        data[table] = await tx.unsafe("SELECT * FROM public." + table + " ORDER BY id ASC");
      }

      const inList = TABLES.map((t) => "\x27" + t + "\x27").join(", ");
      fks = await tx.unsafe(
        "SELECT tc.table_name AS source_table, kcu.column_name AS source_column," +
        " ccu.table_name AS foreign_table, ccu.column_name AS foreign_column," +
        " rc.delete_rule AS on_delete" +
        " FROM information_schema.table_constraints tc" +
        " JOIN information_schema.key_column_usage kcu" +
        "   ON kcu.constraint_name = tc.constraint_name AND kcu.constraint_schema = tc.constraint_schema" +
        " JOIN information_schema.referential_constraints rc" +
        "   ON rc.constraint_name = tc.constraint_name AND rc.constraint_schema = tc.constraint_schema" +
        " JOIN information_schema.constraint_column_usage ccu" +
        "   ON ccu.constraint_name = rc.unique_constraint_name AND ccu.constraint_schema = rc.unique_constraint_schema" +
        " WHERE tc.constraint_schema = \x27public\x27 AND tc.constraint_type = \x27FOREIGN KEY\x27" +
        "   AND (tc.table_name IN (" + inList + ") OR ccu.table_name IN (" + inList + "))" +
        " ORDER BY 1, 2, 3"
      );
    });
  } catch (error) {
    await sql.end({ timeout: 5 }).catch(() => {});
    fail("snapshot abortado antes de gravar qualquer arquivo (" + (error && error.code ? error.code : "desconhecido") + "): " + redact(error && error.message), 1);
  }

  await sql.end({ timeout: 5 });

  if (readOnlyConfirmed !== "on") fail("confirmacao read-only ausente; snapshot nao gravado", 1);

  const counts = {};
  for (const table of TABLES) counts[table] = { total: data[table].length, live: data[table].filter(isLive).length };

  const topicsBySubject = {};
  for (const row of data.knowledge_topics) {
    const bucket = (topicsBySubject[row.subject_id] = topicsBySubject[row.subject_id] || { total: 0, live: 0, with_parent: 0, hierarchy: [] });
    bucket.total += 1;
    if (isLive(row)) {
      bucket.live += 1;
      if (row.parent_topic_id) bucket.with_parent += 1;
      bucket.hierarchy.push({ id: row.id, name: row.name, slug: row.slug, parent_topic_id: row.parent_topic_id, status: row.status });
    }
  }

  const knowledge_topics_per_subject = data.knowledge_subjects
    .map((s) => ({
      knowledge_subject_id: s.id,
      name: s.name,
      slug: s.slug,
      status: s.status,
      live: isLive(s),
      topics_total: (topicsBySubject[s.id] || { total: 0 }).total,
      topics_live: (topicsBySubject[s.id] || { live: 0 }).live,
      topics_with_parent: (topicsBySubject[s.id] || { with_parent: 0 }).with_parent,
    }))
    .sort((a, b) => (b.topics_live - a.topics_live) || String(a.name).localeCompare(String(b.name)));

  const noticeTopicsBySubject = {};
  for (const row of data.notice_topics) {
    const bucket = (noticeTopicsBySubject[row.notice_subject_id] = noticeTopicsBySubject[row.notice_subject_id] || { total: 0, live: 0, linked: 0, with_parent: 0, with_weight: 0, topics: [] });
    bucket.total += 1;
    if (isLive(row)) {
      bucket.live += 1;
      if (row.knowledge_topic_id) bucket.linked += 1;
      if (row.parent_notice_topic_id) bucket.with_parent += 1;
      if (row.weight !== null && row.weight !== undefined) bucket.with_weight += 1;
      bucket.topics.push({ id: row.id, name: row.name, normalized_name: row.normalized_name, slug: row.slug === undefined ? null : row.slug, knowledge_topic_id: row.knowledge_topic_id, parent_notice_topic_id: row.parent_notice_topic_id, weight: row.weight, status: row.status, metadata: row.metadata });
    }
  }

  const subjectNameById = {};
  for (const s of data.knowledge_subjects) subjectNameById[s.id] = s.name;

  const notice_topics_per_subject = data.notice_subjects
    .map((ns) => ({
      notice_subject_id: ns.id,
      name: subjectNameById[ns.knowledge_subject_id] || null,
      status: ns.status,
      live: isLive(ns),
      edital_id: ns.edital_id === undefined ? null : ns.edital_id,
      knowledge_subject_id: ns.knowledge_subject_id === undefined ? null : ns.knowledge_subject_id,
      metadata: ns.metadata === undefined ? null : ns.metadata,
      topics_total: (noticeTopicsBySubject[ns.id] || { total: 0 }).total,
      topics_live: (noticeTopicsBySubject[ns.id] || { live: 0 }).live,
      topics_linked_to_knowledge: (noticeTopicsBySubject[ns.id] || { linked: 0 }).linked,
      topics_with_parent: (noticeTopicsBySubject[ns.id] || { with_parent: 0 }).with_parent,
      topics_with_weight: (noticeTopicsBySubject[ns.id] || { with_weight: 0 }).with_weight,
      topics: (noticeTopicsBySubject[ns.id] || { topics: [] }).topics,
    }))
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));

  const liveNoticeTopics = data.notice_topics.filter(isLive);
  const liveKnowledgeTopics = data.knowledge_topics.filter(isLive);
  const subjectsWithTopics = new Set(liveKnowledgeTopics.map((t) => t.subject_id));

  const artifact = {
    schema_version: 1,
    kind: "catalog-read-only-snapshot",
    purpose: "preservar o estado do catalogo antes de qualquer catalogacao historica (FASE 3)",
    seed_compatible: false,
    destructive: false,
    generator: "scripts/catalog-snapshot.mjs",
    phase: "FASE 2D",
    started_at: startedAt,
    generated_at: new Date().toISOString(),
    database: {
      source: "DATABASE_URL (redigido: URL, host, usuario, senha, token e project ref nunca sao gravados)",
      project_ref: "REDACTED",
      read_only_confirmed: readOnlyConfirmed,
      read_only_mechanism: "BEGIN + SET TRANSACTION READ ONLY como primeira instrucao + SHOW transaction_read_only",
      statements_executed: "SELECT apenas (6 tabelas em allowlist + information_schema de FKs)",
    },
    scope: { tables: TABLES, ordering: "ORDER BY id ASC", filter: "sem filtro: todas as linhas, inclusive deleted_at nao nulo" },
    counts: counts,
    link_coverage: {
      knowledge_topics_live: liveKnowledgeTopics.length,
      notice_topics_live: liveNoticeTopics.length,
      notice_topics_linked_to_knowledge: liveNoticeTopics.filter((t) => t.knowledge_topic_id).length,
      notice_topics_unlinked_to_knowledge: liveNoticeTopics.filter((t) => !t.knowledge_topic_id).length,
      notice_topics_with_parent: liveNoticeTopics.filter((t) => t.parent_notice_topic_id).length,
      notice_topics_with_weight: liveNoticeTopics.filter((t) => t.weight !== null && t.weight !== undefined).length,
      knowledge_subjects_total: data.knowledge_subjects.length,
      knowledge_subjects_without_live_topics: data.knowledge_subjects.filter((s) => !subjectsWithTopics.has(s.id)).length,
    },
    analysis: { knowledge_topics_per_subject: knowledge_topics_per_subject, notice_topics_per_subject: notice_topics_per_subject },
    relationships: { foreign_keys: fks },
    data: data,
  };

  artifact.checksum_sha256 = crypto.createHash("sha256").update(JSON.stringify(canonical(artifact.data))).digest("hex");

  const json = JSON.stringify(artifact, null, 2) + "\n";
  if (args.stdout) {
    process.stdout.write(json);
  } else {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, json, "utf8");
    console.log("snapshot read-only gravado em " + rel);
  }

  console.log("read_only_confirmed = " + readOnlyConfirmed + " | statements = SELECT apenas");
  console.log("checksum_sha256 = " + artifact.checksum_sha256);
  for (const table of TABLES) console.log("  " + table.padEnd(19) + " total=" + counts[table].total + " live=" + counts[table].live);
  console.log("  notice_topics sem knowledge_topic_id = " + artifact.link_coverage.notice_topics_unlinked_to_knowledge + "/" + artifact.link_coverage.notice_topics_live);
  console.log("  AVISO: artefato NAO e seed; nao aplicar no banco.");
}

main().catch((error) => fail("falha nao tratada: " + (error && error.message), 1));

