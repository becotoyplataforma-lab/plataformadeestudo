import { describe, expect, it, vi, beforeEach } from "vitest";
import { getAiUsage, registerUsage } from "@/lib/ai/limits";

const mocks = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
}));

vi.mock("@/lib/db/drizzle", () => ({
  db: { select: mocks.select, insert: mocks.insert },
}));

describe("ai/limits (Drizzle)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("getAiUsage retorna zeros quando não há uso no dia", async () => {
    mocks.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => [] }) }),
    });

    const usage = await getAiUsage("user-1");

    expect(usage).toMatchObject({
      usedMessages: 0,
      usedTokens: 0,
      maxMessages: 100_000,
      remainingMessages: 100_000,
      canSend: true,
      plan: "free",
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

    const usage = await getAiUsage("user-1");

    expect(usage.usedMessages).toBe(3);
    expect(usage.usedTokens).toBe(30);
    expect(usage.remainingMessages).toBe(100_000 - 3);
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
