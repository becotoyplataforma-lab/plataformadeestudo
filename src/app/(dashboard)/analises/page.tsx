import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { studyTasks } from "@/db/schema/study";
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

  const [summary, bySubject, evolution, taskRows] = await Promise.all([
    getDashboardSummary(session.user.id),
    getPerformanceBySubject(session.user.id),
    getEvolution(session.user.id, 30),
    db
      .select({
        scheduledDate: studyTasks.scheduledDate,
        durationMin: studyTasks.durationMin,
        status: studyTasks.status,
      })
      .from(studyTasks)
      .where(eq(studyTasks.userId, session.user.id))
      .orderBy(studyTasks.scheduledDate)
      .limit(500),
  ]);

  const tasks = taskRows.map((t) => ({
    scheduled_date: t.scheduledDate.toISOString(),
    duration_min: t.durationMin,
    status: t.status,
  }));

  return (
    <AnalisesClient
      summary={summary}
      bySubject={bySubject}
      evolution={evolution}
      tasks={tasks}
    />
  );
}
