import Link from "next/link";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { ApostilaUploadForm } from "@/components/admin/apostila-upload-form";
import { BatchUploadForm } from "@/components/admin/batch-upload-form";

export const dynamic = "force-dynamic";

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  processed: "Processado",
  chunked: "Chunkado",
  indexing: "Indexando",
  indexed: "Indexado",
  failed: "Falhou",
};

const reviewLabel: Record<string, string> = {
  pendente: "Revisão pendente",
  aprovado: "Aprovado",
  rejeitado: "Rejeitado",
};

export default async function AdminApostilasPage() {
  const docs = await DocumentRepository.listAll(200);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Apostilas</h2>
          <p className="text-sm text-slate-400">Upload, processamento e associação de apostilas.</p>
        </div>
        <Link
          href="/admin/apostilas/revisao"
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-cyan-300 hover:bg-white/10"
        >
          Fila de revisão de material
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ApostilaUploadForm />
        <BatchUploadForm />
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-4 py-3">Título</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Revisão</th>
              <th className="px-4 py-3">Chunks</th>
              <th className="px-4 py-3">Páginas</th>
              <th className="px-4 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {docs.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                  Nenhuma apostila cadastrada.
                </td>
              </tr>
            )}
            {docs.map((d) => (
              <tr key={d.id} className="border-t border-white/5">
                <td className="px-4 py-3 text-slate-200">
                  <Link href={`/admin/apostilas/${d.id}`} className="hover:text-cyan-300">
                    {d.title}
                  </Link>
                  {d.processingError && (
                    <p className="text-xs text-rose-300">{d.processingError}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-400">{d.type}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      d.status === "indexed"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : d.status === "failed"
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-sky-500/15 text-sky-300"
                    }`}
                  >
                    {statusLabel[d.status] ?? d.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs ${
                      d.reviewStatus === "aprovado"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : d.reviewStatus === "rejeitado"
                          ? "bg-rose-500/15 text-rose-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {reviewLabel[d.reviewStatus] ?? d.reviewStatus}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{d.chunkCount}</td>
                <td className="px-4 py-3 text-slate-400">{d.pageCount ?? "—"}</td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/apostilas/${d.id}`}
                    className="text-xs font-medium text-cyan-300 hover:text-cyan-200"
                  >
                    Detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
