/**
 * Testes de GET /api/knowledge/mcp-providers.
 *
 * O catalogo alimenta o seletor "MCP de processamento" da UI e e a mesma fonte
 * de verdade do guard de capacidade do backend. Duas invariantes importam:
 * sem sessao nao existe catalogo nenhum, e cada linha expoe apenas campos
 * declarativos - nunca credencial, host de storage ou caminho de arquivo.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockAuth = vi.fn();
vi.mock("@/lib/auth/auth", () => ({
  auth: () => mockAuth() as unknown,
}));

import { GET } from "@/app/api/knowledge/mcp-providers/route";
import {
  registerMcpProvider,
  unregisterMcpProvider,
  assertMcpCapability,
} from "@/lib/knowledge/mcp/registry";
import {
  DEFAULT_MCP_PROVIDER_ID,
  McpError,
  type KnowledgeMcpProvider,
  type McpCapability,
} from "@/lib/knowledge/mcp/contracts";

const FAKE_SERVICE_ROLE = "eyJhbGciOiJIUzI1NiIs-fake-service-role-token";
const FAKE_DB_URL = "postgresql://postgres:fake-password@db-xyz.supabase.co:5432/postgres";
const FAKE_R2_KEY = "AKIAIOSFODNN7fake-access-key-id";

interface CatalogRow {
  id: string;
  label: string;
  version: string;
  description: string;
  capabilities: string[];
  isDefault: boolean;
}

function signedIn() {
  mockAuth.mockResolvedValue({ user: { id: "00000000-0000-0000-0000-0000000000b1" } });
}

function probeProvider(capabilities: McpCapability[]): KnowledgeMcpProvider {
  return {
    id: "probe-mcp",
    label: "Probe MCP",
    version: "0.0.1",
    description: "provedor temporario de teste",
    capabilities,
    processingVersion: "probe-1",
    async plan() {
      throw new Error("o catalogo nao deve chamar plan()");
    },
  };
}

async function catalog(): Promise<CatalogRow[]> {
  const res = await GET();
  expect(res.status).toBe(200);
  const body = await res.json();
  return body.providers as CatalogRow[];
}

function errorFrom(run: () => void): string | null {
  try {
    run();
  } catch (error) {
    return error instanceof McpError ? error.code : "NAO_MCP_ERROR";
  }
  return null;
}

beforeEach(() => {
  vi.clearAllMocks();
  signedIn();
  process.env.SUPABASE_SERVICE_ROLE_KEY = FAKE_SERVICE_ROLE;
  process.env.DATABASE_URL = FAKE_DB_URL;
  process.env.R2_ACCESS_KEY_ID = FAKE_R2_KEY;
});

// As credenciais fake existem so para provar que nao vazam: limpar depois evita
// poluir o worker caso outro arquivo rode no mesmo processo.
afterEach(() => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.DATABASE_URL;
  delete process.env.R2_ACCESS_KEY_ID;
});

describe("GET /api/knowledge/mcp-providers", () => {
  it("exige sessao ativa e nao entrega nada sem ela", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Não autorizado");
    expect(body.providers).toBeUndefined();
  });

  it("devolve o catalogo com exatamente um provedor padrao", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.defaultProviderId).toBe(DEFAULT_MCP_PROVIDER_ID);
    const list = body.providers as CatalogRow[];
    expect(list.length).toBeGreaterThan(1);
    expect(list.map((p) => p.id)).toContain("apostila-mcp");
    expect(list.map((p) => p.id)).toContain("mock-mcp");
    const defaults = list.filter((p) => p.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(DEFAULT_MCP_PROVIDER_ID);
  });

  it("espelha as capacidades reais de cada provedor", async () => {
    const list = await catalog();
    const apostila = list.find((p) => p.id === "apostila-mcp");
    const mock = list.find((p) => p.id === "mock-mcp");
    expect(apostila?.capabilities).toEqual(
      expect.arrayContaining(["ingest", "transform", "reprocess"])
    );
    expect(apostila?.capabilities).not.toContain("search");
    expect(mock?.capabilities).toEqual(["ingest"]);
    expect(mock?.isDefault).toBe(false);
  });

  it("expoe somente campos declarativos por provedor", async () => {
    const list = await catalog();
    for (const provider of list) {
      expect(Object.keys(provider).sort()).toEqual([
        "capabilities",
        "description",
        "id",
        "isDefault",
        "label",
        "version",
      ]);
    }
  });

  it("nao vaza credencial nem host de storage mesmo com tudo configurado", async () => {
    const res = await GET();
    const text = JSON.stringify(await res.json());
    expect(text).not.toContain(FAKE_SERVICE_ROLE);
    expect(text).not.toContain(FAKE_DB_URL);
    expect(text).not.toContain(FAKE_R2_KEY);
    expect(text).not.toContain("service_role");
    expect(text).not.toContain("postgresql://");
    expect(text).not.toContain("supabase.co");
    expect(text).not.toContain("process.env");
  });

  it("capabilities e copia defensiva: mexer no payload nao altera o registro", async () => {
    const first = await catalog();
    const apostila = first.find((p) => p.id === "apostila-mcp");
    if (!apostila) throw new Error("apostila-mcp sumiu do catalogo");
    apostila.capabilities.push("inventeada");
    const second = await catalog();
    const again = second.find((p) => p.id === "apostila-mcp");
    expect(again?.capabilities).not.toContain("inventeada");
  });

  it("provedor sem reprocess aparece sem reprocess e o guard recusa igual", async () => {
    registerMcpProvider(probeProvider(["ingest"]));
    try {
      const list = await catalog();
      const probe = list.find((p) => p.id === "probe-mcp");
      expect(probe?.isDefault).toBe(false);
      expect(probe?.capabilities).toEqual(["ingest"]);
      expect(errorFrom(() => assertMcpCapability("probe-mcp", "reprocess"))).toBe(
        "MCP_CAPABILITY_UNAVAILABLE"
      );
      expect(errorFrom(() => assertMcpCapability("probe-mcp", "ingest"))).toBeNull();
    } finally {
      unregisterMcpProvider("probe-mcp");
    }
    const after = await catalog();
    expect(after.map((p) => p.id)).not.toContain("probe-mcp");
  });
});