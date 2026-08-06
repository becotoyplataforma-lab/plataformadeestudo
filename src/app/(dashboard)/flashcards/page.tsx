import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { createClient } from "@/lib/supabase/server";
import { listFlashcards, countDue } from "@/lib/db/repositories/flashcards";
import { FlashcardsClient } from "@/components/flashcards/flashcards-client";

export const metadata: Metadata = {
  title: "Flashcards",
  description: "Revise com flashcards e repetição espaçada.",
};

export default async function FlashcardsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const db = await createClient();
  const [cards, dueCount, subjects] = await Promise.all([
    listFlashcards(db, session.user.id),
    countDue(db, session.user.id),
    db.from("subjects").select("id, name, color").eq("user_id", session.user.id),
  ]);

  return (
    <FlashcardsClient
      initialCards={cards}
      dueCount={dueCount}
      subjects={(subjects.data ?? []) as { id: string; name: string; color: string | null }[]}
      userId={session.user.id}
    />
  );
}
