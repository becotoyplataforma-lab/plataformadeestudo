import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { AdminGuardService } from "@/lib/administration/services/admin-guard.service";
import { AdminManagementService } from "@/lib/administration/services/admin-management.service";
import { AdminManagementClient } from "@/components/admin/admin-management-client";

export const dynamic = "force-dynamic";

export default async function AdminAdminsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const isSuperadmin = await AdminGuardService.isSuperadminEmail(
    session.user.email ?? null
  );
  if (!isSuperadmin) redirect("/admin");

  const { admins, superadmins } = await AdminManagementService.list({
    userId: session.user.id,
    email: session.user.email ?? "",
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Administradores</h2>
        <p className="text-sm text-slate-400">
          Gerencie a allowlist de administradores e superadministradores.
          Acesso exclusivo de superadmin.
        </p>
      </div>

      <AdminManagementClient
        initial={{ admins, superadmins }}
        currentEmail={session.user.email ?? null}
      />
    </div>
  );
}
