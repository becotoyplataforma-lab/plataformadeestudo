import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { questionAttempts, studyTasks } from "@/db/schema/study";
import { getProfile } from "@/lib/db/repositories/perfil";
import { AppHeader } from "@/components/layout/app-header";
import {
  SidebarBrand,
  SidebarNav,
  SidebarStreak,
} from "@/components/layout/app-sidebar";
import { computeStreak, distinctActivityDates, todayISO } from "@/lib/analytics/streak";

// Área autenticada: não deve ser indexada por buscadores.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * Layout do grupo (dashboard) — shell autenticado com sidebar.
 * Rota protegida pelo middleware + verificação adicional aqui.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  const userId = session?.user?.id;

  const profile = userId
    ? await getProfile(userId).catch(() => null)
    : {
        id: "00000000-0000-4000-8000-000000000001",
        full_name: "Estudante Concurseiro",
        email: "aluno@concursoai.com",
        avatar_url: null,
      };

  // Calcula streak a partir das atividades do usuário
  let streakDays = 5;
  if (userId) {
    try {
      const attempts = await db
        .select({ createdAt: questionAttempts.createdAt })
        .from(questionAttempts)
        .where(eq(questionAttempts.userId, userId))
        .limit(500);
    const tasks = await db
      .select({ completedAt: studyTasks.completedAt })
      .from(studyTasks)
      .where(
        and(
          eq(studyTasks.userId, userId),
          isNotNull(studyTasks.completedAt)
        )
      )
      .limit(500);

    const timestamps = [
      ...attempts.map((a) => a.createdAt.toISOString()),
      ...tasks.map((t) => (t.completedAt as Date).toISOString()),
    ];
    const streak = computeStreak({
      activityDates: distinctActivityDates(timestamps),
      today: todayISO(),
    });
    streakDays = streak.current;
    } catch {
      // streak opcional — não quebra o layout
    }
  }

  return (
    <div className="flex min-h-screen bg-transparent">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-white/10 bg-slate-950/75 shadow-[12px_0_40px_rgba(15,23,42,0.45)] backdrop-blur-xl md:flex">
        <SidebarBrand />
        <SidebarStreak days={streakDays} />
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          streakDays={streakDays}
          userName={profile?.full_name}
          userEmail={profile?.email}
          userImage={profile?.avatar_url}
        />
        <main className="flex-1 px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
