import type { Metadata } from "next";
import { redirect, notFound } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { ApostilaTransformService } from "@/lib/knowledge/services/apostila-transform.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const doc = await DocumentRepository.findById(id).catch(() => null);
  return {
    title: doc ? `${doc.title} — Versão em Fases` : "Apostila em Fases",
    robots: { index: false, follow: false },
  };
}

/**
 * Página de leitura da apostila transformada no layout em fases
 * (tema escuro + marca DeepSeek). Renderiza o HTML salvo em um iframe
 * sandbox para isolamento (a IA gera o HTML).
 */
export default async function ApostilaVisualizarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;
  const doc = await DocumentRepository.findById(id);
  if (!doc || doc.userId !== session.user.id) notFound();

  const html = await ApostilaTransformService.downloadTransformed(id);

  if (!html) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 py-10 text-center">
        <p className="text-slate-300">Esta apostila ainda não foi transformada no layout em fases.</p>
        <p className="text-sm text-slate-500">
          Peça à equipe para transformar ou verifique se o processamento foi concluído.
        </p>
      </div>
    );
  }

  const iframeSrc = `/api/knowledge/documents/${id}/transformado`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-white">{doc.title}</h1>
          <p className="text-sm text-slate-400">
            Versão transformada em fases · marca DeepSeek
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`${iframeSrc}?download=1`}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-cyan-300 hover:bg-white/10"
          >
            Baixar HTML
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/40">
        <iframe
          src={iframeSrc}
          title={`${doc.title} — versão em fases`}
          className="h-[80vh] w-full"
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}
