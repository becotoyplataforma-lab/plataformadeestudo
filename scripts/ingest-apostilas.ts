/**
 * Ingestao em lote das apostilas do diretorio de origem.
 *
 * PADRAO: dry-run. Nada e escrito em banco, storage ou R2 sem --apply, e mesmo
 * com --apply a execucao so comeca depois de assertNonProductionDatabaseUrl()
 * comprovar que DATABASE_URL aponta para um banco de teste isolado. Sem essa
 * prova o CLI falha com NON_PRODUCTION_DATABASE_REQUIRED, porque desenvolvimento
 * e producao compartilham o mesmo projeto Supabase neste ambiente.
 *
 * Quatro modos de escrita, mutuamente exclusivos:
 *   --stage  os bytes vao para o storage escolhido e a entrada entra na fila de
 *            ingestao. Nenhum banco e tocado, por isso nenhum guard de banco se
 *            aplica: e o modo que funciona neste posto, sem DATABASE_URL.
 *   --apply  ingestao completa (exige banco de teste isolado).
 *   --sync   consome a fila: `staged` vira ingestao completa a partir dos bytes
 *            preservados, `recorded` repete so a extracao/embeddings. Tambem
 *            exige banco de teste isolado.
 *   --reprocess ID[,ID...]  refaz extracao+transform+chunks de documentos ja
 *            ingeridos, a partir dos bytes em storage. Mesmo guard do --apply.
 *
 * Transformacao editorial (`--transform`, ligado por padrao): redige PII e
 * normaliza a estrutura em fases dentro do pipeline, antes do chunking. Desligue
 * com `--no-transform`; escolha o modo com `--mode sanitize-only|structure|full`.
 * Cada documento ingerido deixa `<workspace>/reports/<id>.transform.json`.
 *
 * Previsualizacao editorial (`--preview`): extracao + transform de cada arquivo
 * aceito, gravados em `<workspace>/preview/<id>/` como `apostila-transformada.md`
 * (o texto que iria para o chunker) e `transform-report.json`. Nao abre conexao
 * com banco, nao sobe um byte a storage e nao escreve manifest — por isso nao
 * precisa do guard de banco e e o unico modo que mostra a saida do pipeline antes
 * de existir qualquer escrita. `--limit` e `--mode` valem aqui do mesmo jeito.
 *
 * --backend r2|supabase|local decide onde os bytes DESTA execucao vivem; sem ele
 * vale STORAGE_BACKEND. Storage local em producao e recusado pelo adaptador
 * (LOCAL_BACKEND_FORBIDDEN), e nao ha escolha de backend por documento.
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
  ensureProjectEnv,
} from "../src/lib/db/env-guard";
import { resolveMcpProvider } from "../src/lib/knowledge/mcp/registry";
import { McpError, type KnowledgeMcpProvider, type McpPlan } from "../src/lib/knowledge/mcp/contracts";
import {
  APOSTILA_TRANSFORM_MODES,
  type ApostilaTransformReport,
} from "../src/lib/knowledge/dto/apostila-transform.dto";
import { extensionOf, mimeForExtension, textFormatOf } from "../src/lib/knowledge/format-contract";
import {
  pendingEntriesToSync,
  readPendingQueue,
  readStagedBytes,
  recordPendingIngest,
  recordStagedIngest,
  stagingDirFor,
  summarizePendingQueue,
  updatePendingStatus,
  writeStagedBytes,
  type PendingIngestEntry,
} from "../src/lib/knowledge/pending-ingest";

const DEFAULT_SOURCE = process.env.APOSTILA_SOURCE_DIR ?? "";
const DEFAULT_WORKSPACE =
  process.env.APOSTILA_WORK_DIR ?? join(process.cwd(), ".apostilas-work");
const WORKSPACE_DIRS = ["source", "manifest", "processed", "failed", "logs", "exports", "reports"];
const ZERO_PROBE_BYTES = 65536;
const BACKEND_CHOICES = ["r2", "supabase", "local"] as const;

type CliArgs = {
  source: string;
  workspace: string;
  limit: number | null;
  apply: boolean;
  stage: boolean;
  sync: boolean;
  backend: string | null;
  mcpId: string | null;
  subject: string | null;
  actorEmail: string | null;
  /** default on: `--no-transform` devolve o texto extraido cru para o chunker. */
  transform: boolean;
  /** `--reprocess ID[,ID...]` refaz extracao + transform + chunks de documentos ja ingeridos. */
  reprocess: string[];
  /** Modo de transformacao desta execucao; vira APOSTILA_TRANSFORM_MODE. */
  mode: string | null;
  /** `--preview`: extracao + transform, zero escrita (banco, storage e manifest). */
  preview: boolean;
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
    "  --stage           grava os bytes no storage e coloca a apostila na fila (sem banco)",
    "  --sync            consome a fila: ingere as staged e repete a extracao das recorded",
    "  --backend B       r2 | supabase | local para os bytes desta execucao (default STORAGE_BACKEND)",
    "  --actor-email E   e-mail do professor ou admin responsavel",
    "  --dry-run         forca modo seco (padrao)",
    "  --transform       aplica o pipeline editorial (padrao: ligado)",
    "  --no-transform    nao aplica regra editorial alguma: texto cru no indice",
    "  --mode M          sanitize-only | structure | full (ou APOSTILA_TRANSFORM_MODE)",
    "  --reprocess ID    refaz extracao+transform+chunks de apostilas ja ingeridas (exige banco de teste)",
    "  --preview         extracao+transform sem nenhuma escrita: saida em <workspace>/preview/<sha12>/",
  ].join("\n");
}

/** Backend de storage desta execucao. Nao existe escolha de backend por documento. */
function parseBackend(raw: string): string {
  if (!(BACKEND_CHOICES as readonly string[]).includes(raw)) {
    throw new Error("--backend aceita r2, supabase ou local. Recebido: " + raw + "\n" + usage());
  }
  return raw;
}

/**
 * Os quatro modos de escrita sao mutuamente exclusivos: cada um tem outro guard,
 * e rodar dois de uma vez faria o segundo reprocessar o que o primeiro acabou de
 * ingerir.
 */
function assertSingleWriteMode(args: CliArgs): void {
  const active: Array<[string, boolean]> = [
    ["--apply", args.apply],
    ["--stage", args.stage],
    ["--sync", args.sync],
    ["--reprocess", args.reprocess.length > 0],
  ];
  const chosen = active.filter((entry) => entry[1]).map((entry) => entry[0]);
  if (chosen.length > 1) {
    throw new Error("Modos exclusivos: " + chosen.join(" e ") + ". Escolha um.\n" + usage());
  }
}

/** O modo desta execucao, como aparece no log e no report. */
function modeLabel(args: CliArgs): string {
  if (args.preview) return "preview (sem banco, sem storage, sem manifest)";
  if (args.reprocess.length > 0) return "reprocess (" + args.reprocess.length + " documento(s))";
  if (args.sync) return "sync (consome a fila)";
  if (args.stage) return "stage (sem banco)";
  return args.apply ? "APPLY" : "dry-run (padrao)";
}

/**
 * Modo de transformacao escolhido na linha de comando.
 *
 * CLI erra alto: `--mode ful` nao cai em default silencioso, porque o operador
 * precisa saber que o lote saiu sem IA em vez de assumir que saiu com.
 */
function parseTransformMode(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (!(APOSTILA_TRANSFORM_MODES as readonly string[]).includes(value)) {
    throw new Error(
      "--mode aceita " + APOSTILA_TRANSFORM_MODES.join(", ") + ". Recebido: " + raw + "\n" + usage(),
    );
  }
  return value;
}

/** Ids de documento, separados por virgula. UUID primeiro, banco depois. */
function parseDocumentIds(raw: string): string[] {
  const ids = raw
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id.length > 0);
  if (ids.length === 0) throw new Error("--reprocess exige pelo menos um id de documento.");
  for (const id of ids) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error("--reprocess espera UUID(s) de documents.id. Recebido: " + id);
    }
  }
  return ids;
}

/**
 * Relatorio JSON por apostila em `<workspace>/reports/`.
 *
 * O nome do arquivo e o id do documento: dois arquivos com o mesmo titulo de
 * aula nao colidem, e o JSON nao pode mentir sobre a que documento pertence.
 */
async function writeTransformReport(
  args: CliArgs,
  documentId: string,
  report: ApostilaTransformReport,
): Promise<void> {
  const dir = join(args.workspace, "reports");
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, documentId + ".transform.json"), JSON.stringify(report, null, 2), "utf8");
}

/**
 * Marcas de procedencia que a entrada tinha e a saida nao manteve.
 *
 * O portao ja existe no structurer (a IA e rejeitada quando devolve texto sem as
 * marcas da entrada) e o relatorio traz `procedencia_preservada`. Isto aqui e a
 * leitura legivel dessa mesma prova, separada por natureza da marca: quem revisa
 * um preview precisa de ler "a URL da plataforma continua la" sem reconstruir a
 * lista a partir do arquivo de regras.
 *
 * `null` quando a entrada nao trazia nenhuma marca daquele tipo: ahi nao ha o
 * que provar, e escrever `true` seria garantia sobre algo que nunca existiu.
 */
/** URL no texto extraido: o dominio da plataforma aparece como `www.` ou com esquema. */
const URL_IN_TEXT = /(?:https?:\/\/|www\.)[^\s<>"'()\[\]]{4,120}/gi;

function provenanceCheck(input: string, output: string, tokens: readonly string[]) {
  const from = input.toLowerCase();
  const to = output.toLowerCase();
  const expected = tokens.filter((token) => from.includes(token.toLowerCase()));
  const missingBrands = expected.filter((token) => !to.includes(token.toLowerCase()));

  // A lista de regras guarda NOMES de marca, nao enderecos: "estrategia" nao prova
  // que `www.estrategiaconcursos.com.br` sobreviveu. A prova da URL sai do proprio
  // texto — toda URL presente na entrada tem de continuar presente na saida.
  const urls = Array.from(new Set(input.match(URL_IN_TEXT)?.map((url) => url.toLowerCase()) ?? []));
  const missingUrls = urls.filter((url) => !to.includes(url));

  return {
    marca_plataforma_permanece: expected.length === 0 ? null : missingBrands.length === 0,
    url_permanece: urls.length === 0 ? null : missingUrls.length === 0,
    marcas_esperadas: expected,
    urls_esperadas: urls.length,
    marcas_ausentes: [...missingBrands, ...missingUrls],
  };
}


/**
 * `--preview`: extracao + transform editorial de cada arquivo aceito, zero escrita.
 *
 * Reproduz o trecho do pipeline que antecede o chunking — a mesma extracao, a
 * mesma normalizacao pagina a pagina, o mesmo `transformExtraction` — e por isso
 * o `apostila-transformada.md` e o texto que o chunker receberia, nao uma versao
 * aproximada dele. Nada aqui importa repositorio, storage ou guard de banco: o
 * modo existe precisamente para o caso em que o banco de teste ainda nao ha.
 *
 * O `documentId` sai do sha256 do arquivo (`prev-<12 hex>`) porque nao existe
 * linha em `documents`: e nome de pasta, nao identidade persistida.
 */
async function previewIngestion(args: CliArgs, rows: ManifestRow[]): Promise<void> {
  const { DocumentExtractionService } = await import(
    "../src/lib/knowledge/services/extraction.service"
  );
  const { ApostilaTransformerService, normalizeExtractedText, PAGE_JOIN, deepSeekStructuringClient } =
    await import("../src/lib/knowledge/services/apostila-transformer.service");
  const { loadApostilaRules } = await import("../src/lib/knowledge/config/apostila-rules.schema");

  // O CLI nao e iniciado pelo Next, entao ninguem injetou o .env no processo. Sem
  // este carregamento, `--mode full` nao veria `DEEPSEEK_API_KEY`, chamaria o
  // provedor indisponivel e cairia em sanitize-only parecendo falha de IA.
  ensureProjectEnv();

  const rules = (await loadApostilaRules(process.env)).rules;
  // A pasta leva o modo pedido porque o mesmo PDF em `sanitize-only` e em `full`
  // produz saidas diferentes: sem isto, a segunda execucao pisaria a evidencia da
  // primeira, e comparar modos e justamente o que a previsualizacao existe para fazer.
  const requestedMode = (process.env.APOSTILA_TRANSFORM_MODE ?? "sanitize-only").trim();

  // O modo pedido so e realidade se houver provedor. Anunciar isto antes do lote
  // evita o erro de leitura contrario: "rodei full" quando o que rodou foi offline.
  const client = deepSeekStructuringClient(process.env);
  const wantsAi = requestedMode === "structure" || requestedMode === "full";
  console.log(
    "[cli] IA: modo " + requestedMode + " | provedor " +
      (client.available ? client.label : "sem chave configurada") +
      (wantsAi && !client.available ? " (ninguem chamou: vai cair em sanitize-only)" : ""),
  );

  const targets = pendingRows(args, rows);
  if (targets.length === 0) {
    console.log("[cli] preview: nenhum arquivo pendente para pre-visualizar.");
    return;
  }

  let done = 0;
  for (const row of targets) {
    const previewId = "prev-" + row.sha256.slice(0, 12);
    try {
      const buffer = await readFile(join(args.source, ...row.relPath.split("/")));
      const extracted = await DocumentExtractionService.extract(
        buffer,
        mimeFor(row.fileName),
        textFormatOf(extensionOf(row.fileName)) ?? "",
      );

      // Mesma forma do pipeline: paginas normalizadas uma a uma e unidas pelo
      // separador das fronteiras. Mexer aqui de um lado so, e o preview passa a
      // mostrar um texto que o chunker nunca viria a receber.
      const pages =
        extracted.pages && extracted.pages.length > 0
          ? extracted.pages.map((page) => normalizeExtractedText(page))
          : null;
      const input = pages !== null ? pages.join(PAGE_JOIN) : normalizeExtractedText(extracted.text);

      if (!input) {
        console.warn(
          "[cli] preview sem texto em " + row.relPath +
            ": provavel PDF escaneado (OCR nao configurado). Nada gravado para este arquivo.",
        );
        continue;
      }

      const outcome = await ApostilaTransformerService.transformExtraction({
        text: input,
        pages: pages ?? undefined,
        sha256Original: row.sha256,
        documentId: previewId,
        fileName: row.fileName,
      });
      const report = outcome.report;
      const provenance = provenanceCheck(input, outcome.text, rules.marcas_procedencia);
      const dir = join(args.workspace, "preview", requestedMode, previewId);
      await mkdir(dir, { recursive: true });

      await writeFile(
        join(dir, "apostila-transformada.md"),
        outcome.text.endsWith("\n") ? outcome.text : outcome.text + "\n",
        "utf8",
      );
      const envelope = {
        previsualizacao: {
          documento: previewId,
          origem: row.relPath,
          bytes_originais: row.sizeBytes,
          paginas_extraidas: extracted.pageCount ?? (pages ? pages.length : 1),
          caracteres_entrada: input.length,
          caracteres_saida: outcome.text.length,
          escrita: "nenhuma: banco, storage e manifest intactos",
          ...provenance,
        },
        relatorio: report,
      };
      await writeFile(join(dir, "transform-report.json"), JSON.stringify(envelope, null, 2), "utf8");

      done += 1;
      console.log(
        "[cli] preview " + done + "/" + targets.length + ": " + row.relPath +
          " -> preview/" + requestedMode + "/" + previewId +
          " | modo " + report.modo_pedido + "->" + report.modo_usado +
          " | PII " + report.pii_removidos +
          " | fases " + report.fases_criadas +
          " | questoes " + report.questoes_entrada + "->" + report.questoes_saida +
          " | procedencia " + report.procedencia_preservada +
          " | fallback " + report.fallback_ativado +
          " | " + report.duracao_ms + "ms",
      );
      if (report.fallback_ativado && report.fallback_motivo) {
        console.warn("[cli]   fallback: " + report.fallback_motivo);
      }
      if (provenance.marcas_ausentes.length > 0) {
        console.warn("[cli]   marcas perdidas: " + provenance.marcas_ausentes.join(", "));
      }
    } catch (error) {
      // Preview nao perde o lote por causa de um arquivo: o mesmo PDF que falha
      // aqui falharia no --apply, e a lista de falhas e parte do resultado.
      console.warn(
        "[cli] preview falhou em " + row.relPath + " (" + previewId + "): " +
          (error as Error).message,
      );
    }
  }

  console.log(
    "[cli] preview concluido: " + done + "/" + targets.length + " documento(s) em " +
      join(args.workspace, "preview") + " — nenhuma escrita em banco, storage ou manifest.",
  );
}

function takeValue(next: string | undefined, flag: string): string {
  if (!next || next.startsWith("--")) throw new Error(flag + " exige um valor.");
  return next;
}

/** Aceita `--flag valor` e `--flag=valor`; a segunda forma e a que aparece em docs. */
function expandEquals(input: string[]): string[] {
  const argv: string[] = [];
  for (const token of input) {
    const eq = token.startsWith("--") ? token.indexOf("=") : -1;
    if (eq > 2) argv.push(token.slice(0, eq), token.slice(eq + 1));
    else argv.push(token);
  }
  return argv;
}

function parseArgs(input: string[]): CliArgs {
  const argv = expandEquals(input);
  const args: CliArgs = {
    source: DEFAULT_SOURCE,
    workspace: DEFAULT_WORKSPACE,
    limit: null,
    apply: false,
    stage: false,
    sync: false,
    backend: null,
    mcpId: null,
    subject: null,
    actorEmail: null,
    transform: true,
    reprocess: [],
    mode: null,
    preview: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--help" || token === "-h") {
      process.stdout.write(usage() + "\n");
      process.exit(0);
    }
    if (token === "--apply") { args.apply = true; continue; }
    if (token === "--stage") { args.stage = true; continue; }
    if (token === "--sync") { args.sync = true; continue; }
    if (token === "--backend") { args.backend = parseBackend(takeValue(argv[i + 1], token)); i += 1; continue; }
    if (token === "--dry-run") { args.apply = false; args.stage = false; args.sync = false; args.reprocess = []; continue; }
    if (token === "--preview") {
      // Previsualizacao nao escreve em lugar nenhum: invalida os modos de escrita
      // do mesmo modo que --dry-run, seja qual for a ordem da linha de comando.
      args.preview = true;
      args.apply = false; args.stage = false; args.sync = false; args.reprocess = [];
      continue;
    }
    if (token === "--transform") { args.transform = true; continue; }
    if (token === "--no-transform") { args.transform = false; continue; }
    if (token === "--mode") { args.mode = parseTransformMode(takeValue(argv[i + 1], token)); i += 1; continue; }
    if (token === "--reprocess") { args.reprocess = parseDocumentIds(takeValue(argv[i + 1], token)); i += 1; continue; }
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
    "- modo: " + modeLabel(args),
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
    "- transformacao editorial: " +
      (args.transform ? (args.mode ?? process.env.APOSTILA_TRANSFORM_MODE ?? "sanitize-only (default)") : "DESATIVADA (--no-transform)"),
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
 * Quem pode escrever no banco: primeiro o guard prova banco de teste isolado,
 * depois o ator real. `isProfessorOrAdmin(undefined)` NAO e suficiente aqui, e o
 * ator precisa existir em `auth.users` — a linha de `documents` referencia ela.
 */
async function requireActor(args: CliArgs): Promise<string> {
  assertNonProductionDatabaseUrl("apostila-cli", process.env.DATABASE_URL);
  if (!args.actorEmail) throw new Error("Este modo exige --actor-email de professor ou admin.");

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
  return actor.id;
}

/**
 * O minimo que o CLI sabe sobre um arquivo para ingere-lo. `ManifestRow`
 * satisfaz esta forma, e uma entrada da fila tambem — assim `--apply` e `--sync`
 * percorrem exatamente o mesmo caminho de ingestao.
 */
type IngestTarget = { relPath: string; fileName: string; sha256: string; sizeBytes: number };

/**
 * Ingestao de UM arquivo: registro -> bytes -> extracao/embeddings -> metadados.
 */
async function applyOne(
  args: CliArgs,
  provider: KnowledgeMcpProvider,
  userId: string,
  target: IngestTarget,
  buffer: Buffer<ArrayBuffer>
): Promise<{ documentId: string; storagePath: string; storageBackend: string }> {
  const { IngestionService } = await import("../src/lib/knowledge/services/ingestion.service");
  const { DocumentStorageService } = await import("../src/lib/knowledge/storage.service");
  const { DocumentPipelineService } = await import("../src/lib/knowledge/services/document-pipeline.service");
  const { DocumentRepository } = await import("../src/lib/knowledge/repositories/document.repository");

  const file = new File([buffer], target.fileName, { type: mimeFor(target.fileName) });
  const plan = await provider.plan({
    fileName: target.fileName,
    mimeType: file.type,
    sizeBytes: target.sizeBytes,
    sha256: target.sha256,
    subject: args.subject ?? undefined,
    relativePath: target.relPath,
  });

  const result = await IngestionService.ingest({ userId, file, sourceType: "upload" });
  await DocumentStorageService.upload({
    userId,
    documentId: result.documentId,
    fileName: result.storagePath.split("/").pop() ?? target.fileName,
    buffer,
    mimeType: result.mimeType,
  });

  try {
    const pipeline = await DocumentPipelineService.processDocument(result.documentId);
    if (args.transform && pipeline.transformReport) {
      await writeTransformReport(args, result.documentId, pipeline.transformReport);
    }
  } catch (error) {
    // Bytes e registro ja existem; so a extracao falhou. Entra na fila como
    // `recorded` para o proximo --sync repetir apenas este passo, em vez de
    // obrigar a voltar ao --stage e gravar os mesmos bytes duas vezes.
    await recordPendingIngest({
      fileName: target.fileName,
      filePath: target.relPath,
      mimeType: result.mimeType,
      sizeBytes: target.sizeBytes,
      sha256: target.sha256,
      storageBackend: result.storageBackend,
      storagePath: result.storagePath,
      documentId: result.documentId,
    });
    console.warn("[cli] pipeline falhou em " + target.relPath + " (fila `recorded`): " + (error as Error).message);
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

  return {
    documentId: result.documentId,
    storagePath: result.storagePath,
    storageBackend: result.storageBackend,
  };
}

/**
 * Ingestao real pelo pipeline completo:
 *   arquivo -> validacao -> storage -> extracao -> chunks -> embeddings ->
 *   indexacao -> metadados -> associacao -> Knowledge Engine -> RAG
 */
async function applyIngestion(args: CliArgs, provider: KnowledgeMcpProvider, rows: ManifestRow[]): Promise<void> {
  const userId = await requireActor(args);
  const limited = pendingRows(args, rows);
  let done = 0;
  for (const row of limited) {
    const buffer = await readFile(join(args.source, ...row.relPath.split("/")));
    await applyOne(args, provider, userId, row, buffer);
    done += 1;
    console.log("[cli] ingerido " + done + "/" + limited.length + ": " + row.relPath);
  }
  console.log("[cli] ingestao concluida: " + done + " documento(s).");
}

/** `--limit` corta a lista de arquivos que ainda precisam de ingestao. */
function pendingRows(args: CliArgs, rows: ManifestRow[]): ManifestRow[] {
  const pending = rows.filter((row) => row.action === "pending");
  const limited = args.limit === null ? pending : pending.slice(0, args.limit);
  if (limited.length !== pending.length) {
    console.log("[cli] --limit ativo: " + limited.length + " de " + pending.length + " documento(s).");
  }
  return limited;
}

/**
 * Metade storage, nenhuma de banco: os bytes vao para o backend escolhido e a
 * apostila entra na fila como `staged`. Nenhum guard de banco se aplica porque
 * nenhuma linha e escrita — e por isso o modo tambem nao exige --actor-email.
 *
 * Os bytes ficam no STAGING, enderecado pelo sha256, e nao na chave canonica:
 * `{userId}/{documentId}/{fileName}` so passa a existir depois do INSERT, e
 * inventar um uuid para parecer pronto deixaria um objeto que nenhum documento
 * aponta. A chave canonica e criada no --sync, pelo proprio servico.
 */
async function stageIngestion(args: CliArgs, rows: ManifestRow[]): Promise<void> {
  const limited = pendingRows(args, rows);
  let fresh = 0;
  let known = 0;
  for (const row of limited) {
    const buffer = await readFile(join(args.source, ...row.relPath.split("/")));
    // writeStagedBytes so renomeia o arquivo depois de conferir o sha256 dos
    // bytes: se a apostila mudou desde a varredura, ela nao entra na fila.
    const stagingPath = await writeStagedBytes({ sha256: row.sha256, fileName: row.fileName, buffer });
    const recorded = await recordStagedIngest({
      fileName: row.fileName,
      filePath: row.relPath,
      mimeType: mimeFor(row.fileName),
      sizeBytes: row.sizeBytes,
      sha256: row.sha256,
      stagingPath,
    });
    if (recorded.created) fresh += 1;
    else known += 1;
  }
  const file = await readPendingQueue();
  console.log("[cli] staged: novos=" + fresh + " reutilizados=" + known + " (staging em " + stagingDirFor() + ")");
  console.log("[cli] fila: " + JSON.stringify(summarizePendingQueue(file)));
  console.log("[cli] nada foi escrito em banco. Rode --sync com DATABASE_URL de teste isolado.");
}

/** Backend registrado na fila, se for um dos conhecidos; senao, o do ambiente. */
function entryBackend(entry: PendingIngestEntry): "r2" | "supabase" | "local" | undefined {
  return (BACKEND_CHOICES as readonly string[]).includes(entry.storageBackend ?? "")
    ? (entry.storageBackend as "r2" | "supabase" | "local")
    : undefined;
}

/** Onde estao os bytes de uma entrada: staging verificado, senao chave canonica. */
async function bytesForEntry(
  entry: PendingIngestEntry,
  storage: { download: (path: string, backend?: "r2" | "supabase" | "local") => Promise<Buffer> }
): Promise<Buffer<ArrayBuffer>> {
  if (entry.stagingPath) {
    return readStagedBytes({ stagingPath: entry.stagingPath, sha256: entry.sha256 });
  }
  if (entry.storagePath) {
    // Todo adapter devolve Buffer de um ArrayBuffer proprio (r2/supabase fazem
    // Buffer.from, local faz readFile); o tipo do servico e o general.
    return (await storage.download(entry.storagePath, entryBackend(entry))) as Buffer<ArrayBuffer>;
  }
  throw new Error("Entrada " + entry.id + " sem stagingPath e sem storagePath; reposicione com --stage.");
}

/**
 * Consome a fila. Escreve em `documents`, chunks e embeddings, entao exige o
 * mesmo banco de teste isolado do --apply.
 *
 * Nada aqui assume que a entrada esta pronta: `staged` so vira ingestao completa
 * se os bytes existem e batem com o sha256; `recorded` ja tem linha em
 * `documents`, entao repete apenas a extracao — ingerir de novo daria
 * DUPLICATE_FILE e o conteudo ficaria sem chunks para sempre.
 */
async function syncQueue(args: CliArgs, provider: KnowledgeMcpProvider): Promise<void> {
  const userId = await requireActor(args);
  const file = await readPendingQueue();
  const toSync = pendingEntriesToSync(file);
  const limited = args.limit === null ? toSync : toSync.slice(0, args.limit);
  if (limited.length === 0) {
    console.log("[cli] fila: nada a sincronizar. " + JSON.stringify(summarizePendingQueue(file)));
    return;
  }
  if (limited.length !== toSync.length) {
    console.log("[cli] --limit ativo: " + limited.length + " de " + toSync.length + " entrada(s) na fila.");
  }

  const { DocumentStorageService } = await import("../src/lib/knowledge/storage.service");
  const { DocumentPipelineService } = await import("../src/lib/knowledge/services/document-pipeline.service");

  let synced = 0;
  for (const entry of limited) {
    try {
      if (entry.status === "recorded" && entry.documentId) {
        const pipeline = await DocumentPipelineService.processDocument(entry.documentId);
        if (args.transform && pipeline.transformReport) {
          await writeTransformReport(args, entry.documentId, pipeline.transformReport);
        }
      } else {
        const buffer = await bytesForEntry(entry, DocumentStorageService);
        await applyOne(
          args,
          provider,
          userId,
          { relPath: entry.filePath, fileName: entry.fileName, sha256: entry.sha256, sizeBytes: buffer.length },
          buffer
        );
      }
      await updatePendingStatus({ id: entry.id, status: "synced" });
      synced += 1;
      console.log("[cli] sincronizado " + synced + "/" + limited.length + ": " + entry.fileName);
    } catch (error) {
      if ((error as { code?: string }).code === "DUPLICATE_FILE") {
        // O catalogo ja tem este conteudo: nao ha nada a repetir, sai da fila.
        await updatePendingStatus({ id: entry.id, status: "synced" });
        console.log("[cli] ja catalogado, marcado como sincronizado: " + entry.fileName);
        continue;
      }
      await updatePendingStatus({ id: entry.id, status: "error", lastError: (error as Error).message });
      console.warn("[cli] sync falhou em " + entry.fileName + ": " + (error as Error).message);
    }
  }
  const after = await readPendingQueue();
  console.log("[cli] sync concluido: " + synced + " entrada(s). Fila: " + JSON.stringify(summarizePendingQueue(after)));
}

/**
 * Reprocessa apostilas que ja estao no banco: reexecuta extracao, transform e
 * chunking a partir dos bytes preservados em storage.
 *
 * Serve para aplicar uma regra nova ao corpus sem reingerir nada. Escreve em
 * `documents` e `chunks`, entao passa pelo MESMO guard do `--apply`: reprocessar
 * contra producao e exatamente o que o guard existe para impedir, e a regra nova
 * ainda nao esta provada em banco de teste.
 */
async function reprocessDocuments(args: CliArgs): Promise<void> {
  assertNonProductionDatabaseUrl("apostila-cli-reprocess", process.env.DATABASE_URL);

  const { DocumentPipelineService } = await import("../src/lib/knowledge/services/document-pipeline.service");
  const { DocumentRepository } = await import("../src/lib/knowledge/repositories/document.repository");

  let done = 0;
  for (const documentId of args.reprocess) {
    const doc = await DocumentRepository.findById(documentId);
    if (!doc) {
      console.warn("[cli] reprocess: documento inexistente ou removido: " + documentId);
      continue;
    }
    try {
      const pipeline = await DocumentPipelineService.processDocument(documentId);
      if (args.transform && pipeline.transformReport) {
        await writeTransformReport(args, documentId, pipeline.transformReport);
      }
      done += 1;
      console.log(
        "[cli] reprocessado " + done + "/" + args.reprocess.length + ": " + documentId +
          " status=" + pipeline.status +
          " chunks=" + pipeline.chunkCount +
          " transform=" + (pipeline.transformReport?.modo_usado ?? "nenhum"),
      );
    } catch (error) {
      console.warn("[cli] reprocess falhou em " + documentId + ": " + (error as Error).message);
    }
  }
  console.log("[cli] reprocess concluido: " + done + " documento(s).");
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  assertSingleWriteMode(args);
  if (args.backend) {
    // Vale para a execucao toda: backend de storage nao e escolha por documento.
    process.env.STORAGE_BACKEND = args.backend;
  }
  if (!args.transform) {
    // O desligamento e do processo, nao do arquivo: o pipeline le isto uma vez.
    process.env.APOSTILA_TRANSFORM_DISABLED = "1";
  } else if (args.mode) {
    process.env.APOSTILA_TRANSFORM_MODE = args.mode;
  }
  const provider = resolveMcpProvider(args.mcpId);

  if (args.reprocess.length > 0) {
    // A origem dos bytes e o storage: --reprocess nao le pasta nenhuma.
    console.log("[cli] modo: " + modeLabel(args));
    console.log(describeDatabaseSafety("apostila-cli-reprocess"));
    await reprocessDocuments(args);
    return;
  }

  if (args.sync) {
    // A fila e a origem: --sync nao le a pasta de apostilas nem reescreve manifest.
    await syncQueue(args, provider);
    return;
  }

  if (!args.source) {
    console.error(usage());
    console.error("Defina --source DIR ou APOSTILA_SOURCE_DIR: sem origem nao ha lote a processar.");
    process.exitCode = 2;
    return;
  }

  console.log("[cli] provedor MCP: " + provider.id + " v" + provider.version);
  console.log("[cli] origem: " + args.source);
  console.log("[cli] modo: " + modeLabel(args));

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

  if (args.preview) {
    // Sem manifest de proposito: o preview nao e artefato de lote, e saida
    // editorial por documento. Gravar manifest aqui daria ao preview a aparencia
    // de um plano de ingestao que nunca foi pedido.
    await previewIngestion(args, rows);
    return;
  }

  await writeArtifacts(args, provider, rows);
  console.log("[cli] manifest e report gravados em " + args.workspace);

  if (args.stage) {
    await stageIngestion(args, rows);
    return;
  }

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
