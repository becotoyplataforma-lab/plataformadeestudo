/**
 * ConcursoAI — orquestrador da transformacao de apostila
 *
 * Ponto unico por onde passam web, CLI e reprocessamento: `DocumentPipelineService`
 * chama este servico depois da extracao e antes do chunking, entao nenhum canal de
 * entrada consegue "esquecer" a transformacao. Era isso que faltava no pipeline:
 * `apostilaMcpProvider.transform` existia, era anunciado no catalogo de capacidades
 * e so era chamado pelo servidor MCP do VS Code.
 *
 * Resiliencia, na ordem:
 *  1. `sanitize-only` e a base obrigatoria de todo modo: roda sempre, sem rede.
 *  2. Modo com IA: se a IA falhar, ou reprovar nos portoes de questoes e
 *     procedencia, o documento cai para o resultado offline e o upload continua.
 *  3. Erro inesperado devolve o texto original com aviso: upload nunca se perde
 *     por regra editorial.
 *  4. Fronteiras de pagina: o offline roda por pagina e as preserva. IA de
 *     documento inteiro nao preserva pagina, e isso fica no relatorio em vez de
 *     virar citacao de pagina errada no chunk.
 */
import "server-only";
import { createHash } from "node:crypto";
import { elapsed, logger, now } from "@/lib/observability";
import { strictDto } from "@/lib/dto";
import type { AIModel } from "@/lib/ai/types";
import { loadApostilaRules, type ApostilaRulesBundle } from "../config/apostila-rules.schema";
import {
  APOSTILA_TRANSFORM_MODE_ENV,
  ApostilaTransformReportSchema,
  DEFAULT_APOSTILA_TRANSFORM_MODE,
  resolveTransformMode,
  type ApostilaTransformMode,
  type ApostilaPagesTransformResult,
  type ApostilaStructuringClient,
  type ApostilaTransformReport,
  type ApostilaTransformResult,
  type PiiCounts,
} from "../dto/apostila-transform.dto";
import { ApostilaSanitizerService, pageBoilerplateKeys } from "./apostila-sanitizer.service";
import { ApostilaStructurerService, countQuestions } from "./apostila-structurer.service";

/** Kill-switch operacional: texto cru ate o chunking, sem nenhuma reescrita. */
export const APOSTILA_TRANSFORM_DISABLED_ENV = "APOSTILA_TRANSFORM_DISABLED";

/** `APOSTILA_TRANSFORM_DISABLED=1|true|sim` devolve o texto extraido sem edicao. */
export function isTransformDisabled(env: Record<string, string | undefined> = process.env): boolean {
  const raw = (env[APOSTILA_TRANSFORM_DISABLED_ENV] ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "sim";
}

/** Separador de paginas: o mesmo do pipeline, para as fronteiras baterem. */
export const PAGE_JOIN = "\n\n";

/**
 * Normalizacao do texto recem-extraido, na forma exata que o pipeline aplica
 * antes do transform: BOM, CRLF, NBSP, espaco antes de quebra e sequencia de
 * linhas em branco.
 *
 * Exportada porque a previsualizacao do CLI (`--preview`) tem de produzir o
 * mesmo texto que o chunker receberia. Copiar esta funcao para dentro do script
 * e a garantia de que, na primeira mexida num dos dois lados, o preview passa a
 * mostrar um documento que nao e o documento ingerido.
 */
export function normalizeExtractedText(text: string): string {
  return text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function zeroCounts(): PiiCounts {
  return { cpf: 0, matricula: 0, identidade: 0, conselho: 0, carteira: 0, nome: 0 };
}

function addCounts(base: PiiCounts, add: PiiCounts): PiiCounts {
  const out = { ...base };
  for (const key of Object.keys(out) as Array<keyof PiiCounts>) {
    out[key] += add[key] ?? 0;
  }
  return out;
}

/**
 * Cliente padrao: DeepSeek `flash`. Nao `pro`: o reasoner gasta os tokens de
 * saida no raciocinio interno e devolve `content` vazio em prompt longo
 * (mesma razao registrada em `apostila-transform.service.ts`, 142-148).
 */
export function deepSeekStructuringClient(
  env: Record<string, string | undefined> = process.env,
): ApostilaStructuringClient {
  const available = Boolean((env.DEEPSEEK_API_KEY ?? "").trim());
  return {
    available,
    label: "deepseek-chat",
    async structure({ prompt }) {
      // Import tardio: o caminho offline nao pode arrastar o cliente de IA (e o
      // modulo de ambiente dele) para dentro de cada teste do pipeline.
      const { DeepSeekProvider } = await import(
        "@/lib/ai/services/deepseek-provider.service"
      );
      const result = await DeepSeekProvider.complete({
        model: "flash" as AIModel,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.4,
        maxTokens: 32768,
      });
      return { text: result.content, model: result.model };
    },
  };
}

export interface ExtractionTransformInput {
  /** Texto completo extraido (usado quando nao ha paginas). */
  text: string;
  /** Paginas do PDF na ordem real: com elas o offline roda por pagina e preserva fronteiras. */
  pages?: string[];
  /** Explicito > `APOSTILA_TRANSFORM_MODE` > modo das regras > default. */
  mode?: ApostilaTransformMode;
  sha256Original?: string;
  documentId?: string;
  fileName?: string;
  client?: ApostilaStructuringClient;
  env?: Record<string, string | undefined>;
}

export type TransformOutcome = {
  text: string;
  pages?: string[];
  report: ApostilaTransformReport;
};

/** Caminho offline por pagina: PII + estrutura, sem banner de IA. */
function runOfflinePages(pages: string[], rules: ApostilaRulesBundle["rules"]) {
  const out: string[] = [];
  let counts = zeroCounts();
  let headings = 0;
  let boxes = 0;
  // As chaves de rodape sao medidas sobre o lote de paginas inteiro: uma pagina
  // sozinha nao sabe se a linha e conteudo ou mobilia do papel.
  const boilerplateKeys = pageBoilerplateKeys(pages);
  let boilerplate = 0;
  for (const page of pages) {
    const sanitized = ApostilaSanitizerService.redactPii({ text: page, rules, boilerplateKeys });
    const structured = ApostilaStructurerService.normalizeOffline(sanitized.text, rules);
    counts = addCounts(counts, sanitized.counts);
    headings += structured.headings;
    boxes += structured.boxes;
    boilerplate += sanitized.boilerplate;
    out.push(structured.text);
  }
  return { pages: out, text: out.join(PAGE_JOIN), counts, headings, boxes, boilerplate };
}

/** Caminho offline de documento unico (txt/md/html/docx, ou extracao sem paginas). */
function runOfflineDoc(text: string, rules: ApostilaRulesBundle["rules"]) {
  const sanitized = ApostilaSanitizerService.redactPii({ text, rules });
  const structured = ApostilaStructurerService.normalizeOffline(sanitized.text, rules);
  return {
    text: structured.text,
    counts: sanitized.counts,
    headings: structured.headings,
    boxes: structured.boxes,
    boilerplate: sanitized.boilerplate,
  };
}

function totalOf(counts: PiiCounts): number {
  return Object.values(counts).reduce((acc, value) => acc + value, 0);
}

function countQuestionsSafe(text: string, rules: ApostilaRulesBundle["rules"]): number {
  try {
    return countQuestions(text, rules);
  } catch {
    return 0;
  }
}

/**
 * Montagem unica do relatorio. `strictDto` e proposital: um campo fora do schema
 * lanca, o chamador captura e devolve o texto original. Assim e impossivel gravar
 * em `documents.metadata` uma auditoria pela metade, que e o tipo de registro que
 * da confianca falsa a quem revisa o lote depois.
 */
function buildReport(parts: {
  sha256Original: string;
  sha256Transformed: string;
  bundle: ApostilaRulesBundle;
  modoPedido: ApostilaTransformMode;
  modoUsado: ApostilaTransformMode;
  counts: PiiCounts;
  headings: number;
  boxes: number;
  boilerplate: number;
  questionsIn: number;
  questionsOut: number;
  llmModel: string | null;
  fallback: boolean;
  fallbackReason: string | null;
  bannerInserted: boolean;
  fronteiras: ApostilaTransformReport["fronteiras_pagina"];
  startedAt: number;
  avisos: string[];
  documentId?: string;
  fileName?: string;
}): ApostilaTransformReport {
  return strictDto(ApostilaTransformReportSchema, {
    sha256_original: parts.sha256Original,
    sha256_transformado: parts.sha256Transformed,
    regras_versao: parts.bundle.versao,
    regras_fonte: parts.bundle.fonte,
    modo_pedido: parts.modoPedido,
    modo_usado: parts.modoUsado,
    pii_removidos: totalOf(parts.counts),
    pii_por_tipo: parts.counts,
    fases_criadas: parts.headings,
    caixas_normalizadas: parts.boxes,
    rodape_repetido: parts.boilerplate,
    questoes_entrada: parts.questionsIn,
    questoes_saida: parts.questionsOut,
    questoes_preservadas: parts.questionsOut >= parts.questionsIn,
    procedencia_preservada: true,
    procedencia_faltantes: [],
    llm_usado: parts.llmModel,
    fallback_ativado: parts.fallback,
    fallback_motivo: parts.fallbackReason,
    aviso_ia_inserido: parts.bannerInserted,
    fronteiras_pagina: parts.fronteiras,
    duracao_ms: elapsed(parts.startedAt),
    avisos: parts.avisos,
    ...(parts.documentId ? { documentId: parts.documentId } : {}),
    ...(parts.fileName ? { arquivo: parts.fileName } : {}),
  });
}

async function runTransform(
  input: ExtractionTransformInput & {
    bundle: ApostilaRulesBundle;
    requested: ApostilaTransformMode;
    startedAt: number;
  },
): Promise<TransformOutcome> {
  const { bundle, requested, startedAt } = input;
  const env = input.env ?? process.env;
  const rules = bundle.rules;
  const hasPages = Array.isArray(input.pages) && input.pages.length > 0;
  const shaOriginal =
    input.sha256Original && input.sha256Original.length === 64
      ? input.sha256Original
      : sha256(input.text);
  const questionsIn = countQuestionsSafe(input.text, rules);

  const offlineRun = () =>
    hasPages ? runOfflinePages(input.pages as string[], rules) : runOfflineDoc(input.text, rules);

  const offlineOutcome = (
    offline: {
      text: string;
      pages?: string[];
      counts: PiiCounts;
      headings: number;
      boxes: number;
      boilerplate: number;
    },
    fallback: boolean,
    fallbackReason: string | null,
  ): TransformOutcome => ({
    text: offline.text,
    pages: offline.pages,
    report: buildReport({
      sha256Original: shaOriginal,
      sha256Transformed: sha256(offline.text),
      bundle,
      modoPedido: requested,
      modoUsado: "sanitize-only",
      counts: offline.counts,
      headings: offline.headings,
      boxes: offline.boxes,
      boilerplate: offline.boilerplate,
      questionsIn,
      questionsOut: countQuestionsSafe(offline.text, rules),
      llmModel: null,
      fallback,
      fallbackReason,
      bannerInserted: false,
      fronteiras: hasPages ? "preservadas" : "inexistente",
      startedAt,
      avisos: bundle.avisos,
      documentId: input.documentId,
      fileName: input.fileName,
    }),
  });

  // sanitize-only e a base: roda sem rede, entao nao ha "tentar a IA primeiro".
  if (requested === "sanitize-only") return offlineOutcome(offlineRun(), false, null);

  // Nos modos com IA o PII sai antes: o modelo nunca ve o dado pessoal.
  const pre = runOfflineDoc(input.text, rules);
  const client = input.client ?? deepSeekStructuringClient(env);
  if (!client.available) {
    return offlineOutcome(offlineRun(), true, "provedor de IA nao configurado");
  }

  try {
    const llm = await ApostilaStructurerService.structureWithLlm({
      text: pre.text,
      rules,
      mode: requested,
      client,
      fileName: input.fileName,
    });
    const avisos = bundle.avisos.slice();
    if (hasPages) {
      avisos.push("IA reestruturou o documento inteiro: citacao de pagina indisponivel neste modo");
    }
    return {
      text: llm.text,
      pages: undefined,
      report: buildReport({
        sha256Original: shaOriginal,
        sha256Transformed: sha256(llm.text),
        bundle,
        modoPedido: requested,
        modoUsado: requested,
        counts: pre.counts,
        headings: llm.headings,
        boxes: llm.boxes,
        boilerplate: pre.boilerplate,
        questionsIn,
        questionsOut: countQuestionsSafe(llm.text, rules),
        llmModel: llm.model,
        fallback: false,
        fallbackReason: null,
        bannerInserted: true,
        fronteiras: hasPages ? "descartadas" : "inexistente",
        startedAt,
        avisos,
        documentId: input.documentId,
        fileName: input.fileName,
      }),
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "falha na chamada de IA";
    logger.warn("apostila-transformer", "modo com IA devolveu o caminho offline", {
      documentId: input.documentId ?? null,
      reason,
    });
    return offlineOutcome(offlineRun(), true, reason.slice(0, 300));
  }
}

export const ApostilaTransformerService = {
  /** Modo efetivo: explicito > `APOSTILA_TRANSFORM_MODE` > regras do arquivo > default. */
  resolveMode(
    explicit?: ApostilaTransformMode | null,
    env: Record<string, string | undefined> = process.env,
    fromRules?: ApostilaTransformMode,
  ): ApostilaTransformMode {
    if (explicit) return explicit;
    if (env[APOSTILA_TRANSFORM_MODE_ENV]) {
      return resolveTransformMode(
        env[APOSTILA_TRANSFORM_MODE_ENV],
        fromRules ?? DEFAULT_APOSTILA_TRANSFORM_MODE,
      );
    }
    return fromRules ?? DEFAULT_APOSTILA_TRANSFORM_MODE;
  },

  /**
   * Transforma o texto recem-extraido. Nunca lanca: erro de regra ou de IA devolve
   * a entrada com `fallback_ativado` e o motivo no relatorio. Upload que quebra por
   * regra editorial e um upload perdido, e o conteudo original continua la.
   */
  async transformExtraction(input: ExtractionTransformInput): Promise<TransformOutcome> {
    const startedAt = now();
    const env = input.env ?? process.env;
    const bundle = await loadApostilaRules(env);
    const requested = ApostilaTransformerService.resolveMode(input.mode, env, bundle.rules.modo);

    if (isTransformDisabled(env)) {
      return passthrough(input, bundle, startedAt, [
        "transform desativado por " +
          APOSTILA_TRANSFORM_DISABLED_ENV +
          ": texto extraido sem edicao",
      ]);
    }

    try {
      return await runTransform({ ...input, bundle, requested, startedAt });
    } catch (error) {
      const reason = error instanceof Error ? error.message : "falha desconhecida no transform";
      logger.error("apostila-transformer", "transform falhou; texto original preservado", {
        documentId: input.documentId ?? null,
        reason,
      });
      return passthrough(
        input,
        bundle,
        startedAt,
        bundle.avisos.concat("transform interrompido: " + reason),
      );
    }
  },

  /** Documento unico, sem paginas: mesmo texto que a ferramenta MCP devolve. */
  async transformText(input: ExtractionTransformInput): Promise<ApostilaTransformResult> {
    const outcome = await ApostilaTransformerService.transformExtraction(input);
    return { text: outcome.text, report: outcome.report };
  },

  /** Por pagina, sempre offline: e o que mantem as fronteiras que o chunker cita. */
  async transformPages(input: {
    pages: string[];
    sha256Original?: string;
    documentId?: string;
    env?: Record<string, string | undefined>;
  }): Promise<ApostilaPagesTransformResult> {
    const outcome = await ApostilaTransformerService.transformExtraction({
      text: input.pages.join(PAGE_JOIN),
      pages: input.pages,
      mode: "sanitize-only",
      sha256Original: input.sha256Original,
      documentId: input.documentId,
      env: input.env,
    });
    return { pages: outcome.pages ?? input.pages, report: outcome.report };
  },
};

/** Texto cru + relatorio valido: kill-switch e caminho de erro inesperado. */
function passthrough(
  input: ExtractionTransformInput,
  bundle: ApostilaRulesBundle,
  startedAt: number,
  avisos: string[],
): TransformOutcome {
  const mode = ApostilaTransformerService.resolveMode(input.mode, input.env ?? process.env);
  const hasPages = Array.isArray(input.pages) && input.pages.length > 0;
  const sha =
    input.sha256Original && input.sha256Original.length === 64
      ? input.sha256Original
      : sha256(input.text);
  return {
    text: input.text,
    pages: input.pages,
    report: buildReport({
      sha256Original: sha,
      sha256Transformed: sha256(input.text),
      bundle,
      modoPedido: mode,
      modoUsado: mode,
      counts: zeroCounts(),
      headings: 0,
      boxes: 0,
      boilerplate: 0,
      questionsIn: 0,
      questionsOut: 0,
      llmModel: null,
      fallback: false,
      fallbackReason: null,
      bannerInserted: false,
      fronteiras: hasPages ? "preservadas" : "inexistente",
      startedAt,
      avisos,
      documentId: input.documentId,
      fileName: input.fileName,
    }),
  };
}



