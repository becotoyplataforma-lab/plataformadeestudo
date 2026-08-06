import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { FocusSession } from "@/components/study/focus-session";

export const metadata: Metadata = {
  title: "Sessão de foco",
  description: "Modo foco para estudar sem distrações.",
};

export default async function FocusSessionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return <FocusSession userId={session.user.id} />;
}
