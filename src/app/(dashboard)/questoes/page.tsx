import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { listBancas, listQuestions } from "@/lib/db/repositories/questoes";
import { QuestionBrowser } from "@/components/questoes/question-browser";

export const metadata: Metadata = {
  title: "Questões",
  description: "Banco de questões para concursos públicos.",
};

export default async function QuestoesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const [initial, bancas, subjects] = await Promise.all([
    listQuestions(db, { page: 1, pageSize: 15 }),
    listBancas(db),
    db.from("content_subjects").select("id, name, color").order("name"),
  ]);

  return (
    <QuestionBrowser
      initialQuestions={initial.data}
      initialTotal={initial.total}
      bancas={bancas}
      subjects={(subjects.data ?? []) as { id: string; name: string; color: string | null }[]}
      userId={session.user.id}
    />
  );
}
