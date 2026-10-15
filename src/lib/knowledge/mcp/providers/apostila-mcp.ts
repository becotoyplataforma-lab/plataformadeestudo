import {
  DEFAULT_MCP_PROVIDER_ID,
  MCP_PROTOCOL_VERSION,
  McpError,
  type KnowledgeMcpProvider,
  type McpCapability,
  type McpClassification,
  type McpPlan,
  type McpPlanInput,
  type McpTransformInput,
  type McpTransformResult,
} from "../contracts";

import {
  BINARY_NO_EXTRACTOR_EXTENSIONS,
  IMAGE_EXTENSIONS as CONTRACT_IMAGE_EXTENSIONS,
  TEXT_EXTRACTABLE_EXTENSIONS,
  extensionsForMime,
} from "../../format-contract";

/**
 * Apostila MCP - provedor de ingestao de material didatico.
 *
 * O que este provedor faz: ordena aulas, deriva titulo, detecta variantes (por
 * exemplo a copia grifada de uma aula ja indexada), decide se o conteudo entra no
 * indice padrao e normaliza a estrutura editorial do texto (cabecalhos de fase e
 * caixas de destaque), preservando integralmente a autoria e a procedencia.
 *
 * O que este provedor NAO faz: remover nome de plataforma, marca d'agua,
 * assinatura de autor, copyright ou identificacao de origem para apresentar
 * material de terceiro como conteudo proprio. Isso nao e transformacao
 * editorial: e ocultacao de titularidade de direitos. A proveniencia e
 * preservada e replicada nos metadados de cada documento.
 */
export const APOSTILA_MCP_ID = DEFAULT_MCP_PROVIDER_ID;
export const APOSTILA_MCP_VERSION = "1.1.0";

/**
 * Versao das regras de transformacao editorial. Muda quando uma linha do texto
 * pode sair diferente do que saiu no lote anterior, e serve para saber o que
 * precisa ser reprocessado sem depender da versao do protocolo MCP.
 */
export const APOSTILA_PROCESSING_VERSION = "2026-09-13.1";

/** Nome da variavel de ambiente que cobre a versao de processamento. */
export const APOSTILA_PROCESSING_VERSION_ENV = "APOSTILA_PROCESSING_VERSION";

const PROCESSING_VERSION_PATTERN = "^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$";

/**
 * Versao de processamento gravada no metadado. O ambiente pode cobri-la quando
 * uma regra editorial muda entre lotes sem trocar de provedor; valor malformado
 * cai no padrao compilado, porque metadado de versao nao aceita entrada crua.
 */
export function resolveApostilaProcessingVersion(
  env: NodeJS.ProcessEnv = process.env,
): string {
  const raw = (env[APOSTILA_PROCESSING_VERSION_ENV] ?? "").trim();
  if (raw.length === 0) return APOSTILA_PROCESSING_VERSION;
  return new RegExp(PROCESSING_VERSION_PATTERN).test(raw)
    ? raw
    : APOSTILA_PROCESSING_VERSION;
}

/**
 * Extensoes que o DocumentExtractionService decodifica de verdade. A lista mora
 * em src/lib/knowledge/format-contract.ts, o mesmo contrato lido pelo
 * IngestionService: MCP e extrator nao podem divergir, porque um formato sem
 * extrator (EPUB, DOC, RTF, ODT, PPTX, XLSX e imagens) viraria lixo binario
 * indexado no Knowledge Engine em vez de conteudo pesquisavel.
 */
export const APOSTILA_SUPPORTED_EXTENSIONS = TEXT_EXTRACTABLE_EXTENSIONS;

/** Recusados nominalmente: binarios sem extrator e imagens sem OCR. */
export const APOSTILA_REJECTED_EXTENSIONS = [
  ...BINARY_NO_EXTRACTOR_EXTENSIONS,
  ...CONTRACT_IMAGE_EXTENSIONS,
] as const;

const SUPPORTED_EXTENSIONS = new Set<string>(APOSTILA_SUPPORTED_EXTENSIONS);
const NO_EXTRACTOR_EXTENSIONS = new Set<string>(BINARY_NO_EXTRACTOR_EXTENSIONS);
const IMAGE_EXTENSIONS = new Set<string>(CONTRACT_IMAGE_EXTENSIONS);

const LESSON_PATTERN = /aula[-_.\s]*0*(\d{1,3})/i;
interface McpVariantRule {
  pattern: RegExp;
  label: string;
}

const VARIANT_PATTERNS: readonly McpVariantRule[] = [
  { pattern: /grifad[oa]/i, label: "grifado" },
  { pattern: /comentad[oa]/i, label: "comentado" },
  { pattern: /resumid[oa]/i, label: "resumido" },
  { pattern: /rascunho/i, label: "rascunho" },
];

const CAPABILITIES: readonly McpCapability[] = ["ingest", "transform", "reprocess"];

function extensionOf(fileName: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName);
  return match?.[1]?.toLowerCase() ?? "";
}

/** Extensao efetiva: nome do arquivo primeiro, MIME como fallback. */
function effectiveExtension(fileName: string, mimeType: string): string {
  const fromName = extensionOf(fileName);
  if (fromName) return fromName;
  const normalized = (mimeType ?? "").split(";")[0].trim().toLowerCase();
  return extensionsForMime(normalized)[0] ?? "";
}

function baseName(fileName: string): string {
  return fileName.replace(/\.[A-Za-z0-9]+$/, "");
}

/** Titulo legivel a partir do nome do arquivo, preservando a ordem da aula. */
export function deriveTitle(fileName: string, lessonOrder?: number): string {
  const cleaned = baseName(fileName)
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const lessonMatch = LESSON_PATTERN.exec(cleaned);
  if (lessonMatch?.[1] && lessonOrder) {
    const rest = cleaned.replace(LESSON_PATTERN, "").replace(/^[-.\s]+|[-.\s]+$/g, "");
    const padded = String(lessonOrder).padStart(2, "0");
    return rest.length > 0 ? "Aula " + padded + " - " + rest : "Aula " + padded;
  }
  return cleaned.length > 0 ? cleaned : baseName(fileName);
}

function detectVariant(fileName: string): string | undefined {
  for (const { pattern, label } of VARIANT_PATTERNS) {
    if (pattern.test(fileName)) return label;
  }
  return undefined;
}

function classificationFor(
  fileName: string,
  mimeType: string,
  sizeBytes: number,
): McpClassification {
  if (sizeBytes === 0) return "invalid";
  const ext = effectiveExtension(fileName, mimeType);
  if (IMAGE_EXTENSIONS.has(ext)) return "unsupported";
  if (NO_EXTRACTOR_EXTENSIONS.has(ext)) return "unsupported";
  if (!SUPPORTED_EXTENSIONS.has(ext)) return "unsupported";
  return "supported";
}

function unsupportedReason(fileName: string, mimeType: string): string {
  const ext = effectiveExtension(fileName, mimeType);
  if (IMAGE_EXTENSIONS.has(ext)) {
    return "Extensao de imagem sem OCR habilitado neste provedor: ." + ext;
  }
  if (NO_EXTRACTOR_EXTENSIONS.has(ext)) {
    return (
      "Sem extrator de texto para ." +
      ext +
      "; converta para PDF ou DOCX para evitar indexar conteudo binario."
    );
  }
  return (
    "Extensao nao suportada por este provedor: " + (ext ? "." + ext : "(sem extensao)")
  );
}

function buildTags(
  lessonOrder: number | undefined,
  variant: string | undefined,
): string[] {
  const tags = ["apostila", "mcp:" + APOSTILA_MCP_ID];
  if (lessonOrder) tags.push("aula-" + String(lessonOrder).padStart(2, "0"));
  if (variant) tags.push("variante-" + variant);
  return tags;
}


/**
 * Avisos de adaptacao por IA pedidos no material de referencia. A caixa do
 * inicio declara que houve adaptacao e a caixa do fim preserva os direitos do
 * conteudo original. Os dois servem a transparencia: sao aditivos e nunca
 * removem a autoria ja presente no corpo do texto. Os acentos entram como
 * escapes \uXXXX para o arquivo permanecer ASCII no repositorio.
 */
const ADAPTATION_MARKER =
  "\u26A1 APOSTILA ADAPTADA POR INTELIG\u00CANCIA ARTIFICIAL";
const RIGHTS_MARKER = "adaptado por Intelig\u00EAncia Artificial";

const ADAPTATION_BANNER: readonly string[] = [
  "> **" + ADAPTATION_MARKER + "**",
  ">",
  "> Este material foi reorganizado e otimizado por IA em fases progressivas.",
  "> Autoria, marcas e avisos de direitos do material de origem foram preservados.",
];

const RIGHTS_FOOTER: readonly string[] = [
  "> Material alterado e adaptado por Intelig\u00EAncia Artificial. Todos os direitos do",
  "> cont\u00FAdo educacional original s\u00E3o de seus respectivos autores.",
];

interface CalloutRule {
  label: string;
  source: string;
}

/** Caixas de destaque do material didatico. O separador evita marcar prosa comum. */
const CALLOUT_RULES: readonly CalloutRule[] = [
  { label: "REGRA", source: "reg(?:ra|ras)" },
  { label: "ATEN\u00C7\u00C3O", source: "aten[\u00E7c][\u00E3a]o" },
  { label: "DICA", source: "(?:dica|macete)" },
  { label: "CUIDADO", source: "(?:cuidado|perigo)" },
  { label: "IMPORTANTE", source: "(?:importante|observa[\u00E7c][\u00E3a]o)" },
  { label: "COMUM EM PROVAS", source: "comum em provas?" },
];

const CALLOUT_PATTERN = new RegExp(
  "^(" +
    CALLOUT_RULES.map((rule) => rule.source).join("|") +
    ")\\s*[:\\-\\u2013\\u2014]\\s*(.+)$",
  "i",
);

/** Linha de abertura de fase ou aula: exige numero, por isso e seguro promover a #. */
const PHASE_HEADING_PATTERN =
  /^(fase|aula|unidade|m[\u00F3o]dulo|se[\u00E7c][\u00E3a]o|cap[\u00EDi]tulo)\s*[-:.]?\s*0*\d{1,3}\b.{0,80}$/i;


interface StructureResult {
  text: string;
  headings: number;
  boxes: number;
}

/**
 * Remarca cabecalhos de fase e caixas de destaque para Markdown sem alterar o
 * conteudo: nenhuma linha e apagada e nenhuma palavra e reescrita. Blocos de
 * codigo sao ignorados e linhas ja marcadas nao mudam, o que torna a funcao
 * idempotente e segura para reprocessar o mesmo documento.
 */
function normalizeStructure(text: string): StructureResult {
  const lines = text.split("\n");
  const output: string[] = [];
  let headings = 0;
  let boxes = 0;
  let inFence = false;

  for (const raw of lines) {
    const line = raw.replace(/[ \t]+$/, "");
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      inFence = !inFence;
      output.push(line);
      continue;
    }
    if (inFence || trimmed.length === 0) {
      output.push(line);
      continue;
    }

    const callout = CALLOUT_PATTERN.exec(trimmed);
    if (callout) {
      const keyword = callout[1] ?? "";
      const body = (callout[2] ?? "").trim();
      const rule = CALLOUT_RULES.find((candidate) =>
        new RegExp("^(?:" + candidate.source + ")$", "i").test(keyword),
      );
      if (rule) {
        output.push("> **" + rule.label + "** - " + body);
        boxes += 1;
        continue;
      }
    }

    if (
      !/^[#>|]/.test(trimmed) &&
      trimmed.length <= 90 &&
      !trimmed.endsWith(".") &&
      trimmed.split(/\s+/).length <= 8 &&
      PHASE_HEADING_PATTERN.test(trimmed)
    ) {
      output.push("## " + trimmed);
      headings += 1;
      continue;
    }

    output.push(line);
  }

  return { text: output.join("\n"), headings, boxes };
}

export const apostilaMcpProvider: KnowledgeMcpProvider = {
  id: APOSTILA_MCP_ID,
  label: "Apostila MCP",
  version: APOSTILA_MCP_VERSION,
  processingVersion: APOSTILA_PROCESSING_VERSION,
  description:
    "Organiza apostilas por aula, detecta variantes (grifado, comentado), normaliza" +
    " fases e caixas de destaque e preserva a procedencia.",
  capabilities: CAPABILITIES,

  async plan(input: McpPlanInput): Promise<McpPlan> {
    const fileName = (input.fileName ?? "").trim();
    if (!fileName) throw McpError.invalidInput("Nome de arquivo ausente.");
    if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0) {
      throw McpError.invalidInput("Tamanho de arquivo invalido.");
    }

    const mimeType = input.mimeType ?? "";
    const lessonMatch = LESSON_PATTERN.exec(fileName);
    const lessonOrder =
      input.lessonOrder ?? (lessonMatch?.[1] ? Number(lessonMatch[1]) : undefined);
    const processingVersion = resolveApostilaProcessingVersion();
    const variant = detectVariant(fileName);
    const verdict = classificationFor(fileName, mimeType, input.sizeBytes);
    const classification: McpClassification = input.allZeroContent ? "invalid" : verdict;

    const reason =
      classification === "invalid"
        ? "Conteudo invalido: arquivo vazio ou composto apenas por bytes zero."
        : classification === "unsupported"
          ? unsupportedReason(fileName, mimeType)
          : undefined;

    const indexedByDefault = classification === "supported" && !variant;

    return {
      providerId: APOSTILA_MCP_ID,
      providerVersion: APOSTILA_MCP_VERSION,
      processingVersion,
      classification,
      reason,
      title: deriveTitle(fileName, lessonOrder),
      kind: "apostila",
      subject: input.subject?.trim() || "geral",
      lessonOrder,
      variant,
      indexedByDefault,
      tags: buildTags(lessonOrder, variant),
      metadata: {
        mcp: {
          providerId: APOSTILA_MCP_ID,
          providerVersion: APOSTILA_MCP_VERSION,
          processingVersion,
          protocolVersion: MCP_PROTOCOL_VERSION,
          classification,
          variant: variant ?? null,
          indexedByDefault,
        },
        sha256: input.sha256,
        variant: variant ?? null,
        sourceKind: "apostila",
      },
    };
  },
  /**
   * Normalizacao editorial do texto extraido.
   *
   * Aqui entram apenas regras que melhoram a leitura e a indexacao: hierarquia
   * de cabecalhos de fase, caixas de destaque, quebras de linha e espacos. Nao
   * existe nenhuma regra de remocao de autoria: nome de plataforma, assinatura,
   * URL e identificacao de origem permanecem no texto, porque retirar isso nao
   * e edicao legitima e sim ocultacao de titularidade.
   */
  async transform(input: McpTransformInput): Promise<McpTransformResult> {
    const notes: string[] = [];
    const unified = input.text.replace(/\r\n?/g, "\n");
    const structured = normalizeStructure(unified);
    let text = structured.text;

    if (structured.headings > 0) {
      notes.push(
        structured.headings + " chamada(s) de fase promovida(s) a cabecalho Markdown",
      );
    }
    if (structured.boxes > 0) {
      notes.push(
        structured.boxes + " caixa(s) de destaque (REGRA/ATENCAO/DICA/CUIDADO) normalizada(s)",
      );
    }

    if (input.aiAdapted !== false) {
      if (text.includes(ADAPTATION_MARKER)) {
        notes.push("aviso de adaptacao por IA preservado (nao duplicado)");
      } else {
        text = ADAPTATION_BANNER.join("\n") + "\n\n" + text;
        notes.push("aviso de adaptacao por IA inserido no inicio");
      }
      if (text.includes(RIGHTS_MARKER)) {
        notes.push("aviso de direitos preservado (nao duplicado)");
      } else {
        text = text + "\n\n" + RIGHTS_FOOTER.join("\n");
        notes.push("aviso de direitos inserido no final");
      }
    } else {
      notes.push(
        "material marcado como nao adaptado por IA: nenhum aviso inserido",
      );
    }

    const collapsed = text.replace(/\n{3,}/g, "\n\n");
    if (collapsed !== text) {
      notes.push("sequencias excessivas de linhas em branco colapsadas");
      text = collapsed;
    }

    const spaced = text.replace(/[ \t]+$/gm, "").replace(/ {2,}/g, " ");
    if (spaced !== text) {
      notes.push("espacos horizontais normalizados");
      text = spaced;
    }

    notes.push("procedencia e autoria preservadas (nenhuma regra de remocao aplicada)");
    return { text: text.trim() + "\n", notes };
  },
};
