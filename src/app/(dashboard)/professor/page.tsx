import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { listSessions } from "@/lib/db/repositories/chat";
import { getProfile } from "@/lib/db/repositories/perfil";
import { getAiUsage } from "@/lib/ai/limits";
import { ChatClient } from "@/components/professor/chat-client";

export const metadata: Metadata = {
  title: "Professor IA",
  description: "Converse com seu professor particular de concursos, alimentado por IA.",
};

export default async function ProfessorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const [sessions, profile, usage, subjects] = await Promise.all([
    listSessions(db, session.user.id),
    getProfile(db, session.user.id),
    getAiUsage(session.user.id),
    db.from("knowledge_subjects").select("id, name").order("name"),
  ]);

  return (
    <ChatClient
      userId={session.user.id}
      initialSessions={sessions}
      profileName={profile?.full_name}
      profileLevel={profile?.nivel}
      profileBanca={profile?.banca_preferida}
      profileConcurso={profile?.concurso_alvo}
      defaultModel={profile?.modelo_ia_padrao ?? "flash"}
      usage={{
        used: usage.usedMessages,
        max: usage.maxMessages,
        canSend: usage.canSend,
      }}
      subjects={(subjects.data ?? []) as { id: string; name: string }[]}
    />
  );
}
