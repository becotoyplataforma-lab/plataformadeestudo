import "server-only";
import { EntitlementService } from "./entitlement.service";
import type { Plan } from "@/types";

/**
 * Resolve o plano efetivo do usuário (fronteira Billing — OPEN-004).
 *
 * - Assinatura/plano válido → plano do usuário (free/pro/intensivo).
 * - Sem assinatura ou erro → "free" (fallback seguro).
 *
 * Substitui a leitura de `profiles.plano` (legado, sem coluna real) pela
 * cadeia: plans → subscriptions → EntitlementService.
 */
export async function resolveUserPlan(userId: string): Promise<Plan> {
  try {
    const entitlement = await EntitlementService.getCurrent(userId);
    const code = entitlement.planCode;
    return code === "free" || code === "pro" || code === "intensivo"
      ? code
      : "free";
  } catch (error) {
    console.error(
      "[billing/plan] Falha ao resolver plano; usando free:",
      error
    );
    return "free";
  }
}
