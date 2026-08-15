import Link from "next/link";
import { notFound } from "next/navigation";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { DocumentSubjectRepository } from "@/lib/knowledge/repositories/junction.repository";
import { ApostilaActions } from "@/components/admin/apostila-actions";

export const dynamic = "force-dynamic";

export default async function AdminApostilaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const doc = await DocumentRepository.findById(id);
  if (!doc) notFound();

  const subjects = await DocumentSubjectRepository.listByDocument(id).catch(() => []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link href="/admin/apostilas" className="text-xs text-cyan-300 hover:text-cyan-200">
            ← Apostilas
          </Link>
          <h2 className="mt-1 text-2xl font-bold text-white">{doc.title}</h2>
          <p className="text-sm text-slate-400">
            {doc.type} · {doc.fileSize ? `${Math.round(doc.fileSize / 1024)} KB` : "—"} · status{" "}
            <span className="text-cyan-300">{doc.status}</span>
          </p>
        </div>
        <ApostilaActions documentId={doc.id} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Chunks</p>
          <p className="text-xl font-bold text-white">{doc.chunkCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Embeddings</p>
          <p className="text-xl font-bold text-white">{doc.embeddingCount}</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs text-slate-400">Páginas</p>
          <p className="text-xl font-bold text-white">{doc.pageCount ?? "—"}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm font-medium text-slate-200">Matérias associadas</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {subjects.length === 0 && <span className="text-sm text-slate-500">Nenhuma</span>}
          {subjects.map((s) => (
            <span
              key={s.id}
              className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
            >
              {s.subjectName}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href={`/admin/questoes/gerar?document_id=${doc.id}`}
          className="rounded-xl bg-cyan-500/15 px-4 py-2 text-sm font-medium text-cyan-200 ring-1 ring-inset ring-cyan-400/30 hover:bg-cyan-500/25"
        >
          Gerar questões
        </Link>
        <Link
          href={`/admin/questoes/revisao?document_id=${doc.id}`}
          className="rounded-xl bg-amber-500/15 px-4 py-2 text-sm font-medium text-amber-200 ring-1 ring-inset ring-amber-400/30 hover:bg-amber-500/25"
        >
          Revisar questões da apostila
        </Link>
      </div>
    </div>
  );
}
