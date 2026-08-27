/**
 * Testes do AdminFinanceRepository — resumo financeiro, assinaturas e pagamentos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();

vi.mock("@/lib/db/drizzle", () => ({
  db: { select: (...a: unknown[]) => mockSelect(...a) },
}));

import { AdminFinanceRepository } from "../admin-finance.repository";

/**
 * Constrói um mock de query Drizzle encadeado (select → from → joins → where
 * → orderBy → limit). Cada elo é thenable (resolve para `result`), porque as
 * queries são aguardadas com Promise.all no repositório.
 */
function makeQuery(result: unknown[]) {
  const chain = (steps: Record<string, unknown>) =>
    Object.assign(Promise.resolve(result), steps);

  const limitMock = vi.fn().mockReturnValue(chain({}));
  const orderByMock = vi.fn().mockReturnValue(chain({ limit: limitMock }));
  const whereMock = vi.fn().mockReturnValue(chain({ orderBy: orderByMock }));
  const innerJoinMock = vi
    .fn()
    .mockImplementation(() => chain({ innerJoin: innerJoinMock, where: whereMock }));
  const fromMock = vi.fn().mockReturnValue(
    chain({ innerJoin: innerJoinMock, where: whereMock, orderBy: orderByMock, limit: limitMock })
  );
  return { from: fromMock };
}

function setupSelects(queries: unknown[]) {
  mockSelect.mockReset();
  queries.forEach((q) => mockSelect.mockReturnValueOnce(q));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminFinanceRepository.summary", () => {
  it("retorna zeros quando não há dados", async () => {
    // 7 queries: mrr, receita, ativas, past_due, pendentes, churn, novos
    const queries = Array.from({ length: 7 }, () => makeQuery([{ total: null, n: 0 }]));
    setupSelects(queries);

    const s = await AdminFinanceRepository.summary();

    expect(s.mrrCents).toBe(0);
    expect(s.monthRevenueCents).toBe(0);
    expect(s.activeSubscriptions).toBe(0);
    expect(s.pastDueSubscriptions).toBe(0);
    expect(s.pendingPaymentsMonth).toBe(0);
    expect(s.churnMonth).toBe(0);
    expect(s.newPaymentsMonth).toBe(0);
  });

  it("calcula MRR e receita do mês", async () => {
    const queries = Array.from({ length: 7 }, () => makeQuery([{ total: null, n: 0 }]));
    queries[0] = makeQuery([{ total: 4990 }]); // MRR
    queries[1] = makeQuery([{ total: 12990 }]); // receita do mês
    setupSelects(queries);

    const s = await AdminFinanceRepository.summary();

    expect(s.mrrCents).toBe(4990);
    expect(s.monthRevenueCents).toBe(12990);
  });

  it("conta assinaturas ativas, past_due, pendentes, churn e novos pagamentos", async () => {
    const queries = Array.from({ length: 7 }, () => makeQuery([{ total: null, n: 0 }]));
    queries[2] = makeQuery([{ n: 5 }]); // ativas
    queries[3] = makeQuery([{ n: 1 }]); // past_due
    queries[4] = makeQuery([{ n: 3 }]); // pendentes
    queries[5] = makeQuery([{ n: 2 }]); // churn
    queries[6] = makeQuery([{ n: 4 }]); // novos pagamentos
    setupSelects(queries);

    const s = await AdminFinanceRepository.summary();

    expect(s.activeSubscriptions).toBe(5);
    expect(s.pastDueSubscriptions).toBe(1);
    expect(s.pendingPaymentsMonth).toBe(3);
    expect(s.churnMonth).toBe(2);
    expect(s.newPaymentsMonth).toBe(4);
  });
});

describe("AdminFinanceRepository.listSubscriptions", () => {
  it("lista assinaturas com aluno e plano", async () => {
    const rows = [
      {
        id: "sub-1",
        userId: "u-1",
        status: "active",
        preapprovalId: "pp-1",
        startsAt: new Date("2026-08-01"),
        endsAt: new Date("2026-09-01"),
        createdAt: new Date("2026-08-01"),
        updatedAt: new Date("2026-08-01"),
        userEmail: "a@b.com",
        planName: "Pro",
        planCode: "pro",
        priceCents: 4990,
      },
    ];
    const q = makeQuery(rows);
    setupSelects([q]);

    const result = await AdminFinanceRepository.listSubscriptions({ status: "active" });

    expect(result).toHaveLength(1);
    expect(result[0].userEmail).toBe("a@b.com");
    expect(result[0].planName).toBe("Pro");
  });
});

describe("AdminFinanceRepository.listPayments", () => {
  it("lista pagamentos com aluno", async () => {
    const rows = [
      {
        id: "pay-1",
        userId: "u-1",
        subscriptionId: "sub-1",
        provider: "mercadopago",
        providerId: "mp-1",
        amountCents: 4990,
        currency: "BRL",
        status: "approved",
        externalReference: "plano:u-1",
        paidAt: new Date("2026-08-01"),
        createdAt: new Date("2026-08-01"),
        userEmail: "a@b.com",
      },
    ];
    const q = makeQuery(rows);
    setupSelects([q]);

    const result = await AdminFinanceRepository.listPayments({ status: "approved", userId: "u-1" });

    expect(result).toHaveLength(1);
    expect(result[0].amountCents).toBe(4990);
    expect(result[0].userEmail).toBe("a@b.com");
  });
});
