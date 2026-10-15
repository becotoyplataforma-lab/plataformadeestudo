import {
  MCP_PROTOCOL_VERSION,
  type KnowledgeMcpProvider,
  type McpClassification,
  type McpPlan,
  type McpPlanInput,
} from "../contracts";

/**
 * Provedor ficticio para testes e desenvolvimento.
 *
 * Existe para provar que a arquitetura aceita multiplos provedores sem tocar na
 * rota de upload. NUNCA deve ser escolhido como padrao em producao.
 */
export const MOCK_MCP_ID = "mock-mcp";
export const MOCK_MCP_VERSION = "0.0.0-test";

/** Versao do processamento do mock: dimensao separada da versao do provedor. */
export const MOCK_PROCESSING_VERSION = "0.0.0-test.processing";

export interface MockMcpOptions {
  classification?: McpClassification;
  rejectWith?: Error;
}

export function createMockMcpProvider(options: MockMcpOptions = {}): KnowledgeMcpProvider {
  return {
    id: MOCK_MCP_ID,
    label: "Mock MCP",
    version: MOCK_MCP_VERSION,
    processingVersion: MOCK_PROCESSING_VERSION,
    description: "Provedor ficticio de teste; nao indexa conteudo real.",
    capabilities: ["ingest"],
    async plan(input: McpPlanInput): Promise<McpPlan> {
      if (options.rejectWith) throw options.rejectWith;
      return {
        providerId: MOCK_MCP_ID,
        providerVersion: MOCK_MCP_VERSION,
        processingVersion: MOCK_PROCESSING_VERSION,
        classification: options.classification ?? "supported",
        title: input.fileName,
        kind: "outro",
        subject: input.subject ?? "teste",
        indexedByDefault: true,
        tags: ["mock"],
        metadata: {
          mcp: {
            providerId: MOCK_MCP_ID,
            protocolVersion: MCP_PROTOCOL_VERSION,
          },
        },
      };
    },
  };
}

export const mockMcpProvider: KnowledgeMcpProvider = createMockMcpProvider();