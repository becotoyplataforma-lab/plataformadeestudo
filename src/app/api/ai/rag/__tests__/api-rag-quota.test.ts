/**
 * Testes de quota, contabilização e limites de entrada de POST /api/ai/rag.
 *
 * A rota só roda com opt-in explícito; habilitada, ela não pode gastar token sem
 * cota verificada nem entregar resposta sem registrar o consumo. Fronteiras
 * mockadas: Billing (limites do plano), ai_usage (contadores) e RagService (que
 * por contrato não registra uso — quem registra é a rota/ProfessorService).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const mockAuth = vi.fn();
const mockAnswer = vi.fn();
const mockGetProfile = vi.fn();
const mockResolveCourseScope = vi.fn();
const mockCheckLimit = vi.fn();
const mockRecord = vi.fn();
const mockEstimateCost = vi.fn();
const mockResolveUserLimits = vi.fn();
const mockCanUseModel = vi.fn();
const mockLogWarn = vi.fn();
const mockLogError = vi.fn();

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

vi.mock("@/lib/db/repositories/perfil", () => ({
  getProfile: (...args: unknown[]) => mockGetProfile(...args),
}));
vi.mock("@/lib/knowledge/security/course-scope", () => ({
  resolveCourseScope: (...args: unknown[]) => mockResolveCourseScope(...args),
}));

vi.mock("@/lib/ai/services/usage.service", () => ({
  UsageService: {
    checkLimit: (...args: unknown[]) => mockCheckLimit(...args),
    record: (...args: unknown[]) => mockRecord(...args),
    estimateCost: (...args: unknown[]) => mockEstimateCost(...args),
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
import { RagError } from "@/lib/ai/services/rag.service";
import { ProviderError } from "@/lib/ai/services/deepseek-provider.service";

const ORIGINAL = process.env.RAG_API_DISABLED;
const UUID = "00000000-0000-0000-0000-000000000001";
const UUID2 = "00000000-0000-0000-0000-000000000002";

function makeRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/ai/rag", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function answered(tokens: { in: number; out: number }) {
  return {
    answer: "Resposta fundamentada.",
    citations: [],
    documents: [UUID],
    chunksUsed: 1,
    tokens: { in: tokens.in, out: tokens.out, total: tokens.in + tokens.out },
    latencyMs: 10,
    model: "flash" as const,
    confidence: 0.8,
  };
}

describe("POST /api/ai/rag — quota, contabilização e limites de entrada", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAG_API_DISABLED = "false";
    mockAuth.mockResolvedValue({ user: { id: "u1" } });
    mockGetProfile.mockResolvedValue(null);
    mockResolveCourseScope.mockResolvedValue({});
    mockResolveUserLimits.mockResolvedValue({
      maxMessages: 5,
      maxTokens: 100_000,
      maxQuestionsPerDay: 20,
      maxDocuments: 3,
      allowPro: false,
    });
    mockCheckLimit.mockResolvedValue({
      canSend: true,
      status: { messagesUsed: 1, tokensIn: 100, tokensOut: 20, totalTokens: 120 },
    });
    mockRecord.mockResolvedValue(undefined);
    mockEstimateCost.mockReturnValue(0.0012);
    mockCanUseModel.mockResolvedValue(true);
    mockAnswer.mockResolvedValue(answered({ in: 100, out: 20 }));
  });

  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.RAG_API_DISABLED;
    } else {
      process.env.RAG_API_DISABLED = ORIGINAL;
    }
  });

  describe("quota do plano", () => {
    it("consulta limites do plano do usuário antes de qualquer gasto", async () => {
      await POST(makeRequest({ question: "q" }));
      expect(mockResolveUserLimits).toHaveBeenCalledWith("u1");
      expect(mockCheckLimit).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({ maxMessages: 5, maxTokens: 100_000 })
      );
    });

    it("429 LIMIT_EXCEEDED sem chamar IA quando a cota do dia acabou", async () => {
      mockCheckLimit.mockResolvedValue({
        canSend: false,
        status: { messagesUsed: 5, tokensIn: 900, tokensOut: 100, totalTokens: 1_000 },
      });
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(429);
      const json = (await res.json()) as { error: string; usage?: Record<string, number> };
      expect(json.error).toBe("LIMIT_EXCEEDED");
      expect(json.usage).toEqual({
        messages_used: 5,
        max_messages: 5,
        tokens_used: 1_000,
        max_tokens: 100_000,
      });
      expect(mockAnswer).not.toHaveBeenCalled();
      expect(mockRecord).not.toHaveBeenCalled();
      expect(mockLogWarn).toHaveBeenCalledWith(
        "rag",
        expect.any(String),
        expect.objectContaining({ event: "LIMIT_EXCEEDED" })
      );
    });

    it("503 fail-closed quando a leitura de uso falha (sem contador, sem IA)", async () => {
      mockCheckLimit.mockRejectedValue(new Error("banco indisponível"));
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(503);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("USAGE_UNAVAILABLE");
      expect(mockAnswer).not.toHaveBeenCalled();
      expect(mockRecord).not.toHaveBeenCalled();
      expect(mockLogError).toHaveBeenCalledWith(
        "rag",
        expect.any(String),
        expect.objectContaining({ event: "USAGE_CHECK_FAILED" })
      );
    });

    it("cota excedida não é caminho de provedor: 429 antes de 502", async () => {
      mockCheckLimit.mockResolvedValue({
        canSend: false,
        status: { messagesUsed: 9, tokensIn: 0, tokensOut: 0, totalTokens: 0 },
      });
      mockAnswer.mockRejectedValue(new ProviderError("PROVIDER_FAILED", "DeepSeek fora do ar"));
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(429);
      expect(mockAnswer).not.toHaveBeenCalled();
    });
  });

  describe("modelo por plano", () => {
    it("403 MODEL_NOT_ALLOWED para pro em plano sem allowPro, sem chamar IA", async () => {
      // Plano gratuito: allowPro false -> a regra do Billing nega o modelo.
      mockCanUseModel.mockResolvedValue(false);
      const res = await POST(makeRequest({ question: "q", model: "pro" }));
      expect(res.status).toBe(403);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("MODEL_NOT_ALLOWED");
      expect(mockCanUseModel).toHaveBeenCalledWith("u1", "pro");
      expect(mockAnswer).not.toHaveBeenCalled();
    });

    it("falha ao consultar entitlement nega o modelo (fail closed)", async () => {
      mockCanUseModel.mockRejectedValue(new Error("sem plano"));
      const res = await POST(makeRequest({ question: "q", model: "pro" }));
      expect(res.status).toBe(403);
      expect(mockAnswer).not.toHaveBeenCalled();
    });

    it("flash e kimi não pagam leitura extra de entitlement", async () => {
      await POST(makeRequest({ question: "q", model: "flash" }));
      await POST(makeRequest({ question: "q", model: "kimi" }));
      expect(mockCanUseModel).not.toHaveBeenCalled();
      expect(mockAnswer).toHaveBeenCalledTimes(2);
    });
  });

  describe("contabilização de uso", () => {
    it("registra os tokens reais da resposta no ai_usage do dia", async () => {
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(200);
      expect(mockRecord).toHaveBeenCalledWith("u1", 100, 20);
      expect(mockEstimateCost).toHaveBeenCalledWith("flash", 100, 20);
      expect(mockLogWarn).not.toHaveBeenCalled();
    });

    it("fallback sem contexto não registra mensagem (nenhum token consumido)", async () => {
      mockAnswer.mockResolvedValue(answered({ in: 0, out: 0 }));
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(200);
      expect(mockRecord).not.toHaveBeenCalled();
    });

    it("falha do provedor ainda conta a tentativa, com tokens zero", async () => {
      mockAnswer.mockRejectedValue(new ProviderError("PROVIDER_FAILED", "DeepSeek fora do ar"));
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(502);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("PROVIDER_FAILED");
      expect(mockRecord).toHaveBeenCalledWith("u1", 0, 0);
    });

    it("timeout do RagService vira 408 e ainda conta a tentativa", async () => {
      mockAnswer.mockRejectedValue(new RagError("TIMEOUT", "Tempo limite excedido (20000ms)."));
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(408);
      expect(mockRecord).toHaveBeenCalledWith("u1", 0, 0);
    });

    it("falha de registro nega a resposta em vez de liberar conteúdo não contabilizado", async () => {
      mockRecord.mockRejectedValue(new Error("ia_usage indisponível"));
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(500);
      const json = (await res.json()) as { error: string; answer?: string };
      expect(json.error).toBe("USAGE_RECORD_FAILED");
      expect(json.answer).toBeUndefined();
      expect(mockLogError).toHaveBeenCalledWith(
        "rag",
        expect.any(String),
        expect.objectContaining({ event: "USAGE_RECORD_FAILED" })
      );
    });

    it("falha de registro no caminho de erro não encobre a falha do provedor", async () => {
      mockAnswer.mockRejectedValue(new ProviderError("PROVIDER_FAILED", "DeepSeek fora do ar"));
      mockRecord.mockRejectedValue(new Error("ia_usage indisponível"));
      const res = await POST(makeRequest({ question: "q" }));
      expect(res.status).toBe(502);
      expect(mockLogError).toHaveBeenCalledWith(
        "rag",
        expect.any(String),
        expect.objectContaining({ event: "USAGE_RECORD_FAILED" })
      );
    });
  });

  describe("validação e limites de entrada", () => {
    it("400 para pergunta vazia, top_k fora de 1-20 e document_ids inválidos", async () => {
      const vazia = await POST(makeRequest({ question: "" }));
      expect(vazia.status).toBe(400);
      const topK = await POST(makeRequest({ question: "q", top_k: 0 }));
      expect(topK.status).toBe(400);
      const ids = await POST(makeRequest({ question: "q", document_ids: ["nao-e-uuid"] }));
      expect(ids.status).toBe(400);
      expect(mockAnswer).not.toHaveBeenCalled();
    });

    it("400 para JSON malformado em vez de 500", async () => {
      const res = await POST(makeRequest("{\"question\": \"q\""));
      expect(res.status).toBe(400);
      const json = (await res.json()) as { error: string; message: string };
      expect(json.error).toBe("Requisição inválida");
      expect(json.message).toBe("Corpo não é JSON válido.");
    });

    it("413 para corpo acima do teto, sem tocar quota nem IA", async () => {
      const res = await POST(
        makeRequest({ question: "a".repeat(2000), enchimento: "x".repeat(20_000) })
      );
      expect(res.status).toBe(413);
      const json = (await res.json()) as { error: string };
      expect(json.error).toBe("PAYLOAD_TOO_LARGE");
      expect(mockCheckLimit).not.toHaveBeenCalled();
      expect(mockAnswer).not.toHaveBeenCalled();
    });

    it("ignora chaves de escopo vindas do cliente e repassa o escopo do perfil", async () => {
      mockGetProfile.mockResolvedValue({ id: "u1", position_id: "pos-Y", contest_id: null });
      mockResolveCourseScope.mockResolvedValue({ positionId: "pos-Y" });
      const res = await POST(
        makeRequest({
          question: "q",
          document_ids: [UUID, UUID2],
          position_id: "pos-HACK",
          edital_id: "edital-HACK",
        })
      );
      expect(res.status).toBe(200);
      const input = mockAnswer.mock.calls[0][0] as Record<string, unknown>;
      // document_ids é permitido: estreita o conjunto já autorizado pela política
      // central (documentAccessCondition) dentro do HybridSearchService.
      expect(input.documentIds).toEqual([UUID, UUID2]);
      expect(input.positionId).toBe("pos-Y");
      expect(input.editalId).toBeUndefined();
      expect(JSON.stringify(input)).not.toContain("pos-HACK");
    });
  });
});