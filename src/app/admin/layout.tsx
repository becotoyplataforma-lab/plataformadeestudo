import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { AdminShell } from "@/components/admin/admin-shell";

export const metadata: Metadata = {
  title: "Admin · ConcursoAI",
  robots: { index: false, follow: false },
};

/**
 * Layout da área administrativa — exige admin (allowlist).
 * Sidebar lateral fixa (AdminShell) + topo com breadcrumb/avatar.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isAdmin = await AdminGuardService.isAdminOrSuperadmin(
    session.user.email ?? null
  );
  if (!isAdmin) redirect("/dashboard");

  return (
    <AdminShell name={session.user.name ?? null} email={session.user.email ?? null}>
      {children}
    </AdminShell>
  );
}
