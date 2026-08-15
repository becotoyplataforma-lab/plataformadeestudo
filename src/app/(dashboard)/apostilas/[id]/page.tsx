import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/drizzle";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
import { questions } from "@/db/schema/study";

export const metadata: Metadata = { title: "Apostila" };

export default async function ApostilaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const doc = await DocumentRepository.findById(id);
  if (!doc || doc.userId !== session.user.id) notFound();

  const subjects = await DocumentSubjectRepository.listByDocument(id).catch(() => []);
  const relatedQuestions = await db
    .select({ id: questions.id, enunciado: questions.enunciado })
    .from(questions)
    .where(
      and(
        eq(questions.sourceDocumentId, id),
        isNull(questions.deletedAt),
        eq(questions.status, "publicada")
      )
    )
    .limit(10);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/apostilas" className="text-xs text-cyan-300 hover:text-cyan-200">
          ← Apostilas
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-white">{doc.title}</h1>
        <p className="text-sm text-slate-400">
          {doc.type} · {doc.pageCount ? `${doc.pageCount} páginas · ` : ""}
          status: <span className="text-cyan-300">{doc.status}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/professor?document_id=${doc.id}`}
          className="rounded-xl bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-200 ring-1 ring-inset ring-cyan-400/30 hover:bg-cyan-500/25"
        >
          Perguntar ao Professor IA
        </Link>
        <Link
          href="/questoes"
          className="rounded-xl bg-white/5 px-4 py-2 text-sm font-medium text-slate-200 ring-1 ring-inset ring-white/10 hover:bg-white/10"
        >
          Resolver questões
        </Link>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-slate-200">Matérias</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {subjects.length === 0 && <span className="text-sm text-slate-500">Não associada</span>}
          {subjects.map((s) => (
            <span key={s.id} className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200">
              {s.subjectName}
            </span>
          ))}
        </div>
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold text-slate-300">
          Questões relacionadas ({relatedQuestions.length})
        </h2>
        <div className="space-y-2">
          {relatedQuestions.length === 0 && (
            <p className="text-sm text-slate-500">Nenhuma questão publicada para esta apostila.</p>
          )}
          {relatedQuestions.map((q) => (
            <div key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
              {q.enunciado.slice(0, 200)}
              {q.enunciado.length > 200 ? "…" : ""}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
