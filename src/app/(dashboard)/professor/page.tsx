import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/drizzle";
import { knowledgeSubjects } from "@/db/schema/knowledge";
import { listSessions } from "@/lib/db/repositories/chat";
import { getProfile } from "@/lib/db/repositories/perfil";
import { getAiUsage } from "@/lib/ai/limits";
import { resolveUserLimits } from "@/lib/billing/services/limits.resolver";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { accessScopeFromProfile } from "@/lib/knowledge/security/document-access";
import { resolveCourseScope, type CourseScope } from "@/lib/knowledge/security/course-scope";
import { ChatClient } from "@/components/professor/chat-client";

export const metadata: Metadata = {
  title: "Professor IA",
  description: "Converse com seu professor particular de concursos, alimentado por IA.",
};

export default async function ProfessorPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [sessions, profile, usage, subjects] = await Promise.all([
    listSessions(session.user.id),
    getProfile(session.user.id),
    resolveUserLimits(session.user.id).then((limits) =>
      getAiUsage(session.user.id, limits)
    ),
    db
      .select({ id: knowledgeSubjects.id, name: knowledgeSubjects.name })
      .from(knowledgeSubjects)
      .orderBy(knowledgeSubjects.name),
  ]);

  // O seletor de contexto do Professor IA mostra o que o aluno pode ler:
  // material proprio e material compartilhado com o cargo/edital dele.
  const courseScope = await resolveCourseScope(profile).catch(
    (): CourseScope => ({})
  );
  const docs = await DocumentRepository.listAccessible(
    accessScopeFromProfile(session.user.id, profile, {
      editalId: courseScope.editalId ?? null,
    }),
    50
  );

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
      subjects={subjects}
      documents={docs
        .filter((d) => d.status === "chunked" || d.status === "indexed")
        .map((d) => ({ id: d.id, title: d.title }))}
    />
  );
}
