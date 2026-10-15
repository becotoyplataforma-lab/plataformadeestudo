/**
 * Testes do interruptor de disponibilidade de POST /api/ai/rag.
 *
 * Decisão de produto: a rota fica desativada por padrão até existir consumidora
 * funcional. Sem opt-in explícito `RAG_API_DISABLED=false` ela não pode tocar
 * sessão, banco, quota ou provedor pago. Valores não reconhecidos mantêm a rota
 * fechada e geram diagnóstico sem ecoar a configuração.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockAnswer = vi.fn();
const mockCheckLimit = vi.fn();
const mockRecord = vi.fn();
const mockResolveUserLimits = vi.fn();
const mockCanUseModel = vi.fn();
const mockLogError = vi.fn();
const mockLogWarn = vi.fn();

vi.mock("@/lib/auth/auth", () => ({
  auth: (...args: unknown[]) => mockAuth(...args),
}));

vi.mock("@/lib/ai/services/rag.service", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/services/rag.service")>();
  return {
    ...actual,
    ragService: { answer: (...args: unknown[]) => mockAnswer(...args) },
  };
});

// Perfil e escopo nunca são alcançados com a rota fechada; resolvidos para que o
// caminho habilitado não quebre por mock malformado.
vi.mock("@/lib/db/repositories/perfil", () => ({
  getProfile: vi.fn(async () => null),
}));
vi.mock("@/lib/knowledge/security/course-scope", () => ({
  resolveCourseScope: vi.fn(async () => ({}) as { positionId?: string; editalId?: string }),
}));

vi.mock("@/lib/ai/services/usage.service", () => ({
  UsageService: {
    checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
    record: (...args: unknown[]) => mockRecord(...args),
    estimateCost: () => 0,
  },
}));
vi.mock("@/lib/billing/services/limits.resolver", () => ({
  resolveUserLimits: (...args: unknown[]) => mockResolveUserLimits(...args),
}));
vi.mock("@/lib/billing/services/entitlement.service", () => ({
  EntitlementService: { canUseModel: (...args: unknown[]) => mockCanUseModel(...args) },
}));
vi.mock("@/lib/observability", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: (...args: unknown[]) => mockLogWarn(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  },
  now: () => Date.now(),
  elapsed: () => 0,
}));

import { POST } from "@/app/api/ai/rag/route";

const ORIGINAL = process.env.RAG_API_DISABLED;

function setFlag(value: string | undefined) {
  if (value === undefined) {
    delete process.env.RAG_API_DISABLED;
  } else {
    process.env.RAG_API_DISABLED = value;
  }
}

function makeRequest(body: unknown = { question: "O que é RLS?" }): NextRequest {
  return new NextRequest("http://localhost/api/ai/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const ANSWER_OK = {
  answer: "Resposta.",
  citations: [],
  documents: [],
  chunksUsed: 0,
  tokens: { in: 0, out: 0, total: 0 },
  latencyMs: 5,
  model: "flash" as const,
  confidence: 0,
};

describe("POST /api/ai/rag — interruptor de disponibilidade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setFlag("false");
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockAnswer.mockResolvedValue(ANSWER_OK);
    mockCheckLimit.mockResolvedValue({
      canSend: true,
      status: { messagesUsed: 0, tokensIn: 0, tokensOut: 0, totalTokens: 0 },
    });
    mockResolveUserLimits.mockResolvedValue({
      maxMessages: 5,
      maxTokens: 100_000,
      maxQuestionsPerDay: 20,
      maxDocuments: 3,
      allowPro: false,
    });
    mockCanUseModel.mockResolvedValue(true);
  });

  afterEach(() => {
    setFlag(ORIGINAL);
  });

  const fechadas: Array<[string, string | undefined]> = [
    ["variável ausente", undefined],
    ["vazia", ""],
    ["espaços só", "   "],
    ["true", "true"],
    ["TRUE com espaços", "  TRUE  "],
    ["True misturado", "True"],
    ["0", "0"],
    ["nao", "nao"],
    ["yes", "yes"],
    ["habilitar", "habilitar"],
  ];

  for (const [label, value] of fechadas) {
    it(`503 sem tocar sessão, quota ou IA quando RAG_API_DISABLED está ${label}`, async () => {
      setFlag(value);
      const res = await POST(makeRequest());
      expect(res.status).toBe(503);
      const json = (await res.json()) as { error: string; message: string };
      expect(json.error).toBe("RAG_ENDPOINT_DISABLED");
      expect(json.message).toBe("Serviço de consulta RAG indisponível neste momento.");
      // Nada antes do gate é executado: nem sessão, nem banco, nem provedor.
      expect(mockAuth).not.toHaveBeenCalled();
      expect(mockResolveUserLimits).not.toHaveBeenCalled();
      expect(mockCheckLimit).not.toHaveBeenCalled();
      expect(mockCanUseModel).not.toHaveBeenCalled();
      expect(mockAnswer).not.toHaveBeenCalled();
      expect(mockRecord).not.toHaveBeenCalled();
    });
  }

  it("habilita apenas com false explícito e mantém autenticação obrigatória", async () => {
    setFlag("false");
    mockAuth.mockResolvedValue(null);
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);
    expect(mockAnswer).not.toHaveBeenCalled();
    expect(mockAuth).toHaveBeenCalledTimes(1);
  });

  it("aceita false com espaços e maiúsculas e segue o fluxo autenticado", async () => {
    setFlag("  FaLsE  ");
    const res = await POST(makeRequest());
    expect(res.status).toBe(200);
    expect(mockAnswer).toHaveBeenCalledTimes(1);
  });

  it("valor inválido fecha a rota e registra diagnóstico sem ecoar a configuração", async () => {
    const valorSensivel = "SENHA-DO-ENV-123";
    setFlag(valorSensivel);
    const res = await POST(makeRequest());
    expect(res.status).toBe(503);
    const corpo = await res.clone().text();
    expect(corpo).not.toContain(valorSensivel);
    expect(mockLogError).toHaveBeenCalledTimes(1);
    const [scope, message, fields] = mockLogError.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect(scope).toBe("rag");
    expect(fields.event).toBe("RAG_DISABLE_FLAG_INVALID");
    expect(JSON.stringify(fields)).not.toContain(valorSensivel);
    expect(message).toContain("RAG_API_DISABLED");
    expect(mockAnswer).not.toHaveBeenCalled();
  });

  it("resposta 503 é estável e idêntica entre chamadas", async () => {
    setFlag("0");
    const primeira = await POST(makeRequest());
    const segunda = await POST(makeRequest());
    expect(await primeira.text()).toBe(await segunda.text());
    expect(primeira.status).toBe(503);
  });

  it("não responde 200 por engano quando a variável some no meio do caminho", async () => {
    setFlag("false");
    const ok = await POST(makeRequest());
    expect(ok.status).toBe(200);
    delete process.env.RAG_API_DISABLED;
    const bloqueada = await POST(makeRequest());
    expect(bloqueada.status).toBe(503);
    expect(mockAnswer).toHaveBeenCalledTimes(1);
  });
});