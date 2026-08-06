import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/db/repositories/perfil";
import { ProfileForm } from "@/components/perfil/profile-form";

export const metadata: Metadata = {
  title: "Meu perfil",
};

export default async function PerfilPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const profile = await getProfile(db, session.user.id);
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Meu perfil</h1>
        <p className="text-sm text-muted-foreground">
          Gerencie seus dados e preferências de estudo.
        </p>
      </div>
      <ProfileForm profile={profile} />
    </div>
  );
}
