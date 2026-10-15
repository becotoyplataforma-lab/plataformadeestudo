import { DEFAULT_MCP_PROVIDER_ID, McpError, type KnowledgeMcpProvider, type McpCapability, type McpProviderSummary } from "./contracts";
import { apostilaMcpProvider } from "./providers/apostila-mcp";
import { createMockMcpProvider } from "./providers/mock-mcp";

/**
 * Registro dos provedores MCP disponiveis.
 *
 * A rota de upload e a de reprocessamento resolvem o provedor por aqui; nenhuma
 * delas contem regra de conteudo. Registrar um novo MCP e acrescentar uma linha
 * neste arquivo (ou chamar registerMcpProvider em inicializacao dedicada).
 */
const REGISTRY = new Map<string, KnowledgeMcpProvider>();

export function registerMcpProvider(provider: KnowledgeMcpProvider): void {
  if (!provider.id.trim()) {
    throw new McpError("MCP_INVALID_INPUT", "Provedor MCP precisa de um id nao vazio.", 422);
  }
  if (REGISTRY.has(provider.id)) {
    throw new McpError("MCP_INVALID_INPUT", "Provedor MCP ja registrado: " + provider.id, 422);
  }
  REGISTRY.set(provider.id, provider);
}

export function unregisterMcpProvider(id: string): void {
  REGISTRY.delete(id);
}

export function listMcpProviders(): KnowledgeMcpProvider[] {
  return [...REGISTRY.values()];
}

export function getMcpProvider(id: string): KnowledgeMcpProvider | undefined {
  return REGISTRY.get(id);
}

export function requireMcpProvider(id: string): KnowledgeMcpProvider {
  const provider = REGISTRY.get(id);
  if (!provider) throw McpError.providerNotFound(id);
  return provider;
}

/** Sem id explicito cai no provedor padrao; id desconhecido lanca 404 de dominio. */
export function resolveMcpProvider(id?: string | null): KnowledgeMcpProvider {
  const requested = (id ?? "").trim();
  return requireMcpProvider(requested.length > 0 ? requested : DEFAULT_MCP_PROVIDER_ID);
}

/** Guard de capacidade: reprocessamento so roda se o provedor souber fazelo. */
export function assertMcpCapability(id: string, capability: McpCapability): KnowledgeMcpProvider {
  const provider = requireMcpProvider(id);
  if (!provider.capabilities.includes(capability)) {
    throw McpError.capabilityUnavailable(id, capability);
  }
  return provider;
}

export function mcpProviderCatalog(): McpProviderSummary[] {
  return listMcpProviders().map(function (provider) {
    return {
      id: provider.id,
      label: provider.label,
      version: provider.version,
      description: provider.description,
      capabilities: [...provider.capabilities],
      isDefault: provider.id === DEFAULT_MCP_PROVIDER_ID,
    };
  });
}

registerMcpProvider(apostilaMcpProvider);
registerMcpProvider(createMockMcpProvider());