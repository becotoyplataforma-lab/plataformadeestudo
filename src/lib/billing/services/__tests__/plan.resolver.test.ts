import { describe, expect, it, vi, beforeEach } from "vitest";

const mockGetCurrent = vi.fn();

vi.mock("../entitlement.service", () => ({
  EntitlementService: {
    getCurrent: (...args: unknown[]) => mockGetCurrent(...args),
  },
}));

import { resolveUserPlan } from "../plan.resolver";

describe("resolveUserPlan (Billing)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("retorna o plano do usuário com assinatura", async () => {
    mockGetCurrent.mockResolvedValue({ planCode: "pro" });
    const plan = await resolveUserPlan("u1");
    expect(mockGetCurrent).toHaveBeenCalledWith("u1");
    expect(plan).toBe("pro");
  });

  it("retorna intensivo quando a assinatura é intensivo", async () => {
    mockGetCurrent.mockResolvedValue({ planCode: "intensivo" });
    const plan = await resolveUserPlan("u1");
    expect(plan).toBe("intensivo");
  });

  it("retorna free quando não há assinatura", async () => {
    mockGetCurrent.mockResolvedValue({ planCode: "free" });
    const plan = await resolveUserPlan("u1");
    expect(plan).toBe("free");
  });

  it("usa free como fallback em erro de resolução", async () => {
    mockGetCurrent.mockRejectedValue(new Error("billing indisponível"));
    const plan = await resolveUserPlan("u1");
    expect(plan).toBe("free");
  });
});
