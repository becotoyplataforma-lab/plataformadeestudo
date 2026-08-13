import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { getProfile } from "@/lib/db/repositories/perfil";
import { listPublishedContests, listPositions } from "@/lib/db/repositories/contest";
import { ProfileForm } from "@/components/perfil/profile-form";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [profile, contests, positions] = await Promise.all([
    getProfile(session.user.id),
    listPublishedContests(),
    listPositions(),
  ]);
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus dados e preferências de estudo.
        </p>
      </div>
      <ProfileForm profile={profile} contests={contests} positions={positions} />
    </div>
  );
}
