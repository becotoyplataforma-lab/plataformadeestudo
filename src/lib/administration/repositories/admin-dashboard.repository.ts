/**
 * ConcursoAI — AdminDashboardRepository
 *
 * Contagens reais para o dashboard administrativo + KPIs financeiros.
 */
import { count, eq, isNull, or, and, sum, sql, gte, inArray, gt } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { authUsers } from "@/db/schema/identity";
import { contests, editais } from "@/db/schema/contest";
import { documents } from "@/db/schema/knowledge";
import { questions, lessons } from "@/db/schema/study";
import { aiUsage, avatars } from "@/db/schema/ai";
import { subscriptions, payments, plans } from "@/db/schema/billing";

/** Início do mês corrente (UTC). */
function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

export const AdminDashboardRepository = {
  async stats() {
    const [
      users,
      contestRows,
      editalRows,
      docRows,
      docFailRows,
      qRows,
      pendingRows,
      lessonRows,
      avatarRows,
      aiRows,
      aiTokensRows,
      // --- KPIs financeiros ---
      mrrRows,
      monthRevenueRows,
      activeSubsRows,
      pastDueRows,
      pendingPaymentsRows,
      churnRows,
      newPaymentsRows,
    ] = await Promise.all([
      db.select({ n: count() }).from(authUsers),
      db.select({ n: count() }).from(contests).where(isNull(contests.deletedAt)),
      db.select({ n: count() }).from(editais).where(isNull(editais.deletedAt)),
      db.select({ n: count() }).from(documents).where(isNull(documents.deletedAt)),
      db.select({ n: count() }).from(documents).where(eq(documents.status, "failed")),
      db.select({ n: count() }).from(questions).where(isNull(questions.deletedAt)),
      db
        .select({ n: count() })
        .from(questions)
        .where(
          and(
            or(eq(questions.status, "em_revisao"), eq(questions.needsReview, true)),
            isNull(questions.deletedAt)
          )
        ),
      db.select({ n: count() }).from(lessons).where(isNull(lessons.deletedAt)),
      db.select({ n: count() }).from(avatars).where(isNull(avatars.deletedAt)),
      db.select({ n: count() }).from(aiUsage),
      // Tokens totais consumidos (IA)
      db
        .select({ total: sum(sql`${aiUsage.tokensIn} + ${aiUsage.tokensOut}`) })
        .from(aiUsage),
      // MRR: soma do preço dos planos das assinaturas ativas (não expiradas)
      db
        .select({ total: sum(plans.priceCents) })
        .from(subscriptions)
        .innerJoin(plans, eq(subscriptions.planId, plans.id))
        .where(
          and(
            eq(subscriptions.status, "active"),
            isNull(subscriptions.deletedAt),
            or(isNull(subscriptions.endsAt), gt(subscriptions.endsAt, sql`now()`))
          )
        ),
      // Receita do mês: pagamentos aprovados no mês corrente
      db
        .select({ total: sum(payments.amountCents) })
        .from(payments)
        .where(
          and(
            eq(payments.status, "approved"),
            gte(payments.paidAt, monthStart())
          )
        ),
      // Assinaturas ativas (contagem)
      db
        .select({ n: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "active"),
            isNull(subscriptions.deletedAt),
            or(isNull(subscriptions.endsAt), gt(subscriptions.endsAt, sql`now()`))
          )
        ),
      // Inadimplência: assinaturas past_due
      db
        .select({ n: count() })
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.status, "past_due"),
            isNull(subscriptions.deletedAt)
          )
        ),
      // Inadimplência: pagamentos pendentes/rejeitados no mês
      db
        .select({ n: count() })
        .from(payments)
        .where(
          and(
            inArray(payments.status, ["pending", "rejected"]),
            gte(payments.createdAt, monthStart())
          )
        ),
      // Churn do mês: assinaturas canceladas/expiradas no mês
      db
        .select({ n: count() })
        .from(subscriptions)
        .where(
          and(
            inArray(subscriptions.status, ["cancelled", "expired"]),
            gte(subscriptions.updatedAt, monthStart())
          )
        ),
      // Novos pagamentos aprovados no mês
      db
        .select({ n: count() })
        .from(payments)
        .where(
          and(
            eq(payments.status, "approved"),
            gte(payments.paidAt, monthStart())
          )
        ),
    ]);

    return {
      totalUsers: Number(users[0]?.n ?? 0),
      totalContests: Number(contestRows[0]?.n ?? 0),
      totalEditais: Number(editalRows[0]?.n ?? 0),
      totalDocuments: Number(docRows[0]?.n ?? 0),
      documentsFailed: Number(docFailRows[0]?.n ?? 0),
      totalQuestions: Number(qRows[0]?.n ?? 0),
      pendingReviews: Number(pendingRows[0]?.n ?? 0),
      totalLessons: Number(lessonRows[0]?.n ?? 0),
      totalAvatars: Number(avatarRows[0]?.n ?? 0),
      aiMessagesTotal: Number(aiRows[0]?.n ?? 0),
      aiTokensTotal: Number(aiTokensRows[0]?.total ?? 0),
      // --- KPIs financeiros (valores em centavos) ---
      mrrCents: Number(mrrRows[0]?.total ?? 0),
      monthRevenueCents: Number(monthRevenueRows[0]?.total ?? 0),
      activeSubscriptions: Number(activeSubsRows[0]?.n ?? 0),
      pastDueSubscriptions: Number(pastDueRows[0]?.n ?? 0),
      pendingPaymentsMonth: Number(pendingPaymentsRows[0]?.n ?? 0),
      churnMonth: Number(churnRows[0]?.n ?? 0),
      newPaymentsMonth: Number(newPaymentsRows[0]?.n ?? 0),
    };
  },
};
