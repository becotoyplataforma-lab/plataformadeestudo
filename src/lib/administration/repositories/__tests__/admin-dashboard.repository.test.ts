/**
 * Testes do AdminDashboardRepository.stats — contagens + KPIs financeiros.
 *
 * Verifica que os KPIs financeiros (MRR, receita do mês, assinaturas ativas,
 * inadimplência, churn, novos pagamentos) são calculados corretamente a partir
 * dos dados reais de subscriptions/payments/plans.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();

vi.mock("@/lib/db/drizzle", () => ({
  db: { select: (...a: unknown[]) => mockSelect(...a) },
}));

import { AdminDashboardRepository } from "../admin-dashboard.repository";

/** Constrói um mock de query Drizzle encadeado (select → from → where). */
function makeQuery(result: unknown[]) {
  const whereMock = vi.fn().mockResolvedValue(result);
  const innerJoinMock = vi.fn().mockReturnValue({ where: whereMock });
  // from retorna um objeto que é também uma Promise (para queries sem .where())
  const fromMock = vi.fn().mockReturnValue(
    Object.assign(Promise.resolve(result), {
      where: whereMock,
      innerJoin: innerJoinMock,
    })
  );
  return { from: fromMock };
}

/** Configura a sequência de selects na ordem em que o repositório os executa. */
function setupSelects(queries: unknown[]) {
  mockSelect.mockReset();
  queries.forEach((q) => mockSelect.mockReturnValueOnce(q));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("AdminDashboardRepository.stats", () => {
  it("retorna zeros quando não há dados", async () => {
    // 18 queries: 10 contagens + tokens + 7 KPIs financeiros
    const queries = Array.from({ length: 18 }, () => makeQuery([{ n: 0, total: null }]));
    setupSelects(queries);

    const stats = await AdminDashboardRepository.stats();

    expect(stats.totalUsers).toBe(0);
    expect(stats.mrrCents).toBe(0);
    expect(stats.monthRevenueCents).toBe(0);
    expect(stats.activeSubscriptions).toBe(0);
    expect(stats.pastDueSubscriptions).toBe(0);
    expect(stats.pendingPaymentsMonth).toBe(0);
    expect(stats.churnMonth).toBe(0);
    expect(stats.newPaymentsMonth).toBe(0);
    expect(stats.aiTokensTotal).toBe(0);
  });

  it("calcula MRR a partir do preço dos planos das assinaturas ativas", async () => {
    const queries = Array.from({ length: 18 }, () => makeQuery([{ n: 0, total: null }]));
    // MRR é a 12ª query (índice 11)
    queries[11] = makeQuery([{ total: 4990 }]); // R$ 49,90
    setupSelects(queries);

    const stats = await AdminDashboardRepository.stats();

    expect(stats.mrrCents).toBe(4990);
  });

  it("calcula receita do mês a partir dos pagamentos aprovados", async () => {
    const queries = Array.from({ length: 18 }, () => makeQuery([{ n: 0, total: null }]));
    // Receita do mês é a 13ª query (índice 12)
    queries[12] = makeQuery([{ total: 12990 }]); // R$ 129,90
    setupSelects(queries);

    const stats = await AdminDashboardRepository.stats();

    expect(stats.monthRevenueCents).toBe(12990);
  });

  it("conta assinaturas ativas", async () => {
    const queries = Array.from({ length: 18 }, () => makeQuery([{ n: 0, total: null }]));
    // Assinaturas ativas é a 14ª query (índice 13)
    queries[13] = makeQuery([{ n: 3 }]);
    setupSelects(queries);

    const stats = await AdminDashboardRepository.stats();

    expect(stats.activeSubscriptions).toBe(3);
  });

  it("soma inadimplência (past_due + pagamentos pendentes/rejeitados)", async () => {
    const queries = Array.from({ length: 18 }, () => makeQuery([{ n: 0, total: null }]));
    // past_due é a 15ª query (índice 14)
    queries[14] = makeQuery([{ n: 1 }]);
    // pagamentos pendentes/rejeitados é a 16ª query (índice 15)
    queries[15] = makeQuery([{ n: 2 }]);
    setupSelects(queries);

    const stats = await AdminDashboardRepository.stats();

    expect(stats.pastDueSubscriptions).toBe(1);
    expect(stats.pendingPaymentsMonth).toBe(2);
  });

  it("conta churn do mês (canceladas/expiradas)", async () => {
    const queries = Array.from({ length: 18 }, () => makeQuery([{ n: 0, total: null }]));
    // churn é a 17ª query (índice 16)
    queries[16] = makeQuery([{ n: 2 }]);
    setupSelects(queries);

    const stats = await AdminDashboardRepository.stats();

    expect(stats.churnMonth).toBe(2);
  });

  it("conta novos pagamentos aprovados no mês", async () => {
    const queries = Array.from({ length: 18 }, () => makeQuery([{ n: 0, total: null }]));
    // novos pagamentos é a 18ª query (índice 17)
    queries[17] = makeQuery([{ n: 4 }]);
    setupSelects(queries);

    const stats = await AdminDashboardRepository.stats();

    expect(stats.newPaymentsMonth).toBe(4);
  });

  it("soma tokens de IA (tokens_in + tokens_out)", async () => {
    const queries = Array.from({ length: 18 }, () => makeQuery([{ n: 0, total: null }]));
    // Tokens é a 11ª query (índice 10)
    queries[10] = makeQuery([{ total: 1500 }]);
    setupSelects(queries);

    const stats = await AdminDashboardRepository.stats();

    expect(stats.aiTokensTotal).toBe(1500);
  });
});
