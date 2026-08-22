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
  /** ID da Preapproval (assinatura recorrente) no Mercado Pago. */
  preapprovalId?: string | null;
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
      preapprovalId: opts.preapprovalId ?? null,
    });
    return row;
  },

  /**
   * Renova uma assinatura recorrente (novo ciclo pago).
   * Estende endsAt em +1 mês a partir do fim atual (ou de agora se sem fim).
   * Não cria nova assinatura — mantém o mesmo registro e o preapproval_id.
   */
  async renew(userId: string, planCode: string, opts: ActivateOptions = {}) {
    const plan = await PlanRepository.findByCode(planCode);
    if (!plan) {
      throw new SubscriptionError("PLAN_NOT_FOUND", `Plano não encontrado: ${planCode}`);
    }

    const active = await SubscriptionRepository.findActiveByUser(userId);
    if (active) {
      // Estende o ciclo atual em +1 mês.
      const base = active.endsAt && active.endsAt > new Date() ? active.endsAt : new Date();
      const nextEnd = new Date(base);
      nextEnd.setMonth(nextEnd.getMonth() + 1);
      return SubscriptionRepository.update(active.id, {
        status: "active",
        endsAt: nextEnd,
        preapprovalId: opts.preapprovalId ?? active.preapprovalId,
      });
    }

    // Sem assinatura ativa → cria nova.
    return this.activate(userId, planCode, opts);
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
