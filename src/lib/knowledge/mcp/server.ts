/**
 * Servidor MCP dos provedores de conhecimento (stdio, JSON-RPC 2.0).
 *
 * Expose o registry, o contrato de formatos e o transform para o VS Code sem
 * criar uma arquitetura paralela: cada ferramenta chama exatamente o mesmo
 * modulo que a rota de upload usa.
 *
 * O servidor e somente leitura por construcao: ele nunca importa repositorio,
 * storage ou credenciais de banco. Rodar o MCP no editor nao pode escrever em
 * producao nem empurrar apostila para o indice.
 */

import {
  BINARY_NO_EXTRACTOR_EXTENSIONS,
  IMAGE_EXTENSIONS,
  TEXT_EXTRACTABLE_MIME_TYPES,
  TEXT_EXTRACTABLE_EXTENSIONS,
  describeFormatRejection,
  formatFamilyOf,
} from "../format-contract";
import { MCP_PROTOCOL_VERSION, McpError, type McpPlanInput } from "./contracts";
import { mcpProviderCatalog, resolveMcpProvider } from "./registry";

/** Versao do protocolo MCP na fio (diferente da versao interna do contrato). */
export const KNOWLEDGE_MCP_PROTOCOL_VERSION = "2025-06-18";

export const KNOWLEDGE_MCP_SERVER_NAME = "concursoai-knowledge-mcp";
export const KNOWLEDGE_MCP_SERVER_VERSION = "1.1.0";

export type JsonRpcId = string | number | null;

export interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: JsonRpcError;
}

export interface McpToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** Ferramentas expostas ao editor. Todas somente leitura. */
export const KNOWLEDGE_MCP_TOOLS = [
  {
    name: "knowledge_mcp_catalog",
    description: "Lista os provedores MCP registrados, capacidades e versoes.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "knowledge_format_contract",
    description: "Formatos aceitos e recusados pelo MCP e pelo extrator de texto.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "knowledge_plan_file",
    description: "Dry-run: classifica um arquivo pelo MCP escolhido, sem escrever.",
    inputSchema: {
      type: "object",
      properties: {
        fileName: { type: "string" },
        mimeType: { type: "string" },
        sizeBytes: { type: "number" },
        sha256: { type: "string" },
        subject: { type: "string" },
        lessonOrder: { type: "number" },
        providerId: { type: "string" },
        allZeroContent: { type: "boolean" },
      },
      required: ["fileName"],
    },
  },
  {
    name: "knowledge_transform_text",
    description: "Aplica a normalizacao editorial de um provedor a um texto.",
    inputSchema: {
      type: "object",
      properties: {
        providerId: { type: "string" },
        fileName: { type: "string" },
        text: { type: "string" },
        aiAdapted: { type: "boolean" },
      },
      required: ["text"],
    },
  },
] as const;

function textResult(payload: unknown, isError = false): McpToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    isError,
  };
}

function readString(args: Record<string, unknown>, key: string): string {
  const raw = args[key];
  return typeof raw === "string" ? raw : "";
}

function readNumber(args: Record<string, unknown>, key: string): number | undefined {
  const raw = args[key];
  return typeof raw === "string" || typeof raw === "number" ? Number(raw) : undefined;
}

function readBoolean(args: Record<string, unknown>, key: string): boolean | undefined {
  const raw = args[key];
  return typeof raw === "boolean" ? raw : undefined;
}

/**
 * Executa uma ferramenta do MCP. Erro de dominio vira resultado com isError:
 * protocolo algum deve estourar como excecao para o cliente do editor.
 */
export async function callKnowledgeMcpTool(
  name: string,
  args: Record<string, unknown> = {},
): Promise<McpToolResult> {
  try {
    if (name === "knowledge_mcp_catalog") {
      return textResult({
        protocolVersion: MCP_PROTOCOL_VERSION,
        server: {
          name: KNOWLEDGE_MCP_SERVER_NAME,
          version: KNOWLEDGE_MCP_SERVER_VERSION,
        },
        providers: mcpProviderCatalog(),
      });
    }

    if (name === "knowledge_format_contract") {
      return textResult({
        rule: "um formato so entra quando existe extrator de texto implementado",
        acceptedExtensions: [...TEXT_EXTRACTABLE_EXTENSIONS],
        acceptedMimeTypes: [...TEXT_EXTRACTABLE_MIME_TYPES],
        rejectedBinaryExtensions: [...BINARY_NO_EXTRACTOR_EXTENSIONS],
        imageExtensions: [...IMAGE_EXTENSIONS],
      });
    }

    if (name === "knowledge_plan_file") {
      const fileName = readString(args, "fileName").trim();
      if (!fileName) return textResult({ error: "fileName e obrigatorio." }, true);
      const rawSize = readNumber(args, "sizeBytes");
      const mimeType = readString(args, "mimeType");
      const provider = resolveMcpProvider(readString(args, "providerId"));
      const input: McpPlanInput = {
        fileName,
        mimeType,
        sizeBytes: Number.isFinite(rawSize) ? Number(rawSize) : 1,
        sha256: readString(args, "sha256"),
        subject: readString(args, "subject") || undefined,
        lessonOrder: readNumber(args, "lessonOrder"),
        allZeroContent: readBoolean(args, "allZeroContent"),
      };
      const plan = await provider.plan(input);
      const recusa =
        plan.classification === "supported"
          ? null
          : describeFormatRejection(fileName, mimeType);
      return textResult({
        provider: { id: provider.id, version: provider.version },
        family: formatFamilyOf(fileName, mimeType),
        rejection: recusa,
        plan,
      });
    }

    if (name === "knowledge_transform_text") {
      const text = readString(args, "text");
      const provider = resolveMcpProvider(readString(args, "providerId"));
      if (!provider.transform) {
        return textResult({ error: "provedor sem capacidade transform: " + provider.id }, true);
      }
      const plan = await provider.plan({
        fileName: readString(args, "fileName") || "documento.txt",
        mimeType: "text/plain",
        sizeBytes: 1,
        sha256: "",
      });
      const result = await provider.transform({
        plan,
        text,
        aiAdapted: readBoolean(args, "aiAdapted"),
      });
      return textResult(result);
    }

    return textResult({ error: "Ferramenta desconhecida: " + name }, true);
  } catch (error) {
    if (error instanceof McpError) {
      return textResult({ error: error.code, message: error.message }, true);
    }
    return textResult({
      error: "MCP_TOOL_FAILED",
      message: error instanceof Error ? error.message : "falha desconhecida",
    }, true);
  }
}

function response(id: JsonRpcId, result: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result };
}

function failure(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** Resultado do handshake initialize do MCP. */
export function knowledgeMcpInitializeResult(): Record<string, unknown> {
  return {
    protocolVersion: KNOWLEDGE_MCP_PROTOCOL_VERSION,
    capabilities: { tools: {} },
    serverInfo: {
      name: KNOWLEDGE_MCP_SERVER_NAME,
      version: KNOWLEDGE_MCP_SERVER_VERSION,
    },
  };
}

/**
 * Despacha um request JSON-RPC do cliente (VS Code). Notificacao sem id nao
 * gera resposta, conforme a especificacao.
 */
export async function handleKnowledgeMcpRequest(
  request: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  const id: JsonRpcId = request.id ?? null;
  const params = request.params ?? {};
  const hasId = request.id !== undefined && request.id !== null;

  if (request.method === "initialize") {
    return response(id, knowledgeMcpInitializeResult());
  }
  if (request.method === "ping") {
    return response(id, {});
  }
  if (request.method === "tools/list") {
    return response(id, { tools: [...KNOWLEDGE_MCP_TOOLS] });
  }
  if (request.method === "tools/call") {
    const toolName = typeof params.name === "string" ? params.name : "";
    const rawArgs = params.arguments;
    const args =
      typeof rawArgs === "object" && rawArgs !== null
        ? (rawArgs as Record<string, unknown>)
        : {};
    return response(id, await callKnowledgeMcpTool(toolName, args));
  }

  return hasId ? failure(id, -32601, "Metodo nao suportado: " + request.method) : null;
}
