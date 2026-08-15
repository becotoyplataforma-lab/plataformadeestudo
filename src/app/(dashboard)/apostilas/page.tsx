import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { auth } from "@/lib/auth/auth";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { ApostilaUpload } from "@/components/apostilas/apostila-upload";

export const metadata: Metadata = { title: "Apostilas" };

const statusLabel: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  processed: "Processado",
  chunked: "Conteúdo pronto",
  indexing: "Indexando",
  indexed: "Indexado",
  failed: "Falhou",
};

export default async function ApostilasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const docs = await DocumentRepository.listByUser(session.user.id, 100);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Apostilas</h1>
        <p className="text-sm text-slate-400">
          Envie suas apostilas e o ConcursoAI as transforma em conteúdo inteligente.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Link
              key={d.id}
              href={`/apostilas/${d.id}`}
              className="rounded-2xl border border-white/10 bg-white/5 p-4 transition-transform hover:-translate-y-0.5"
            >
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-slate-300">
                  {d.type}
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    d.status === "indexed" || d.status === "chunked"
                      ? "bg-emerald-500/15 text-emerald-300"
                      : d.status === "failed"
                        ? "bg-rose-500/15 text-rose-300"
                        : "bg-sky-500/15 text-sky-300"
                  }`}
                >
                  {statusLabel[d.status] ?? d.status}
                </span>
              </div>
              <h3 className="mt-3 text-base font-bold text-white">{d.title}</h3>
              <p className="mt-1 text-xs text-slate-400">
                {d.pageCount ? `${d.pageCount} páginas · ` : ""}
                {d.chunkCount} trechos
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
