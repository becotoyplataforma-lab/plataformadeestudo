import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { StudySubjectRepository } from "@/lib/study/repositories/study-subject.repository";
import { StudyPlannerService } from "@/lib/study/services/study-planner.service";
import { CronogramaClient } from "@/components/cronograma/cronograma-client";
import type { Subject } from "@/types";

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

  const week = weekRange();
  const end = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 28);
    return d.toISOString().slice(0, 10);
  })();

  const [subjectRows, allTasks] = await Promise.all([
    StudySubjectRepository.listByUser(session.user.id),
    // Mesmo layer do planejador adaptativo: study_subjects + study_tasks
    StudyPlannerService.listTasksWithSubject(session.user.id, {
      from: week.from,
      to: end,
    }),
  ]);

  const subjects: Subject[] = subjectRows.map((s) => ({
    id: s.id,
    user_id: s.userId,
    name: s.name,
    color: s.color,
    priority: s.priority,
    carga_horaria_total: s.cargaHorariaTotal,
    created_at: s.createdAt.toISOString(),
  }));

  return (
    <CronogramaClient
      subjects={subjects}
      initialTasks={allTasks}
      week={week}
    />
  );
}
