/**
 * ConcursoAI — DTOs da transformacao de apostila
 *
 * Contrato de entrada e saida do `ApostilaTransformerService`. Fica em `dto/`
 * porque cruza fronteira: o mesmo objeto e gravado em `documents.metadata`,
 * escrito como JSON na area de trabalho do CLI e lido por auditoria depois.
 * Daqui a saida passa por Zod (DD-007), entao relatorio malformado nao vira
 * metadado silencioso no banco.
 *
 * O relatorio nunca contem o valor removido: `pii_removidos` e contagem por
 * tipo. Redigir PII e apagar do indice o dado pessoal, nao transferi-lo para
 * um arquivo de log que ninguem criptografa.
 */
import { z } from "zod";

/** Modos do pipeline. `sanitize-only` e a base obrigatoria dos outros dois. */
export const APOSTILA_TRANSFORM_MODES = ["sanitize-only", "structure", "full"] as const;

export const TransformModeSchema = z.enum(APOSTILA_TRANSFORM_MODES);
export type ApostilaTransformMode = z.infer<typeof TransformModeSchema>;

/** Variavel que escolhe o modo; valor fora da lista cai no default compilado. */
export const APOSTILA_TRANSFORM_MODE_ENV = "APOSTILA_TRANSFORM_MODE";

/**
 * Modo default: `sanitize-only`.
 *
 * Estrutura e expansao pedem IA por documento ingerido. Deixar `full` como
 * default colocaria uma chamada externa no caminho critico do upload e mudaria
 * o texto que entra no indice sem o professor escolher isso. O modo alto e
 * deliberado: `APOSTILA_TRANSFORM_MODE=full` ou `--transform` com o env setado.
 */
export const DEFAULT_APOSTILA_TRANSFORM_MODE: ApostilaTransformMode = "sanitize-only";

/** Aceita `full`, `FULL`, ` full `; qualquer outra coisa devolve o default. */
export function resolveTransformMode(
  raw: string | null | undefined,
  fallback: ApostilaTransformMode = DEFAULT_APOSTILA_TRANSFORM_MODE,
): ApostilaTransformMode {
  const value = (raw ?? "").trim().toLowerCase();
  return (APOSTILA_TRANSFORM_MODES as readonly string[]).includes(value)
    ? (value as ApostilaTransformMode)
    : fallback;
}

/** Tipos de identificador pessoal que a sanitizacao conhece. */
export const PII_COUNT_KINDS = [
  "cpf",
  "matricula",
  "identidade",
  "conselho",
  "carteira",
  "nome",
] as const;

export type PiiKind = (typeof PII_COUNT_KINDS)[number];

/** Contagem por tipo. O valor removido nunca entra aqui: so o quanto havia. */
export type PiiCounts = Record<PiiKind, number>;

export const PiiCountsSchema = z.record(
  z.enum(PII_COUNT_KINDS),
  z.number().int().nonnegative(),
);

/** O que o transform recebe. Nenhum campo daqui vai para o banco cru. */
export interface ApostilaTransformInput {
  /** Texto de um documento inteiro (modos com IA) ou de uma pagina (modo offline). */
  text: string;
  /** Omitido: vem de `APOSTILA_TRANSFORM_MODE`, depois das regras do arquivo. */
  mode?: ApostilaTransformMode;
  /** sha256 dos bytes de origem, quando existe (upload/CLI). Sem ele so o do texto. */
  sha256Original?: string;
  documentId?: string;
  fileName?: string;
  /**
   * false quando o material nao sofreu adaptacao por IA: assim nenhum banner de
   * IA entra no texto. Declarar IA em texto nao adaptado e procedencia falsa
   * (ver `mcp/contracts.ts`, comentario de `aiAdapted`).
   */
  aiAdapted?: boolean;
}

export const ApostilaTransformReportSchema = z.object({
  sha256_original: z.string().length(64),
  sha256_transformado: z.string().length(64),
  regras_versao: z.string().min(1),
  regras_fonte: z.enum(["arquivo", "compilado"]),
  modo_pedido: TransformModeSchema,
  modo_usado: TransformModeSchema,
  pii_removidos: z.number().int().nonnegative(),
  pii_por_tipo: PiiCountsSchema,
  fases_criadas: z.number().int().nonnegative(),
  caixas_normalizadas: z.number().int().nonnegative(),
  /** Linhas de cabecalho/rodape repetidas de pagina em pagina (marca d'agua, "Aula 03"). */
  rodape_repetido: z.number().int().nonnegative(),
  /** Questoes comentadas: contadas na entrada e na saida. Gate, nao promessa. */
  questoes_entrada: z.number().int().nonnegative(),
  questoes_saida: z.number().int().nonnegative(),
  questoes_preservadas: z.boolean(),
  /** false quando a IA devolveu texto sem alguma marca de procedencia da entrada. */
  procedencia_preservada: z.boolean(),
  procedencia_faltantes: z.array(z.string()).default([]),
  llm_usado: z.string().nullable(),
  fallback_ativado: z.boolean(),
  fallback_motivo: z.string().nullable(),
  aviso_ia_inserido: z.boolean(),
  /** `preservadas` mantem a citacao de pagina no chunk; IA de documento inteiro nao mantem. */
  fronteiras_pagina: z.enum(["preservadas", "descartadas", "inexistente"]),
  duracao_ms: z.number().int().nonnegative(),
  avisos: z.array(z.string()).default([]),
  documentId: z.string().optional(),
  arquivo: z.string().optional(),
});

export type ApostilaTransformReport = z.infer<typeof ApostilaTransformReportSchema>;

/** Resultado interno do transform: o texto pronto e o relatorio auditavel. */
export interface ApostilaTransformResult {
  text: string;
  report: ApostilaTransformReport;
}

/** Por pagina: o pipeline precisa das fronteiras, entao o offline trabalha assim. */
export interface ApostilaPagesTransformResult {
  pages: string[];
  report: ApostilaTransformReport;
}

/** Porta de saida da IA. Injetavel para os testes rodarem sem rede. */
export interface StructuringCompletion {
  text: string;
  model: string;
}

export interface ApostilaStructuringClient {
  readonly available: boolean;
  readonly label: string;
  structure(input: { prompt: string; maxChars: number }): Promise<StructuringCompletion>;
}

/** Codigo de erro do transform; a rota traduz para HTTP, a UI mostra a mensagem. */
export const APOSTILA_TRANSFORM_ERROR_CODES = [
  "EMPTY_TEXT",
  "RULES_INVALID",
  "LLM_UNAVAILABLE",
  "LLM_EMPTY_RESPONSE",
  "LLM_QUESTIONS_LOST",
  "LLM_PROVENANCE_LOST",
] as const;

export type ApostilaTransformErrorCode = (typeof APOSTILA_TRANSFORM_ERROR_CODES)[number];

export class ApostilaTransformError extends Error {
  constructor(
    readonly code: ApostilaTransformErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ApostilaTransformError";
  }
}
