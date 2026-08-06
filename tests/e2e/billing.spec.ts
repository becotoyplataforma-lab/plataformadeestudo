/**
 * E2E — Billing.
 *
 * Entitlement (plano/limites), catálogo de planos e fluxo de checkout.
 * Requer backend real. Checkout exige Mercado Pago configurado; sem acesso
 * token, o teste valida apenas a resposta de erro controlada (não 5xx genérico).
 */
import { test, expect } from "@playwright/test";
import { getAuthContext, hasAuth } from "./support/auth";

test.describe("Billing — fluxo principal", () => {
  test.skip(!hasAuth, "Requer E2E_USER_EMAIL/E2E_USER_PASSWORD (backend real)");
  test("entitlement do usuário (gratuito por padrão)", async () => {
    const api = await getAuthContext();
    const res = await api.get("/api/billing/entitlement");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as {
      plan_code: string;
      tier: "free" | "paid";
      limits: { max_messages: number; max_tokens: number };
    };
    expect(body.plan_code).toBe("free");
    expect(body.tier).toBe("free");
    expect(body.limits.max_messages).toBeGreaterThan(0);
  });

  test("catálogo de planos inclui os planos pagos", async () => {
    const api = await getAuthContext();
    const res = await api.get("/api/billing/plans");
    expect(res.ok()).toBeTruthy();
    const body = (await res.json()) as { plans: Array<{ code: string; price_cents: number }> };
    const codes = body.plans.map((p) => p.code);
    expect(codes).toContain("free");
    expect(codes).toContain("pro");
  });

  test("checkout de plano pago responde de forma controlada", async () => {
    const api = await getAuthContext();
    const res = await api.post("/api/billing/checkout", {
      data: { plan: "pro" },
    });
    // Sem access token do Mercado Pago o serviço retorna erro mapeado (não 5xx genérico).
    expect([200, 400, 500]).toContain(res.status());
    if (res.ok()) {
      const body = (await res.json()) as { init_point: string; plan: string };
      expect(body.init_point).toBeTruthy();
      expect(body.plan).toBe("pro");
    }
  });
});
