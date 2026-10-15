/**
 * Ingestao em lote das apostilas do diretorio de origem.
 *
 * PADRAO: dry-run. Nada e escrito em banco, storage ou R2 sem --apply, e mesmo
 * com --apply a execucao so comeca depois de assertNonProductionDatabaseUrl()
 * comprovar que DATABASE_URL aponta para um banco de teste isolado. Sem essa
 * prova o CLI falha com NON_PRODUCTION_DATABASE_REQUIRED, porque desenvolvimento
 * e producao compartilham o mesmo projeto Supabase neste ambiente.
 *
 * Origem: somente leitura. O CLI nao move, renomeia nem apaga arquivo algum.
 * As saidas vao para a area de trabalho (manifest, reports, logs, processed).
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";

import {
  NonProductionDatabaseRequiredError,
  assertNonProductionDatabaseUrl,
  describeDatabaseSafety,
} from "../src/lib/db/env-guard";
import { resolveMcpProvider } from "../src/lib/knowledge/mcp/registry";
import { McpError, type KnowledgeMcpProvider, type McpPlan } from "../src/lib/knowledge/mcp/contracts";
import { extensionOf, mimeForExtension } from "../src/lib/knowledge/format-contract";

const DEFAULT_SOURCE = process.env.APOSTILA_SOURCE_DIR ?? "";
const DEFAULT_WORKSPACE =
  process.env.APOSTILA_WORK_DIR ?? join(process.cwd(), ".apostilas-work");
const WORKSPACE_DIRS = ["source", "manifest", "processed", "failed", "logs", "exports", "reports"];
const ZERO_PROBE_BYTES = 65536;

type CliArgs = {
  source: string;
  workspace: string;
  limit: number | null;
  apply: boolean;
  mcpId: string | null;
  subject: string | null;
  actorEmail: string | null;
};

type FileEntry = { relPath: string; absPath: string; sizeBytes: number };

type ManifestRow = {
  relPath: string;
  fileName: string;
  sizeBytes: number;
  sha256: string;
  classification: string;
  reason: string | null;
  title: string;
  kind: string;
  subject: string;
  lessonOrder: number | null;
  variant: string | null;
  indexedByDefault: boolean;
  tags: string[];
  action: "pending" | "skipped_duplicate" | "skipped_unsupported" | "skipped_invalid";
};

function usage(): string {
  return [
    "Uso: tsx scripts/ingest-apostilas.ts [opcoes]",
    "  --source DIR      origem somente leitura (ou APOSTILA_SOURCE_DIR)",
    "  --workspace DIR   area de trabalho (ou APOSTILA_WORK_DIR; padrao .apostilas-work)",
    "  --limit N         trunca o lote aceito (a cota do plano e cumulativa)",
    "  --mcp ID          provedor MCP (default apostila-mcp)",
    "  --subject NOME    disciplina gravada no plano",
    "  --apply           executa ingestao real (exige banco de teste isolado)",
    "  --actor-email E   e-mail do professor ou admin responsavel",
    "  --dry-run         forca modo seco (padrao)",
  ].join("\n");
}

function takeValue(next: string | undefined, flag: string): string {
  if (!next || next.startsWith("--")) throw new Error(flag + " exige um valor.");
  return next;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    source: DEFAULT_SOURCE,
    workspace: DEFAULT_WORKSPACE,
    limit: null,
    apply: false,
    mcpId: null,
    subject: null,
    actorEmail: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (token === "--apply") { args.apply = true; continue; }
    if (token === "--dry-run") { args.apply = false; continue; }
    if (token === "--source") { args.source = resolve(takeValue(argv[i + 1], token)); i += 1; continue; }
    if (token === "--workspace") { args.workspace = resolve(takeValue(argv[i + 1], token)); i += 1; continue; }
    if (token === "--mcp") { args.mcpId = takeValue(argv[i + 1], token); i += 1; continue; }
    if (token === "--subject") { args.subject = takeValue(argv[i + 1], token); i += 1; continue; }
    if (token === "--actor-email") { args.actorEmail = takeValue(argv[i + 1], token); i += 1; continue; }
    if (token === "--limit") {
      const parsed = Number(takeValue(argv[i + 1], token));
      if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error("--limit exige um inteiro maior que zero.");
      }
      args.limit = parsed;
      i += 1;
      continue;
    }
    throw new Error("Opcao desconhecida: " + token + "\n" + usage());
  }
  return args;
}

/** Varredura recursiva com saida ordenada por caminho relativo. */
async function walk(root: string, current: string): Promise<FileEntry[]> {
  const entries: FileEntry[] = [];
  const items = await readdir(current, { withFileTypes: true });
  for (const item of items) {
    const absPath = join(current, item.name);
    if (item.isDirectory()) {
      entries.push(...await walk(root, absPath));
      continue;
    }
    if (!item.isFile()) continue;
    const info = await stat(absPath);
    entries.push({
      relPath: relative(root, absPath).split(sep).join("/"),
      absPath,
      sizeBytes: info.size,
    });
  }
  return entries;
}

function sha256Of(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * Arquivo composto apenas por bytes zero: magic bytes invalidos e conteudo
 * inexistente. Precisamos desta checagem porque ele passa no teste de extensao
 * e no de tamanho.
 */
function isAllZero(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;
  const probe = buffer.subarray(0, Math.min(buffer.length, ZERO_PROBE_BYTES));
  for (const byte of probe) {
    if (byte !== 0) return false;
  }
  return true;
}
/**
 * MIME a partir da extensao, pelo contrato unico de formatos: o MCP e o
 * extrator leem a mesma lista, entao .epub nao chega mais no pipeline.
 */
function mimeFor(fileName: string): string {
  return mimeForExtension(extensionOf(fileName)) ?? "application/octet-stream";
}

function baseName(relPath: string): string {
  return relPath.split("/").pop() ?? relPath;
}

/**
 * Classifica todo o lote via MCP, calcula SHA-256 e marca duplicados exatos.
 * Duplicado nao e falha: entra como skipped_duplicate para nao inflar o corpus.
 */
/**
 * Qual dos dois arquivos identicos representa o conteudo no catalogo: ganha o de
 * nome mais curto, empate resolvido por ordem lexicografica. Sem isso a copia
 * que aparece primeiro na caminhada ordenada virava o documento gravado, e o
 * titulo canonico da aula se perdia no lote.
 */
function isMoreCanonical(candidate: ManifestRow, keeper: ManifestRow): boolean {
  if (candidate.fileName.length !== keeper.fileName.length) {
    return candidate.fileName.length < keeper.fileName.length;
  }
  return candidate.relPath.localeCompare(keeper.relPath) < 0;
}

async function buildRows(
  entries: FileEntry[],
  provider: KnowledgeMcpProvider,
  subject: string | null,
): Promise<ManifestRow[]> {
  const rows: ManifestRow[] = [];
  // Keeper por hash: guarda a linha canonica, nao so o caminho.
  const seen = new Map<string, ManifestRow>();

  for (const entry of entries) {
    const fileName = baseName(entry.relPath);
    const buffer = await readFile(entry.absPath);
    const sha256 = sha256Of(buffer);
    const allZeroContent = isAllZero(buffer);

    let plan: McpPlan | null = null;
    let rejection: string | null = null;
    try {
      plan = await provider.plan({
        fileName,
        mimeType: mimeFor(fileName),
        sizeBytes: entry.sizeBytes,
        sha256,
        subject: subject ?? undefined,
        relativePath: entry.relPath,
        allZeroContent,
      });
    } catch (error) {
      if (!(error instanceof McpError)) throw error;
      rejection = error.message;
    }

    if (!plan) {
      rows.push({
        relPath: entry.relPath,
        fileName,
        sizeBytes: entry.sizeBytes,
        sha256,
        classification: "invalid",
        reason: rejection ?? "Provedor MCP recusou o arquivo.",
        title: fileName,
        kind: "outro",
        subject: subject ?? "geral",
        lessonOrder: null,
        variant: null,
        indexedByDefault: false,
        tags: [],
        action: "skipped_invalid",
      });
      continue;
    }

    let action: ManifestRow["action"] = "pending";
    if (plan.classification === "invalid") {
      action = "skipped_invalid";
    } else if (plan.classification !== "supported") {
      action = "skipped_unsupported";
    }

    const row: ManifestRow = {
      relPath: entry.relPath,
      fileName,
      sizeBytes: entry.sizeBytes,
      sha256,
      classification: plan.classification,
      reason: plan.reason ?? null,
      title: plan.title,
      kind: plan.kind,
      subject: plan.subject,
      lessonOrder: plan.lessonOrder ?? null,
      variant: plan.variant ?? null,
      indexedByDefault: plan.indexedByDefault,
      tags: plan.tags,
      action,
    };

    // Duplicado exato nao e falha: entra como skipped_duplicate para nao inflar
    // o corpus, e o arquivo canonico e o que fica pendente.
    if (action === "pending") {
      const keeper = seen.get(sha256);
      if (!keeper) {
        seen.set(sha256, row);
      } else if (isMoreCanonical(row, keeper)) {
        keeper.action = "skipped_duplicate";
        seen.set(sha256, row);
      } else {
        row.action = "skipped_duplicate";
      }
    }

    rows.push(row);
  }

  return rows;
}

function summarize(rows: ManifestRow[]) {
  return {
    found: rows.length,
    supported: rows.filter(function (row) { return row.classification === "supported"; }).length,
    invalid: rows.filter(function (row) { return row.action === "skipped_invalid"; }).length,
    unsupported: rows.filter(function (row) { return row.action === "skipped_unsupported"; }).length,
    duplicates: rows.filter(function (row) { return row.action === "skipped_duplicate"; }).length,
    variants: rows.filter(function (row) { return row.variant !== null; }).length,
    pending: rows.filter(function (row) { return row.action === "pending"; }).length,
    totalBytes: rows.reduce(function (acc, row) { return acc + row.sizeBytes; }, 0),
    pendingBytes: rows
      .filter(function (row) { return row.action === "pending"; })
      .reduce(function (acc, row) { return acc + row.sizeBytes; }, 0),
  };
}

function renderReport(args: CliArgs, provider: KnowledgeMcpProvider, rows: ManifestRow[]): string {
  const summary = summarize(rows);
  const lines: string[] = [
    "# Relatorio de ingestao de apostilas",
    "",
    "- modo: " + (args.apply ? "APPLY" : "dry-run"),
    "- provedor MCP: " + provider.id + "-" + provider.version,
      "- versao editorial: " + provider.processingVersion,
    "- origem: " + args.source,
    "- achados: " + summary.found,
    "- suportados: " + summary.supported,
    "- invalidos: " + summary.invalid,
    "- nao suportados: " + summary.unsupported,
    "- duplicados: " + summary.duplicates,
    "- variantes fora do indice: " + summary.variants,
    "- total de bytes: " + summary.totalBytes,
    "- limite aplicado: " + (args.limit ?? "nenhum"),
    // Projecao do que o --apply gravaria: só linhas pending contam e o --limit
    // trunca essa fila. Sem estas linhas o report mostra o lote inteiro e o
    // operador nao consegue ler o tamanho real da escrita projetada.
    ...projectedLines(summary, args.limit),
    "",
    "| aula | arquivo | bytes | status | acao |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const row of rows) {
    const lesson = row.lessonOrder === null ? "-" : String(row.lessonOrder).padStart(2, "0");
    lines.push(
      "| " + lesson + " | " + row.relPath + " | " + row.sizeBytes + " | " + row.classification +
        " | " + row.action + " |",
    );
  }
  return lines.join("\n") + "\n";
}

/**
 * Linhas de projecao do apply: quantos documentos e bytes entrariam, respeitando
 * o --limit. Aritmetica sobre o manifest - nenhuma escrita acontece aqui.
 */
function projectedLines(
  summary: ReturnType<typeof summarize>,
  limit: number | null
) {
  const would = limit === null ? summary.pending : Math.min(summary.pending, limit);
  return [
    "- pendentes para o apply: " + summary.pending,
    "- persistiriam com este limite: " + would,
    "- bytes dos pendentes: " + summary.pendingBytes,
  ];
}

async function writeArtifacts(args: CliArgs, provider: KnowledgeMcpProvider, rows: ManifestRow[]): Promise<void> {
  for (const dir of WORKSPACE_DIRS) {
    await mkdir(join(args.workspace, dir), { recursive: true });
  }
  const manifest = JSON.stringify({ generatedAt: new Date().toISOString(), provider: provider.id,
    mcpVersion: provider.version,
    processingVersion: provider.processingVersion,
    source: args.source,
    rows }, null, 2);
  await writeFile(join(args.workspace, "manifest", "apostilas.json"), manifest, "utf8");
  await writeFile(join(args.workspace, "reports", "apostilas.md"), renderReport(args, provider, rows), "utf8");
}
/**
 * Ingestao real, atraves do pipeline completo:
 *   arquivo -> validacao -> storage -> extracao -> chunks -> embeddings ->
 *   indexacao -> metadados -> associacao -> Knowledge Engine -> RAG
 *
 * Nao roda sem o guard provar banco de teste isolado, e nao roda sem um ator
 * professor/admin real: isProfessorOrAdmin(undefined) NAO e suficiente aqui.
 */
async function applyIngestion(args: CliArgs, provider: KnowledgeMcpProvider, rows: ManifestRow[]): Promise<void> {
  assertNonProductionDatabaseUrl("apostila-cli", process.env.DATABASE_URL);
  if (!args.actorEmail) throw new Error("--apply exige --actor-email de professor ou admin.");

  const pending = rows.filter(function (row) { return row.action === "pending"; });
  const limited = args.limit === null ? pending : pending.slice(0, args.limit);
  if (limited.length !== pending.length) {
    console.log("[cli] --limit ativo: " + limited.length + " de " + pending.length + " documento(s).");
  }

  const { AdminGuardService } = await import("../src/lib/administration/services/admin-guard.service");
  const allowed = await AdminGuardService.isProfessorOrAdmin(args.actorEmail);
  if (!allowed) throw new Error("E-mail sem privilegio de upload: " + args.actorEmail);

  const { db } = await import("../src/lib/db/drizzle");
  const { authUsers } = await import("../src/db/schema/identity");
  const { eq } = await import("drizzle-orm");
  const [actor] = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, args.actorEmail))
    .limit(1);
  if (!actor) throw new Error("Ator sem registro em auth.users: " + args.actorEmail);
  const userId = actor.id;

  const { IngestionService } = await import("../src/lib/knowledge/services/ingestion.service");
  const { DocumentStorageService } = await import("../src/lib/knowledge/storage.service");
  const { DocumentPipelineService } = await import("../src/lib/knowledge/services/document-pipeline.service");
  const { DocumentRepository } = await import("../src/lib/knowledge/repositories/document.repository");

  let done = 0;
  for (const row of limited) {
    const buffer = await readFile(join(args.source, ...row.relPath.split("/")));
    const file = new File([buffer], row.fileName, { type: mimeFor(row.fileName) });
    const plan = await provider.plan({
      fileName: row.fileName,
      mimeType: file.type,
      sizeBytes: row.sizeBytes,
      sha256: row.sha256,
      subject: args.subject ?? undefined,
      relativePath: row.relPath,
    });

    const result = await IngestionService.ingest({ userId, file, sourceType: "upload" });
    await DocumentStorageService.upload({
      userId,
      documentId: result.documentId,
      fileName: result.storagePath.split("/").pop() ?? row.fileName,
      buffer,
      mimeType: result.mimeType,
    });

    try {
      await DocumentPipelineService.processDocument(result.documentId);
    } catch (error) {
      console.warn("[cli] pipeline falhou em " + row.relPath + ": " + (error as Error).message);
    }

    await DocumentRepository.updateMetadata(result.documentId, {
      mcp_provider_id: plan.providerId,
      mcp_version: plan.providerVersion,
      processing_version: plan.processingVersion,
      lesson_order: plan.lessonOrder ?? null,
      variant: plan.variant ?? null,
      mcp: {
        providerId: plan.providerId,
        providerVersion: plan.providerVersion,
        processingVersion: plan.processingVersion,
        variant: plan.variant ?? null,
        indexedByDefault: plan.indexedByDefault,
      },
    });

    done += 1;
    console.log("[cli] ingerido " + done + "/" + limited.length + ": " + row.relPath);
  }
  console.log("[cli] ingestao concluida: " + done + " documento(s).");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const provider = resolveMcpProvider(args.mcpId);

  if (!args.source) {
    console.error(usage());
    console.error("Defina --source DIR ou APOSTILA_SOURCE_DIR: sem origem nao ha lote a processar.");
    process.exitCode = 2;
    return;
  }

  console.log("[cli] provedor MCP: " + provider.id + " v" + provider.version);
  console.log("[cli] origem: " + args.source);
  console.log("[cli] modo: " + (args.apply ? "APPLY" : "dry-run (padrao)"));

  const entries = await walk(args.source, args.source);
  entries.sort(function (a, b) { return a.relPath.localeCompare(b.relPath); });

  const rows = await buildRows(entries, provider, args.subject);
  const summary = summarize(rows);
  console.log(
    "[cli] encontrados=" + summary.found +
      " suportados=" + summary.supported +
      " invalidos=" + summary.invalid +
      " nao_suportados=" + summary.unsupported +
      " duplicados=" + summary.duplicates +
      " variantes=" + summary.variants,
  );

  await writeArtifacts(args, provider, rows);
  console.log("[cli] manifest e report gravados em " + args.workspace);

  if (!args.apply) {
    console.log("[cli] dry-run: nenhuma escrita em banco, storage ou R2.");
    return;
  }

  console.log(describeDatabaseSafety("apostila-cli"));
  await applyIngestion(args, provider, rows);
}

main().catch(function (error) {
  if (error instanceof NonProductionDatabaseRequiredError) {
    console.error("[cli] BLOCKED " + error.code + ": " + error.message);
    process.exitCode = 3;
    return;
  }
  if (error instanceof McpError) {
    console.error("[cli] MCP " + error.code + ": " + error.message);
    process.exitCode = 4;
    return;
  }
  console.error("[cli] falha: " + (error instanceof Error ? error.message : String(error)));
  process.exitCode = 1;
});
