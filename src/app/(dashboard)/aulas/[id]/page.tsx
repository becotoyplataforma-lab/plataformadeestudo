import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { LessonRepository } from "@/lib/study/repositories/lesson.repository";
import { LessonPlayer } from "@/components/study/lesson-player";

export const metadata: Metadata = { title: "Aula" };

export default async function AulaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const lesson = await LessonRepository.findById(id);
  if (!lesson || (lesson.userId !== null && lesson.userId !== session.user.id)) notFound();

  const progress = await LessonRepository.getProgress(session.user.id, id);
  const sections = Array.isArray(lesson.roteiro) ? (lesson.roteiro as Section[]) : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/aulas" className="text-xs text-cyan-300 hover:text-cyan-200">
          ← Aulas
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-white">{lesson.title}</h1>
        <p className="text-sm text-slate-400">
          {lesson.chapter ? `Capítulo: ${lesson.chapter} · ` : ""}
          {lesson.duracaoMin ? `${lesson.duracaoMin} min` : ""}
        </p>
      </div>

      <LessonPlayer
        lessonId={lesson.id}
        sections={sections}
        initialProgress={progress ? Number(progress.progress) : 0}
        initialSection={progress?.currentSection ?? null}
      />
    </div>
  );
}

interface Section {
  tipo: string;
  titulo: string;
  conteudo: string;
}
