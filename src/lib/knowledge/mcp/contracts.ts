/**
 * Contrato dos provedores MCP de conhecimento (arquitetura multi-MCP).
 *
 * Cada provedor e um modulo que decide, a partir de um arquivo recebido, como ele
 * deve ser classificado, organizado e indexado. O upload nao conhece regra de
 * conteudo: ele pergunta ao provedor. Assim novos MCPs (provas, questoes, editais
 * de outras bancas) entram sem tocar na rota de upload.
 *
 * Nada aqui toca banco de dados: o contrato e puro e testavel isoladamente.
 */

export const MCP_PROTOCOL_VERSION = "1.0" as const;

export const DEFAULT_MCP_PROVIDER_ID = "apostila-mcp" as const;

export type McpCapability = "ingest" | "transform" | "reprocess" | "search";

export type McpClassification = "supported" | "unsupported" | "invalid";

export type McpDocumentKind = "apostila" | "prova" | "edital" | "resumo" | "outro";

export interface McpPlanInput {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  subject?: string;
  lessonOrder?: number;
  relativePath?: string;
  /** true quando o conteudo do arquivo e formado apenas por bytes zero (corrompido). */
  allZeroContent?: boolean;
}

export interface McpPlan {
  providerId: string;
  providerVersion: string;
  /**
   * Versao das regras de processamento editorial (normalizacao, ordenacao,
   * variantes). E dimensao propria e nunca copia do providerVersion: mudar a
   * regra sem trocar de provedor tambem exige reprocessamento.
   */
  processingVersion: string;
  classification: McpClassification;
  /** Motivo legivel quando nao e supported; nunca contem caminho absoluto. */
  reason?: string;
  title: string;
  kind: McpDocumentKind;
  subject: string;
  lessonOrder?: number;
  /** Variante de um mesmo conteudo-base, por exemplo a copia grifada de uma aula. */
  variant?: string;
  /** Variantes e rascunhos nao entram no indice padrao do Knowledge Engine. */
  indexedByDefault: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
}

export interface McpTransformInput {
  plan: McpPlan;
  text: string;
  /**
   * true quando o material passou por adaptacao gerada por IA. So nesse caso
   * o transform inser o aviso de adaptacao: declarar IA em texto que no
   * foi adaptado seria uma procedencia falsa.
   */
  aiAdapted?: boolean;
}

export interface McpTransformResult {
  text: string;
  notes: string[];
}

export interface KnowledgeMcpProvider {
  readonly id: string;
  readonly label: string;
  readonly version: string;
  readonly processingVersion: string;
  readonly description: string;
  readonly capabilities: readonly McpCapability[];
  plan(input: McpPlanInput): Promise<McpPlan>;
  transform?(input: McpTransformInput): Promise<McpTransformResult>;
}

export type McpErrorCode =
  | "MCP_PROVIDER_NOT_FOUND"
  | "MCP_CAPABILITY_UNAVAILABLE"
  | "MCP_INVALID_INPUT"
  | "MCP_REJECTED"
  | "MCP_DUPLICATE";

/**
 * Erro de dominio dos provedores. A rota de upload traduz o codigo para HTTP;
 * a mensagem e sempre segura para exibicao.
 */
export class McpError extends Error {
  constructor(
    readonly code: McpErrorCode,
    message: string,
    readonly status: number = 400,
  ) {
    super(message);
    this.name = "McpError";
  }

  static providerNotFound(id: string): McpError {
    return new McpError("MCP_PROVIDER_NOT_FOUND", "Provedor MCP desconhecido: " + id, 404);
  }

  static capabilityUnavailable(id: string, capability: McpCapability): McpError {
    return new McpError(
      "MCP_CAPABILITY_UNAVAILABLE",
      "O provedor " + id + " nao suporta a operacao: " + capability,
      422,
    );
  }

  static rejected(reason: string): McpError {
    return new McpError("MCP_REJECTED", reason, 422);
  }

  static invalidInput(reason: string): McpError {
    return new McpError("MCP_INVALID_INPUT", reason, 422);
  }
}

/** Resumo publico de um provedor, para a tela de upload listar as opcoes. */
export interface McpProviderSummary {
  id: string;
  label: string;
  version: string;
  description: string;
  capabilities: McpCapability[];
  isDefault: boolean;
}