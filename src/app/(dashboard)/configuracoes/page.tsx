import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/db/repositories/perfil";
import { SettingsContent } from "@/components/settings/settings-content";

export const metadata: Metadata = {
  title: "Configurações",
};

export default async function ConfiguracoesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const profile = await getProfile(db, session.user.id);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          Plano, segurança e recursos da sua conta.
        </p>
      </div>
      <SettingsContent
        plano={profile?.plano ?? "free"}
        email={profile?.email}
      />
    </div>
  );
}
