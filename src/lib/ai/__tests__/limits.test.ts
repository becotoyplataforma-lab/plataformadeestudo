import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAiUsage, registerUsage } from "@/lib/ai/limits";
import type { PlanLimits } from "@/lib/billing/types";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/db/drizzle", () => ({
  db: { select: mocks.select, insert: mocks.insert },
}));

// Limites do plano gratuito (Billing) — injetados, nunca decididos pelo módulo.
const FREE_LIMITS: PlanLimits = {
  maxMessages: 50,
  maxTokens: 100_000,
  maxQuestionsPerDay: 20,
  maxDocuments: 3,
  allowPro: false,
};

describe("ai/limits (Drizzle)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAiUsage retorna zeros quando não há uso no dia", async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });

    const usage = await getAiUsage("user-1", FREE_LIMITS);

    expect(usage).toMatchObject({
      usedMessages: 0,
      usedTokens: 0,
      maxMessages: 50,
      maxTokens: 100_000,
      remainingMessages: 50,
      canSend: true,
    });
  });

  it("getAiUsage lê o uso do dia", async () => {
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [
            { messagesCount: 3, tokensIn: 10, tokensOut: 20 },
          ],
        }),
      }),
    });

    const usage = await getAiUsage("user-1", FREE_LIMITS);

    expect(usage.usedMessages).toBe(3);
    expect(usage.usedTokens).toBe(30);
    expect(usage.remainingMessages).toBe(50 - 3);
    expect(usage.canSend).toBe(true);
  });

  it("bloqueia quando o uso atinge o limite de mensagens", async () => {
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{ messagesCount: 50, tokensIn: 0, tokensOut: 0 }],
        }),
      }),
    });

    const usage = await getAiUsage("user-1", FREE_LIMITS);

    expect(usage.remainingMessages).toBe(0);
    expect(usage.canSend).toBe(false);
  });

  it("limites maiores injetados liberam uso que o fallback bloquearia", async () => {
    mocks.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: async () => [{ messagesCount: 60, tokensIn: 0, tokensOut: 0 }],
        }),
      }),
    });

    const proLimits: PlanLimits = {
      maxMessages: 500,
      maxTokens: 1_000_000,
      allowPro: true,
    };
    const usage = await getAiUsage("user-1", proLimits);

    expect(usage.maxMessages).toBe(500);
    expect(usage.remainingMessages).toBe(500 - 60);
    expect(usage.canSend).toBe(true);
  });

  it("registerUsage faz upsert com mensagem inicial e incrementos", async () => {
    let values: unknown;
    let target: unknown;
    let set: unknown;

    mocks.insert.mockReturnValue({
      values: (v: unknown) => ({
        onConflictDoUpdate: (opts: { target: unknown; set: unknown }) => {
          values = v;
          target = opts.target;
          set = opts.set;
          return Promise.resolve();
        },
      }),
    });

    await registerUsage("user-1", 10, 20);

    expect(values).toMatchObject({
      userId: "user-1",
      messagesCount: 1,
      tokensIn: 10,
      tokensOut: 20,
    });
    // target único (user_id, usage_date) — permite incremento por dia
    expect(target).toBeTruthy();
    expect(set).toBeTruthy();
  });
});
