/**
 * ConcursoAI — Billing — Teste de contrato da fonte de verdade (FASE 3C-1 P0-B).
 *
 * Valida o contrato mínimo de `public.plans` via PlanRepository (READ-ONLY):
 * - 3 planos ativos: free, pro, intensivo (sem enterprise, sem seed, sem correção).
 * - Limites oficiais + preços oficiais.
 *
 * - Se DATABASE_URL ausente → suite SKIPPED (limitação documentada, sem inventar
 *   infra). A validação real ocorre em ambiente integrado com banco.
 * - NUNCA executa seed/migration/INSERT/UPDATE/DELETE.
 * - Deve FALHAR se free=50, se houver enterprise, ou se faltar plano.
 */
import { describe, it, expect } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("plans contract (public.plans via PlanRepository)", () => {
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
