import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { listBancas, listQuestions, listSubjects } from "@/lib/db/repositories/questoes";
import { QuestionBrowser } from "@/components/questoes/question-browser";

export const metadata: Metadata = {
  title: "Questões",
  description: "Banco de questões para concursos públicos.",
};

export default async function QuestoesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [initial, bancas, subjects] = await Promise.all([
    listQuestions({ page: 1, pageSize: 15 }),
    listBancas(),
    listSubjects(),
  ]);

  return (
    <QuestionBrowser
      initialQuestions={initial.data}
      initialTotal={initial.total}
      bancas={bancas}
      subjects={subjects}
      userId={session.user.id}
    />
  );
}
