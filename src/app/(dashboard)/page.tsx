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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {firstName(profile.data?.full_name)} 👋
          </h1>
          <p className="text-sm text-muted-foreground">
            Aqui está o resumo do seu desempenho.
          </p>
        </div>
      </div>

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
