/**
 * FASE 18 — Integração real: Professor IA ↔ Billing (OPEN-004) ↔ AI Usage.
 *
 * ProfessorService real + EntitlementService real (Billing) + UsageService real
 * contra o Postgres real. Única fronteira externa mockada: HTTP DeepSeek.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

const mockChatCompletion = vi.fn();
vi.mock("@/lib/ai/deepseek", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/deepseek")>();
  return {
    ...actual,
    chatCompletion: (...args: unknown[]) => mockChatCompletion(...args),
  };
});

import { ProfessorService, defaultResolveIntent } from "@/lib/ai/services/professor.service";
import { RagService } from "@/lib/ai/services/rag.service";
import { ChatService } from "@/lib/ai/services/chat.service";
import { PromptService } from "@/lib/ai/services/prompt.service";
import { DeepSeekProvider } from "@/lib/ai/services/deepseek-provider.service";
import { ModelRouterService } from "@/lib/ai/services/model-router.service";
import { UsageService } from "@/lib/ai/services/usage.service";
import { HybridSearchService } from "@/lib/knowledge/services/hybrid-search.service";
import { EntitlementService } from "@/lib/billing/services/entitlement.service";
import { UsageRepository } from "@/lib/ai/repositories/usage.repository";
import { hasDb, createTestUser, deleteTestUser, startOfDay } from "./helpers";

describe.skipIf(!hasDb)("Professor IA ↔ Billing — integração real", () => {
  const users: string[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    mockChatCompletion.mockResolvedValue({
      content: "Olá! Como posso ajudar?",
      model: "flash",
      tokensIn: 10,
      tokensOut: 5,
    });
  });

  afterAll(async () => {
    await Promise.all(users.map((id) => deleteTestUser(id)));
  });

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
      billing: EntitlementService, // Billing é dono dos limites (OPEN-004)
    });
  }

  it("fluxo chat real: consulta Billing (gratuito), chama IA e registra ai_usage", async () => {
    const userId = await createTestUser();
    users.push(userId);

    const out = await buildProfessor().ask({
      message: "Explique o que é a Constituição.",
      userId,
    });

    expect(out.mode).toBe("chat");
    expect(out.answer).toBe("Olá! Como posso ajudar?");
    expect(mockChatCompletion).toHaveBeenCalledTimes(1);

    const usage = await UsageRepository.findByUserAndDay(userId, startOfDay());
    expect(usage?.messagesCount).toBe(1);
    expect(usage?.tokensIn).toBe(10);
  });

  it("limite gratuito atingido → LIMIT_EXCEEDED sem chamar a IA", async () => {
    const userId = await createTestUser();
    users.push(userId);
    // Plano gratuito (sem assinatura) → maxMessages = 50 (default).
    await UsageRepository.increment(userId, startOfDay(), 0, 0);
    for (let i = 1; i < 50; i++) {
      await UsageRepository.increment(userId, startOfDay(), 1, 1);
    }

    await expect(
      buildProfessor().ask({ message: "Oi", userId })
    ).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
    expect(mockChatCompletion).not.toHaveBeenCalled();
  });
});
