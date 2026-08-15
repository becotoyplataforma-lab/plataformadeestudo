import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { LessonRepository } from "@/lib/study/repositories/lesson.repository";

export const metadata: Metadata = { title: "Aulas" };

export default async function AulasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const lessons = await LessonRepository.listForStudent(session.user.id, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Aulas</h1>
        <p className="text-sm text-slate-400">Aulas geradas a partir das apostilas.</p>
      </div>

      {lessons.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-slate-400">Nenhuma aula disponível ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lessons.map((l) => (
            <Link
              key={l.id}
              href={`/aulas/${l.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5"
            >
              <h3 className="text-base font-bold text-white">{l.title}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {l.chapter ? `Capítulo: ${l.chapter} · ` : ""}
                {l.duracaoMin ? `${l.duracaoMin} min` : ""}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
