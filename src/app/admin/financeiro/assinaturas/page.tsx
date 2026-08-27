import Link from "next/link";
import { AdminFinanceRepository } from "@/lib/administration/repositories/admin-finance.repository";
import { PlanRepository } from "@/lib/billing/repositories/plan.repository";
import { SubscriptionStatusBadge, formatDate } from "@/components/admin/finance-helpers";
import { SubscriptionActions } from "@/components/admin/subscription-actions";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "active", label: "Ativa" },
  { value: "past_due", label: "Past due" },
  { value: "cancelled", label: "Cancelada" },
  { value: "expired", label: "Expirada" },
  { value: "suspended", label: "Suspensa" },
] as const;

export default async function AdminFinanceiroAssinaturasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; plan_id?: string }>;
}) {
  const sp = await searchParams;
  const [rows, plans] = await Promise.all([
    AdminFinanceRepository.listSubscriptions({
      status: sp.status as never,
      planId: sp.plan_id,
      limit: 200,
    }),
    PlanRepository.listActive(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Assinaturas</h2>
        <p className="text-sm text-slate-400">
          {rows.length} assinatura(s) — filtre por status ou plano.
        </p>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Status
          </label>
          <select
            name="status"
            defaultValue={sp.status ?? ""}
            className="h-9 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-slate-200"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Plano
          </label>
          <select
            name="plan_id"
            defaultValue={sp.plan_id ?? ""}
            className="h-9 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-slate-200"
          >
            <option value="">Todos os planos</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-200 ring-1 ring-inset ring-cyan-400/30 transition-colors hover:bg-cyan-500/25"
        >
          Filtrar
        </button>
        <Link
          href="/admin/financeiro/assinaturas"
          className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-slate-200"
        >
          Limpar
        </Link>
      </form>

      {/* Tabela */}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Aluno</th>
              <th className="px-4 py-3">Plano</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Início</th>
              <th className="px-4 py-3">Renovação</th>
              <th className="px-4 py-3">Preapproval</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma assinatura encontrada.
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">{s.userEmail ?? "—"}</td>
                <td className="px-4 py-3 text-slate-200">{s.planName}</td>
                <td className="px-4 py-3">
                  <SubscriptionStatusBadge status={s.status} />
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(s.startsAt)}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(s.endsAt)}</td>
                <td className="max-w-[180px] truncate px-4 py-3 text-xs text-slate-500">
                  {s.preapprovalId ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <SubscriptionActions
                    row={{
                      id: s.id,
                      status: s.status,
                      userEmail: s.userEmail,
                      planName: s.planName,
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
