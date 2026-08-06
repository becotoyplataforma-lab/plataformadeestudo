import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { listSubjects, listTasks } from "@/lib/db/repositories/cronograma";
import { CronogramaClient } from "@/components/cronograma/cronograma-client";

export const metadata: Metadata = {
  title: "Cronograma",
  description: "Planeje seus estudos com o cronograma inteligente.",
};

function weekRange() {
  const today = new Date();
  const day = today.getDay(); // 0=dom, 1=seg ...
  // Semana de segunda a domingo
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(monday), to: iso(sunday), today: iso(today) };
}

export default async function CronogramaPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const [subjects, allTasks] = await Promise.all([
    listSubjects(db, session.user.id),
    // Carrega do início da semana atual até +4 semanas
    listTasks(
      db,
      session.user.id,
      weekRange().from,
      (() => {
        const d = new Date();
        d.setDate(d.getDate() + 28);
        return d.toISOString().slice(0, 10);
      })()
    ),
  ]);

  return (
    <CronogramaClient
      subjects={subjects}
      initialTasks={allTasks}
      week={weekRange()}
    />
  );
}
