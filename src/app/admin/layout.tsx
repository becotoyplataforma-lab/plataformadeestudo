import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { AdminNav } from "@/components/admin/admin-nav";

export const metadata: Metadata = { title: "Admin · ConcursoAI" };

/**
 * Layout da área administrativa — exige admin (allowlist).
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isAdmin = await AdminGuardService.isAdminEmail(session.user.email ?? null);
  if (!isAdmin) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(6,182,212,0.08),transparent_40%),#070b14] text-slate-200">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#0b1120]/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">
              Área administrativa
            </p>
            <h1 className="text-lg font-bold text-white">ConcursoAI</h1>
          </div>
          <AdminNav />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
