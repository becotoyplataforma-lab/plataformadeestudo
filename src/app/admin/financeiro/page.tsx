import Link from "next/link";
import {
  TrendingUp,
  Banknote,
  Users,
  AlertTriangle,
  UserMinus,
  CreditCard,
  ArrowRight,
} from "lucide-react";
import { AdminDashboardRepository } from "@/lib/administration/repositories/admin-dashboard.repository";
import { AdminFinanceRepository } from "@/lib/administration/repositories/admin-finance.repository";
import { StatCard } from "@/components/admin/stat-card";
import {
  formatBRL,
  formatDate,
  PaymentStatusBadge,
} from "@/components/admin/finance-helpers";

export const dynamic = "force-dynamic";

/** Formata número inteiro com separador pt-BR. */
function formatInt(n: number): string {
  return new Intl.NumberFormat("pt-BR").format(n);
}

export default async function AdminFinanceiroPage() {
  // Reutiliza o mesmo repositório do dashboard para os KPIs (números consistentes).
  const stats = await AdminDashboardRepository.stats();
  const payments = await AdminFinanceRepository.listPayments({ limit: 20 });

  const cards: {
    label: string;
    value: string;
    icon: typeof TrendingUp;
    iconClassName: string;
    trend?: { direction: "up" | "down" | "neutral"; text: string };
  }[] = [
    {
      label: "MRR",
      value: formatBRL(stats.mrrCents),
      icon: TrendingUp,
      iconClassName: "text-cyan-300",
      trend: { direction: "up", text: "Receita recorrente mensal" },
    },
    {
      label: "Receita do mês",
      value: formatBRL(stats.monthRevenueCents),
      icon: Banknote,
      iconClassName: "text-emerald-300",
      trend: { direction: "up", text: "Pagamentos aprovados" },
    },
    {
      label: "Assinaturas ativas",
      value: formatInt(stats.activeSubscriptions),
      icon: Users,
      iconClassName: "text-blue-300",
    },
    {
      label: "Inadimplência",
      value: formatInt(stats.pastDueSubscriptions + stats.pendingPaymentsMonth),
      icon: AlertTriangle,
      iconClassName: "text-amber-300",
      trend: {
        direction: stats.pastDueSubscriptions + stats.pendingPaymentsMonth > 0 ? "down" : "neutral",
        text: `${stats.pastDueSubscriptions} past_due · ${stats.pendingPaymentsMonth} pendentes`,
      },
    },
    {
      label: "Churn do mês",
      value: formatInt(stats.churnMonth),
      icon: UserMinus,
      iconClassName: "text-rose-300",
      trend: {
        direction: stats.churnMonth > 0 ? "down" : "neutral",
        text: "Cancelamentos/expirados",
      },
    },
    {
      label: "Novos pagamentos",
      value: formatInt(stats.newPaymentsMonth),
      icon: CreditCard,
      iconClassName: "text-violet-300",
      trend: { direction: "up", text: "Aprovados no mês" },
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-white">Financeiro</h2>
        <p className="mt-1 text-sm text-slate-400">
          Visão geral financeira — receita, assinaturas e transações.
        </p>
      </div>

      {/* KPIs */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-cyan-300">
            Indicadores
          </h3>
          <span className="h-px flex-1 bg-gradient-to-r from-cyan-400/30 to-transparent" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {cards.map((c) => (
            <StatCard
              key={c.label}
              label={c.label}
              value={c.value}
              icon={c.icon}
              iconClassName={c.iconClassName}
              trend={c.trend}
            />
          ))}
        </div>
      </section>

      {/* Acesso rápido */}
      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/financeiro/assinaturas"
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-cyan-400/30 hover:bg-white/[0.05]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Assinaturas</p>
              <p className="mt-1 text-xs text-slate-400">
                Gerencie planos ativos, cancelamentos, suspensões e reativações.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-500 transition-colors group-hover:text-cyan-300" />
          </div>
        </Link>
        <Link
          href="/admin/financeiro/pagamentos"
          className="group rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-all hover:border-cyan-400/30 hover:bg-white/[0.05]"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Pagamentos</p>
              <p className="mt-1 text-xs text-slate-400">
                Histórico de transações com filtros por status e período.
              </p>
            </div>
            <ArrowRight className="h-5 w-5 text-slate-500 transition-colors group-hover:text-cyan-300" />
          </div>
        </Link>
      </section>

      {/* Últimas transações */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
              Últimas transações
            </h3>
            <span className="h-px flex-1 bg-gradient-to-r from-slate-400/30 to-transparent" />
          </div>
          <Link
            href="/admin/financeiro/pagamentos"
            className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
          >
            Ver todas →
          </Link>
        </div>
        <div className="overflow-x-auto rounded-2xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-3">Aluno</th>
                <th className="px-4 py-3">Valor</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    Nenhuma transação registrada.
                  </td>
                </tr>
              )}
              {payments.map((p) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="px-4 py-3 text-slate-200">{p.userEmail ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-200">{formatBRL(p.amountCents)}</td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={p.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-400">{formatDate(p.paidAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
