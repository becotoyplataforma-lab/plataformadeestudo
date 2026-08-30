import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth/auth";
import { db } from "@/lib/db/drizzle";
import { getProfile } from "@/lib/db/repositories/perfil";
import { contests, positions } from "@/db/schema/contest";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
import { ApostilasList, type ApostilaListItem } from "@/components/apostilas/apostilas-list";

export const metadata: Metadata = { title: "Apostilas" };

export default async function ApostilasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const docs = await DocumentRepository.listByUser(session.user.id, 100);
  const links = await DocumentSubjectRepository.listSubjectsByDocuments(
    docs.map((d) => d.id)
  );
  const subjectByDoc = new Map<
    string,
    { subjectId: string; subjectName: string; subjectColor: string | null }
  >();
  for (const l of links) {
    if (!subjectByDoc.has(l.documentId)) {
      subjectByDoc.set(l.documentId, {
        subjectId: l.subjectId,
        subjectName: l.subjectName,
        subjectColor: l.subjectColor,
      });
    }
  }

  const items: ApostilaListItem[] = docs.map((d) => ({
    id: d.id,
    title: d.title,
    type: d.type,
    status: d.status,
    chunkCount: d.chunkCount,
    pageCount: d.pageCount,
    sourceType: d.sourceType,
    reviewStatus: d.reviewStatus,
    isFavorite: d.isFavorite,
    createdAt: d.createdAt.toISOString(),
    subjectId: subjectByDoc.get(d.id)?.subjectId,
    subjectName: subjectByDoc.get(d.id)?.subjectName,
    subjectColor: subjectByDoc.get(d.id)?.subjectColor ?? null,
  }));

  // Concurso/cargo do aluno (mesma fonte do badge "Estudando para" do dashboard).
  const profile = await getProfile(session.user.id);
  const [contestRow] = profile?.contest_id
    ? await db
        .select()
        .from(contests)
        .where(eq(contests.id, profile.contest_id))
        .limit(1)
    : [null];
  const [positionRow] = profile?.position_id
    ? await db
        .select()
        .from(positions)
        .where(eq(positions.id, profile.position_id))
        .limit(1)
    : [null];

  return (
    <div className="space-y-6">
      {/* Cabeçalho com contexto do concurso (padrão "Meus Cursos") */}
      <section className="relative overflow-hidden rounded-[30px] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(77,109,254,0.25),transparent_28%),linear-gradient(135deg,rgba(15,23,42,0.97),rgba(11,18,31,0.9))] p-6 shadow-[0_30px_100px_rgba(2,6,23,0.6)]">
        <div className="absolute -right-10 top-0 h-40 w-40 rounded-full bg-[#4D6BFE]/25 blur-3xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 inline-flex rounded-full border border-[#4D6BFE]/40 bg-[#4D6BFE]/10 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#8fa3ff]">
              Biblioteca
            </p>
            <h1 className="text-3xl font-extrabold tracking-[-0.06em] text-white md:text-4xl">
              Apostilas 📚
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-300">
              Seu material de estudo organizado por concurso. Abra uma apostila para
              estudar com o Professor IA.
            </p>
          </div>

          {contestRow ? (
            <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-2xl border border-[#4D6BFE]/30 bg-[#4D6BFE]/10 px-4 py-2 text-sm">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#8fa3ff]">
                Estudando para
              </span>
              <span className="font-bold text-white">{contestRow.title}</span>
              {positionRow && (
                <>
                  <span className="text-[#8fa3ff]">·</span>
                  <span className="font-semibold text-white">{positionRow.name}</span>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/perfil"
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:border-[#4D6BFE]/40 hover:bg-[#4D6BFE]/10"
            >
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-slate-400">
                Seu foco
              </span>
              <span className="font-semibold text-[#8fa3ff] underline-offset-2 hover:underline">
                Defina seu concurso e cargo
              </span>
            </Link>
          )}
        </div>
      </section>

      {docs.length === 0 ? (
        <div className="rounded-[28px] border border-white/10 bg-white/5 p-12 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-3xl">
            📄
          </div>
          <p className="mt-4 text-lg font-bold text-white">Você ainda não tem apostilas</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            As apostilas são disponibilizadas pela equipe. Estude com o Professor IA e
            gere questões a partir do conteúdo.
          </p>
        </div>
      ) : (
        <ApostilasList docs={items} />
      )}
    </div>
  );
}
