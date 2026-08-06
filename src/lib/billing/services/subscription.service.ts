/**
 * ConcursoAI — SubscriptionService (Billing)
 *
 * Gerencia o ciclo de vida da assinatura (ativa, cancela, consulta).
 * Uma assinatura ativa por usuário (índice parcial + cancelamento das ativas).
 */
import "server-only";
import { PlanRepository } from "../repositories/plan.repository";
import { SubscriptionRepository } from "../repositories/subscription.repository";

export class SubscriptionError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SubscriptionError";
    this.code = code;
  }
}

export interface ActivateOptions {
  startsAt?: Date;
  endsAt?: Date | null;
}

export const SubscriptionService = {
  /**
   * Ativa uma assinatura para o usuário.
   * Cancela as assinaturas ativas anteriores (uma ativa por usuário).
   */
  async activate(userId: string, planCode: string, opts: ActivateOptions = {}) {
    const plan = await PlanRepository.findByCode(planCode);
    if (!plan) {
      throw new SubscriptionError("PLAN_NOT_FOUND", `Plano não encontrado: ${planCode}`);
    }

    await SubscriptionRepository.cancelActiveByUser(userId);

    const row = await SubscriptionRepository.create({
      userId,
      planId: plan.id,
      status: "active",
      startsAt: opts.startsAt ?? new Date(),
      endsAt: opts.endsAt ?? null,
    });
    return row;
  },

  /** Cancela a assinatura ativa do usuário (se houver). */
  async cancel(userId: string) {
    const active = await SubscriptionRepository.findActiveByUser(userId);
    if (!active) return null;
    return SubscriptionRepository.update(active.id, {
      status: "cancelled",
      endsAt: new Date(),
    });
  },

  /** Assinatura ativa atual do usuário (sem plano). */
  async getCurrent(userId: string) {
    return SubscriptionRepository.findActiveByUser(userId);
  },
};
