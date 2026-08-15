import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { FocusSession } from "@/components/study/focus-session";

export const metadata: Metadata = {
  title: "Sessão de estudo",
  description: "Player de estudo: aula, leitura, questões, flashcards e foco.",
};

const modes = [
  { href: "/aulas", label: "Aula", desc: "Assista a uma aula gerada pela IA", icon: "🎬" },
  { href: "/apostilas", label: "Leitura", desc: "Estude uma apostila", icon: "📚" },
  { href: "/questoes", label: "Questões", desc: "Pratique com questões", icon: "📝" },
  { href: "/flashcards", label: "Flashcards", desc: "Revisão espaçada", icon: "🃏" },
];

export default async function FocusSessionPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Sessão de estudo</h1>
        <p className="text-sm text-slate-400">Escolha o modo de estudo.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {modes.map((m) => (
          <Link
            key={m.href}
            href={m.href}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5"
          >
            <p className="text-2xl">{m.icon}</p>
            <p className="mt-2 text-base font-bold text-white">{m.label}</p>
            <p className="mt-1 text-xs text-slate-400">{m.desc}</p>
          </Link>
        ))}
      </div>

      <FocusSession />
    </div>
  );
}
