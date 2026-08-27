import Link from "next/link";
import { desc, count, eq, sql, isNull, inArray, max, sum, and, or } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { authUsers, profiles } from "@/db/schema/identity";
import { questionAttempts } from "@/db/schema/study";
import { subscriptions, plans, payments } from "@/db/schema/billing";
import { aiUsage, chatMessages } from "@/db/schema/ai";
import { PaymentStatusBadge, formatDate } from "@/components/admin/finance-helpers";

export const dynamic = "force-dynamic";

export default async function AdminAlunosPage() {
  // 1) Usuários (limitado a 200) — mantém as 4 colunas originais.
  const users = await db
    .select({
      id: authUsers.id,
      email: authUsers.email,
      level: profiles.level,
      contestId: profiles.contestId,
      createdAt: profiles.createdAt,
    })
    .from(authUsers)
    .leftJoin(profiles, eq(authUsers.id, profiles.id))
    .orderBy(desc(profiles.createdAt))
    .limit(200);

  const userIds = users.map((u) => u.id);

  // 2) Questões respondidas por usuário (agregado separado — evita duplicação de linhas).
  const attempts = await db
    .select({
      userId: questionAttempts.userId,
      total: count(questionAttempts.id),
    })
    .from(questionAttempts)
    .where(inArray(questionAttempts.userId, userIds))
    .groupBy(questionAttempts.userId);
  const attemptsByUser = new Map(attempts.map((a) => [a.userId, a.total]));

  // 3) Assinatura ativa + plano (uma por usuário — índice parcial uq_subscriptions_user_active).
  const activeSubs = await db
    .select({
      userId: subscriptions.userId,
      planName: plans.name,
      endsAt: subscriptions.endsAt,
      status: subscriptions.status,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        inArray(subscriptions.userId, userIds),
        eq(subscriptions.status, "active"),
        isNull(subscriptions.deletedAt),
        or(isNull(subscriptions.endsAt), sql`${subscriptions.endsAt} > now()`)
      )
    );
  const subByUser = new Map(activeSubs.map((s) => [s.userId, s]));

  // 4) Último pagamento por usuário (subquery com MAX(paid_at)).
  const lastPaidSubquery = db
    .select({
      userId: payments.userId,
      maxPaid: max(payments.paidAt),
    })
    .from(payments)
    .where(inArray(payments.userId, userIds))
    .groupBy(payments.userId)
    .as("last_paid");

  const lastPayments = await db
    .select({
      userId: payments.userId,
      id: payments.id,
      status: payments.status,
      amountCents: payments.amountCents,
      paidAt: payments.paidAt,
    })
    .from(payments)
    .innerJoin(lastPaidSubquery, sql`${payments.userId} = ${lastPaidSubquery.userId} AND ${payments.paidAt} = ${lastPaidSubquery.maxPaid}`);
  const paymentByUser = new Map(lastPayments.map((p) => [p.userId, p]));

  // 5) Consumo de IA (tokens) por usuário.
  const aiUsageRows = await db
    .select({
      userId: aiUsage.userId,
      total: sum(sql`${aiUsage.tokensIn} + ${aiUsage.tokensOut}`),
    })
    .from(aiUsage)
    .where(inArray(aiUsage.userId, userIds))
    .groupBy(aiUsage.userId);
  const aiTokensByUser = new Map(aiUsageRows.map((a) => [a.userId, Number(a.total ?? 0)]));

  // 6) Última atividade (MAX(chat_messages.created_at)) por usuário.
  const lastActivity = await db
    .select({
      userId: chatMessages.userId,
      last: max(chatMessages.createdAt),
    })
    .from(chatMessages)
    .where(inArray(chatMessages.userId, userIds))
    .groupBy(chatMessages.userId);
  const activityByUser = new Map(lastActivity.map((a) => [a.userId, a.last]));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Alunos</h2>
        <p className="text-sm text-slate-400">{users.length} usuário(s) registrados.</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Nível</th>
              <th className="px-4 py-3">Questões respondidas</th>
              <th className="px-4 py-3">Plano ativo</th>
              <th className="px-4 py-3">Status do pagamento</th>
              <th className="px-4 py-3">Renovação</th>
              <th className="px-4 py-3">Consumo IA (tokens)</th>
              <th className="px-4 py-3">Última atividade</th>
              <th className="px-4 py-3">Cadastro</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const sub = subByUser.get(u.id);
              const pay = paymentByUser.get(u.id);
              return (
                <tr key={u.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-200">{u.email ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{u.level ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400">{attemptsByUser.get(u.id) ?? 0}</td>
                  <td className="px-4 py-3 text-slate-200">{sub?.planName ?? "Free"}</td>
                  <td className="px-4 py-3">
                    {pay ? (
                      <PaymentStatusBadge status={pay.status} />
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(sub?.endsAt)}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {aiTokensByUser.get(u.id)?.toLocaleString("pt-BR") ?? 0}
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(activityByUser.get(u.id))}</td>
                  <td className="px-4 py-3 text-slate-400">
                    {u.createdAt ? u.createdAt.toISOString().slice(0, 10) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/financeiro/pagamentos?user_id=${u.id}`}
                      className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                    >
                      Ver transações
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
