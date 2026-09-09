/**
 * ConcursoAI — EntitlementService (Billing)
 *
 * Resolve o entitlement do usuário: plano atual (assinatura ativa ou gratuito),
 * limites (quota) e permissão de modelo.
 *
 * OPEN-004: Billing é dono dos limites. O Professor IA consulta este serviço
 * ANTES de chamar a IA; a IA continua registrando ai_usage.
 */
import "server-only";
import { PlanRepository } from "../repositories/plan.repository";
import { SubscriptionRepository } from "../repositories/subscription.repository";
import {
  DEFAULT_FREE_LIMITS,
  normalizeLimits,
  type CurrentEntitlement,
  type PlanLimits,
} from "../types";
import type { plans, subscriptions } from "@/db/schema/billing";
import type { AIModel } from "@/lib/ai/types";
import { logger } from "@/lib/observability";

type PlanRow = typeof plans.$inferSelect;
type SubscriptionRow = typeof subscriptions.$inferSelect;

function toEntitlement(
  sub: SubscriptionRow | null,
  plan: PlanRow | null,
  tier: "free" | "paid"
): CurrentEntitlement {
  return {
    planId: plan?.id ?? "",
    planCode: plan?.code ?? "free",
    planName: plan?.name ?? "Gratuito",
    priceCents: plan?.priceCents ?? 0,
    limits: normalizeLimits(plan?.limits ?? DEFAULT_FREE_LIMITS),
    tier,
    subscriptionId: sub?.id ?? null,
    subscriptionStatus: sub?.status ?? null,
    startsAt: sub?.startsAt ?? null,
    endsAt: sub?.endsAt ?? null,
  };
}

export const EntitlementService = {
  /**
   * Resolve o entitlement atual do usuário.
   * - Assinatura ativa (não expirada) → plano da assinatura.
   * - Sem assinatura / cancelada / expirada → plano gratuito.
   *
   * FASE 3C-1 (P0-A): fallback passa a ser observável via evento
   * PLAN_FALLBACK (logger estruturado `billing`, sem PII). O comportamento
   * funcional é preservado: erro → DEFAULT_FREE_LIMITS.
   * - Sem assinatura + free existente → caminho normal (sem log).
   * - Plano da assinatura ausente/inativo → PLAN_NOT_FOUND.
   * - Plano free ausente → FREE_PLAN_NOT_FOUND (usa DEFAULT_FREE_LIMITS).
   * normalizeLimits() de campo segue silenciosa (não é falha crítica).
   */
  async getCurrent(userId: string): Promise<CurrentEntitlement> {
    const sub = await SubscriptionRepository.findActiveByUser(userId);

    if (sub) {
      // Assinatura expirada (ends_at passado) → trata como gratuito.
      if (sub.endsAt && sub.endsAt.getTime() < Date.now()) {
        const free = await PlanRepository.findByCode("free");
        if (!free) {
          logger.warn("billing", "PLAN_FALLBACK", {
            event: "PLAN_FALLBACK",
            layer: "entitlement",
            reason: "FREE_PLAN_NOT_FOUND",
          });
        }
        return toEntitlement(null, free, "free");
      }
      const plan = await PlanRepository.findById(sub.planId);
      if (plan && plan.status === "active") {
        return toEntitlement(sub, plan, plan.priceCents > 0 ? "paid" : "free");
      }
      // Assinatura existe mas o plano não foi resolvido → fallback p/ free.
      logger.warn("billing", "PLAN_FALLBACK", {
        event: "PLAN_FALLBACK",
        layer: "entitlement",
        reason: "PLAN_NOT_FOUND",
      });
    }

    const free = await PlanRepository.findByCode("free");
    if (!free) {
      logger.warn("billing", "PLAN_FALLBACK", {
        event: "PLAN_FALLBACK",
        layer: "entitlement",
        reason: "FREE_PLAN_NOT_FOUND",
      });
    }
    return toEntitlement(null, free, "free");
  },

  /** Limites (quota) do plano do usuário. */
  async getLimits(userId: string): Promise<PlanLimits> {
    const entitlement = await this.getCurrent(userId);
    return entitlement.limits;
  },

  /** Verifica se o plano do usuário permite o modelo solicitado. */
  async canUseModel(userId: string, model: AIModel): Promise<boolean> {
    const entitlement = await this.getCurrent(userId);
    if (model === "flash" || model === "kimi") return true;
    return entitlement.limits.allowPro === true;
  },
};
