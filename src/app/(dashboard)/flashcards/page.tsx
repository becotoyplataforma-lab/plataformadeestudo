import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/drizzle";
import { studySubjects } from "@/db/schema/study";
import { listFlashcards, countDue } from "@/lib/db/repositories/flashcards";
import { FlashcardsClient } from "@/components/flashcards/flashcards-client";

export const metadata: Metadata = {
  title: "Flashcards",
  description: "Revise com flashcards e repetição espaçada.",
};

export default async function FlashcardsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const [cards, dueCount, subjects] = await Promise.all([
    listFlashcards(session.user.id),
    countDue(session.user.id),
    db
      .select({
        id: studySubjects.id,
        name: studySubjects.name,
        color: studySubjects.color,
      })
      .from(studySubjects)
      .where(eq(studySubjects.userId, session.user.id))
      .orderBy(studySubjects.name),
  ]);

  return (
    <FlashcardsClient
      initialCards={cards}
      dueCount={dueCount}
      subjects={subjects}
      userId={session.user.id}
    />
  );
}
