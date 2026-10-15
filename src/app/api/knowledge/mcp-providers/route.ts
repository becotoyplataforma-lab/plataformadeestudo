/**
 * GET /api/knowledge/mcp-providers
 *
 * Catalogo estatico dos provedores MCP disponiveis para o formulario de upload.
 * Exige sessao ativa. Nao expoe segredo nenhum: somente id, rotulo, versao e
 * capacidades declarativas de cada provedor.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { DEFAULT_MCP_PROVIDER_ID } from "@/lib/knowledge/mcp/contracts";
import { mcpProviderCatalog } from "@/lib/knowledge/mcp/registry";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  return NextResponse.json({
    defaultProviderId: DEFAULT_MCP_PROVIDER_ID,
    providers: mcpProviderCatalog(),
  });
}