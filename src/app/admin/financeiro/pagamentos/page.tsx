import Link from "next/link";
import { AdminFinanceRepository } from "@/lib/administration/repositories/admin-finance.repository";
import {
  formatBRL,
  formatDate,
  PaymentStatusBadge,
} from "@/components/admin/finance-helpers";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "approved", label: "Aprovado" },
  { value: "pending", label: "Pendente" },
  { value: "rejected", label: "Rejeitado" },
  { value: "cancelled", label: "Cancelado" },
  { value: "refunded", label: "Reembolsado" },
] as const;

export default async function AdminFinanceiroPagamentosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; from?: string; to?: string; user_id?: string }>;
}) {
  const sp = await searchParams;
  const rows = await AdminFinanceRepository.listPayments({
    status: sp.status as never,
    from: sp.from,
    to: sp.to,
    userId: sp.user_id,
    limit: 200,
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Pagamentos</h2>
        <p className="text-sm text-slate-400">
          {rows.length} pagamento(s){sp.user_id ? " para este aluno" : ""} — filtre por
          status e período.
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
            De
          </label>
          <input
            type="date"
            name="from"
            defaultValue={sp.from ?? ""}
            className="h-9 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-slate-200"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Até
          </label>
          <input
            type="date"
            name="to"
            defaultValue={sp.to ?? ""}
            className="h-9 rounded-lg border border-white/10 bg-slate-900 px-3 text-sm text-slate-200"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-200 ring-1 ring-inset ring-cyan-400/30 transition-colors hover:bg-cyan-500/25"
        >
          Filtrar
        </button>
        <Link
          href="/admin/financeiro/pagamentos"
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
              <th className="px-4 py-3">Valor</th>
              <th className="px-4 py-3">Moeda</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Pago em</th>
              <th className="px-4 py-3">Provider ID</th>
              <th className="px-4 py-3">Referência externa</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            )}
            {rows.map((p) => (
              <tr key={p.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">{p.userEmail ?? "—"}</td>
                <td className="px-4 py-3 text-slate-200">{formatBRL(p.amountCents)}</td>
                <td className="px-4 py-3 text-slate-400">{p.currency}</td>
                <td className="px-4 py-3">
                  <PaymentStatusBadge status={p.status} />
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(p.paidAt)}</td>
                <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-500">
                  {p.providerId ?? "—"}
                </td>
                <td className="max-w-[160px] truncate px-4 py-3 text-xs text-slate-500">
                  {p.externalReference ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
