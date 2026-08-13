import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/db/repositories/perfil";
import { AppHeader } from "@/components/layout/app-header";
import {
  SidebarBrand,
  SidebarNav,
  SidebarStreak,
} from "@/components/layout/app-sidebar";
import { computeStreak, distinctActivityDates, todayISO } from "@/lib/analytics/streak";

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
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const profile = await getProfile(session.user.id);

  // Calcula streak a partir das atividades do usuário
  let streakDays = 0;
  try {
    const { data: attempts } = await db
      .from("question_attempts")
      .select("created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(500);
    const { data: tasks } = await db
      .from("study_tasks")
      .select("completed_at")
      .eq("user_id", session.user.id)
      .not("completed_at", "is", null)
      .limit(500);

    const timestamps = [
      ...((attempts ?? []).map((a) => a.created_at) as string[]),
      ...((tasks ?? []).map((t) => t.completed_at as string)),
    ];
    const streak = computeStreak({
      activityDates: distinctActivityDates(timestamps),
      today: todayISO(),
    });
    streakDays = streak.current;
  } catch {
    // streak opcional — não quebra o layout
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
