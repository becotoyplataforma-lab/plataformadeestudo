import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
import { ApostilaUpload } from "@/components/apostilas/apostila-upload";
import { ApostilasList, type ApostilaListItem } from "@/components/apostilas/apostilas-list";

export const metadata: Metadata = { title: "Apostilas" };

export default async function ApostilasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const docs = await DocumentRepository.listByUser(session.user.id, 100);
  const links = await DocumentSubjectRepository.listSubjectsByDocuments(
    docs.map((d) => d.id)
  );
  const subjectByDoc = new Map<string, { subjectId: string; subjectName: string }>();
  for (const l of links) {
    if (!subjectByDoc.has(l.documentId)) {
      subjectByDoc.set(l.documentId, { subjectId: l.subjectId, subjectName: l.subjectName });
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
    subjectId: subjectByDoc.get(d.id)?.subjectId,
    subjectName: subjectByDoc.get(d.id)?.subjectName,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Apostilas</h1>
        <p className="text-sm text-slate-400">
          Envie suas apostilas e o ConcursoAI as transforma em conteúdo inteligente. Selecione
          várias da mesma matéria para gerar um resumo consolidado.
        </p>
      </div>

      <ApostilaUpload />

      {docs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center">
          <p className="text-slate-400">Você ainda não tem apostilas.</p>
          <p className="mt-2 text-sm text-slate-500">
            Envie sua apostila e o ConcursoAI a transforma em aulas, questões e revisões.
          </p>
        </div>
      ) : (
        <ApostilasList docs={items} />
      )}
    </div>
  );
}
