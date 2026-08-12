import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { getDashboardSummary, getPerformanceBySubject, getEvolution } from "@/lib/db/repositories/analises";
import { DashboardStats, QuickActions } from "@/components/dashboard/dashboard-stats";
import { EvolutionChart } from "@/components/dashboard/evolution-chart";
import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { firstName } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const [summary, bySubject, evolution, profile] = await Promise.all([
    getDashboardSummary(db, session.user.id),
    getPerformanceBySubject(db, session.user.id),
    getEvolution(db, session.user.id, 30),
    db.from("profiles").select("full_name").eq("id", session.user.id).single(),
  ]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(6,182,212,0.22),transparent_26%),linear-gradient(135deg,rgba(15,23,42,0.97),rgba(11,18,31,0.88))] p-6 shadow-[0_30px_100px_rgba(2,6,23,0.7)]">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
        <div className="absolute -bottom-8 left-20 h-28 w-28 rounded-full bg-cyan-400/20 blur-3xl" />

        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-cyan-200">
              Dashboard
            </p>
            <h1 className="text-3xl font-extrabold tracking-[-0.06em] text-white md:text-5xl">
              Olá, {firstName(profile.data?.full_name)} 👋
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300 md:text-base">
              Seu desempenho em destaque para continuar evoluindo com foco, consistência e inteligência.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3 text-left text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.3)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Meta</div>
              <div className="mt-1 font-extrabold text-white">{summary.meta_hoje_min ?? 0} min</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.3)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Acertos</div>
              <div className="mt-1 font-extrabold text-white">{summary.acertos ?? 0}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-[0_8px_24px_rgba(15,23,42,0.3)]">
              <div className="text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Sequência</div>
              <div className="mt-1 font-extrabold text-white">{summary.streak_dias ?? 0} dias</div>
            </div>
          </div>
        </div>
      </section>

      <DashboardStats summary={summary} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EvolutionChart data={evolution} />
        </div>
        <div>
          <PerformanceChart data={bySubject} />
        </div>
      </div>

      <QuickActions />
    </div>
  );
}
