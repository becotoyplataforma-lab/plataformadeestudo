import { UrlImportForm } from "@/components/admin/url-import-form";

export const dynamic = "force-dynamic";

export default async function AdminImportarPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Importar conteúdo externo</h2>
        <p className="text-sm text-slate-400">
          Use apenas conteúdo público/oficial (editais, leis, diários oficiais, provas anteriores
          das bancas). Não importe apostilas/videoaulas de terceiros sem autorização.
        </p>
      </div>
      <UrlImportForm />
    </div>
  );
}
