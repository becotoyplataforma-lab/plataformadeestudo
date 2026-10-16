/**
 * ConcursoAI - Billing - Teste de contrato da fonte de verdade (FASE 3C-1 P0-B).
 *
 * Valida o contrato minimo de public.plans via PlanRepository (READ-ONLY):
 * - 3 planos ativos: free, pro, intensivo (sem enterprise, sem seed, sem correcao).
 * - Limites oficiais + precos oficiais.
 *
 * Gate de banco (FASE 1 - blindar a suite contra o banco de producao):
 * - A suite so roda quando o guard de src/lib/db/env-guard.ts PROVA que DATABASE_URL e
 *   um banco de teste (host local, ref em SAFE_TEST_DATABASE_REFS ou nome de banco
 *   claramente de teste). Mesmo padrao de hasDb em src/integration/helpers.ts.
 * - URL ausente, invalida ou de producao: suite IGNORADA com justificativa log-safe,
 *   sem nenhuma tentativa de conexao.
 * - O gate antigo era Boolean(process.env.DATABASE_URL): qualquer URL, inclusive a
 *   de producao, liberava os SELECTs. Substituido de proposito.
 * - NUNCA executa seed/migration/INSERT/UPDATE/DELETE.
 * - Deve FALHAR se free=50, se houver enterprise, ou se faltar plano.
 */
import { beforeAll, describe, expect, it } from "vitest";

import {
  assertNonProductionDatabaseUrl,
  resolveDatabaseTestGate,
} from "@/lib/db/env-guard";

const GATE_TARGET = "plans-contract";

/**
 * Decidido na coleta, antes de qualquer import de repositorio. O cliente Drizzle e
 * lazy (src/lib/db/drizzle.ts): sem gate aprovado nada acesso a db e feito, entao
 * nenhuma conexao e tentada nem para testar o gate.
 */
const gate = resolveDatabaseTestGate(GATE_TARGET, process.env.DATABASE_URL);
const hasDb = gate.enabled;

if (!hasDb) {
  // Justificativa explicita do skip: alvo, host, database, ref, prodRef e motivo.
  // Nunca senha, token, service-role nem a string de conexao completa.
  console.info("[" + GATE_TARGET + "] suite de banco ignorada: " + gate.summary);
}

describe.skipIf(!hasDb)("plans contract (public.plans via PlanRepository)", () => {
  /**
   * Revalidacao em tempo de execucao: se o ambiente mudou entre a coleta e o
   * teste, o guard bloqueia antes do primeiro SELECT em vez de consultar destino
   * nao aprovado.
   */
  beforeAll(() => {
    assertNonProductionDatabaseUrl(GATE_TARGET);
  });

  it("possui exatamente free/pro/intensivo ativos", async () => {
    const { PlanRepository } = await import("../plan.repository");
    const rows = await PlanRepository.listActive();
    const codes = rows.map((r) => r.code).sort();
    expect(codes).toEqual(["free", "intensivo", "pro"]);
    expect(rows).toHaveLength(3);
  });

  it("limites oficiais (maxMessages/maxTokens)", async () => {
    const { PlanRepository } = await import("../plan.repository");
    const { normalizeLimits } = await import("../../types");
    const rows = await PlanRepository.listActive();
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));

    expect(normalizeLimits(byCode.free.limits).maxMessages).toBe(5);
    expect(normalizeLimits(byCode.free.limits).maxTokens).toBe(100000);
    expect(normalizeLimits(byCode.pro.limits).maxMessages).toBe(500);
    expect(normalizeLimits(byCode.pro.limits).maxTokens).toBe(1000000);
    expect(normalizeLimits(byCode.intensivo.limits).maxMessages).toBe(2000);
    expect(normalizeLimits(byCode.intensivo.limits).maxTokens).toBe(5000000);
  });

  it("limites restantes (questions/documents/allowPro)", async () => {
    const { PlanRepository } = await import("../plan.repository");
    const { normalizeLimits } = await import("../../types");
    const rows = await PlanRepository.listActive();
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));

    const free = normalizeLimits(byCode.free.limits);
    expect(free.maxQuestionsPerDay).toBe(20);
    expect(free.maxDocuments).toBe(3);
    expect(free.allowPro).toBe(false);

    const pro = normalizeLimits(byCode.pro.limits);
    expect(pro.maxQuestionsPerDay).toBe(200);
    expect(pro.maxDocuments).toBe(20);
    expect(pro.allowPro).toBe(true);

    const intensivo = normalizeLimits(byCode.intensivo.limits);
    expect(intensivo.maxQuestionsPerDay).toBe(1000);
    expect(intensivo.maxDocuments).toBe(100);
    expect(intensivo.allowPro).toBe(true);
  });

  it("preços oficiais (cents + promo)", async () => {
    const { PlanRepository } = await import("../plan.repository");
    const rows = await PlanRepository.listActive();
    const byCode = Object.fromEntries(rows.map((r) => [r.code, r]));

    expect(byCode.free.priceCents).toBe(0);
    expect(byCode.pro.priceCents).toBe(1990);
    expect(byCode.pro.promoPriceCents).toBe(990);
    expect(byCode.intensivo.priceCents).toBe(4990);
  });
});
