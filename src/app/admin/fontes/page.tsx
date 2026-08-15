import { DocumentRepository } from "@/lib/knowledge/repositories/document.repository";
import { FontesList } from "@/components/admin/fontes-list";

export const dynamic = "force-dynamic";

export default async function AdminFontesPage() {
  const docs = await DocumentRepository.listExternalSources(200);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Biblioteca de fontes externas</h2>
        <p className="text-sm text-slate-400">
          De onde veio cada material importado (site da banca, Planalto, diários oficiais etc.)
          com registro de origem/licença para rastreabilidade. Use apenas conteúdo público
          ou autorizado.
        </p>
      </div>
      <FontesList
        fontes={docs.map((d) => {
          const metadata = (d.metadata ?? {}) as Record<string, unknown>;
          return {
            id: d.id,
            title: d.title,
            type: d.type,
            status: d.status,
            reviewStatus: d.reviewStatus,
            sourceType: d.sourceType,
            sourceUrl: d.sourceUrl,
            fonte: (metadata.fonte as string | null) ?? null,
            licenca: (metadata.licenca as string | null) ?? null,
            createdAt: d.createdAt.toISOString(),
          };
        })}
      />
    </div>
  );
}
