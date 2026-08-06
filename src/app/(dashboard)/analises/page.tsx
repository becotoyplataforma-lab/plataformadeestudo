import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getDashboardSummary,
  getEvolution,
  getPerformanceBySubject,
} from "@/lib/db/repositories/analises";
import { AnalisesClient } from "@/components/analises/analises-client";

export const metadata: Metadata = {
  title: "Analíticas",
  description: "Acompanhe seu desempenho nos estudos.",
};

export default async function AnalisesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const [summary, bySubject, evolution, tasks] = await Promise.all([
    getDashboardSummary(db, session.user.id),
    getPerformanceBySubject(db, session.user.id),
    getEvolution(db, session.user.id, 30),
    db
      .from("study_tasks")
      .select("scheduled_date, duration_min, status")
      .eq("user_id", session.user.id)
      .order("scheduled_date", { ascending: true })
      .limit(500),
  ]);

  return (
    <AnalisesClient
      summary={summary}
      bySubject={bySubject}
      evolution={evolution}
      tasks={(tasks.data ?? []) as { scheduled_date: string; duration_min: number; status: string }[]}
    />
  );
}
