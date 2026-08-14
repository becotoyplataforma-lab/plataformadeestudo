import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetLimits = vi.fn();

vi.mock("../entitlement.service", () => ({
  EntitlementService: {
    getLimits: (...args: unknown[]) => mockGetLimits(...args),
  },
}));

import { resolveUserLimits } from "../limits.resolver";
import { DEFAULT_FREE_LIMITS } from "../../types";

describe("resolveUserLimits (Billing)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna os limites do plano pago quando o usuário tem assinatura", async () => {
    mockGetLimits.mockResolvedValue({
      maxMessages: 500,
      maxTokens: 1_000_000,
      maxQuestionsPerDay: 200,
      maxDocuments: 20,
      allowPro: true,
    });

    const limits = await resolveUserLimits("u1");

    expect(mockGetLimits).toHaveBeenCalledWith("u1");
    expect(limits).toMatchObject({
      maxMessages: 500,
      maxTokens: 1_000_000,
      maxQuestionsPerDay: 200,
      maxDocuments: 20,
      allowPro: true,
    });
  });

  it("retorna DEFAULT_FREE_LIMITS quando o usuário não tem assinatura", async () => {
    mockGetLimits.mockResolvedValue(DEFAULT_FREE_LIMITS);

    const limits = await resolveUserLimits("u1");

    expect(limits.maxMessages).toBe(50);
    expect(limits.maxTokens).toBe(100_000);
    expect(limits.allowPro).toBe(false);
  });

  it("usa DEFAULT_FREE_LIMITS como fallback em erro de resolução", async () => {
    mockGetLimits.mockRejectedValue(new Error("billing indisponível"));

    const limits = await resolveUserLimits("u1");

    expect(limits).toEqual(DEFAULT_FREE_LIMITS);
  });
});
