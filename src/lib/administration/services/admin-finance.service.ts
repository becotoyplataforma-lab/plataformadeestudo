/**
 * ConcursoAI — AdminFinanceService (Administration)
 *
 * Operações do módulo financeiro do admin (docs/22 §3.1):
 * - Listar assinaturas e pagamentos (com filtros) — somente leitura.
 * - Mutar assinatura (cancelar / suspender / reativar) com auditoria em
 *   admin_action_logs (mesmo padrão de AdminManagementService).
 *
 * Garantia de negócio: as mutações mantêm o EntitlementService coerente —
 * assinatura `cancelled`/`suspended` não é mais considerada ativa
 * (SubscriptionRepository.findActiveByUser filtra por status = active),
 * portanto o usuário volta ao plano gratuito imediatamente.
 */
import "server-only";
import { SubscriptionRepository } from "@/lib/billing/repositories/subscription.repository";
import {
  AdminGuardService,
  type AdminSession,
} from "./admin-guard.service";
import { AuditService } from "./audit.service";
import { AdminFinanceRepository } from "../repositories/admin-finance.repository";
import type { SubscriptionStatus, PaymentStatus } from "@/lib/billing/types";

export class AdminFinanceError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "AdminFinanceError";
    this.code = code;
  }
}

export const AdminFinanceService = {
  // ============================================================
  // LEITURA
  // ============================================================

  /** KPIs financeiros (somente admin). */
  async summary(admin: AdminSession) {
    await AdminGuardService.requireAdmin(admin);
    return AdminFinanceRepository.summary();
  },

  /** Lista de assinaturas com filtros (somente admin). */
  async listSubscriptions(
    admin: AdminSession,
    filters: { status?: string; planId?: string; limit?: number } = {}
  ) {
    await AdminGuardService.requireAdmin(admin);
    const status = normalizeSubscriptionStatus(filters.status);
    return AdminFinanceRepository.listSubscriptions({
      status,
      planId: filters.planId,
      limit: clampLimit(filters.limit),
    });
  },

  /** Lista de pagamentos com filtros (somente admin). */
  async listPayments(
    admin: AdminSession,
    filters: { status?: string; from?: string; to?: string; userId?: string; limit?: number } = {}
  ) {
    await AdminGuardService.requireAdmin(admin);
    const status = normalizePaymentStatus(filters.status);
    return AdminFinanceRepository.listPayments({
      status,
      from: filters.from,
      to: filters.to,
      userId: filters.userId,
      limit: clampLimit(filters.limit),
    });
  },

  // ============================================================
  // MUTAÇÃO (assinatura)
  // ============================================================

  /**
   * Cancela uma assinatura.
   * - status → `cancelled` e ends_at = agora (mesma semântica de
   *   SubscriptionService.cancel).
   * - Usuário volta a ser tratado como free pelo EntitlementService.
   */
  async cancelSubscription(admin: AdminSession, subscriptionId: string) {
    await AdminGuardService.requireAdmin(admin);
    const sub = await this.findOrThrow(subscriptionId);
    if (sub.status !== "active" && sub.status !== "past_due") {
      throw new AdminFinanceError(
        "INVALID_STATUS",
        `Não é possível cancelar uma assinatura com status "${sub.status}".`
      );
    }
    const row = await SubscriptionRepository.update(subscriptionId, {
      status: "cancelled",
      endsAt: new Date(),
    });
    await AuditService.record({
      adminId: admin.userId,
      action: "finance.subscription.cancel",
      entityType: "subscription",
      entityId: subscriptionId,
      details: { userId: sub.userId, previousStatus: sub.status },
      ip: admin.ip,
    });
    return row;
  },

  /** Suspende uma assinatura (mantém datas, remove acesso). */
  async suspendSubscription(admin: AdminSession, subscriptionId: string) {
    await AdminGuardService.requireAdmin(admin);
    const sub = await this.findOrThrow(subscriptionId);
    if (sub.status !== "active") {
      throw new AdminFinanceError(
        "INVALID_STATUS",
        `Não é possível suspender uma assinatura com status "${sub.status}".`
      );
    }
    const row = await SubscriptionRepository.update(subscriptionId, {
      status: "suspended",
    });
    await AuditService.record({
      adminId: admin.userId,
      action: "finance.subscription.suspend",
      entityType: "subscription",
      entityId: subscriptionId,
      details: { userId: sub.userId, previousStatus: sub.status },
      ip: admin.ip,
    });
    return row;
  },

  /** Reativa uma assinatura suspensa/cancelada (restaura acesso). */
  async reactivateSubscription(admin: AdminSession, subscriptionId: string) {
    await AdminGuardService.requireAdmin(admin);
    const sub = await this.findOrThrow(subscriptionId);
    if (sub.status !== "suspended" && sub.status !== "cancelled") {
      throw new AdminFinanceError(
        "INVALID_STATUS",
        `Não é possível reativar uma assinatura com status "${sub.status}".`
      );
    }
    const row = await SubscriptionRepository.update(subscriptionId, {
      status: "active",
      // Mantém ends_at original (ou estende 1 mês a partir de agora se expirada).
      endsAt:
        sub.endsAt && sub.endsAt > new Date()
          ? sub.endsAt
          : addOneMonth(sub.endsAt ?? new Date()),
    });
    await AuditService.record({
      adminId: admin.userId,
      action: "finance.subscription.reactivate",
      entityType: "subscription",
      entityId: subscriptionId,
      details: { userId: sub.userId, previousStatus: sub.status },
      ip: admin.ip,
    });
    return row;
  },

  // ============================================================
  // HELPERS
  // ============================================================

  /** Busca assinatura por ID (não deletada) ou lança NOT_FOUND. */
  async findOrThrow(id: string) {
    const sub = await SubscriptionRepository.findById(id);
    if (!sub) {
      throw new AdminFinanceError("NOT_FOUND", "Assinatura não encontrada.");
    }
    return sub;
  },
};

// --- Helpers de normalização (evitam erros de tipo em filtros) ---

const SUBSCRIPTION_STATUSES: SubscriptionStatus[] = [
  "active",
  "cancelled",
  "expired",
  "past_due",
  "suspended",
];

const PAYMENT_STATUSES: PaymentStatus[] = [
  "pending",
  "approved",
  "rejected",
  "cancelled",
  "refunded",
];

function normalizeSubscriptionStatus(value?: string): SubscriptionStatus | undefined {
  if (!value) return undefined;
  return SUBSCRIPTION_STATUSES.includes(value as SubscriptionStatus)
    ? (value as SubscriptionStatus)
    : undefined;
}

function normalizePaymentStatus(value?: string): PaymentStatus | undefined {
  if (!value) return undefined;
  return PAYMENT_STATUSES.includes(value as PaymentStatus)
    ? (value as PaymentStatus)
    : undefined;
}

function clampLimit(limit?: number): number | undefined {
  if (!limit || Number.isNaN(limit)) return undefined;
  return Math.min(500, Math.max(1, Math.floor(limit)));
}

function addOneMonth(base: Date): Date {
  const d = new Date(base);
  d.setMonth(d.getMonth() + 1);
  return d;
}
