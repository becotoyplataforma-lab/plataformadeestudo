/**
 * Integração Professor ↔ Billing (OPEN-004).
 *
 * Fluxo real: ProfessorService → EntitlementService (Billing) → UsageService
 * (AI registra ai_usage) → ChatService/RagService → DeepSeekProvider.
 *
 * Billing é dono dos limites; AI continua registrando uso. Fronteiras externas
 * (DeepSeek HTTP, repositórios DB) são mockadas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Fronteiras externas (HTTP/DB) ---
const mockChatCompletion = vi.fn();
vi.mock("@/lib/ai/deepseek", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/deepseek")>();
  return {
    ...actual,
    chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  };
});

const mockFindUsage = vi.fn();
const mockIncrement = vi.fn();
vi.mock("../../ai/repositories/usage.repository", () => ({
  UsageRepository: {
    findByUserAndDay: (...args: unknown[]) => mockFindUsage(...args),
    increment: (...args: unknown[]) => mockIncrement(...args),
  },
}));

const mockFindSession = vi.fn();
const mockCreateSession = vi.fn();
const mockTouch = vi.fn();
const mockCreateMessage = vi.fn();
const mockGetRecent = vi.fn();
vi.mock("../../ai/repositories/chat.repository", () => ({
  ChatRepository: {
    findSessionById: (...args: unknown[]) => mockFindSession(...args),
    createSession: (...args: unknown[]) => mockCreateSession(...args),
    touchSession: (...args: unknown[]) => mockTouch(...args),
    createMessage: (...args: unknown[]) => mockCreateMessage(...args),
    getRecentContext: (...args: unknown[]) => mockGetRecent(...args),
  },
}));

// --- Billing repos (controlam o entitlement) ---
const mockFindActiveSub = vi.fn();
const mockFindPlanByCode = vi.fn();
const mockFindPlanById = vi.fn();
vi.mock("../repositories/subscription.repository", () => ({
  SubscriptionRepository: {
    findActiveByUser: (...args: unknown[]) => mockFindActiveSub(...args),
  },
}));
vi.mock("../repositories/plan.repository", () => ({
  PlanRepository: {
    findByCode: (...args: unknown[]) => mockFindPlanByCode(...args),
    findById: (...args: unknown[]) => mockFindPlanById(...args),
    listActive: vi.fn(),
    create: vi.fn(),
  },
}));

// --- Serviços reais ---
import { ProfessorService, defaultResolveIntent } from "@/lib/ai/services/professor.service";
import { RagService } from "@/lib/ai/services/rag.service";
import { ChatService } from "@/lib/ai/services/chat.service";
import { PromptService } from "@/lib/ai/services/prompt.service";
import { DeepSeekProvider } from "@/lib/ai/services/deepseek-provider.service";
import { ModelRouterService } from "@/lib/ai/services/model-router.service";
import { UsageService } from "@/lib/ai/services/usage.service";
import { HybridSearchService } from "@/lib/knowledge/services/hybrid-search.service";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";

const FREE_PLAN = {
  id: "p-free",
  name: "Gratuito",
  code: "free",
  priceCents: 0,
  limits: { maxMessages: 50, maxTokens: 50000, allowPro: false },
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const PRO_PLAN = {
  id: "p-pro",
  name: "Pro",
  code: "pro",
  priceCents: 2990,
  limits: { maxMessages: 500, maxTokens: 1000000, allowPro: true },
  status: "active",
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

const ACTIVE_SUB = {
  id: "s1",
  userId: "u1",
  planId: "p-pro",
  status: "active",
  startsAt: new Date(),
  endsAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
};

function buildProfessor() {
  return new ProfessorService({
    rag: new RagService({
      search: HybridSearchService,
      prompt: PromptService,
      provider: DeepSeekProvider,
      router: ModelRouterService,
    }),
    chat: ChatService,
    usage: UsageService,
    router: ModelRouterService,
    resolveIntent: defaultResolveIntent,
    billing: EntitlementService, // OPEN-004: Billing é dono dos limites
  });
}

describe("Integração Professor ↔ Billing (OPEN-004)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindActiveSub.mockResolvedValue(null);
    mockFindPlanByCode.mockResolvedValue(FREE_PLAN);
    mockFindPlanById.mockResolvedValue(PRO_PLAN);
    mockFindUsage.mockResolvedValue(null); // sem uso → pode enviar
    mockIncrement.mockResolvedValue({});
    mockCreateSession.mockResolvedValue({
      id: "s1",
      userId: "u1",
      title: "T",
      knowledgeSubjectId: null,
      model: "flash",
    });
    mockGetRecent.mockResolvedValue([]);
    mockCreateMessage.mockResolvedValue({ id: "m1" });
    mockChatCompletion.mockResolvedValue({
      content: "Olá!",
      model: "flash",
      tokensIn: 10,
      tokensOut: 5,
    });
  });

  it("consulta o Billing (entitlement) antes de chamar a IA — plano gratuito", async () => {
    const out = await buildProfessor().ask({
      message: "Explique o que é a Constituição.",
      userId: "u1",
    });
    expect(out.mode).toBe("chat");
    expect(out.answer).toBe("Olá!");
    // Sem assinatura → entitlement resolve o plano gratuito pelo código.
    expect(mockFindActiveSub).toHaveBeenCalledWith("u1");
    expect(mockFindPlanByCode).toHaveBeenCalledWith("free");
  });

  it("plano gratuito com quota atingida → LIMIT_EXCEEDED (Professor não chama IA)", async () => {
    mockFindUsage.mockResolvedValue({
      messagesCount: 50, // == maxMessages do free
      tokensIn: 0,
      tokensOut: 0,
    });
    await expect(
      buildProfessor().ask({ message: "Oi", userId: "u1" })
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });

  it("assinatura Pro ativa com 50 mensagens → NÃO excede (limite do Pro = 500)", async () => {
    mockFindActiveSub.mockResolvedValue(ACTIVE_SUB);
    mockFindPlanById.mockResolvedValue(PRO_PLAN);
    mockFindUsage.mockResolvedValue({
      messagesCount: 50,
      tokensIn: 0,
      tokensOut: 0,
    });
    const out = await buildProfessor().ask({
      message: "Oi",
      userId: "u1",
    });
    expect(out.mode).toBe("chat");
    expect(mockChatCompletion).toHaveBeenCalledTimes(1);
  });

  it("Billing tem precedência sobre o limite padrão injetado", async () => {
    const professor = new ProfessorService({
      rag: new RagService({
        search: HybridSearchService,
        prompt: PromptService,
        provider: DeepSeekProvider,
        router: ModelRouterService,
      }),
      chat: ChatService,
      usage: UsageService,
      router: ModelRouterService,
      resolveIntent: defaultResolveIntent,
      billing: EntitlementService,
      limit: { maxMessages: 0, maxTokens: 0 }, // ignorado: billing vence
    });
    const out = await professor.ask({ message: "Oi", userId: "u1" });
    expect(out.answer).toBe("Olá!");
  });

  it("AI continua responsável por registrar ai_usage (não duplica o Billing)", async () => {
    await buildProfessor().ask({ message: "Oi", userId: "u1" });
    // ChatService registra uso via UsageRepository (IA).
    expect(mockIncrement).toHaveBeenCalledTimes(1);
  });

  it("fluxo completo responde e retorna métricas", async () => {
    const out = await buildProfessor().ask({ message: "Oi", userId: "u1" });
    expect(out.tokens).toEqual({ in: 10, out: 5, total: 15 });
    expect(out.costBRL).toBeGreaterThanOrEqual(0);
    expect(out.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
