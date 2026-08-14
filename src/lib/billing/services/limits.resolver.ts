import "server-only";
import { EntitlementService } from "./entitlement.service";
import { DEFAULT_FREE_LIMITS, type PlanLimits } from "../types";

/**
 * Resolve os limites de IA do usuário (fronteira Billing — OPEN-004).
 *
 * - Usuário com assinatura/plano válido → limites do plano.
 * - Sem assinatura / plano indisponível / erro → DEFAULT_FREE_LIMITS (fallback
 *   seguro: o fluxo de IA nunca deve quebrar por falha na resolução de limites).
 *
 * Nenhuma lógica de banco aqui: reutiliza EntitlementService (que já abstrai
 * PlanRepository/SubscriptionRepository).
 */
export async function resolveUserLimits(userId: string): Promise<PlanLimits> {
  try {
    const limits = await EntitlementService.getLimits(userId);
    return {
      maxMessages: limits.maxMessages,
      maxTokens: limits.maxTokens,
      maxQuestionsPerDay: limits.maxQuestionsPerDay,
      maxDocuments: limits.maxDocuments,
      allowPro: limits.allowPro ?? false,
    };
  } catch (error) {
    console.error(
      "[billing/limits] Falha ao resolver limites; usando fallback gratuito:",
      error
    );
    return DEFAULT_FREE_LIMITS;
  }
}
