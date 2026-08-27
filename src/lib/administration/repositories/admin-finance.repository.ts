/**
 * ConcursoAI — AdminFinanceRepository (Administration)
 *
 * Queries do módulo financeiro do admin (docs/22 §3.1):
 * - summary: KPIs financeiros (MRR, receita do mês, inadimplência, churn...)
 * - assinaturas: lista com filtros (status, plano) + join de aluno/plano
 * - pagamentos: lista com filtros (status, período, user_id) + join de aluno
 *
 * Reutiliza a mesma lógica de cálculo do AdminDashboardRepository (MRR,
 * receita do mês) para manter os números consistentes entre /admin e
 * /admin/financeiro.
 */
import { and, desc, eq, gte, inArray, isNull, or, sql, sum } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { authUsers } from "@/db/schema/identity";
import { subscriptions, payments, plans } from "@/db/schema/billing";
import type { SubscriptionStatus, PaymentStatus } from "@/lib/billing/types";

/** Início do mês corrente (UTC) — espelha AdminDashboardRepository. */
function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export interface AdminFinanceSummary {
  mrrCents: number;
  monthRevenueCents: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  pendingPaymentsMonth: number;
  churnMonth: number;
  newPaymentsMonth: number;
}

export interface SubscriptionFilters {
  status?: SubscriptionStatus;
  planId?: string;
  limit?: number;
}

export interface PaymentFilters {
  status?: PaymentStatus;
  from?: string;
  to?: string;
  userId?: string;
  limit?: number;
}

export const AdminFinanceRepository = {
  /** KPIs financeiros agregados (mesma semântica do dashboard). */
  async summary(): Promise<AdminFinanceSummary> {
    const [mrr, monthRevenue, activeSubs, pastDue, pendingPayments, churn, newPayments] =
      await Promise.all([
        db
          .select({ total: sum(plans.priceCents) })
          .from(subscriptions)
          .innerJoin(plans, eq(subscriptions.planId, plans.id))
          .where(
            and(
              eq(subscriptions.status, "active"),
              isNull(subscriptions.deletedAt),
              or(isNull(subscriptions.endsAt), sql`${subscriptions.endsAt} > now()`)
            )
          ),
        db
          .select({ total: sum(payments.amountCents) })
          .from(payments)
          .where(
            and(eq(payments.status, "approved"), gte(payments.paidAt, monthStart()))
          ),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(subscriptions)
          .where(
            and(
              eq(subscriptions.status, "active"),
              isNull(subscriptions.deletedAt),
              or(isNull(subscriptions.endsAt), sql`${subscriptions.endsAt} > now()`)
            )
          ),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(subscriptions)
          .where(
            and(eq(subscriptions.status, "past_due"), isNull(subscriptions.deletedAt))
          ),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(payments)
          .where(
            and(
              inArray(payments.status, ["pending", "rejected"]),
              gte(payments.createdAt, monthStart())
            )
          ),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(subscriptions)
          .where(
            and(
              inArray(subscriptions.status, ["cancelled", "expired"]),
              gte(subscriptions.updatedAt, monthStart())
            )
          ),
        db
          .select({ n: sql<number>`count(*)::int` })
          .from(payments)
          .where(
            and(eq(payments.status, "approved"), gte(payments.paidAt, monthStart()))
          ),
      ]);

    return {
      mrrCents: Number(mrr[0]?.total ?? 0),
      monthRevenueCents: Number(monthRevenue[0]?.total ?? 0),
      activeSubscriptions: Number(activeSubs[0]?.n ?? 0),
      pastDueSubscriptions: Number(pastDue[0]?.n ?? 0),
      pendingPaymentsMonth: Number(pendingPayments[0]?.n ?? 0),
      churnMonth: Number(churn[0]?.n ?? 0),
      newPaymentsMonth: Number(newPayments[0]?.n ?? 0),
    };
  },

  /** Lista de assinaturas com aluno (email) e plano (nome). */
  async listSubscriptions(filters: SubscriptionFilters = {}) {
    const conditions = [
      isNull(subscriptions.deletedAt),
      ...(filters.status ? [eq(subscriptions.status, filters.status)] : []),
      ...(filters.planId ? [eq(subscriptions.planId, filters.planId)] : []),
    ];

    const rows = await db
      .select({
        id: subscriptions.id,
        userId: subscriptions.userId,
        status: subscriptions.status,
        preapprovalId: subscriptions.preapprovalId,
        startsAt: subscriptions.startsAt,
        endsAt: subscriptions.endsAt,
        createdAt: subscriptions.createdAt,
        updatedAt: subscriptions.updatedAt,
        userEmail: authUsers.email,
        planName: plans.name,
        planCode: plans.code,
        priceCents: plans.priceCents,
      })
      .from(subscriptions)
      .innerJoin(authUsers, eq(subscriptions.userId, authUsers.id))
      .innerJoin(plans, eq(subscriptions.planId, plans.id))
      .where(and(...conditions))
      .orderBy(desc(subscriptions.createdAt))
      .limit(filters.limit ?? 200);

    return rows.map((r) => ({
      ...r,
      userEmail: r.userEmail ?? null,
    }));
  },

  /** Lista de pagamentos com aluno (email) e assinatura vinculada. */
  async listPayments(filters: PaymentFilters = {}) {
    const conditions = [
      ...(filters.status ? [eq(payments.status, filters.status)] : []),
      ...(filters.userId ? [eq(payments.userId, filters.userId)] : []),
      ...(filters.from ? [gte(payments.paidAt, new Date(`${filters.from}T00:00:00.000Z`))] : []),
      ...(filters.to ? [sql`${payments.paidAt} <= ${new Date(`${filters.to}T23:59:59.999Z`)}`] : []),
    ];

    const rows = await db
      .select({
        id: payments.id,
        userId: payments.userId,
        subscriptionId: payments.subscriptionId,
        provider: payments.provider,
        providerId: payments.providerId,
        amountCents: payments.amountCents,
        currency: payments.currency,
        status: payments.status,
        externalReference: payments.externalReference,
        paidAt: payments.paidAt,
        createdAt: payments.createdAt,
        userEmail: authUsers.email,
      })
      .from(payments)
      .innerJoin(authUsers, eq(payments.userId, authUsers.id))
      .where(and(...conditions))
      .orderBy(desc(payments.paidAt))
      .limit(filters.limit ?? 200);

    return rows.map((r) => ({
      ...r,
      userEmail: r.userEmail ?? null,
    }));
  },
};
